import { ipcMain, app } from 'electron';
import { IPC_CHANNELS } from '@afe/shared';
import bcrypt from 'bcryptjs';

// Backend services
import {
    createStudent,
    getAllStudents,
    getStudentById,
    updateStudentLastActive,
    updateStudentLanguage,
    generateUniqueUsername,
    updateVideoProgress,
    getVideoProgress,
    getAllVideoProgressForStudent,
    submitQuizAttempt,
    getQuizAttempts,
    getBestQuizScore,
    markModuleStarted,
    getStartedModules,
    updateReadingProgress,
    getReadingProgress,
    getAllReadingProgressForStudent,
} from '@backend/db';
import { trackEvent, getAnalyticsSummary } from '@backend/analytics';
import {
    sendMessage,
    sendVoiceMessage,
    getSessions,
    createSession,
    deleteSession,
    getSessionHistory,
    clearChatHistory
} from '@backend/ai-tutor';
import {
    loadContentManifest,
    getModuleById,
    getLessonById,
    getCourseId,
    getCanonicalCourseTitle,
    getCourseMetadata,
    getSiblingLessonIds,
    getSiblingModuleIds,
} from '@backend/content-engine';

import {
    pushAudioChunk,
    processAudio,
    resetAudio
} from "@backend/stt-engine";

import {
    speak as ttsSpeak,
    stop as ttsStop,
    isAvailable as ttsIsAvailable
} from "@backend/tts-engine";
// Content manifest (loaded once)
let contentManifest: ReturnType<typeof loadContentManifest> | null = null;

import path from 'path';
import fs from 'fs';
import { PATHS, APP_DATA_ROOT } from '../main/paths.js';
import { getMp4Duration } from '../main/mp4-parser.js';
import { getMkvDuration } from '../main/mkv-parser.js';
import { SessionManager } from '../main/session-manager.js';
import { writeConfig } from '../main/device-info.js';

// Admin password hash (bcrypt, 10 rounds) — raw password is never stored
const ADMIN_PWD_HASH = '$2b$10$TnoAwkgzB/PuqDdXW50v4.552E/D/uudKE8OVxiGj5V1LXQC13Koa';

const LANG_CODE_TO_NAME: Record<string, string> = {
    en: 'English',
    hi: 'Hindi',
    ta: 'Tamil',
    te: 'Telugu',
    mr: 'Marathi',
    gu: 'Gujarati',
    kn: 'Kannada',
};

function getManifest() {
    if (!contentManifest) {
        contentManifest = loadContentManifest(APP_DATA_ROOT);
        console.log('Manifest loaded from:', APP_DATA_ROOT);

        // Dynamically compute module durations from videos
        if (contentManifest && contentManifest.modules) {
            for (const module of contentManifest.modules) {
                let totalSeconds = 0;
                for (const lesson of module.lessons) {
                    if (lesson.type === 'video' && (lesson as any).videoUrl) {
                        try {
                            let absolutePath = path.join(PATHS.ROOT, (lesson as any).videoUrl);
                            
                            // Development fallback: check installer-assets if it's missing in dev-data
                            if (!fs.existsSync(absolutePath) && !app.isPackaged) {
                                absolutePath = path.join(app.getAppPath(), '../../installer-assets', (lesson as any).videoUrl);
                            }

                            if (fs.existsSync(absolutePath)) {
                                const ext = path.extname(absolutePath).toLowerCase();
                                const dur = (ext === '.mkv' || ext === '.webm') ? getMkvDuration(absolutePath) : getMp4Duration(absolutePath);
                                (lesson as any).durationSeconds = dur;
                                totalSeconds += dur;
                            } else {
                                console.warn(`Missing video file for duration parsing: ${absolutePath}`);
                            }
                        } catch (err) {
                            console.error(`Failed to get duration for ${lesson.id}:`, err);
                        }
                    }
                }
                if (totalSeconds > 0) {
                    (module as any).durationMinutes = Math.round(totalSeconds / 60);
                }
            }
        }
    }
    return contentManifest;
}

let sttInterval: NodeJS.Timeout | null = null;
let isRecording = false;

/**
 * Register all IPC handlers
 * Each handler maps to a backend service function
 */
export function registerIPCHandlers() {
    // ========== Student Operations ==========

    ipcMain.handle(IPC_CHANNELS.STUDENT_CREATE, async (_event, data) => {
        const { name, avatar, grade, language } = data;
        const normalizedLang = LANG_CODE_TO_NAME[language] || language || 'English';
        return await createStudent(name, avatar, grade, normalizedLang);
    });

    ipcMain.handle(IPC_CHANNELS.STUDENT_GET_ALL, async () => {
        return await getAllStudents();
    });

    ipcMain.handle(IPC_CHANNELS.STUDENT_GET_BY_ID, async (_event, data) => {
        const { studentId } = data;
        return await getStudentById(studentId);
    });

    ipcMain.handle(IPC_CHANNELS.STUDENT_UPDATE_LAST_ACTIVE, async (_event, data) => {
        const { studentId } = data;
        await updateStudentLastActive(studentId);
    });

    ipcMain.handle(IPC_CHANNELS.STUDENT_GENERATE_USERNAME, async (_event, data) => {
        const { avatarName } = data;
        return await generateUniqueUsername(avatarName);
    });

    // ========== Content Operations ==========

    ipcMain.handle(IPC_CHANNELS.CONTENT_GET_MODULES, async () => {
        const manifest = getManifest();
        return manifest.modules;
    });

    ipcMain.handle(IPC_CHANNELS.CONTENT_GET_MODULE_BY_ID, async (_event, data) => {
        const { moduleId } = data;
        const manifest = getManifest();
        return getModuleById(manifest, moduleId);
    });

    ipcMain.handle(IPC_CHANNELS.CONTENT_GET_LESSON_BY_ID, async (_event, data) => {
        const { lessonId } = data;
        const manifest = getManifest();
        return getLessonById(manifest, lessonId);
    });

    ipcMain.handle(IPC_CHANNELS.CONTENT_GET_VIDEO_METADATA, async (_event, data) => {
        const { videoUrl } = data;
        try {
            const absolutePath = path.join(PATHS.ROOT, videoUrl);
            if (!fs.existsSync(absolutePath)) {
                return null;
            }
            const ext = path.extname(absolutePath).toLowerCase();
            const duration = (ext === '.mkv' || ext === '.webm') ? getMkvDuration(absolutePath) : getMp4Duration(absolutePath);
            const stats = fs.statSync(absolutePath);
            return {
                duration,
                size: stats.size
            };
        } catch (error) {
            console.error('[IPC] Failed to get video metadata:', error);
            return null;
        }
    });

    // ========== Progress Tracking ==========

    ipcMain.handle(IPC_CHANNELS.PROGRESS_UPDATE_VIDEO, async (_event, data) => {
        const { studentId, lessonId, watchedPercentage, watchDuration, watchedSegments, lastPosition, completed } = data;
        
        const manifest = getManifest();
        const lesson = getLessonById(manifest, lessonId);
        const courseId = getCourseId(lesson?.moduleId || lessonId);

        // Track watch duration in session under canonical course
        SessionManager.recordWatchDuration(watchDuration, courseId);

        await updateVideoProgress(
            studentId,
            lessonId,
            watchedPercentage,
            watchDuration,
            watchedSegments,
            lastPosition,
            completed
        );

        // Track analytics event
        await trackEvent(studentId, 'video_watched', {
            lessonId,
            moduleId: lesson?.moduleId,
            courseId,
            watchDuration,
            watchedPercentage,
            lastPosition,
            completed,
        });
    });

    ipcMain.handle(IPC_CHANNELS.PROGRESS_GET_VIDEO, async (_event, data) => {
        const { studentId, lessonId } = data;
        const manifest = getManifest();
        const siblingIds = getSiblingLessonIds(manifest, lessonId);

        const allProgress = await getAllVideoProgressForStudent(studentId);
        const matching = allProgress.filter((p) => siblingIds.includes(p.lessonId));
        if (matching.length === 0) return null;

        // Choose best progress across siblings
        matching.sort((a, b) => {
            const aComp = a.completed || (a.watchedPercentage || 0) >= 95;
            const bComp = b.completed || (b.watchedPercentage || 0) >= 95;
            if (aComp !== bComp) return (bComp ? 1 : 0) - (aComp ? 1 : 0);
            if ((a.watchedPercentage || 0) !== (b.watchedPercentage || 0)) {
                return (b.watchedPercentage || 0) - (a.watchedPercentage || 0);
            }
            return (b.totalWatchDuration || 0) - (a.totalWatchDuration || 0);
        });

        return {
            ...matching[0],
            lessonId, // Normalize for requested lesson
        };
    });

    ipcMain.handle(IPC_CHANNELS.PROGRESS_GET_ALL_FOR_STUDENT, async (_event, data) => {
        const { studentId } = data;
        const rawProgressList = await getAllVideoProgressForStudent(studentId);
        const manifest = getManifest();

        // Expand recorded progress across all sibling lesson IDs for seamless multilingual progress
        const progressByLessonId = new Map<string, (typeof rawProgressList)[0]>();

        for (const prog of rawProgressList) {
            const siblings = getSiblingLessonIds(manifest, prog.lessonId);
            for (const sId of siblings) {
                const existing = progressByLessonId.get(sId);
                if (!existing) {
                    progressByLessonId.set(sId, { ...prog, lessonId: sId });
                } else {
                    const isCompleted = existing.completed || prog.completed || (prog.watchedPercentage || 0) >= 95 || (existing.watchedPercentage || 0) >= 95;
                    const maxWatchedPercentage = Math.max(existing.watchedPercentage || 0, prog.watchedPercentage || 0);
                    const maxDuration = Math.max(existing.totalWatchDuration || 0, prog.totalWatchDuration || 0);
                    const useLatest = (prog.lastWatchedAt || '') >= (existing.lastWatchedAt || '');

                    progressByLessonId.set(sId, {
                        ...existing,
                        completed: isCompleted,
                        watchedPercentage: maxWatchedPercentage,
                        totalWatchDuration: maxDuration,
                        lastPosition: useLatest ? prog.lastPosition : existing.lastPosition,
                        lastWatchedAt: useLatest ? prog.lastWatchedAt : existing.lastWatchedAt,
                        lessonId: sId,
                    });
                }
            }
        }

        return Array.from(progressByLessonId.values());
    });

    ipcMain.handle(IPC_CHANNELS.PROGRESS_MARK_MODULE_STARTED, async (_event, data) => {
        const { studentId, moduleId } = data;
        const courseId = getCourseId(moduleId);
        SessionManager.setActiveModule(courseId);
        await markModuleStarted(studentId, moduleId);

        // Track analytics
        await trackEvent(studentId, 'module_started', {
            moduleId,
            courseId,
        });
    });

    ipcMain.handle(IPC_CHANNELS.PROGRESS_GET_STARTED_MODULES, async (_event, data) => {
        const { studentId } = data;
        const rawStartedList = await getStartedModules(studentId);
        const manifest = getManifest();

        const startedModuleIds = new Set<string>();
        for (const sm of rawStartedList) {
            const siblings = getSiblingModuleIds(manifest, sm.moduleId);
            for (const sId of siblings) {
                startedModuleIds.add(sId);
            }
        }

        return Array.from(startedModuleIds).map((moduleId) => ({
            id: `started_${studentId}_${moduleId}`,
            studentId,
            moduleId,
            startedAt: rawStartedList[0]?.startedAt || new Date().toISOString(),
        }));
    });

    ipcMain.handle(IPC_CHANNELS.PROGRESS_UPDATE_READING, async (_event, data) => {
        const { studentId, lessonId, readPercentage, readDuration, currentPage } = data;
        console.log(`[IPC] Updating reading progress: Student=${studentId}, Lesson=${lessonId}, Duration=+${readDuration}s`);
        await updateReadingProgress(studentId, lessonId, readPercentage, readDuration, currentPage);

        // Track analytics event
        await trackEvent(studentId, 'pdf_read', {
            lessonId,
            readDuration,
        });
    });

    ipcMain.handle(IPC_CHANNELS.PROGRESS_GET_READING, async (_event, data) => {
        const { studentId, lessonId } = data;
        return await getReadingProgress(studentId, lessonId);
    });

    ipcMain.handle(IPC_CHANNELS.PROGRESS_GET_ALL_READING, async (_event, data) => {
        const { studentId } = data;
        return await getAllReadingProgressForStudent(studentId);
    });

    // ========== Quiz Operations ==========

    ipcMain.handle(IPC_CHANNELS.QUIZ_SUBMIT_ATTEMPT, async (_event, data) => {
        const { studentId, lessonId, answers, timeTaken } = data;

        // Get lesson data to validate answers
        const manifest = getManifest();
        const lesson = getLessonById(manifest, lessonId);

        if (!lesson || !lesson.quizData) {
            throw new Error('Quiz not found');
        }

        // Calculate score
        const gradedAnswers = answers.map((answer: any) => {
            const question = lesson.quizData!.questions.find((q: any) => (q as any).id === answer.questionId);
            const isCorrect = question ? (question as any).correctAnswerIndex === answer.selectedAnswerIndex : false;

            return {
                ...answer,
                isCorrect,
            };
        });

        const score = gradedAnswers.filter((a: any) => a.isCorrect).length;
        const totalQuestions = lesson.quizData.questions.length;

        // Submit attempt
        const attempt = await submitQuizAttempt(
            studentId,
            lessonId,
            score,
            totalQuestions,
            gradedAnswers,
            timeTaken
        );

        // Track analytics
        await trackEvent(studentId, 'quiz_completed', {
            lessonId,
            score,
            totalQuestions,
            percentage: (score / totalQuestions) * 100,
        });

        return attempt;
    });

    ipcMain.handle(IPC_CHANNELS.QUIZ_GET_ATTEMPTS, async (_event, data) => {
        const { studentId, lessonId } = data;
        const manifest = getManifest();
        const siblingIds = getSiblingLessonIds(manifest, lessonId);

        let allAttempts: any[] = [];
        for (const sId of siblingIds) {
            const attempts = await getQuizAttempts(studentId, sId);
            allAttempts = allAttempts.concat(attempts);
        }
        allAttempts.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
        return allAttempts;
    });

    ipcMain.handle(IPC_CHANNELS.QUIZ_GET_BEST_SCORE, async (_event, data) => {
        const { studentId, lessonId } = data;
        const manifest = getManifest();
        const siblingIds = getSiblingLessonIds(manifest, lessonId);

        let bestScore: number | null = null;
        for (const sId of siblingIds) {
            const score = await getBestQuizScore(studentId, sId);
            if (score !== null && score !== undefined) {
                if (bestScore === null || score > bestScore) {
                    bestScore = score;
                }
            }
        }
        return bestScore;
    });

    // ========== Analytics ==========

    ipcMain.handle(IPC_CHANNELS.ANALYTICS_TRACK_EVENT, async (_event, data) => {
        const { studentId, eventType, metadata } = data;
        await trackEvent(studentId, eventType as any, metadata);
    });

    ipcMain.handle(IPC_CHANNELS.ANALYTICS_GET_SUMMARY, async (_event, data) => {
        const { studentId } = data;
        return await getAnalyticsSummary(studentId);
    });

    // ========== Session Tracking ==========

    ipcMain.handle('session:start', async (_event, data) => {
        const { studentId, language } = data || {};
        const normalizedLang = LANG_CODE_TO_NAME[language] || language || 'English';
        SessionManager.startSession(studentId, normalizedLang);
    });

    ipcMain.handle('session:end', async (_event, data) => {
        const { csat, itp, overallRating, exploreCareerRating, seeMoreToursRating } = data || {};
        await SessionManager.endSession(csat ?? null, itp ?? null, overallRating ?? null, exploreCareerRating ?? null, seeMoreToursRating ?? null);
    });

    ipcMain.handle('session:pause', async (_event, data) => {
        const { lessonId, moduleId } = data || {};
        const courseId = getCourseId(moduleId || lessonId);
        SessionManager.recordPause(courseId);
    });

    ipcMain.handle('session:seek', async (_event, data) => {
        const { lessonId, moduleId } = data || {};
        const courseId = getCourseId(moduleId || lessonId);
        SessionManager.recordSeek(courseId);
    });

    ipcMain.handle('session:speed', async (_event, data) => {
        const { speed, lessonId, moduleId } = data || {};
        const courseId = getCourseId(moduleId || lessonId);
        SessionManager.recordPlaybackSpeed(speed, courseId);
    });



    ipcMain.handle('session:updateLanguage', async (_event, data) => {
        const { language } = data || {};
        const normalizedLang = LANG_CODE_TO_NAME[language] || language || 'English';
        SessionManager.updateLanguage(normalizedLang);
        const activeStudentId = SessionManager.getActiveStudentId();
        if (activeStudentId) {
            await updateStudentLanguage(activeStudentId, normalizedLang);
        }
    });

    ipcMain.handle('session:getLanguage', async () => {
        return SessionManager.getLanguage();
    });

    ipcMain.handle('session:hasMetEngagementThreshold', async () => {
        return SessionManager.hasMetEngagementThreshold();
    });

    // ========== App Lifecycle ==========
    ipcMain.handle('app:exit-immediately', async () => {
        (global as any).isQuitting = true;
        app.quit();
    });

    ipcMain.handle('app:set-close-on-session-end', async () => {
        SessionManager.closeOnSessionEnd = true;
    });

    // ========== AI Tutor ==========
    const aiCancelFlags = new Map<string, boolean>();

    ipcMain.handle(IPC_CHANNELS.AI_SEND_MESSAGE, async (event, data) => {
        const { studentId, message, sessionId, requestId } = data;
        console.log('DEBUG: IPC AI_SEND_MESSAGE received:', { studentId, sessionId });

        aiCancelFlags.set(requestId, false);

        const result = await sendMessage(
            studentId,
            message,
            sessionId,
            () => aiCancelFlags.get(requestId) === true,
            (chunk) => {
                event.sender.send(IPC_CHANNELS.AI_STREAM_CHUNK, { chunk });
            },
            (title) => {
                event.sender.send(IPC_CHANNELS.AI_SESSION_UPDATED, { sessionId, title });
            }
        );
        aiCancelFlags.delete(requestId);
        return result;
    });

    ipcMain.handle(IPC_CHANNELS.AI_CANCEL_MESSAGE, async (_event, data) => {
        const { requestId } = data;
        if (!requestId) return { cancelled: false };
        aiCancelFlags.set(requestId, true);
        return { cancelled: true };
    });

    ipcMain.handle(IPC_CHANNELS.AI_SESSION_GET_ALL, async (_event, data) => {
        const { studentId } = data;
        return await getSessions(studentId);
    });

    ipcMain.handle(IPC_CHANNELS.AI_SESSION_CREATE, async (_event, data) => {
        const { studentId, title, mode, moduleId } = data;
        return await createSession(studentId, title, mode, moduleId);
    });

    ipcMain.handle(IPC_CHANNELS.AI_SESSION_DELETE, async (_event, data) => {
        const { sessionId } = data;
        await deleteSession(sessionId);
    });

    ipcMain.handle(IPC_CHANNELS.AI_GET_SESSION_HISTORY, async (_event, data) => {
        const { sessionId } = data;
        return await getSessionHistory(sessionId);
    });

    ipcMain.handle(IPC_CHANNELS.AI_CLEAR_HISTORY, async (_event, data) => {
        const { studentId } = data;
        await clearChatHistory(studentId);
    });


    // ========== Voice Pipeline (Near RT STS) ==========

    /**
     * Strip markdown formatting from text before sending to TTS.
     * Piper speaks asterisks and hashes literally, which sounds terrible.
     */
    function stripMarkdownForTTS(text: string): string {
        return text
            .replace(/\*\*([^*]*)\*\*/g, '$1')   // **bold** → bold
            .replace(/\*([^*]*)\*/g, '$1')         // *italic* → italic
            .replace(/^\s*\d+[.)]\s+/gm, '')       // 1. or 1) list → remove
            .replace(/^\s*[-*•]\s+/gm, '')          // - bullet → remove
            .replace(/#{1,6}\s+/g, '')              // ## heading → remove
            .replace(/`([^`]*)`/g, '$1')            // `code` → code
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url) → text
            .replace(/\s+/g, ' ')
            .trim();
    }

    ipcMain.handle(IPC_CHANNELS.AI_VOICE_MESSAGE, async (event, data) => {
        const { studentId, message, sessionId } = data;
        console.log('DEBUG: IPC AI_VOICE_MESSAGE received:', { studentId, sessionId });

        // Sequential TTS queue: synthesize ONE sentence at a time to avoid
        // resource contention (each Piper loads the 63MB ONNX model).
        // Playback of sentence N overlaps with synthesis of sentence N+1.
        let sentenceIndex = 0;
        const ttsPromiseChain: Promise<void>[] = [];
        let previousPromise: Promise<void> = Promise.resolve();

        const response = await sendVoiceMessage(
            studentId,
            message,
            sessionId,
            (rawSentence) => {
                const idx = sentenceIndex++;
                // Strip markdown BEFORE sending to Piper
                const sentence = stripMarkdownForTTS(rawSentence);
                if (!sentence) return; // Skip empty sentences after stripping

                console.log(`[Voice] Sentence ${idx}: "${sentence.substring(0, 50)}"`);

                // Chain: start Piper only AFTER previous sentence's audio is sent.
                // This means only one Piper process at a time → no resource contention.
                // Sentence N's playback (in renderer) overlaps N+1's synthesis here.
                const waitForPrevious = previousPromise;
                const orderedSend = waitForPrevious.then(async () => {
                    try {
                        const audioBuffer = await ttsSpeak(sentence);
                        if (audioBuffer) {
                            const base64 = audioBuffer.toString('base64');
                            event.sender.send(IPC_CHANNELS.TTS_SENTENCE_READY, {
                                audio: base64,
                                index: idx,
                                text: sentence,
                            });
                        }
                    } catch (err) {
                        console.error(`[Voice] TTS failed for sentence ${idx}:`, err);
                    }
                });

                previousPromise = orderedSend;
                ttsPromiseChain.push(orderedSend);
            },
            (chunk) => {
                event.sender.send(IPC_CHANNELS.AI_STREAM_CHUNK, { chunk });
            },
            (title) => {
                event.sender.send(IPC_CHANNELS.AI_SESSION_UPDATED, { sessionId, title });
            }
        );

        // Wait for all TTS synthesis/sends to complete before signaling done
        await Promise.all(ttsPromiseChain);
        event.sender.send(IPC_CHANNELS.AI_VOICE_DONE, {});

        return { response };
    });



    // ===============================
    // STT (Speech-To-Text) Handlers
    // ===============================

    // ---------- STT START ------- ---
    ipcMain.on(IPC_CHANNELS.STT_START, () => {
        if (isRecording) {
            console.warn('[IPC] STT_START ignored (already recording)');
            return;
        }

        console.log('[IPC] STT_START received');
        resetAudio();
        isRecording = true;
    });


    // ---------- STT CHUNK ----------
    ipcMain.on(IPC_CHANNELS.STT_CHUNK, (_event, chunk: ArrayBuffer) => {
        if (!isRecording) {
            console.warn('[IPC] STT_CHUNK ignored (not recording)');
            return;
        }

        if (!chunk) {
            console.warn('[IPC] STT_CHUNK received empty chunk');
            return;
        }

        try {
            pushAudioChunk(Buffer.from(chunk));
        } catch (error) {
            console.error('[IPC] Error pushing audio chunk:', error);
        }
    });


    // ---------- STT STOP ----------
    ipcMain.on(IPC_CHANNELS.STT_STOP, async (event) => {
        if (!isRecording) {
            console.warn('[IPC] STT_STOP ignored (not recording)');
            return;
        }

        console.log('[IPC] STT_STOP received');
        isRecording = false;

        try {
            // Prevent blocking event loop starvation
            const result = await processAudio();

            resetAudio();

            if (result && result.trim().length > 0) {
                console.log('[IPC] Sending STT_FINAL result');
                event.reply(IPC_CHANNELS.STT_FINAL, result.trim());
            } else {
                console.log('[IPC] No transcript generated');
                event.reply(IPC_CHANNELS.STT_FINAL, '');
            }

        } catch (error) {
            console.error('[IPC] STT processing failed:', error);
            event.reply(IPC_CHANNELS.STT_FINAL, '');
            resetAudio();
        }
    });



    // ===============================
    // TTS (Text-To-Speech) Handlers
    // ===============================

    ipcMain.handle(IPC_CHANNELS.TTS_SPEAK, async (_event, data) => {
        const { text } = data;
        console.log('[IPC] TTS_SPEAK received:', text?.substring(0, 50));
        try {
            const audioBuffer = await ttsSpeak(text);
            if (audioBuffer) {
                // Convert Node Buffer to base64 string for reliable IPC transfer
                // (raw ArrayBuffer gets corrupted during Electron's structured clone across context bridge)
                const base64 = audioBuffer.toString('base64');
                return { audio: base64, fallback: false };
            }
            return { audio: null, fallback: true };
        } catch (error) {
            console.error('[IPC] TTS_SPEAK error:', error);
            return { audio: null, fallback: true };
        }
    });

    ipcMain.handle(IPC_CHANNELS.TTS_STOP, async () => {
        console.log('[IPC] TTS_STOP received');
        ttsStop();
    });

    ipcMain.handle(IPC_CHANNELS.TTS_STATUS, async () => {
        return { available: ttsIsAvailable() };
    });


    // ========== Config / School Setup ==========

    ipcMain.handle(IPC_CHANNELS.CONFIG_GET_SETUP_STATUS, async () => {
        try {
            const configPath = app.isPackaged
                ? path.join(app.getPath('appData'), 'OfflineLearningApp', 'config.json')
                : path.join(process.cwd(), '../dev-data/config.json');

            let config: any = {};
            if (fs.existsSync(configPath)) {
                try {
                    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                } catch (e) {}
            }

            return {
                setupCompleted: config.setupCompleted === true,
                schoolName: config.schoolName || '',
                schoolUdise: config.schoolUdise || '',
                state: config.state || '',
                city: config.city || '',
                district: config.district || '',
                districtCode: config.districtCode || '',
                schoolType: config.schoolType || 'NGO',
            };
        } catch (error) {
            console.error('[IPC] Failed to get setup status:', error);
            return {
                setupCompleted: false,
                schoolName: '',
                schoolUdise: '',
                state: '',
                city: '',
                district: '',
                districtCode: '',
                schoolType: 'NGO',
            };
        }
    });

    ipcMain.handle(IPC_CHANNELS.CONFIG_SAVE_SCHOOL_DETAILS, async (_event, data) => {
        try {
            const { schoolName, schoolUdise, state, city, district, districtCode, schoolType } = data;
            writeConfig({
                schoolName,
                schoolUdise,
                state,
                city,
                district,
                districtCode,
                schoolType,
                setupCompleted: true,
            });
            console.log('[IPC] School details saved successfully');
            return { success: true };
        } catch (error) {
            console.error('[IPC] Failed to save school details:', error);
            return { success: false };
        }
    });

    ipcMain.handle(IPC_CHANNELS.CONFIG_VERIFY_ADMIN_PASSWORD, async (_event, data) => {
        try {
            const { password } = data;
            const valid = await bcrypt.compare(password, ADMIN_PWD_HASH);
            return { valid };
        } catch (error) {
            console.error('[IPC] Failed to verify admin password:', error);
            return { valid: false };
        }
    });

    console.log('✓ All IPC handlers registered');
}

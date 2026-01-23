import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@afe/shared';

// Backend services
import {
    createStudent,
    getAllStudents,
    getStudentById,
    updateStudentLastActive,
    updateVideoProgress,
    getVideoProgress,
    getAllVideoProgressForStudent,
    submitQuizAttempt,
    getQuizAttempts,
    getBestQuizScore,
    markModuleStarted,
    getStartedModules,
} from '@backend/db';
import { trackEvent, getAnalyticsSummary } from '@backend/analytics';
import {
    sendMessage,
    getSessions,
    createSession,
    deleteSession,
    getSessionHistory,
    clearChatHistory
} from '@backend/ai-tutor';
import { loadContentManifest, getModuleById, getLessonById } from '@backend/content-engine';

// Content manifest (loaded once)
let contentManifest: ReturnType<typeof loadContentManifest> | null = null;

import { APP_DATA_ROOT } from '../main/paths.js';

function getManifest() {
    if (!contentManifest) {
        contentManifest = loadContentManifest(APP_DATA_ROOT);
        console.log('Manifest loaded from:', APP_DATA_ROOT);
    }
    return contentManifest;
}

/**
 * Register all IPC handlers
 * Each handler maps to a backend service function
 */
export function registerIPCHandlers() {
    // ========== Student Operations ==========

    ipcMain.handle(IPC_CHANNELS.STUDENT_CREATE, async (_event, data) => {
        const { name, avatar } = data;
        return await createStudent(name, avatar);
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

    // ========== Progress Tracking ==========

    ipcMain.handle(IPC_CHANNELS.PROGRESS_UPDATE_VIDEO, async (_event, data) => {
        const { studentId, lessonId, watchedPercentage, watchDuration } = data;
        await updateVideoProgress(studentId, lessonId, watchedPercentage, watchDuration);

        // Track analytics event
        await trackEvent(studentId, 'video_watched', {
            lessonId,
            watchDuration,
        });
    });

    ipcMain.handle(IPC_CHANNELS.PROGRESS_GET_VIDEO, async (_event, data) => {
        const { studentId, lessonId } = data;
        return await getVideoProgress(studentId, lessonId);
    });

    ipcMain.handle(IPC_CHANNELS.PROGRESS_GET_ALL_FOR_STUDENT, async (_event, data) => {
        const { studentId } = data;
        return await getAllVideoProgressForStudent(studentId);
    });

    ipcMain.handle(IPC_CHANNELS.PROGRESS_MARK_MODULE_STARTED, async (_event, data) => {
        const { studentId, moduleId } = data;
        await markModuleStarted(studentId, moduleId);

        // Track analytics
        await trackEvent(studentId, 'module_started', {
            moduleId,
        });
    });

    ipcMain.handle(IPC_CHANNELS.PROGRESS_GET_STARTED_MODULES, async (_event, data) => {
        const { studentId } = data;
        return await getStartedModules(studentId);
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
        return await getQuizAttempts(studentId, lessonId);
    });

    ipcMain.handle(IPC_CHANNELS.QUIZ_GET_BEST_SCORE, async (_event, data) => {
        const { studentId, lessonId } = data;
        return await getBestQuizScore(studentId, lessonId);
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

    // ========== AI Tutor ==========
    ipcMain.handle(IPC_CHANNELS.AI_SEND_MESSAGE, async (event, data) => {
        const { studentId, message, sessionId } = data;
        console.log('DEBUG: IPC AI_SEND_MESSAGE received:', { studentId, sessionId });

        const response = await sendMessage(
            studentId,
            message,
            sessionId,
            (chunk) => {
                event.sender.send(IPC_CHANNELS.AI_STREAM_CHUNK, { chunk });
            },
            (title) => {
                event.sender.send(IPC_CHANNELS.AI_SESSION_UPDATED, { sessionId, title });
            }
        );
        return { response };
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

    console.log('✓ All IPC handlers registered');
}

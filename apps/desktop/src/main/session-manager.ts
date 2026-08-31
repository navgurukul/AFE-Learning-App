import { getDeviceInfo } from './device-info.js';
import {
    getDatabase,
    saveAFESessions,
    getSessionCountForDate,
    getStudentById,
    videoProgress,
    lessons,
    quizAttempts,
    modules,
    type NewAFESession
} from '@backend/db';
import {
    loadContentManifest,
    getCourseId,
    getCourseMetadata,
    getCanonicalCourseTitle,
    type ContentManifest
} from '@backend/content-engine';
import { PATHS } from './paths.js';
import { eq, and, sql } from 'drizzle-orm';
import { app } from 'electron';

export interface CourseSessionMetrics {
    courseId: string;
    watchTimeSeconds: number;
    pauseCount: number;
    seekCount: number;
    playbackSpeeds: number[];
}

export interface ActiveSession {
    studentId: string;
    startTime: Date;
    language: string;
    activeCourseId: string | null;
    courses: Map<string, CourseSessionMetrics>;
    globalPauseCount: number;
    globalSeekCount: number;
    globalPlaybackSpeeds: number[];
    globalWatchTimeSeconds: number;
}

export class SessionManager {
    private static activeSession: ActiveSession | null = null;
    public static closeOnSessionEnd = false;
    private static cachedManifest: ContentManifest | null = null;

    private static getManifest(): ContentManifest {
        if (!this.cachedManifest) {
            this.cachedManifest = loadContentManifest(PATHS.ROOT);
        }
        return this.cachedManifest;
    }

    /**
     * Helper to get or initialize per-course metrics in the active session
     */
    private static getOrInitCourseMetrics(moduleIdOrCourseId: string): CourseSessionMetrics | null {
        if (!this.activeSession) return null;
        const courseId = getCourseId(moduleIdOrCourseId);
        let metrics = this.activeSession.courses.get(courseId);
        if (!metrics) {
            metrics = {
                courseId,
                watchTimeSeconds: 0,
                pauseCount: 0,
                seekCount: 0,
                playbackSpeeds: []
            };
            this.activeSession.courses.set(courseId, metrics);
        }
        return metrics;
    }

    /**
     * Start a new session for a student
     */
    static startSession(studentId: string, language: string = 'English'): void {
        // If there's an active session already, end it first to prevent orphans
        if (this.activeSession) {
            console.log(`[SessionManager] Ending orphaned session for student ${this.activeSession.studentId}`);
            this.endSession(null, null);
        }

        this.activeSession = {
            studentId,
            startTime: new Date(),
            language,
            activeCourseId: null,
            courses: new Map(),
            globalPauseCount: 0,
            globalSeekCount: 0,
            globalPlaybackSpeeds: [],
            globalWatchTimeSeconds: 0
        };
        console.log(`[SessionManager] Started session for student ${studentId} with language ${language}`);
    }

    /**
     * Set the currently active course the student is viewing
     */
    static setActiveModule(moduleIdOrCourseId: string): void {
        if (this.activeSession && moduleIdOrCourseId) {
            const courseId = getCourseId(moduleIdOrCourseId);
            this.activeSession.activeCourseId = courseId;
            this.getOrInitCourseMetrics(courseId);
            console.log(`[SessionManager] Set active course: ${courseId}`);
        }
    }

    /**
     * Record a video pause event
     */
    static recordPause(moduleIdOrCourseId?: string): void {
        if (this.activeSession) {
            this.activeSession.globalPauseCount++;
            const targetCourseId = moduleIdOrCourseId ? getCourseId(moduleIdOrCourseId) : this.activeSession.activeCourseId;
            if (targetCourseId) {
                const mod = this.getOrInitCourseMetrics(targetCourseId);
                if (mod) mod.pauseCount++;
            }
        }
    }

    /**
     * Record a video seek event
     */
    static recordSeek(moduleIdOrCourseId?: string): void {
        if (this.activeSession) {
            this.activeSession.globalSeekCount++;
            const targetCourseId = moduleIdOrCourseId ? getCourseId(moduleIdOrCourseId) : this.activeSession.activeCourseId;
            if (targetCourseId) {
                const mod = this.getOrInitCourseMetrics(targetCourseId);
                if (mod) mod.seekCount++;
            }
        }
    }

    /**
     * Record a playback speed change
     */
    static recordPlaybackSpeed(speed: number, moduleIdOrCourseId?: string): void {
        if (this.activeSession) {
            this.activeSession.globalPlaybackSpeeds.push(speed);
            const targetCourseId = moduleIdOrCourseId ? getCourseId(moduleIdOrCourseId) : this.activeSession.activeCourseId;
            if (targetCourseId) {
                const mod = this.getOrInitCourseMetrics(targetCourseId);
                if (mod) mod.playbackSpeeds.push(speed);
            }
        }
    }

    /**
     * Record watch duration (called when player saves progress)
     */
    static recordWatchDuration(durationSeconds: number, moduleIdOrCourseId?: string): void {
        if (this.activeSession) {
            this.activeSession.globalWatchTimeSeconds += durationSeconds;
            const targetCourseId = moduleIdOrCourseId ? getCourseId(moduleIdOrCourseId) : this.activeSession.activeCourseId;
            if (targetCourseId) {
                const mod = this.getOrInitCourseMetrics(targetCourseId);
                if (mod) mod.watchTimeSeconds += durationSeconds;
            }
        }
    }

    /**
     * Get active student ID
     */
    static getActiveStudentId(): string | null {
        return this.activeSession ? this.activeSession.studentId : null;
    }

    /**
     * Get active session language
     */
    static getLanguage(): string {
        return this.activeSession ? this.activeSession.language : 'English';
    }

    /**
     * Determine if the active session meets the engagement threshold to display feedback survey.
     * Criteria:
     * - Active video watch time >= 60 seconds OR
     * - Total session duration >= 120 seconds (2 minutes)
     */
    static hasMetEngagementThreshold(): boolean {
        if (!this.activeSession) return false;
        const durationSeconds = (Date.now() - this.activeSession.startTime.getTime()) / 1000;
        const watchTime = this.activeSession.globalWatchTimeSeconds || 0;
        return watchTime >= 60 || durationSeconds >= 120;
    }

    /**
     * Update active session language
     */
    static updateLanguage(language: string): void {
        if (this.activeSession) {
            this.activeSession.language = language;
            console.log(`[SessionManager] Updated language for active session: ${language}`);
        }
    }

    /**
     * End the active session and save canonical course-scoped rows to the SQLite database
     */
    static async endSession(
        csat: number | null,
        itp: number | null,
        overallRating: number | null = null,
        exploreCareerRating: number | null = null,
        seeMoreToursRating: number | null = null
    ): Promise<void> {
        if (!this.activeSession) {
            console.log('[SessionManager] No active session to end');
            return;
        }

        const session = this.activeSession;
        this.activeSession = null; // Clear immediately to prevent double calls

        try {
            const db = getDatabase();
            const manifest = this.getManifest();
            const endTime = new Date();
            const durationMs = endTime.getTime() - session.startTime.getTime();
            const totalDurationMinutes = Math.max(1, Math.round(durationMs / 60000)); // Minimum 1 minute

            const deviceInfo = await getDeviceInfo();
            const student = await getStudentById(session.studentId);
            if (!student) {
                console.error(`[SessionManager] Student ${session.studentId} not found in database`);
                return;
            }

            const sessionDate = session.startTime.toISOString().split('T')[0]; // YYYY-MM-DD
            const startISO = session.startTime.toISOString();
            const endISO = endTime.toISOString();

            // 1. Fetch DB records needed for telemetry calculation
            const sessionQuizzes = await db.select()
                .from(quizAttempts)
                .where(
                    and(
                        eq(quizAttempts.studentId, student.id),
                        sql`${quizAttempts.completedAt} >= ${startISO}`,
                        sql`${quizAttempts.completedAt} <= ${endISO}`
                    )
                );

            const sessionVideoProgress = await db.select()
                .from(videoProgress)
                .where(
                    and(
                        eq(videoProgress.studentId, student.id),
                        sql`${videoProgress.lastWatchedAt} >= ${startISO}`,
                        sql`${videoProgress.lastWatchedAt} <= ${endISO}`
                    )
                );

            const allStudentVideoProgress = await db.select()
                .from(videoProgress)
                .where(eq(videoProgress.studentId, student.id));

            const allStudentQuizAttempts = await db.select()
                .from(quizAttempts)
                .where(eq(quizAttempts.studentId, student.id));

            const allLessons = await db.select().from(lessons);
            const lessonMap = new Map<string, typeof lessons.$inferSelect>();
            for (const l of allLessons) {
                lessonMap.set(l.id, l);
            }

            // 2. Identify all engaged canonical COURSES during this session
            const engagedCourseIds = new Set<string>();

            // From in-memory recorded metrics:
            for (const [courseId, metrics] of session.courses.entries()) {
                if (metrics.watchTimeSeconds > 0 || metrics.pauseCount > 0 || metrics.seekCount > 0) {
                    engagedCourseIds.add(courseId);
                }
            }

            // From video progress recorded in SQLite within session window:
            for (const vp of sessionVideoProgress) {
                const lesson = lessonMap.get(vp.lessonId);
                if (lesson?.moduleId || vp.lessonId) {
                    engagedCourseIds.add(getCourseId(lesson?.moduleId || vp.lessonId));
                }
            }

            // From quiz attempts recorded in SQLite within session window:
            for (const q of sessionQuizzes) {
                const lesson = lessonMap.get(q.lessonId);
                if (lesson?.moduleId || q.lessonId) {
                    engagedCourseIds.add(getCourseId(lesson?.moduleId || q.lessonId));
                }
            }

            // If activeCourseId was explicitly navigated to:
            if (engagedCourseIds.size === 0 && session.activeCourseId) {
                engagedCourseIds.add(session.activeCourseId);
            }

            // Fallback: If no activity occurred (e.g. quick login/logout or AI tutor only), pick default course from manifest
            if (engagedCourseIds.size === 0) {
                const firstModule = manifest.modules[0];
                const fallbackCourseId = firstModule ? getCourseId(firstModule.id) : 'dct';
                engagedCourseIds.add(fallbackCourseId);
            }

            console.log(`[SessionManager] Compiling session for student ${student.id}. Engaged courses (${engagedCourseIds.size}):`, Array.from(engagedCourseIds));

            // 3. Generate sequential session IDs based on current session count on this date
            const baseSequenceCount = await getSessionCountForDate(student.id, sessionDate);
            const schoolUdise = deviceInfo.schoolUdise || '12345678901';
            const gradeStr = String(student.grade || 5).padStart(2, '0');

            const rowsToInsert: NewAFESession[] = [];
            const courseList = Array.from(engagedCourseIds);
            const courseCount = courseList.length;

            for (let i = 0; i < courseCount; i++) {
                const courseId = courseList[i];
                const meta = getCourseMetadata(manifest, courseId);
                const tourName = meta.canonicalTitle;

                // Cumulative completed video orders for THIS canonical course across ANY language
                const completedVideoOrders = new Set<number>();
                for (const vp of allStudentVideoProgress) {
                    if (vp.completed || (vp.watchedPercentage || 0) >= 80) {
                        const lesson = lessonMap.get(vp.lessonId);
                        if (lesson && meta.moduleIds.includes(lesson.moduleId) && lesson.type === 'video') {
                            completedVideoOrders.add(lesson.order);
                        }
                    }
                }
                const completedVideosCount = completedVideoOrders.size;
                const totalCourseVideos = meta.totalVideos || 1;
                const videoCompletionRate = Number(((completedVideosCount / totalCourseVideos) * 100).toFixed(2));

                // Cumulative distinct quiz orders completed for THIS canonical course across ANY language
                const completedQuizOrders = new Set<number>();
                for (const q of allStudentQuizAttempts) {
                    const lesson = lessonMap.get(q.lessonId);
                    if (lesson && meta.moduleIds.includes(lesson.moduleId) && lesson.type === 'quiz') {
                        completedQuizOrders.add(lesson.order);
                    }
                }
                const distinctModuleQuizzesCompleted = completedQuizOrders.size;
                const totalCourseQuizzes = meta.totalQuizzes;

                // Overall completion metrics strictly for THIS canonical course
                const sessionCompletedFlag = (completedVideosCount >= totalCourseVideos) && (distinctModuleQuizzesCompleted >= totalCourseQuizzes);
                const totalCourseItems = meta.totalItems > 0 ? meta.totalItems : (totalCourseVideos + totalCourseQuizzes);
                const completedCourseItems = completedVideosCount + distinctModuleQuizzesCompleted;
                const completionPercentage = totalCourseItems > 0 ? Math.round((completedCourseItems / totalCourseItems) * 100) : 0;

                // Session-level quiz attempts for THIS course during this session
                const thisSessionCourseQuizzes = sessionQuizzes.filter((q) => {
                    const lesson = lessonMap.get(q.lessonId);
                    return lesson && meta.moduleIds.includes(lesson.moduleId);
                });
                const quizzesCompletedCount = thisSessionCourseQuizzes.length;
                const totalQuestionsAnswered = thisSessionCourseQuizzes.reduce((sum, q) => sum + q.totalQuestions, 0);
                const correctAnswersCount = thisSessionCourseQuizzes.reduce((sum, q) => sum + q.score, 0);
                const quizAccuracyPercentage = totalQuestionsAnswered > 0
                    ? Number(((correctAnswersCount / totalQuestionsAnswered) * 100).toFixed(2))
                    : 0.00;

                // Session-level watch metrics for THIS course during this session
                const metrics = session.courses.get(courseId);
                const courseWatchTime = metrics?.watchTimeSeconds || 0;
                const sessionCourseVideosWatched = sessionVideoProgress.filter((vp) => {
                    const lesson = lessonMap.get(vp.lessonId);
                    return lesson && meta.moduleIds.includes(lesson.moduleId) && lesson.type === 'video';
                });
                const sessionVideosCount = sessionCourseVideosWatched.length;
                const avgWatchTimeSeconds = sessionVideosCount > 0
                    ? Math.round(courseWatchTime / sessionVideosCount)
                    : 0;

                // Allocate duration minutes (evenly split if multiple courses engaged, minimum 1 min each)
                const courseDurationMinutes = courseCount > 1
                    ? Math.max(1, Math.round(totalDurationMinutes / courseCount))
                    : totalDurationMinutes;

                // Interaction telemetry for THIS course
                const pauseCountTotal = metrics?.pauseCount ?? (courseCount === 1 ? session.globalPauseCount : 0);
                const seekCountTotal = metrics?.seekCount ?? (courseCount === 1 ? session.globalSeekCount : 0);
                const speeds = (metrics?.playbackSpeeds && metrics.playbackSpeeds.length > 0)
                    ? metrics.playbackSpeeds
                    : session.globalPlaybackSpeeds;
                const avgPlaybackSpeed = speeds.length > 0
                    ? Number((speeds.reduce((sum, s) => sum + s, 0) / speeds.length).toFixed(2))
                    : 1.00;

                // Sequential session ID
                const sequenceNum = baseSequenceCount + i + 1;
                const sequenceStr = String(sequenceNum).padStart(3, '0');
                const sessionId = `CT_IN_${sessionDate.replace(/-/g, '')}_${schoolUdise}_${gradeStr}_INDIV_${sequenceStr}`;

                const sessionRow: NewAFESession = {
                    id: sessionId,
                    studentId: student.id,
                    avatarName: student.name,
                    sessionDate,
                    startTime: startISO,
                    endTime: endISO,
                    durationMinutes: courseDurationMinutes,
                    csatAvg: csat !== null ? Number(csat.toFixed(2)) : null,
                    itpAvg: itp !== null ? Number(itp.toFixed(2)) : null,
                    overallRating: overallRating !== null ? Number(overallRating.toFixed(2)) : null,
                    exploreCareerRating: exploreCareerRating !== null ? Number(exploreCareerRating.toFixed(2)) : null,
                    seeMoreToursRating: seeMoreToursRating !== null ? Number(seeMoreToursRating.toFixed(2)) : null,
                    videoCompletionRate,
                    quizAccuracyPercentage,
                    avgWatchTimeSeconds,
                    videosCompletedCount: completedVideosCount,
                    quizzesCompletedCount,
                    totalQuestionsAnswered,
                    correctAnswersCount,
                    sessionCompletedFlag,
                    completionPercentage,
                    totalWatchTimeSeconds: Math.round(courseWatchTime),
                    avgPlaybackSpeed,
                    pauseCountTotal,
                    seekCountTotal,
                    networkType: this.getNetworkType(),
                    language: session.language,
                    moduleId: courseId,
                    tourName,
                    synced: false,
                    createdAt: new Date().toISOString()
                };

                rowsToInsert.push(sessionRow);
            }

            await saveAFESessions(rowsToInsert);
            console.log(`[SessionManager] Successfully saved ${rowsToInsert.length} canonical course session row(s) for student ${student.id}. Session IDs:`, rowsToInsert.map((r) => r.id));

            if (SessionManager.closeOnSessionEnd) {
                console.log('[SessionManager] closeOnSessionEnd is true, quitting app.');
                (global as any).isQuitting = true;
                app.quit();
            }
        } catch (error) {
            console.error('[SessionManager] Failed to save session:', error);
        }
    }

    private static getNetworkType(): string {
        return 'wifi';
    }
}


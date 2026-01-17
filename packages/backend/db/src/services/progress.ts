import { eq, and, desc } from 'drizzle-orm';
import { getDatabase } from '../core.js';
import {
    videoProgress,
    quizAttempts,
    type VideoProgress,
    type NewVideoProgress,
    type QuizAttempt,
    type NewQuizAttempt,
} from '../schema/index.js';
import { randomUUID } from 'crypto';



// ============ Video Progress ============

/**
 * Update video watch progress
 */
export async function updateVideoProgress(
    studentId: string,
    lessonId: string,
    watchedPercentage: number,
    watchDuration: number
): Promise<void> {
    const now = new Date().toISOString();

    // Check if record exists
    const existing = await getDatabase()
        .select()
        .from(videoProgress)
        .where(and(eq(videoProgress.studentId, studentId), eq(videoProgress.lessonId, lessonId)));

    if (existing.length > 0) {
        // Update existing
        await getDatabase()
            .update(videoProgress)
            .set({
                watchedPercentage: Math.max(watchedPercentage, existing[0].watchedPercentage),
                totalWatchDuration: existing[0].totalWatchDuration + watchDuration,
                lastWatchedAt: now,
            })
            .where(and(eq(videoProgress.studentId, studentId), eq(videoProgress.lessonId, lessonId)));
    } else {
        // Create new
        const newProgress: NewVideoProgress = {
            id: randomUUID(),
            studentId,
            lessonId,
            watchedPercentage,
            totalWatchDuration: watchDuration,
            lastWatchedAt: now,
        };
        await getDatabase().insert(videoProgress).values(newProgress);
    }
}

/**
 * Get video progress for a student and lesson
 */
export async function getVideoProgress(
    studentId: string,
    lessonId: string
): Promise<VideoProgress | null> {
    const result = await getDatabase()
        .select()
        .from(videoProgress)
        .where(and(eq(videoProgress.studentId, studentId), eq(videoProgress.lessonId, lessonId)));

    return result[0] || null;
}

/**
 * Get all video progress for a student
 */
export async function getAllVideoProgressForStudent(
    studentId: string
): Promise<VideoProgress[]> {
    return await getDatabase().select().from(videoProgress).where(eq(videoProgress.studentId, studentId));
}

// ============ Quiz Attempts ============

/**
 * Submit a quiz attempt
 */
export async function submitQuizAttempt(
    studentId: string,
    lessonId: string,
    score: number,
    totalQuestions: number,
    answers: Array<{ questionId: string; selectedAnswerIndex: number; isCorrect: boolean }>,
    timeTaken: number
): Promise<QuizAttempt> {
    // Get attempt number
    const previousAttempts = await getDatabase()
        .select()
        .from(quizAttempts)
        .where(and(eq(quizAttempts.studentId, studentId), eq(quizAttempts.lessonId, lessonId)));

    const attemptNumber = previousAttempts.length + 1;
    const now = new Date().toISOString();

    const newAttempt: NewQuizAttempt = {
        id: randomUUID(),
        studentId,
        lessonId,
        score,
        totalQuestions,
        answers: JSON.stringify(answers),
        attemptNumber,
        completedAt: now,
        timeTaken,
    };

    await getDatabase().insert(quizAttempts).values(newAttempt);
    return newAttempt as QuizAttempt;
}

/**
 * Get all quiz attempts for a student and lesson
 */
export async function getQuizAttempts(
    studentId: string,
    lessonId: string
): Promise<QuizAttempt[]> {
    return await getDatabase()
        .select()
        .from(quizAttempts)
        .where(and(eq(quizAttempts.studentId, studentId), eq(quizAttempts.lessonId, lessonId)))
        .orderBy(desc(quizAttempts.completedAt));
}

/**
 * Get best quiz score for a student and lesson
 */
export async function getBestQuizScore(
    studentId: string,
    lessonId: string
): Promise<number | null> {
    const attempts = await getQuizAttempts(studentId, lessonId);
    if (attempts.length === 0) return null;

    return Math.max(...attempts.map((a) => (a.score / a.totalQuestions) * 100));
}

/**
 * Get quiz improvement metrics (first vs best attempt)
 */
export async function getQuizImprovement(
    studentId: string,
    lessonId: string
): Promise<{ firstScore: number; bestScore: number; improvement: number } | null> {
    const attempts = await getQuizAttempts(studentId, lessonId);
    if (attempts.length === 0) return null;

    const firstAttempt = attempts[attempts.length - 1];
    const firstScore = (firstAttempt.score / firstAttempt.totalQuestions) * 100;
    const bestScore = Math.max(...attempts.map((a) => (a.score / a.totalQuestions) * 100));

    return {
        firstScore,
        bestScore,
        improvement: bestScore - firstScore,
    };
}

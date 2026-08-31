import fs from 'fs';
import path from 'path';
import { ContentManifestSchema, ContentValidationError, type ContentManifest } from './schemas/manifest.js';

/**
 * Load and validate content manifest from ProgramData
 */
export function loadContentManifest(basePath?: string): ContentManifest {
    const manifestPath = basePath
        ? path.join(basePath, 'content', 'manifest.json')
        : path.join('C:\\ProgramData\\OfflineLearningApp', 'content', 'manifest.json');

    if (!fs.existsSync(manifestPath)) {
        throw new Error(`Content manifest not found at: ${manifestPath}`);
    }

    try {
        const rawContent = fs.readFileSync(manifestPath, 'utf-8');
        const jsonData = JSON.parse(rawContent);

        // Validate with Zod schema
        const result = ContentManifestSchema.safeParse(jsonData);

        if (!result.success) {
            throw new ContentValidationError(
                'Content manifest validation failed',
                result.error
            );
        }

        console.log(`✓ Content manifest loaded: ${result.data.modules.length} modules`);
        return result.data;
    } catch (error) {
        if (error instanceof ContentValidationError) {
            throw error;
        }
        throw new Error(`Failed to load content manifest: ${error}`);
    }
}

/**
 * Get module by ID from manifest
 */
export function getModuleById(manifest: ContentManifest, moduleId: string) {
    return manifest.modules.find((m) => m.id === moduleId) || null;
}

/**
 * Get lesson by ID from manifest
 */
export function getLessonById(manifest: ContentManifest, lessonId: string) {
    for (const module of manifest.modules) {
        const lesson = module.lessons.find((l) => l.id === lessonId);
        if (lesson) return lesson;
    }
    return null;
}

/**
 * Get all lessons for a module
 */
export function getLessonsForModule(manifest: ContentManifest, moduleId: string) {
    const module = getModuleById(manifest, moduleId);
    return module ? module.lessons : [];
}

/**
 * Extract canonical course slug/ID dynamically (e.g. 'dct', 'rft', 'music', 'ai_career')
 * Works with both module IDs ('dct-english-001') and lesson IDs ('dct-en-ch01').
 */
export function getCourseId(moduleIdOrLessonId?: string | null): string {
    if (!moduleIdOrLessonId) return 'dct';
    const clean = String(moduleIdOrLessonId).trim().toLowerCase();
    // Common separators in module/lesson naming conventions
    const parts = clean.split(/[-_]/);
    return parts[0] || clean;
}

/**
 * Dynamically resolve the canonical course title from the manifest.
 * Prefers the English title, falling back to the first available localized module title.
 */
export function getCanonicalCourseTitle(manifest: ContentManifest, courseIdOrModuleId?: string | null): string {
    const courseId = getCourseId(courseIdOrModuleId);
    const courseModules = manifest.modules.filter((m) => getCourseId(m.id) === courseId);
    
    if (courseModules.length === 0) {
        return courseId.toUpperCase();
    }

    const englishMod = courseModules.find((m) => (m.language || '').toLowerCase() === 'english');
    return englishMod?.title || courseModules[0].title || courseId.toUpperCase();
}

export interface CourseMetadata {
    courseId: string;
    canonicalTitle: string;
    moduleIds: string[];
    videoOrders: number[];
    quizOrders: number[];
    readingOrders: number[];
    totalVideos: number;
    totalQuizzes: number;
    totalReadings: number;
    totalItems: number;
}

/**
 * Dynamically compute course structure, lesson counts, and denominators from the manifest.
 * Extensible for any course and any number of videos/quizzes/readings without hardcoding.
 */
export function getCourseMetadata(manifest: ContentManifest, courseIdOrModuleId?: string | null): CourseMetadata {
    const courseId = getCourseId(courseIdOrModuleId);
    const canonicalTitle = getCanonicalCourseTitle(manifest, courseId);
    const courseModules = manifest.modules.filter((m) => getCourseId(m.id) === courseId);
    const moduleIds = courseModules.map((m) => m.id);

    const videoOrdersSet = new Set<number>();
    const quizOrdersSet = new Set<number>();
    const readingOrdersSet = new Set<number>();

    for (const mod of courseModules) {
        for (const lesson of mod.lessons) {
            if (lesson.type === 'video') {
                videoOrdersSet.add(lesson.order);
            } else if (lesson.type === 'quiz') {
                quizOrdersSet.add(lesson.order);
            } else if (lesson.type === 'reading') {
                readingOrdersSet.add(lesson.order);
            }
        }
    }

    const videoOrders = Array.from(videoOrdersSet).sort((a, b) => a - b);
    const quizOrders = Array.from(quizOrdersSet).sort((a, b) => a - b);
    const readingOrders = Array.from(readingOrdersSet).sort((a, b) => a - b);

    const totalVideos = videoOrders.length;
    const totalQuizzes = quizOrders.length;
    const totalReadings = readingOrders.length;
    const totalItems = totalVideos + totalQuizzes + totalReadings;

    return {
        courseId,
        canonicalTitle,
        moduleIds,
        videoOrders,
        quizOrders,
        readingOrders,
        totalVideos,
        totalQuizzes,
        totalReadings,
        totalItems,
    };
}

/**
 * Get all sibling lesson IDs across all localized language modules for the exact same lesson order and course.
 */
export function getSiblingLessonIds(manifest: ContentManifest, lessonId: string): string[] {
    const lesson = getLessonById(manifest, lessonId);
    if (!lesson) return [lessonId];
    const courseId = getCourseId(lesson.moduleId || lesson.id);
    const order = lesson.order;

    const siblingIds: string[] = [];
    for (const mod of manifest.modules) {
        if (getCourseId(mod.id) === courseId) {
            const matchingLesson = mod.lessons.find((l) => l.order === order && l.type === lesson.type);
            if (matchingLesson) {
                siblingIds.push(matchingLesson.id);
            }
        }
    }
    return siblingIds.length > 0 ? siblingIds : [lessonId];
}

/**
 * Get all sibling module IDs across all localized languages for the same course.
 */
export function getSiblingModuleIds(manifest: ContentManifest, moduleId: string): string[] {
    const courseId = getCourseId(moduleId);
    const siblingIds = manifest.modules
        .filter((m) => getCourseId(m.id) === courseId)
        .map((m) => m.id);
    return siblingIds.length > 0 ? siblingIds : [moduleId];
}

export * from './schemas/manifest.js';


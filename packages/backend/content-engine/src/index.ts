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

export * from './schemas/manifest.js';

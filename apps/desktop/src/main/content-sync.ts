import { getDatabase, modules, lessons } from '@backend/db';
import type { ContentManifest } from '@backend/content-engine';

/**
 * Sync content manifest to SQLite database
 * This ensures that modules and lessons exist in the DB for foreign key constraints
 */
export async function syncContentToDatabase(manifest: ContentManifest) {
    console.log('🔄 Syncing content to database...');
    const db = getDatabase();

    try {
        await db.transaction(async (tx) => {
            // 1. Sync Modules
            for (const module of manifest.modules) {
                await tx
                    .insert(modules)
                    .values({
                        id: module.id,
                        contentId: module.contentId,
                        version: module.version,
                        hash: module.hash,
                        title: module.title,
                        description: module.description,
                        thumbnailUrl: module.thumbnailUrl,
                        data: JSON.stringify(module), // Store mostly for caching/completeness
                    })
                    .onConflictDoUpdate({
                        target: modules.id,
                        set: {
                            title: module.title,
                            description: module.description,
                            version: module.version,
                            hash: module.hash,
                            data: JSON.stringify(module),
                        },
                    });

                // 2. Sync Lessons for this Module
                for (const lesson of module.lessons) {
                    await tx
                        .insert(lessons)
                        .values({
                            id: lesson.id,
                            contentId: lesson.contentId,
                            version: lesson.version,
                            hash: lesson.hash,
                            moduleId: module.id,
                            title: lesson.title,
                            description: lesson.description,
                            type: lesson.type,
                            videoUrl: lesson.videoUrl, // optional
                            readingUrl: lesson.readingUrl, // optional
                            order: lesson.order,
                            data: JSON.stringify(lesson),
                        })
                        .onConflictDoUpdate({
                            target: lessons.id,
                            set: {
                                title: lesson.title,
                                description: lesson.description,
                                type: lesson.type,
                                videoUrl: lesson.videoUrl,
                                readingUrl: lesson.readingUrl,
                                order: lesson.order,
                                data: JSON.stringify(lesson),
                            },
                        });
                }
            }
        });
        console.log('✅ Content synced to database successfully');
    } catch (error) {
        console.error('❌ Failed to sync content to database:', error);
        throw error;
    }
}

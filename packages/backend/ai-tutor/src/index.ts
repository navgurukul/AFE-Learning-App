import { getDatabase, aiChatHistory, aiSessions, students, modules, eq, desc } from '@backend/db';
import { randomUUID } from 'crypto';
import { Ollama } from 'ollama';
import { buildSystemPrompt } from './prompts.js';
import { loadContentManifest, getModuleById } from '@backend/content-engine';

import { DATA_PATHS } from '@afe/shared';

// Ollama client (assumes Ollama is running locally)
let ollama: Ollama | null = null;
let contentManifest: any = null;

function getOllamaClient(): Ollama {
    if (!ollama) {
        ollama = new Ollama({ host: 'http://127.0.0.1:11434' });
    }
    return ollama;
}

function getManifest() {
    if (!contentManifest) {
        contentManifest = loadContentManifest(DATA_PATHS.ROOT);
    }
    return contentManifest;
}

export async function sendMessage(
    studentId: string,
    message: string,
    sessionId: string,
    onChunk?: (chunk: string) => void
): Promise<string> {
    console.log('DEBUG: sendMessage arguments:', { studentId, sessionId });
    try {
        const db = getDatabase();
        const client = getOllamaClient();

        // Get session context
        const sessionResult = await db.select().from(aiSessions).where(eq(aiSessions.id, sessionId));
        const session = sessionResult[0];
        if (!session) throw new Error('Session not found');

        // Get student name
        const student = await db.select().from(students).where(eq(students.id, studentId));
        const studentName = student[0]?.name || 'Student';

        // Fetch titles if in tutor mode
        let lessonTitle: string | undefined;
        let moduleTitle: string | undefined;
        let lessonDescription: string | undefined;

        if (session.mode === 'tutor' && session.moduleId) {
            const manifest = getManifest();
            const module = getModuleById(manifest, session.moduleId);
            if (module) {
                moduleTitle = module.title;
            }
        }

        // Build system prompt
        const systemPrompt = session.mode === 'tutor'
            ? buildSystemPrompt(undefined, moduleTitle, undefined)
            : "You are a helpful and friendly AI assistant. Answer questions clearly and concisely.";

        console.log(`DEBUG: Using systemPrompt for mode ${session.mode}: ${systemPrompt}`);

        // Get recent chat history for this SESSION
        const history = await db
            .select()
            .from(aiChatHistory)
            .where(eq(aiChatHistory.sessionId, sessionId))
            .orderBy(aiChatHistory.timestamp)
            .limit(20);

        const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
            { role: 'system', content: systemPrompt },
        ];

        history.forEach((h) => {
            messages.push({
                role: h.role as 'user' | 'assistant',
                content: h.content,
            });
        });

        messages.push({ role: 'user', content: message });

        let aiResponse = '';
        const model = 'qwen2.5:1.5b'; // Using a smaller model for better speed on local

        if (onChunk) {
            const stream = await client.chat({
                model,
                messages,
                stream: true,
            });

            for await (const part of stream) {
                const chunk = part.message.content;
                aiResponse += chunk;
                onChunk(chunk);
            }
        } else {
            const response = await client.chat({
                model,
                messages,
            });
            aiResponse = response.message.content;
        }

        const now = new Date().toISOString();

        // Save messages and update session
        await db.transaction(async (tx) => {
            await tx.insert(aiChatHistory).values({
                id: randomUUID(),
                sessionId,
                role: 'user',
                content: message,
                timestamp: now,
            });

            await tx.insert(aiChatHistory).values({
                id: randomUUID(),
                sessionId,
                role: 'assistant',
                content: aiResponse,
                timestamp: now,
            });

            await tx.update(aiSessions)
                .set({ lastMessageAt: now })
                .where(eq(aiSessions.id, sessionId));
        });

        return aiResponse;
    } catch (error) {
        console.error('AI Tutor error:', error);
        return "I'm sorry, I'm currently unavailable. Please make sure Ollama is running locally.";
    }
}

export async function getSessions(studentId: string) {
    return await getDatabase()
        .select()
        .from(aiSessions)
        .where(eq(aiSessions.studentId, studentId))
        .orderBy(aiSessions.lastMessageAt);
}

export async function createSession(
    studentId: string,
    title: string,
    mode: 'tutor' | 'chat',
    moduleId?: string
) {
    const id = randomUUID();
    const now = new Date().toISOString();
    await getDatabase().insert(aiSessions).values({
        id,
        studentId,
        title,
        mode,
        moduleId,
        createdAt: now,
        lastMessageAt: now,
    });

    // Initial AI greeting if it's a new chat
    // We could add a default message here or let the frontend do it.

    return await getDatabase().select().from(aiSessions).where(eq(aiSessions.id, id)).then(res => res[0]);
}

export async function deleteSession(sessionId: string) {
    await getDatabase().delete(aiSessions).where(eq(aiSessions.id, sessionId));
}

export async function updateSessionTitle(sessionId: string, title: string) {
    await getDatabase()
        .update(aiSessions)
        .set({ title })
        .where(eq(aiSessions.id, sessionId));
}

export async function getSessionHistory(sessionId: string) {
    return await getDatabase()
        .select()
        .from(aiChatHistory)
        .where(eq(aiChatHistory.sessionId, sessionId))
        .orderBy(aiChatHistory.timestamp);
}

export async function clearChatHistory(studentId: string): Promise<void> {
    // This now deletes all sessions for the student which cascades to history
    await getDatabase().delete(aiSessions).where(eq(aiSessions.studentId, studentId));
}

/**
 * Check if Ollama is available
 */
export async function isOllamaAvailable(): Promise<boolean> {
    try {
        const client = getOllamaClient();
        await client.list(); // Simple ping to check if Ollama is running
        return true;
    } catch {
        return false;
    }
}

export * from './prompts.js';

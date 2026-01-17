import { eq } from 'drizzle-orm';
import { getDatabase } from '../core.js';
import { students, type Student, type NewStudent } from '../schema/index.js';
import { randomUUID } from 'crypto';



/**
 * Create a new student
 */
export async function createStudent(name: string, avatar: string): Promise<Student> {
    const now = new Date().toISOString();
    const newStudent: NewStudent = {
        id: randomUUID(),
        name,
        avatar,
        createdAt: now,
        lastActiveAt: now,
    };

    await getDatabase().insert(students).values(newStudent);
    return newStudent as Student;
}

/**
 * Get all students
 */
export async function getAllStudents(): Promise<Student[]> {
    return await getDatabase().select().from(students);
}

/**
 * Get student by ID
 */
export async function getStudentById(studentId: string): Promise<Student | null> {
    const result = await getDatabase().select().from(students).where(eq(students.id, studentId));
    return result[0] || null;
}

/**
 * Update student's last active timestamp
 */
export async function updateStudentLastActive(studentId: string): Promise<void> {
    const now = new Date().toISOString();
    await getDatabase().update(students).set({ lastActiveAt: now }).where(eq(students.id, studentId));
}

/**
 * Delete a student (cascades to all related data)
 */
export async function deleteStudent(studentId: string): Promise<void> {
    await getDatabase().delete(students).where(eq(students.id, studentId));
}

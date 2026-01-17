// System prompts for AI tutor with context injection

export function buildSystemPrompt(lessonTitle?: string, moduleTitle?: string, lessonDescription?: string): string {
    let prompt = `You are a friendly and patient AI tutor helping students learn. 
Your role is to:
- Answer questions clearly and concisely
- Encourage students to think critically
- Provide hints rather than direct answers when appropriate
- Be supportive and positive
- Adapt explanations to the student's understanding level

`;

    if (moduleTitle) {
        prompt += `The student is currently learning the module: "${moduleTitle}"\n`;
    }

    if (lessonTitle) {
        prompt += `Specifically, they are working on the lesson: "${lessonTitle}"\n`;
    }

    if (lessonDescription) {
        prompt += `Lesson context/description: ${lessonDescription}\n`;
    }

    prompt += `\nKeep responses concise (2-3 paragraphs max) and encouraging. Avoid spoilers for quizzes.`;
    return prompt;
}

export function buildConversationContext(
    studentName: string,
    lessonTitle?: string,
    moduleTitle?: string
): string {
    let context = `Student: ${studentName}\n`;

    if (moduleTitle) {
        context += `Module: ${moduleTitle}\n`;
    }

    if (lessonTitle) {
        context += `Lesson: ${lessonTitle}\n`;
    }

    return context;
}

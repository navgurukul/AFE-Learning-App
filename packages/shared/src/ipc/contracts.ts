// Type-safe IPC contracts for communication between renderer and main process
import type {
    Student,
    Module,
    Lesson,
    VideoProgress,
    QuizAttempt,
    AnalyticsEvent,
    AIChatMessage,
    AISession,
} from '../types/index.js';

// IPC Channel names
export const IPC_CHANNELS = {
    // Student operations
    STUDENT_CREATE: 'student:create',
    STUDENT_GET_ALL: 'student:getAll',
    STUDENT_GET_BY_ID: 'student:getById',
    STUDENT_UPDATE_LAST_ACTIVE: 'student:updateLastActive',

    // Content operations
    CONTENT_GET_MODULES: 'content:getModules',
    CONTENT_GET_MODULE_BY_ID: 'content:getModuleById',
    CONTENT_GET_LESSON_BY_ID: 'content:getLessonById',

    // Progress tracking
    PROGRESS_UPDATE_VIDEO: 'progress:updateVideo',
    PROGRESS_GET_VIDEO: 'progress:getVideo',
    PROGRESS_GET_ALL_FOR_STUDENT: 'progress:getAllForStudent',

    // Quiz operations
    QUIZ_SUBMIT_ATTEMPT: 'quiz:submitAttempt',
    QUIZ_GET_ATTEMPTS: 'quiz:getAttempts',
    QUIZ_GET_BEST_SCORE: 'quiz:getBestScore',

    // Analytics
    ANALYTICS_TRACK_EVENT: 'analytics:trackEvent',
    ANALYTICS_GET_SUMMARY: 'analytics:getSummary',

    // AI Tutor
    AI_SEND_MESSAGE: 'ai:sendMessage',
    AI_GET_SESSION_HISTORY: 'ai:getSessionHistory',
    AI_SESSION_GET_ALL: 'ai:session:getAll',
    AI_SESSION_CREATE: 'ai:session:create',
    AI_SESSION_DELETE: 'ai:session:delete',
    AI_CLEAR_HISTORY: 'ai:clearHistory',
    AI_STREAM_CHUNK: 'ai:streamChunk',
} as const;

// Request/Response type definitions

// Students
export type StudentCreateRequest = { name: string; avatar: string };
export type StudentCreateResponse = Student;

export type StudentGetAllRequest = void;
export type StudentGetAllResponse = Student[];

export type StudentGetByIdRequest = { studentId: string };
export type StudentGetByIdResponse = Student | null;

export type StudentUpdateLastActiveRequest = { studentId: string };
export type StudentUpdateLastActiveResponse = void;

// Content
export type ContentGetModulesRequest = void;
export type ContentGetModulesResponse = Module[];

export type ContentGetModuleByIdRequest = { moduleId: string };
export type ContentGetModuleByIdResponse = Module | null;

export type ContentGetLessonByIdRequest = { lessonId: string };
export type ContentGetLessonByIdResponse = Lesson | null;

// Progress
export type ProgressUpdateVideoRequest = {
    studentId: string;
    lessonId: string;
    watchedPercentage: number;
    watchDuration: number;
};
export type ProgressUpdateVideoResponse = void;

export type ProgressGetVideoRequest = { studentId: string; lessonId: string };
export type ProgressGetVideoResponse = VideoProgress | null;

export type ProgressGetAllForStudentRequest = { studentId: string };
export type ProgressGetAllForStudentResponse = VideoProgress[];

// Quiz
export type QuizSubmitAttemptRequest = {
    studentId: string;
    lessonId: string;
    answers: Array<{ questionId: string; selectedAnswerIndex: number }>;
    timeTaken: number;
};
export type QuizSubmitAttemptResponse = QuizAttempt;

export type QuizGetAttemptsRequest = { studentId: string; lessonId: string };
export type QuizGetAttemptsResponse = QuizAttempt[];

export type QuizGetBestScoreRequest = { studentId: string; lessonId: string };
export type QuizGetBestScoreResponse = number | null;

// Analytics
export type AnalyticsTrackEventRequest = {
    studentId: string;
    eventType: string;
    metadata: Record<string, unknown>;
};
export type AnalyticsTrackEventResponse = void;

export type AnalyticsGetSummaryRequest = { studentId: string };
export type AnalyticsGetSummaryResponse = {
    totalWatchTime: number;
    modulesStarted: number;
    modulesCompleted: number;
    quizzesTaken: number;
    averageQuizScore: number;
};

// AI Tutor sessions
export type AISessionGetAllRequest = { studentId: string };
export type AISessionGetAllResponse = AISession[];

export type AISessionCreateRequest = {
    studentId: string;
    title: string;
    mode: 'tutor' | 'chat';
    moduleId?: string;
};
export type AISessionCreateResponse = AISession;

export type AISessionDeleteRequest = { sessionId: string };
export type AISessionDeleteResponse = void;

export type AIGetSessionHistoryRequest = { sessionId: string };
export type AIGetSessionHistoryResponse = AIChatMessage[];

// AI Tutor message
export type AISendMessageRequest = {
    studentId: string;
    message: string;
    sessionId: string;
};
export type AISendMessageResponse = { response: string };

export type AIGetHistoryRequest = { studentId: string };
export type AIGetHistoryResponse = AIChatMessage[];

export type AIClearHistoryRequest = { studentId: string };
export type AIClearHistoryResponse = void;

// Type helper for IPC invocation
export interface IPCContract {
    [IPC_CHANNELS.STUDENT_CREATE]: {
        request: StudentCreateRequest;
        response: StudentCreateResponse;
    };
    [IPC_CHANNELS.STUDENT_GET_ALL]: {
        request: StudentGetAllRequest;
        response: StudentGetAllResponse;
    };
    [IPC_CHANNELS.STUDENT_GET_BY_ID]: {
        request: StudentGetByIdRequest;
        response: StudentGetByIdResponse;
    };
    [IPC_CHANNELS.STUDENT_UPDATE_LAST_ACTIVE]: {
        request: StudentUpdateLastActiveRequest;
        response: StudentUpdateLastActiveResponse;
    };
    [IPC_CHANNELS.CONTENT_GET_MODULES]: {
        request: ContentGetModulesRequest;
        response: ContentGetModulesResponse;
    };
    [IPC_CHANNELS.CONTENT_GET_MODULE_BY_ID]: {
        request: ContentGetModuleByIdRequest;
        response: ContentGetModuleByIdResponse;
    };
    [IPC_CHANNELS.CONTENT_GET_LESSON_BY_ID]: {
        request: ContentGetLessonByIdRequest;
        response: ContentGetLessonByIdResponse;
    };
    [IPC_CHANNELS.PROGRESS_UPDATE_VIDEO]: {
        request: ProgressUpdateVideoRequest;
        response: ProgressUpdateVideoResponse;
    };
    [IPC_CHANNELS.PROGRESS_GET_VIDEO]: {
        request: ProgressGetVideoRequest;
        response: ProgressGetVideoResponse;
    };
    [IPC_CHANNELS.PROGRESS_GET_ALL_FOR_STUDENT]: {
        request: ProgressGetAllForStudentRequest;
        response: ProgressGetAllForStudentResponse;
    };
    [IPC_CHANNELS.QUIZ_SUBMIT_ATTEMPT]: {
        request: QuizSubmitAttemptRequest;
        response: QuizSubmitAttemptResponse;
    };
    [IPC_CHANNELS.QUIZ_GET_ATTEMPTS]: {
        request: QuizGetAttemptsRequest;
        response: QuizGetAttemptsResponse;
    };
    [IPC_CHANNELS.QUIZ_GET_BEST_SCORE]: {
        request: QuizGetBestScoreRequest;
        response: QuizGetBestScoreResponse;
    };
    [IPC_CHANNELS.ANALYTICS_TRACK_EVENT]: {
        request: AnalyticsTrackEventRequest;
        response: AnalyticsTrackEventResponse;
    };
    [IPC_CHANNELS.ANALYTICS_GET_SUMMARY]: {
        request: AnalyticsGetSummaryRequest;
        response: AnalyticsGetSummaryResponse;
    };
    [IPC_CHANNELS.AI_SEND_MESSAGE]: {
        request: AISendMessageRequest;
        response: AISendMessageResponse;
    };
    [IPC_CHANNELS.AI_GET_SESSION_HISTORY]: {
        request: AIGetSessionHistoryRequest;
        response: AIGetSessionHistoryResponse;
    };
    [IPC_CHANNELS.AI_SESSION_GET_ALL]: {
        request: AISessionGetAllRequest;
        response: AISessionGetAllResponse;
    };
    [IPC_CHANNELS.AI_SESSION_CREATE]: {
        request: AISessionCreateRequest;
        response: AISessionCreateResponse;
    };
    [IPC_CHANNELS.AI_SESSION_DELETE]: {
        request: AISessionDeleteRequest;
        response: AISessionDeleteResponse;
    };
    [IPC_CHANNELS.AI_CLEAR_HISTORY]: {
        request: AIClearHistoryRequest;
        response: AIClearHistoryResponse;
    };
}

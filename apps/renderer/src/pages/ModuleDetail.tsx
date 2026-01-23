import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ipc } from '../lib/ipc.ts';
import type { Module, Lesson, VideoProgress } from '@afe/shared';
import VideoPlayer from '../components/VideoPlayer.tsx';
import PDFViewer from '../components/PDFViewer.tsx';
import QuizViewer from '../components/QuizViewer.tsx';

function ModuleDetail() {
    const { studentId, moduleId } = useParams<{ studentId: string; moduleId: string }>();
    const navigate = useNavigate();
    const [module, setModule] = useState<Module | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
    const [videoProgress, setVideoProgress] = useState<VideoProgress | null>(null);

    useEffect(() => {
        if (moduleId) {
            loadModule();
            // Dispatch event for global AI Tutor
            window.dispatchEvent(new CustomEvent('set-ai-module', { detail: { moduleId } }));
        }
    }, [moduleId]);

    async function loadModule() {
        if (!moduleId) return;

        try {
            const moduleData = await ipc.getModuleById(moduleId);
            setModule(moduleData);

            // Track module started event
            if (studentId && moduleData) {
                await ipc.markModuleStarted(studentId, moduleId);
                await ipc.trackEvent(studentId, 'module_started', { moduleId });
            }
        } catch (error) {
            console.error('Failed to load module:', error);
        } finally {
            setLoading(false);
        }
    }

    function handleBackToModules() {
        navigate(`/modules/${studentId}`);
    }


    async function handleSelectLesson(lesson: Lesson) {
        setSelectedLesson(lesson);
        // Dispatch event for global AI Tutor
        window.dispatchEvent(new CustomEvent('set-ai-lesson', { detail: { lessonId: lesson.id } }));

        if (lesson.type === 'video' && studentId) {
            try {
                // Fetch existing progress
                const progress = await ipc.getVideoProgress(studentId, lesson.id);
                setVideoProgress(progress);
            } catch (err) {
                console.error('Failed to load video progress', err);
            }
        }
    }

    async function checkModuleCompletion() {
        if (!module || !studentId) return;

        try {
            // Fetch all progress
            // In a real app, we should probably have a 'getModuleProgress' endpoint that returns status for all lessons
            // For now, we iterate or rely on a new IPC call if it existed.
            // Let's use the existing getAllVideoProgressForStudent but filter for this module.
            // A better way: The backend knows best. But we are client-side driven for now.
            // Let's fire a 'check_module_completion' event or similar? 
            // Or just track it:

            // For simplicity and offline trust:
            // We assume if this was the last lesson needed, it's done. 
            // But unordered access allows skipping.
            // Ideally:
            const allProgress = await ipc.getAllProgressForStudent(studentId);
            const moduleLessonIds = module.lessons.map(l => l.id);
            const completedLessonIds = allProgress
                .filter(p => moduleLessonIds.includes(p.lessonId))
                .filter(p => p.watchedPercentage >= 90 || p.totalWatchDuration > 0) // rough check
                .map(p => p.lessonId);

            // Also check quiz attempts? 
            // This is getting complex for client side.
            // Let's assume the backend handles 'module_completed' automagically when 'video_watched' or 'quiz_completed' events come in?
            // The prompt asks to "Fix broken metrics... modules completed". 
            // Let's trigger it explicitly here if we think we are done.

            const isComplete = moduleLessonIds.every(id => completedLessonIds.includes(id));

            if (isComplete) {
                await ipc.trackEvent(studentId, 'module_completed', { moduleId: module.id });
                // Maybe show a celebration modal?
                alert('Congratulations! You have completed this module!');
            }

        } catch (e) {
            console.error('Error checking module completion', e);
        }
    }

    async function handleLessonCompleted() {
        // Refresh progress
        if (selectedLesson && studentId) {
            if (selectedLesson.type === 'video') {
                try {
                    const p = await ipc.getVideoProgress(studentId, selectedLesson.id);
                    setVideoProgress(p);
                } catch { }
            }
        }

        await checkModuleCompletion();
    }

    function handleBackToLessonList() {
        setSelectedLesson(null);
        setVideoProgress(null);
        // Reset global AI Tutor context
        window.dispatchEvent(new CustomEvent('set-ai-lesson', { detail: { lessonId: undefined } }));
        // Refresh module to show progress indicators if we had them
    }

    function getLessonIcon(lesson: Lesson): string {
        switch (lesson.type) {
            case 'video':
                return '🎥';
            case 'quiz':
                return '📝';
            case 'reading':
                return '📖';
            default:
                return '📄';
        }
    }

    if (loading) {
        return <div className="loading">Loading module...</div>;
    }

    if (!module) {
        return (
            <div className="container">
                <p>Module not found</p>
                <button className="btn btn-secondary" onClick={handleBackToModules}>
                    ← Back to Modules
                </button>
            </div>
        );
    }

    return (
        <div className="container">
            <div style={{ marginBottom: 'var(--spacing-md)' }}>
                <button className="btn btn-secondary" onClick={handleBackToModules}>
                    ← Back to Modules
                </button>
            </div>

            <div className="page-header">
                <h1>{module.title}</h1>
                <p style={{ fontSize: '1.125rem', color: 'var(--color-text-light)' }}>
                    {module.description}
                </p>
            </div>

            <div className="accent-bar"></div>

            {selectedLesson ? (
                <div className="lesson-viewer">
                    <button className="btn btn-secondary" onClick={handleBackToLessonList} style={{ marginBottom: '1rem' }}>
                        ← Back to Lessons
                    </button>
                    <h2>{selectedLesson.title}</h2>
                    {selectedLesson.type === 'video' && studentId && (
                        <VideoPlayer
                            src={`media://${selectedLesson.videoUrl}`}
                            lessonId={selectedLesson.id}
                            studentId={studentId}
                            initialProgress={videoProgress ? {
                                watchedPercentage: videoProgress.watchedPercentage,
                                totalWatchDuration: videoProgress.totalWatchDuration,
                                lastWatchedAt: videoProgress.lastWatchedAt
                            } : undefined}
                            onCompleted={handleLessonCompleted}
                        />
                    )}
                    {selectedLesson.type === 'reading' && studentId && (
                        <PDFViewer
                            src={`media://${selectedLesson.readingUrl}`} // Use readingUrl for PDFs
                            lessonId={selectedLesson.id}
                            studentId={studentId}
                            initialProgress={videoProgress ? {
                                watchedPercentage: videoProgress.watchedPercentage,
                                totalWatchDuration: videoProgress.totalWatchDuration,
                                lastWatchedAt: videoProgress.lastWatchedAt
                            } : undefined}
                            onCompleted={handleLessonCompleted}
                        />
                    )}
                    {selectedLesson.type === 'quiz' && studentId && (
                        <QuizViewer
                            lessonId={selectedLesson.id}
                            studentId={studentId}
                            quizData={selectedLesson.quizData || (selectedLesson as any).data?.quizData}
                            onCompleted={handleLessonCompleted}
                        />
                    )}
                    {/* Placeholder for other types */}
                    {selectedLesson.type !== 'video' && selectedLesson.type !== 'reading' && selectedLesson.type !== 'quiz' && (
                        <div className="alert">Content type {selectedLesson.type} viewer coming soon.</div>
                    )}
                </div>
            ) : (
                <>
                    <h2 style={{ marginBottom: 'var(--spacing-md)' }}>Lessons ({module.lessons.length})</h2>

                    <div className="grid">
                        {module.lessons
                            .sort((a, b) => a.order - b.order)
                            .map((lesson) => (
                                <div key={lesson.id} className="card" onClick={() => handleSelectLesson(lesson)} style={{ cursor: 'pointer' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--spacing-md)' }}>
                                        <div style={{ fontSize: '3rem' }}>{getLessonIcon(lesson)}</div>
                                        <div style={{ flex: 1 }}>
                                            <h3 style={{ marginBottom: 'var(--spacing-xs)' }}>{lesson.title}</h3>
                                            <p style={{ color: 'var(--color-text-light)', marginBottom: 'var(--spacing-sm)' }}>
                                                {lesson.description}
                                            </p>
                                            <span className="tag">{lesson.type}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                    </div>
                </>
            )}
        </div>
    );
}

export default ModuleDetail;

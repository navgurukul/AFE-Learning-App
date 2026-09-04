import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ipc } from '../lib/ipc.ts';
import type { Module, Lesson, VideoProgress } from '@afe/shared';
import VideoPlayer from '../components/VideoPlayer.tsx';
import PDFViewer from '../components/PDFViewer.tsx';
import QuizViewer from '../components/QuizViewer.tsx';
import { FeedbackSurveyModal } from '../components/FeedbackSurveyModal.tsx';
import { NoticeModal, type NoticeModalVariant } from '../components/NoticeModal.tsx';
import { LessonNavigationBar } from '../components/LessonNavigationBar.tsx';
import { QuizGateModal } from '../components/QuizGateModal.tsx';
import { exitPictureInPictureAndCleanup } from '../lib/mediaCleanup.ts';

function ModuleDetail() {
    const { studentId, moduleId } = useParams<{ studentId: string; moduleId: string }>();
    const navigate = useNavigate();
    const [module, setModule] = useState<Module | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
    const [videoProgress, setVideoProgress] = useState<VideoProgress | null>(null);
    const [lessonCompletionStates, setLessonCompletionStates] = useState<Record<string, boolean>>({});
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
    const [noticeModal, setNoticeModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        variant: NoticeModalVariant;
        buttonText?: string;
    }>({
        isOpen: false,
        title: '',
        message: '',
        variant: 'info',
    });
    const savedScrollPositionRef = useRef<number>(0);
    const [currentWatchPercentage, setCurrentWatchPercentage] = useState(0);
    const [quizGateState, setQuizGateState] = useState<{
        isOpen: boolean;
        quizLesson: Lesson | null;
        isAlreadySubmitted: boolean;
        targetLessonAfterQuiz: Lesson | null;
    }>({
        isOpen: false,
        quizLesson: null,
        isAlreadySubmitted: false,
        targetLessonAfterQuiz: null,
    });

    // Derive sorted lessons and current index
    const sortedLessons = useMemo(() => {
        if (!module) return [];
        return [...module.lessons].sort((a, b) => a.order - b.order);
    }, [module]);

    const currentLessonIndex = useMemo(() => {
        if (!selectedLesson) return -1;
        return sortedLessons.findIndex(l => l.id === selectedLesson.id);
    }, [selectedLesson, sortedLessons]);

    const isCurrentLessonCompleted = selectedLesson ? !!lessonCompletionStates[selectedLesson.id] : false;

    useEffect(() => {
        if (moduleId) {
            loadModule();
            // Dispatch event for global AI Tutor
            window.dispatchEvent(new CustomEvent('set-ai-module', { detail: { moduleId } }));
        }
    }, [moduleId]);

    async function loadCompletionStates(targetModule?: Module | null) {
        const currentModule = targetModule !== undefined ? targetModule : module;
        if (!currentModule || !studentId) return;

        try {
            const completions: Record<string, boolean> = {};

            // Fetch all progress
            const [videoProgressList, readingProgressList] = await Promise.all([
                ipc.getAllProgressForStudent(studentId),
                ipc.getAllReadingProgress(studentId)
            ]);

            const videoProgressMap = new Map(videoProgressList.map(p => [p.lessonId, p]));
            const readingProgressMap = new Map(readingProgressList.map(p => [p.lessonId, p]));

            // Fetch quiz scores
            const quizLessons = currentModule.lessons.filter(l => l.type === 'quiz');
            const quizScores = await Promise.all(
                quizLessons.map(async (l) => {
                    const score = await ipc.getBestQuizScore(studentId, l.id);
                    return { lessonId: l.id, score };
                })
            );
            const quizScoresMap = new Map(quizScores.map(q => [q.lessonId, q.score]));

            for (const lesson of currentModule.lessons) {
                if (lesson.type === 'video') {
                    const progress = videoProgressMap.get(lesson.id);
                    completions[lesson.id] = progress ? (progress.completed || progress.watchedPercentage >= 95) : false;
                } else if (lesson.type === 'reading') {
                    const progress = readingProgressMap.get(lesson.id);
                    completions[lesson.id] = progress ? progress.readPercentage >= 95 : false;
                } else if (lesson.type === 'quiz') {
                    const bestScore = quizScoresMap.get(lesson.id);
                    // Completed as long as student submitted at least one quiz attempt
                    completions[lesson.id] = bestScore !== null && bestScore !== undefined;
                }
            }

            setLessonCompletionStates(completions);
        } catch (e) {
            console.error('Error loading completion states:', e);
        }
    }

    async function loadModule() {
        if (!moduleId) return;

        try {
            const moduleData = await ipc.getModuleById(moduleId);
            setModule(moduleData);

            // Track module started event
            if (studentId && moduleData) {
                await ipc.markModuleStarted(studentId, moduleId);
                await ipc.trackEvent(studentId, 'module_started', { moduleId });
                await loadCompletionStates(moduleData);
            }
        } catch (error) {
            console.error('Failed to load module:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleBackToModules() {
        await exitPictureInPictureAndCleanup();
        navigate(`/dashboard/${studentId}`);
    }

    async function handleSelectLesson(lesson: Lesson) {
        // Save current scroll position before viewing lesson (only when opening from module lesson list)
        if (!selectedLesson) {
            savedScrollPositionRef.current = window.scrollY;
        }
        setSelectedLesson(lesson);
        setCurrentWatchPercentage(0);
        // Dispatch event for global AI Tutor
        window.dispatchEvent(new CustomEvent('set-ai-lesson', { detail: { lessonId: lesson.id } }));

        if (studentId) {
            try {
                if (lesson.type === 'video') {
                    // Fetch existing video progress
                    const progress = await ipc.getVideoProgress(studentId, lesson.id);
                    setVideoProgress(progress);
                    if (progress) {
                        setCurrentWatchPercentage(progress.watchedPercentage || 0);
                    }
                } else if (lesson.type === 'reading') {
                    // Fetch existing reading progress
                    const progress = await ipc.getReadingProgress(studentId, lesson.id);
                    setVideoProgress(progress as any);
                }
            } catch (err) {
                console.error('Failed to load lesson progress', err);
            }
        }
    }

    async function checkModuleCompletion() {
        if (!module || !studentId) return;

        try {
            const sorted = [...module.lessons].sort((a, b) => a.order - b.order);
            const isComplete = sorted.every(lesson => !!lessonCompletionStates[lesson.id]);

            if (isComplete) {
                await ipc.trackEvent(studentId, 'module_completed', { moduleId: module.id });
                setNoticeModal({
                    isOpen: true,
                    title: 'Module Completed! 🎉',
                    message: 'Congratulations! You have completed all lessons in this module.',
                    variant: 'success',
                    buttonText: 'Awesome! 🚀',
                });
            }
        } catch (e) {
            console.error('Error checking module completion', e);
        }
    }

    async function handleLessonCompleted() {
        // Refresh progress
        if (selectedLesson && studentId) {
            try {
                if (selectedLesson.type === 'video') {
                    const p = await ipc.getVideoProgress(studentId, selectedLesson.id);
                    setVideoProgress(p);
                } else if (selectedLesson.type === 'reading') {
                    const p = await ipc.getReadingProgress(studentId, selectedLesson.id);
                    setVideoProgress(p as any);
                }
            } catch { }
        }

        await loadCompletionStates();
        await checkModuleCompletion();
    }

    async function handleBackToLessonList() {
        await exitPictureInPictureAndCleanup();
        setSelectedLesson(null);
        setVideoProgress(null);
        setCurrentWatchPercentage(0);
        // Reset global AI Tutor context
        window.dispatchEvent(new CustomEvent('set-ai-lesson', { detail: { lessonId: undefined } }));
        // Refresh completions
        await loadCompletionStates();
        // Restore scroll position to where the student was
        requestAnimationFrame(() => {
            window.scrollTo({ top: savedScrollPositionRef.current, behavior: 'instant' });
        });
    }

    // --- Navigation Handlers ---

    const handleNavigateNext = useCallback(async () => {
        if (currentLessonIndex < 0 || currentLessonIndex >= sortedLessons.length - 1) return;

        const nextLesson = sortedLessons[currentLessonIndex + 1];
        if (!nextLesson) return;

        // If next lesson is a quiz, check if it has been submitted
        if (nextLesson.type === 'quiz') {
            const isAlreadySubmitted = !!lessonCompletionStates[nextLesson.id];

            // Find the lesson after the quiz (for skip navigation)
            const lessonAfterQuiz = currentLessonIndex + 2 < sortedLessons.length
                ? sortedLessons[currentLessonIndex + 2]
                : null;

            setQuizGateState({
                isOpen: true,
                quizLesson: nextLesson,
                isAlreadySubmitted,
                targetLessonAfterQuiz: lessonAfterQuiz,
            });
            return;
        }

        // Navigate directly if not a quiz
        await exitPictureInPictureAndCleanup();
        handleSelectLesson(nextLesson);
    }, [currentLessonIndex, sortedLessons, lessonCompletionStates]);

    const handleNavigatePrevious = useCallback(async () => {
        if (currentLessonIndex <= 0) return;

        // Walk backwards, skipping quiz lessons
        let targetIndex = currentLessonIndex - 1;
        while (targetIndex >= 0 && sortedLessons[targetIndex].type === 'quiz') {
            targetIndex--;
        }

        if (targetIndex < 0) return;

        const prevLesson = sortedLessons[targetIndex];
        await exitPictureInPictureAndCleanup();
        handleSelectLesson(prevLesson);
    }, [currentLessonIndex, sortedLessons]);

    const handleQuizGateOpenFullScreen = useCallback(async () => {
        if (!quizGateState.quizLesson) return;
        setQuizGateState(prev => ({ ...prev, isOpen: false }));
        await exitPictureInPictureAndCleanup();
        handleSelectLesson(quizGateState.quizLesson);
    }, [quizGateState.quizLesson]);

    const handleQuizGateSkip = useCallback(async () => {
        const target = quizGateState.targetLessonAfterQuiz;
        setQuizGateState(prev => ({ ...prev, isOpen: false }));
        if (target) {
            await exitPictureInPictureAndCleanup();
            handleSelectLesson(target);
        }
    }, [quizGateState.targetLessonAfterQuiz]);

    const handleQuizGateCompleted = useCallback(async () => {
        // Refresh completion states after inline quiz submission
        await loadCompletionStates();
        await checkModuleCompletion();
    }, []);

    const handleQuizGateNavigateNext = useCallback(async () => {
        // After inline quiz submission, navigate to the lesson after the quiz
        const target = quizGateState.targetLessonAfterQuiz;
        setQuizGateState(prev => ({ ...prev, isOpen: false }));
        if (target) {
            await exitPictureInPictureAndCleanup();
            handleSelectLesson(target);
        }
    }, [quizGateState.targetLessonAfterQuiz]);

    const handleQuizGateNavigatePrevious = useCallback(async () => {
        // Go back to the current lesson (the one before the quiz)
        setQuizGateState(prev => ({ ...prev, isOpen: false }));
        // Already on the correct lesson, just close the modal
    }, []);

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
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontSize: 20, fontWeight: 700 }}>Loading module...</div>;
    }

    if (!module) {
        return (
            <div className="neo-root" style={{ padding: 40 }}>
                <p>Module not found</p>
                <button className="neo-btn neo-btn--teal" onClick={handleBackToModules}>
                    ← Back to Modules
                </button>
            </div>
        );
    }

    return (
        <div className="neo-root" style={{ display: 'flex', flexDirection: 'column', padding: '44px 24px 0' }}>
            <div style={{ maxWidth: 940, margin: '0 auto', width: '100%', flex: 1 }}>

                <div style={{ marginBottom: 32 }}>
                    <button className="neo-btn neo-btn--teal" onClick={handleBackToModules}>
                        ← Back to Modules
                    </button>
                </div>

                <div style={{ textAlign: 'center', marginBottom: 48, padding: '40px 0' }}>
                    <h1 className="h-hero" style={{ fontSize: 'clamp(32px,5vw,48px)', margin: '0 0 16px' }}>{module.title}</h1>
                    <p style={{ fontSize: 18, color: '#6E6A64', fontWeight: 500, margin: 0, maxWidth: 800, marginInline: 'auto' }}>
                        {module.description}
                    </p>
                </div>

                <div style={{ height: 4, background: '#141210', width: '100%', marginBottom: 40 }} />

                {selectedLesson ? (
                    <div style={{ marginBottom: 60 }}>
                        <button className="neo-btn neo-btn--teal" onClick={handleBackToLessonList} style={{ marginBottom: 24 }}>
                            ← Back to Lessons
                        </button>
                        <h2 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 24px' }}>{selectedLesson.title}</h2>
                        {selectedLesson.type === 'video' && studentId && (
                            <VideoPlayer
                                key={selectedLesson.id}
                                src={`media://${selectedLesson.videoUrl}`}
                                lessonId={selectedLesson.id}
                                studentId={studentId}
                                language={module.language}
                                initialProgress={videoProgress ? {
                                    watchedPercentage: videoProgress.watchedPercentage,
                                    totalWatchDuration: videoProgress.totalWatchDuration,
                                    lastWatchedAt: videoProgress.lastWatchedAt
                                } : undefined}
                                onCompleted={handleLessonCompleted}
                                onProgressUpdate={setCurrentWatchPercentage}
                            />
                        )}
                        {selectedLesson.type === 'reading' && studentId && (
                            <PDFViewer
                                key={selectedLesson.id}
                                src={`media://${selectedLesson.readingUrl}`} // Use readingUrl for PDFs
                                lessonId={selectedLesson.id}
                                studentId={studentId}
                                initialProgress={videoProgress ? {
                                    readPercentage: (videoProgress as any).readPercentage,
                                    currentPage: (videoProgress as any).currentPage,
                                    totalReadDuration: (videoProgress as any).totalReadDuration,
                                    lastReadAt: (videoProgress as any).lastReadAt
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
                                onNavigateNext={currentLessonIndex < sortedLessons.length - 1 ? handleNavigateNext : undefined}
                                onNavigatePrevious={currentLessonIndex > 0 ? handleNavigatePrevious : undefined}
                            />
                        )}
                        {/* Placeholder for other types */}
                        {selectedLesson.type !== 'video' && selectedLesson.type !== 'reading' && selectedLesson.type !== 'quiz' && (
                            <div className="neo-card" style={{ padding: 24, textAlign: 'center', color: '#6E6A64', fontWeight: 600 }}>Content type {selectedLesson.type} viewer coming soon.</div>
                        )}

                        {/* Lesson Navigation Bar — shown for video and reading lessons */}
                        {selectedLesson.type !== 'quiz' && currentLessonIndex >= 0 && (
                            <LessonNavigationBar
                                sortedLessons={sortedLessons}
                                currentLessonIndex={currentLessonIndex}
                                lessonCompletionStates={lessonCompletionStates}
                                currentWatchPercentage={currentWatchPercentage}
                                isCurrentLessonCompleted={isCurrentLessonCompleted}
                                onNavigateNext={handleNavigateNext}
                                onNavigatePrevious={handleNavigatePrevious}
                            />
                        )}
                    </div>
                ) : (
                    <div style={{ marginBottom: 60 }}>
                        <h2 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 32px' }}>Lessons ({module.lessons.length})</h2>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                            {(() => {
                                const sortedLessons = [...module.lessons].sort((a, b) => a.order - b.order);
                                return sortedLessons.map((lesson, idx) => {
                                    const isUnlocked = idx === 0 || !!lessonCompletionStates[sortedLessons[idx - 1].id];
                                    const isCompleted = !!lessonCompletionStates[lesson.id];
                                    const showSeparator = isUnlocked && !isCompleted && idx < sortedLessons.length - 1;
                                    return (
                                        <React.Fragment key={lesson.id}>
                                            <div
                                                className={`neo-card ${isUnlocked ? 'neo-tap' : ''}`}
                                                onClick={() => {
                                                    if (isUnlocked) {
                                                        handleSelectLesson(lesson);
                                                    } else {
                                                        setNoticeModal({
                                                            isOpen: true,
                                                            title: 'Lesson Locked 🔒',
                                                            message: 'Please complete the previous lessons first to unlock this lesson!',
                                                            variant: 'locked',
                                                            buttonText: 'Got It 👍',
                                                        });
                                                    }
                                                }}
                                                style={{
                                                    cursor: isUnlocked ? 'pointer' : 'not-allowed',
                                                    opacity: isUnlocked ? 1 : 0.6,
                                                    backgroundColor: isUnlocked ? '#FFFFFF' : '#EAEAE6',
                                                    borderStyle: isUnlocked ? 'solid' : 'dashed',
                                                    boxShadow: isUnlocked ? '5px 5px 0 0 #141210' : 'none',
                                                    transform: 'none',
                                                    padding: '24px 32px'
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
                                                    <div style={{ fontSize: '48px', filter: isUnlocked ? 'none' : 'grayscale(100%)', flexShrink: 0, opacity: isUnlocked ? 1 : 0.5 }}>
                                                        {isUnlocked ? getLessonIcon(lesson) : '🔒'}
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <h3 style={{
                                                            fontSize: 22,
                                                            fontWeight: 700,
                                                            margin: '0 0 8px'
                                                        }}>
                                                            {lesson.title}
                                                        </h3>
                                                        <p style={{ color: '#6E6A64', fontSize: 16, fontWeight: 500, margin: '0 0 16px' }}>
                                                            {lesson.description}
                                                        </p>
                                                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                                            <span className="neo-chip" style={{
                                                                backgroundColor: isCompleted ? '#3FB873' : '#4ECDC4',
                                                                color: isCompleted ? '#FFFFFF' : '#141210',
                                                                textTransform: 'uppercase',
                                                                fontSize: 13,
                                                                padding: '6px 14px'
                                                            }}>
                                                                {lesson.type} {isCompleted && '✓'}
                                                            </span>
                                                            {(lesson as any).durationSeconds > 0 && (
                                                                <span style={{ fontSize: 14, color: '#6E6A64', fontWeight: 600 }}>
                                                                    {Math.round((lesson as any).durationSeconds / 60)} min
                                                                </span>
                                                            )}
                                                            {!isUnlocked && (
                                                                <span style={{ fontSize: '14px', color: '#ef476f', fontWeight: 800 }}>
                                                                    Locked
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            {showSeparator && (
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    margin: '16px 0',
                                                    width: '100%',
                                                    gap: 16
                                                }}>
                                                    <div style={{ flex: 1, height: 2, backgroundColor: '#141210' }} />
                                                    <span style={{
                                                        fontWeight: 800,
                                                        fontSize: '14px',
                                                        color: '#ef476f',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '1px',
                                                        padding: '8px 16px',
                                                        backgroundColor: '#FFFFFF',
                                                        border: '2.5px solid #141210',
                                                        borderRadius: '12px',
                                                        boxShadow: '3px 3px 0 #141210',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        🔒 Complete to unlock next
                                                    </span>
                                                    <div style={{ flex: 1, height: 2, backgroundColor: '#141210' }} />
                                                </div>
                                            )}
                                        </React.Fragment>
                                    );
                                });
                            })()}
                        </div>
                    </div>
                )}
            </div>

            <FeedbackSurveyModal
                isOpen={isFeedbackOpen}
                language={module?.language}
                onClose={() => setIsFeedbackOpen(false)}
                onSubmit={async (csat, itp, overallRating, exploreCareerRating, seeMoreToursRating) => {
                    await exitPictureInPictureAndCleanup();
                    await ipc.endSession(csat, itp, overallRating, exploreCareerRating, seeMoreToursRating);
                    setIsFeedbackOpen(false);
                    navigate('/');
                }}
            />

            <NoticeModal
                isOpen={noticeModal.isOpen}
                title={noticeModal.title}
                message={noticeModal.message}
                variant={noticeModal.variant}
                buttonText={noticeModal.buttonText}
                onClose={() => setNoticeModal(prev => ({ ...prev, isOpen: false }))}
            />

            {/* Quiz Gate Modal for lesson navigation */}
            <QuizGateModal
                isOpen={quizGateState.isOpen}
                quizLesson={quizGateState.quizLesson}
                studentId={studentId || ''}
                isQuizAlreadySubmitted={quizGateState.isAlreadySubmitted}
                onQuizCompleted={handleQuizGateCompleted}
                onOpenFullScreen={handleQuizGateOpenFullScreen}
                onSkipQuiz={handleQuizGateSkip}
                onClose={() => setQuizGateState(prev => ({ ...prev, isOpen: false }))}
                onNavigateNext={handleQuizGateNavigateNext}
                onNavigatePrevious={handleQuizGateNavigatePrevious}
            />
        </div>
    );
}

export default ModuleDetail;

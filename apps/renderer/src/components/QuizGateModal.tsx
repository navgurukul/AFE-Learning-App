import { useState } from 'react';
import { Brain, Star, RotateCcw, SkipForward, Maximize2, ArrowRight, ArrowLeft, Trophy, Sparkles, Zap } from 'lucide-react';
import { ipc } from '../lib/ipc.ts';
import { ConfirmModal } from './ConfirmModal.tsx';
import type { Lesson } from '@afe/shared';

interface QuizGateModalProps {
    isOpen: boolean;
    quizLesson: Lesson | null;
    studentId: string;
    isQuizAlreadySubmitted: boolean;
    onQuizCompleted: () => void;
    onOpenFullScreen: () => void;
    onSkipQuiz: () => void;
    onClose: () => void;
    onNavigateNext?: () => void;
    onNavigatePrevious?: () => void;
}

interface QuizQuestion {
    id: string;
    question: string;
    options: string[];
}

export function QuizGateModal({
    isOpen,
    quizLesson,
    studentId,
    isQuizAlreadySubmitted,
    onQuizCompleted,
    onOpenFullScreen,
    onSkipQuiz,
    onClose,
    onNavigateNext,
    onNavigatePrevious,
}: QuizGateModalProps) {
    const [showInlineQuiz, setShowInlineQuiz] = useState(false);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, number>>({});
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<{ score: number; total: number } | null>(null);
    const [isConfirmSubmitOpen, setIsConfirmSubmitOpen] = useState(false);

    if (!isOpen || !quizLesson) return null;

    const quizData = quizLesson.quizData || (quizLesson as any).data?.quizData;
    const questions: QuizQuestion[] = quizData?.questions || [];
    const totalQuestions = questions.length;
    const currentQuestion = totalQuestions > 0 ? questions[currentQuestionIndex] : null;
    const isLastQuestion = currentQuestionIndex === totalQuestions - 1;

    function handleReset() {
        setShowInlineQuiz(false);
        setCurrentQuestionIndex(0);
        setAnswers({});
        setResult(null);
        setSubmitting(false);
        setIsConfirmSubmitOpen(false);
    }

    function handleClose() {
        handleReset();
        onClose();
    }

    function handleOptionSelect(optionIndex: number) {
        if (!currentQuestion) return;
        setAnswers(prev => ({
            ...prev,
            [currentQuestion.id]: optionIndex
        }));
    }

    function handleNextQuestion() {
        if (currentQuestionIndex < totalQuestions - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        }
    }

    function handlePrevQuestion() {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(prev => prev - 1);
        }
    }

    async function handleSubmit() {
        setIsConfirmSubmitOpen(false);
        if (!quizLesson) return;
        setSubmitting(true);

        const formattedAnswers = Object.entries(answers).map(([qId, index]) => ({
            questionId: qId,
            selectedAnswerIndex: index
        }));

        try {
            const attempt = await ipc.submitQuizAttempt(
                studentId,
                quizLesson.id,
                formattedAnswers,
                60 // mock time taken
            );

            if (attempt) {
                setResult({
                    score: attempt.score,
                    total: attempt.totalQuestions,
                });
                onQuizCompleted();
            }
        } catch (error) {
            console.error('Failed to submit quiz:', error);
        } finally {
            setSubmitting(false);
        }
    }

    // Rewatch mode — quiz already completed
    if (isQuizAlreadySubmitted && !showInlineQuiz && !result) {
        return (
            <div
                style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(20, 18, 16, 0.6)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 10000,
                    backdropFilter: 'blur(4px)',
                }}
                onClick={handleClose}
            >
                <div
                    className="neo-card"
                    style={{
                        width: '90%',
                        maxWidth: '480px',
                        textAlign: 'center',
                        padding: '36px 28px',
                        backgroundColor: '#FFFFFF',
                        border: '3px solid #141210',
                        borderRadius: '16px',
                        boxShadow: '6px 6px 0 0 #141210',
                        animation: 'modalSlideIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Icon Badge */}
                    <div style={{
                        width: '76px',
                        height: '76px',
                        borderRadius: '50%',
                        backgroundColor: '#FFD166',
                        border: '3px solid #141210',
                        boxShadow: '3px 3px 0 0 #141210',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 20px auto',
                    }}>
                        <Star size={36} strokeWidth={2.5} color="#141210" />
                    </div>

                    <h2 style={{
                        fontSize: '22px',
                        fontWeight: 800,
                        marginBottom: '12px',
                        color: '#141210',
                        lineHeight: 1.2,
                    }}>
                        You've Already Aced This!
                    </h2>

                    <p style={{
                        color: '#55524E',
                        marginBottom: '28px',
                        fontSize: '16px',
                        fontWeight: 600,
                        lineHeight: 1.5,
                    }}>
                        You've already completed this quiz. Want to try again for a perfect score, or keep moving forward?
                    </p>

                    <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
                        <button
                            className="neo-tap"
                            onClick={() => setShowInlineQuiz(true)}
                            style={{
                                width: '100%',
                                padding: '14px 20px',
                                fontSize: '16px',
                                fontWeight: 800,
                                color: '#141210',
                                backgroundColor: '#FFD166',
                                border: '3px solid #141210',
                                borderRadius: '12px',
                                boxShadow: '4px 4px 0 0 #141210',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                            }}
                        >
                            <RotateCcw size={18} strokeWidth={2.5} />
                            Retry Quiz
                        </button>
                        <button
                            className="neo-tap"
                            onClick={() => { handleClose(); onSkipQuiz(); }}
                            style={{
                                width: '100%',
                                padding: '14px 20px',
                                fontSize: '16px',
                                fontWeight: 800,
                                color: '#FFFFFF',
                                backgroundColor: '#4ECDC4',
                                border: '3px solid #141210',
                                borderRadius: '12px',
                                boxShadow: '4px 4px 0 0 #141210',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                            }}
                        >
                            <SkipForward size={18} strokeWidth={2.5} />
                            Skip to Next Lesson
                        </button>
                    </div>
                </div>
                <style>{`
                    @keyframes modalSlideIn {
                        from { transform: translateY(40px) scale(0.95); opacity: 0; }
                        to { transform: translateY(0) scale(1); opacity: 1; }
                    }
                `}</style>
            </div>
        );
    }

    // First attempt prompt (no inline quiz yet)
    if (!showInlineQuiz && !result && !isQuizAlreadySubmitted) {
        return (
            <div
                style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(20, 18, 16, 0.6)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 10000,
                    backdropFilter: 'blur(4px)',
                }}
                onClick={handleClose}
            >
                <div
                    className="neo-card"
                    style={{
                        width: '90%',
                        maxWidth: '480px',
                        textAlign: 'center',
                        padding: '36px 28px',
                        backgroundColor: '#FFFFFF',
                        border: '3px solid #141210',
                        borderRadius: '16px',
                        boxShadow: '6px 6px 0 0 #141210',
                        animation: 'modalSlideIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Icon Badge */}
                    <div style={{
                        width: '76px',
                        height: '76px',
                        borderRadius: '50%',
                        backgroundColor: '#4ECDC4',
                        border: '3px solid #141210',
                        boxShadow: '3px 3px 0 0 #141210',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 20px auto',
                    }}>
                        <Brain size={36} strokeWidth={2.5} color="#141210" />
                    </div>

                    <h2 style={{
                        fontSize: '22px',
                        fontWeight: 800,
                        marginBottom: '12px',
                        color: '#141210',
                        lineHeight: 1.2,
                    }}>
                        Quick Quiz Time!
                    </h2>

                    <p style={{
                        color: '#55524E',
                        marginBottom: '28px',
                        fontSize: '16px',
                        fontWeight: 600,
                        lineHeight: 1.5,
                    }}>
                        Before you zoom ahead, let's check what you've learned! Don't worry, it'll be fun!
                    </p>

                    <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
                        <button
                            className="neo-tap"
                            onClick={() => setShowInlineQuiz(true)}
                            style={{
                                width: '100%',
                                padding: '14px 20px',
                                fontSize: '16px',
                                fontWeight: 800,
                                color: '#FFFFFF',
                                backgroundColor: '#4ECDC4',
                                border: '3px solid #141210',
                                borderRadius: '12px',
                                boxShadow: '4px 4px 0 0 #141210',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                            }}
                        >
                            <Zap size={18} strokeWidth={2.5} />
                            Let's Go!
                        </button>
                    </div>
                </div>
                <style>{`
                    @keyframes modalSlideIn {
                        from { transform: translateY(40px) scale(0.95); opacity: 0; }
                        to { transform: translateY(0) scale(1); opacity: 1; }
                    }
                `}</style>
            </div>
        );
    }

    // Result screen after inline quiz submission
    if (result) {
        const isPerfect = result.score === result.total;
        const isHigh = result.total > 0 && (result.score / result.total) >= 0.7;

        return (
            <div
                style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(20, 18, 16, 0.6)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 10000,
                    backdropFilter: 'blur(4px)',
                }}
            >
                <div
                    className="neo-card"
                    style={{
                        width: '90%',
                        maxWidth: '520px',
                        textAlign: 'center',
                        padding: '36px 28px',
                        backgroundColor: '#FFFFFF',
                        border: '3px solid #141210',
                        borderRadius: '16px',
                        boxShadow: '6px 6px 0 0 #141210',
                        animation: 'modalSlideIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    }}
                >
                    {/* Icon Badge */}
                    <div style={{
                        width: '76px',
                        height: '76px',
                        borderRadius: '50%',
                        backgroundColor: isPerfect ? '#3FB873' : isHigh ? '#FFD166' : '#FF7F50',
                        border: '3px solid #141210',
                        boxShadow: '3px 3px 0 0 #141210',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 20px auto',
                    }}>
                        {isPerfect ? <Trophy size={36} strokeWidth={2.5} color="#141210" /> :
                         isHigh ? <Sparkles size={36} strokeWidth={2.5} color="#141210" /> :
                         <Zap size={36} strokeWidth={2.5} color="#141210" />}
                    </div>

                    <h2 style={{
                        fontSize: '24px',
                        fontWeight: 800,
                        marginBottom: '8px',
                        color: '#141210',
                    }}>
                        Quiz Completed!
                    </h2>

                    <h3 style={{
                        fontSize: '20px',
                        fontWeight: 700,
                        marginBottom: '12px',
                        color: '#141210',
                    }}>
                        You scored {result.score} / {result.total}
                    </h3>

                    <p style={{
                        color: '#55524E',
                        marginBottom: '24px',
                        fontSize: '15px',
                        fontWeight: 600,
                        lineHeight: 1.5,
                    }}>
                        {isPerfect
                            ? "Outstanding work! You got every question right!"
                            : isHigh
                            ? "Great job! You did really well!"
                            : "Good effort! Keep going!"}
                        {' '}Want to rewatch the previous lesson or continue your journey?
                    </p>

                    <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
                        {/* Next and Previous buttons row */}
                        <div style={{ display: 'flex', gap: '12px' }}>
                            {onNavigatePrevious && (
                                <button
                                    className="neo-tap"
                                    onClick={() => { handleClose(); onNavigatePrevious(); }}
                                    style={{
                                        flex: 1,
                                        padding: '12px 16px',
                                        fontSize: '15px',
                                        fontWeight: 800,
                                        color: '#141210',
                                        backgroundColor: '#FFD166',
                                        border: '3px solid #141210',
                                        borderRadius: '12px',
                                        boxShadow: '4px 4px 0 0 #141210',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 6,
                                    }}
                                >
                                    <ArrowLeft size={16} strokeWidth={2.5} />
                                    Previous
                                </button>
                            )}
                            {onNavigateNext && (
                                <button
                                    className="neo-tap"
                                    onClick={() => { handleClose(); onNavigateNext(); }}
                                    style={{
                                        flex: 1.5,
                                        padding: '12px 16px',
                                        fontSize: '15px',
                                        fontWeight: 800,
                                        color: '#FFFFFF',
                                        backgroundColor: '#4ECDC4',
                                        border: '3px solid #141210',
                                        borderRadius: '12px',
                                        boxShadow: '4px 4px 0 0 #141210',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 6,
                                    }}
                                >
                                    Next Lesson
                                    <ArrowRight size={16} strokeWidth={2.5} />
                                </button>
                            )}
                        </div>
                        {/* Retry button */}
                        <button
                            className="neo-tap"
                            onClick={() => {
                                setResult(null);
                                setAnswers({});
                                setCurrentQuestionIndex(0);
                                setShowInlineQuiz(true);
                            }}
                            style={{
                                width: '100%',
                                padding: '12px 16px',
                                fontSize: '15px',
                                fontWeight: 800,
                                color: '#141210',
                                backgroundColor: '#EAEAE6',
                                border: '3px solid #141210',
                                borderRadius: '12px',
                                boxShadow: '4px 4px 0 0 #141210',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                            }}
                        >
                            <RotateCcw size={16} strokeWidth={2.5} />
                            Retry Quiz
                        </button>
                    </div>
                </div>
                <style>{`
                    @keyframes modalSlideIn {
                        from { transform: translateY(40px) scale(0.95); opacity: 0; }
                        to { transform: translateY(0) scale(1); opacity: 1; }
                    }
                `}</style>
            </div>
        );
    }

    // Inline quiz view
    if (showInlineQuiz && currentQuestion) {
        return (
            <div
                style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(20, 18, 16, 0.6)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 10000,
                    backdropFilter: 'blur(4px)',
                    padding: '20px',
                }}
            >
                <div
                    className="neo-card"
                    style={{
                        width: '90%',
                        maxWidth: '640px',
                        maxHeight: '85vh',
                        overflow: 'auto',
                        padding: '32px 28px',
                        backgroundColor: '#FFFFFF',
                        border: '3px solid #141210',
                        borderRadius: '16px',
                        boxShadow: '6px 6px 0 0 #141210',
                        animation: 'modalSlideIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header with title and full-screen button */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 24,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <Brain size={24} strokeWidth={2.5} color="#4ECDC4" />
                            <span style={{ fontSize: 18, fontWeight: 800, color: '#141210' }}>Quick Quiz</span>
                        </div>
                        <button
                            onClick={() => { handleClose(); onOpenFullScreen(); }}
                            title="Open in full screen"
                            style={{
                                background: 'none',
                                border: '2px solid #141210',
                                borderRadius: '8px',
                                padding: '6px 10px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                fontSize: 13,
                                fontWeight: 700,
                                color: '#141210',
                            }}
                            className="neo-tap"
                        >
                            <Maximize2 size={14} strokeWidth={2.5} />
                            Full Screen
                        </button>
                    </div>

                    {/* Progress bar */}
                    <div style={{
                        marginBottom: 24,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#141210' }}>
                            Question {currentQuestionIndex + 1} of {totalQuestions}
                        </span>
                        <div className="neo-bar" style={{ width: 160, height: 14, background: '#EAEAE6' }}>
                            <div style={{
                                width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%`,
                                height: '100%',
                                background: '#FF7F50',
                                borderRight: '2px solid #141210',
                                transition: 'width 0.3s ease',
                            }} />
                        </div>
                    </div>

                    {/* Question */}
                    <h3 style={{
                        fontSize: 20,
                        fontWeight: 700,
                        margin: '0 0 24px',
                        lineHeight: 1.4,
                        color: '#141210',
                    }}>
                        {currentQuestion.question}
                    </h3>

                    {/* Options */}
                    <div style={{ display: 'grid', gap: 12, marginBottom: 24 }}>
                        {currentQuestion.options.map((option, idx) => {
                            const isSelected = answers[currentQuestion.id] === idx;
                            return (
                                <label
                                    key={idx}
                                    className={isSelected ? '' : 'neo-tap'}
                                    style={{
                                        padding: '14px 18px',
                                        border: '2.5px solid #141210',
                                        borderRadius: '12px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 14,
                                        backgroundColor: isSelected ? '#FFE6D6' : '#FFFFFF',
                                        boxShadow: isSelected ? 'none' : '3px 3px 0 0 #141210',
                                        transform: isSelected ? 'translate(3px, 3px)' : 'none',
                                        transition: 'all 0.1s ease-in-out',
                                    }}
                                >
                                    <input
                                        type="radio"
                                        name={`qg-${currentQuestion.id}`}
                                        checked={isSelected}
                                        onChange={() => handleOptionSelect(idx)}
                                        style={{ width: 18, height: 18, margin: 0, cursor: 'pointer' }}
                                    />
                                    <span style={{ fontSize: 16, fontWeight: 600, color: '#141210' }}>{option}</span>
                                </label>
                            );
                        })}
                    </div>

                    {/* Navigation */}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <button
                            className="neo-btn"
                            onClick={handlePrevQuestion}
                            disabled={currentQuestionIndex === 0}
                            style={{ opacity: currentQuestionIndex === 0 ? 0.5 : 1 }}
                        >
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <ArrowLeft size={16} strokeWidth={2.5} />
                                Previous
                            </span>
                        </button>

                        {isLastQuestion ? (
                            <button
                                className="neo-btn neo-btn--teal"
                                onClick={() => setIsConfirmSubmitOpen(true)}
                                disabled={submitting || Object.keys(answers).length < totalQuestions}
                                style={{ opacity: (submitting || Object.keys(answers).length < totalQuestions) ? 0.5 : 1 }}
                            >
                                {submitting ? 'Submitting...' : 'Submit Quiz'}
                            </button>
                        ) : (
                            <button
                                className="neo-btn neo-btn--teal"
                                onClick={handleNextQuestion}
                                disabled={answers[currentQuestion.id] === undefined}
                                style={{ opacity: answers[currentQuestion.id] === undefined ? 0.5 : 1 }}
                            >
                                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    Next
                                    <ArrowRight size={16} strokeWidth={2.5} />
                                </span>
                            </button>
                        )}
                    </div>
                </div>

                <ConfirmModal
                    isOpen={isConfirmSubmitOpen}
                    title="Submit Quiz?"
                    message="Are you sure you want to submit your quiz? You won't be able to change your answers."
                    confirmText="Yes, Submit"
                    cancelText="No, wait"
                    onConfirm={handleSubmit}
                    onCancel={() => setIsConfirmSubmitOpen(false)}
                />

                <style>{`
                    @keyframes modalSlideIn {
                        from { transform: translateY(40px) scale(0.95); opacity: 0; }
                        to { transform: translateY(0) scale(1); opacity: 1; }
                    }
                `}</style>
            </div>
        );
    }

    return null;
}

export default QuizGateModal;

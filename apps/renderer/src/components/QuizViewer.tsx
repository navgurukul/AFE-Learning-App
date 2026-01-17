import { useState } from 'react';
import { ipc } from '../lib/ipc.js';

interface QuizQuestion {
    id: string;
    question: string;
    options: string[];
}

interface QuizData {
    questions: QuizQuestion[];
    passingScore?: number; // percent, e.g. 70
}

interface QuizViewerProps {
    lessonId: string;
    studentId: string;
    // We expect the quiz data to be passed in. 
    // In a real app, this might come from lesson.data or lesson.quizData
    quizData: QuizData;
    onCompleted?: () => void;
}

export default function QuizViewer({ lessonId, studentId, quizData, onCompleted }: QuizViewerProps) {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, number>>({});
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<{ score: number; total: number; passed: boolean } | null>(null);

    const totalQuestions = quizData?.questions?.length || 0;
    const currentQuestion = totalQuestions > 0 ? quizData.questions[currentQuestionIndex] : null;
    const isLastQuestion = currentQuestionIndex === totalQuestions - 1;

    function handleOptionSelect(optionIndex: number) {
        if (!currentQuestion) return;
        setAnswers(prev => ({
            ...prev,
            [currentQuestion.id]: optionIndex
        }));
    }

    function handleNext() {
        if (currentQuestionIndex < totalQuestions - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        }
    }

    function handlePrevious() {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(prev => prev - 1);
        }
    }

    async function handleSubmit() {
        if (!confirm('Are you sure you want to submit your quiz?')) return;

        setSubmitting(true);
        const startTime = Date.now(); // We ideally track start time properly, this is a placeholder
        // TODO: Pass actual time taken. For now using a dummy or calculating diff if we had mount time.

        const formattedAnswers = Object.entries(answers).map(([qId, index]) => ({
            questionId: qId,
            selectedAnswerIndex: index
        }));

        try {
            // We assume start time was when component mounted or user clicked start
            const timeTaken = 60; // Mocking 60 seconds or calculate real duration

            const attempt = await ipc.submitQuizAttempt(
                studentId,
                lessonId,
                formattedAnswers,
                timeTaken
            );

            // Attempt object should contain score
            if (attempt) {
                const passed = (attempt.score / attempt.totalQuestions) * 100 >= (quizData.passingScore || 70);
                setResult({
                    score: attempt.score,
                    total: attempt.totalQuestions,
                    passed
                });

                if (onCompleted) {
                    onCompleted();
                }
            }
        } catch (error) {
            console.error('Failed to submit quiz:', error);
            alert('Failed to submit quiz. Please try again.');
        } finally {
            setSubmitting(false);
        }
    }

    if (result) {
        return (
            <div className="quiz-result container text-center" style={{ padding: '2rem' }}>
                <h2>Quiz Completed!</h2>
                <div style={{ fontSize: '4rem', margin: '2rem 0' }}>
                    {result.passed ? '🎉' : '📚'}
                </div>
                <h3>
                    You scored {result.score} / {result.total}
                </h3>
                <p className={result.passed ? 'text-success' : 'text-warning'}>
                    {result.passed ? 'Congratulations! You passed.' : 'Keep practicing. You can try again!'}
                </p>
                <div style={{ marginTop: '2rem' }}>
                    <button className="btn btn-primary" onClick={() => {
                        // Reset state to retry
                        setResult(null);
                        setAnswers({});
                        setCurrentQuestionIndex(0);
                    }}>
                        Retry Quiz
                    </button>
                </div>
            </div>
        );
    }

    if (!quizData || totalQuestions === 0 || !currentQuestion) {
        return (
            <div className="alert alert-error">
                <h3>Error Loading Quiz</h3>
                <p>The quiz data is missing or invalid. Please check the content manifest.</p>
                <button className="btn btn-secondary mt-4" onClick={() => window.location.reload()}>
                    Reload App
                </button>
            </div>
        );
    }

    return (
        <div className="quiz-viewer" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="quiz-header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Question {currentQuestionIndex + 1} of {totalQuestions}</span>
                <div className="progress-bar" style={{ width: '200px', height: '8px', background: '#eee', borderRadius: '4px' }}>
                    <div
                        style={{
                            width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%`,
                            height: '100%',
                            background: 'var(--color-primary)',
                            borderRadius: '4px',
                            transition: 'width 0.3s ease'
                        }}
                    />
                </div>
            </div>

            <div className="card question-card" style={{ padding: '2rem' }}>
                <h3 style={{ marginBottom: '1.5rem' }}>{currentQuestion.question}</h3>

                <div className="options-grid" style={{ display: 'grid', gap: '1rem' }}>
                    {currentQuestion.options.map((option, idx) => (
                        <label
                            key={idx}
                            className={`option-item ${answers[currentQuestion.id] === idx ? 'selected' : ''}`}
                            style={{
                                padding: '1rem',
                                border: '2px solid var(--color-border)',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem',
                                backgroundColor: answers[currentQuestion.id] === idx ? 'rgba(var(--color-primary-rgb), 0.1)' : 'transparent',
                                borderColor: answers[currentQuestion.id] === idx ? 'var(--color-primary)' : 'var(--color-border)'
                            }}
                        >
                            <input
                                type="radio"
                                name={`q-${currentQuestion.id}`}
                                checked={answers[currentQuestion.id] === idx}
                                onChange={() => handleOptionSelect(idx)}
                                style={{ width: '20px', height: '20px' }}
                            />
                            {option}
                        </label>
                    ))}
                </div>
            </div>

            <div className="quiz-footer" style={{ marginTop: '2rem', display: 'flex', justifyContent: 'space-between' }}>
                <button
                    className="btn btn-secondary"
                    onClick={handlePrevious}
                    disabled={currentQuestionIndex === 0}
                >
                    Previous
                </button>

                {isLastQuestion ? (
                    <button
                        className="btn btn-primary"
                        onClick={handleSubmit}
                        disabled={submitting || Object.keys(answers).length < totalQuestions}
                    >
                        {submitting ? 'Submitting...' : 'Submit Quiz'}
                    </button>
                ) : (
                    <button
                        className="btn btn-primary"
                        onClick={handleNext}
                        disabled={answers[currentQuestion.id] === undefined}
                    >
                        Next
                    </button>
                )}
            </div>
        </div>
    );
}

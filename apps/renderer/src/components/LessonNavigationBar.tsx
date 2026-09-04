import { useState } from 'react';
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import type { Lesson } from '@afe/shared';

interface LessonNavigationBarProps {
    sortedLessons: Lesson[];
    currentLessonIndex: number;
    lessonCompletionStates: Record<string, boolean>;
    currentWatchPercentage: number;
    isCurrentLessonCompleted: boolean;
    onNavigateNext: () => void;
    onNavigatePrevious: () => void;
}

export function LessonNavigationBar({
    sortedLessons,
    currentLessonIndex,
    lessonCompletionStates,
    currentWatchPercentage,
    isCurrentLessonCompleted,
    onNavigateNext,
    onNavigatePrevious,
}: LessonNavigationBarProps) {
    const [hoveredButton, setHoveredButton] = useState<'prev' | 'next' | null>(null);

    const isFirstLesson = currentLessonIndex === 0;
    const isLastLesson = currentLessonIndex === sortedLessons.length - 1;

    // Find previous lesson (for label)
    const prevLesson = !isFirstLesson ? sortedLessons[currentLessonIndex - 1] : null;
    // Find next lesson (for label)
    const nextLesson = !isLastLesson ? sortedLessons[currentLessonIndex + 1] : null;

    // Check if next lesson is unlocked (current lesson must be completed)
    const isNextLessonLocked = nextLesson
        ? !lessonCompletionStates[sortedLessons[currentLessonIndex].id]
        : false;

    // Previous button: always enabled except on first lesson
    const isPrevDisabled = isFirstLesson;
    const isPrevClickable = !isFirstLesson;

    // Next button: needs current lesson completed AND next lesson unlocked
    const isNextActive = isCurrentLessonCompleted && !isLastLesson && !isNextLessonLocked;
    const isNextPermanentlyDisabled = isLastLesson;

    // Fill percentage for the Next button (only animate if not permanently disabled)
    const nextFillPercent = isNextPermanentlyDisabled ? 0 : Math.min(currentWatchPercentage, 100);

    // Tooltip messages
    const getNextTooltip = () => {
        if (isLastLesson) return "Woohoo! You've completed the whole course!";
        if (isCurrentLessonCompleted) return '';
        const remaining = Math.max(0, 95 - Math.floor(currentWatchPercentage));
        if (remaining <= 0) return "Almost there! Just a tiny bit more!";
        return `Just ${remaining}% more! Keep watching!`;
    };

    const getPrevTooltip = () => {
        if (isFirstLesson) return "This is where your journey begins!";
        return '';
    };

    const nextTooltip = getNextTooltip();
    const prevTooltip = getPrevTooltip();

    return (
        <div style={{
            marginTop: 16,
            display: 'flex',
            gap: 16,
            width: '100%',
        }}>
            {/* Previous Button */}
            <div
                style={{ flex: 1, position: 'relative' }}
                onMouseEnter={() => setHoveredButton('prev')}
                onMouseLeave={() => setHoveredButton(null)}
            >
                {/* Cloud Tooltip */}
                {hoveredButton === 'prev' && prevTooltip && (
                    <div style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 12px)',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 100,
                        animation: 'cloudFloat 0.3s ease-out',
                    }}>
                        <div style={{
                            backgroundColor: '#FFFFFF',
                            border: '2.5px solid #141210',
                            borderRadius: '20px 20px 20px 6px',
                            boxShadow: '3px 3px 0 #141210',
                            padding: '10px 16px',
                            fontSize: 14,
                            fontWeight: 700,
                            color: '#141210',
                            whiteSpace: 'nowrap',
                            maxWidth: 260,
                            textAlign: 'center',
                        }}>
                            {prevTooltip}
                        </div>
                    </div>
                )}

                <button
                    onClick={isPrevClickable ? onNavigatePrevious : undefined}
                    disabled={isPrevDisabled}
                    style={{
                        width: '100%',
                        position: 'relative',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 12,
                        padding: '16px 20px',
                        border: '2.5px solid #141210',
                        borderRadius: '14px',
                        cursor: isPrevClickable ? 'pointer' : 'not-allowed',
                        backgroundColor: isPrevDisabled ? '#EAEAE6' : '#FFD166',
                        color: isPrevDisabled ? '#A0A0A0' : '#141210',
                        fontWeight: 800,
                        fontSize: 16,
                        boxShadow: isPrevClickable ? '4px 4px 0 #141210' : 'none',
                        opacity: isPrevDisabled ? 0.5 : 1,
                        transition: 'all 0.2s ease',
                        transform: isPrevClickable ? 'translate(0, 0)' : 'none',
                    }}
                    className={isPrevClickable ? 'neo-tap' : ''}
                >
                    {isPrevDisabled ? (
                        <Lock size={20} strokeWidth={2.5} />
                    ) : (
                        <ChevronLeft size={22} strokeWidth={2.5} />
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 14, fontWeight: 600, opacity: 0.7 }}>Previous</span>
                        {prevLesson && (
                            <span style={{
                                fontSize: 13,
                                fontWeight: 600,
                                maxWidth: 180,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}>
                                {prevLesson.title}
                            </span>
                        )}
                    </div>
                </button>
            </div>

            {/* Next Button */}
            <div
                style={{ flex: 1, position: 'relative' }}
                onMouseEnter={() => setHoveredButton('next')}
                onMouseLeave={() => setHoveredButton(null)}
            >
                {/* Cloud Tooltip */}
                {hoveredButton === 'next' && nextTooltip && !isNextActive && (
                    <div style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 12px)',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 100,
                        animation: 'cloudFloat 0.3s ease-out',
                    }}>
                        <div style={{
                            backgroundColor: '#FFFFFF',
                            border: '2.5px solid #141210',
                            borderRadius: '20px 20px 6px 20px',
                            boxShadow: '3px 3px 0 #141210',
                            padding: '10px 16px',
                            fontSize: 14,
                            fontWeight: 700,
                            color: '#141210',
                            whiteSpace: 'nowrap',
                            maxWidth: 260,
                            textAlign: 'center',
                        }}>
                            {nextTooltip}
                        </div>
                    </div>
                )}

                <button
                    onClick={isNextActive ? onNavigateNext : undefined}
                    disabled={!isNextActive}
                    style={{
                        width: '100%',
                        position: 'relative',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 12,
                        padding: '16px 20px',
                        border: '2.5px solid #141210',
                        borderRadius: '14px',
                        cursor: isNextActive ? 'pointer' : 'not-allowed',
                        backgroundColor: isNextPermanentlyDisabled ? '#EAEAE6' : (isNextActive ? '#4ECDC4' : '#EAEAE6'),
                        color: isNextActive ? '#141210' : '#A0A0A0',
                        fontWeight: 800,
                        fontSize: 16,
                        boxShadow: isNextActive ? '4px 4px 0 #141210' : 'none',
                        opacity: isNextPermanentlyDisabled ? 0.5 : 1,
                        transition: 'all 0.3s ease',
                        transform: isNextActive ? 'translate(0, 0)' : 'none',
                    }}
                    className={isNextActive ? 'neo-tap' : ''}
                >
                    {/* Progressive color fill bar (only for non-permanently-disabled) */}
                    {!isNextPermanentlyDisabled && !isNextActive && (
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            bottom: 0,
                            width: `${nextFillPercent}%`,
                            backgroundColor: nextFillPercent >= 95 ? '#4ECDC4' : 'rgba(78, 205, 196, 0.25)',
                            transition: 'width 0.5s ease, background-color 0.3s ease',
                            zIndex: 0,
                            borderRadius: '12px 0 0 12px',
                        }} />
                    )}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        position: 'relative',
                        zIndex: 1,
                    }}>
                        <span style={{ fontSize: 14, fontWeight: 600, opacity: 0.7 }}>Next</span>
                        {nextLesson && (
                            <span style={{
                                fontSize: 13,
                                fontWeight: 600,
                                maxWidth: 180,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}>
                                {nextLesson.title}
                            </span>
                        )}
                    </div>
                    {isNextPermanentlyDisabled ? (
                        <Lock size={20} strokeWidth={2.5} style={{ position: 'relative', zIndex: 1 }} />
                    ) : (
                        <ChevronRight size={22} strokeWidth={2.5} style={{ position: 'relative', zIndex: 1 }} />
                    )}
                </button>
            </div>

            <style>{`
                @keyframes cloudFloat {
                    from { transform: translateX(-50%) translateY(8px); opacity: 0; }
                    to { transform: translateX(-50%) translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
}

export default LessonNavigationBar;

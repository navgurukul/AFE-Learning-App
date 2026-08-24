import { useState, useEffect, useRef } from 'react';

interface UpdateRestartModalProps {
    isOpen: boolean;
    onRestart: () => void;
}

export function UpdateRestartModal({ isOpen, onRestart }: UpdateRestartModalProps) {
    const [countdown, setCountdown] = useState(5);
    const hasTriggeredRef = useRef(false);

    useEffect(() => {
        if (!isOpen) {
            setCountdown(5);
            hasTriggeredRef.current = false;
            return;
        }

        setCountdown(5);
        hasTriggeredRef.current = false;

        const interval = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    if (!hasTriggeredRef.current) {
                        hasTriggeredRef.current = true;
                        onRestart();
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [isOpen, onRestart]);

    if (!isOpen) return null;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(20, 18, 16, 0.75)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 20000,
                backdropFilter: 'blur(6px)',
            }}
        >
            <div
                className="neo-card"
                style={{
                    width: '90%',
                    maxWidth: '520px',
                    textAlign: 'center',
                    padding: '44px 36px',
                    animation: 'modalSlideIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    backgroundColor: '#FFFFFF',
                    border: '3px solid #141210',
                    boxShadow: '8px 8px 0px 0px #141210',
                }}
            >
                <div style={{ fontSize: '54px', marginBottom: '16px' }}>🚀</div>

                <h2
                    style={{
                        fontSize: '26px',
                        fontWeight: 800,
                        marginBottom: '16px',
                        color: '#141210',
                        letterSpacing: '-0.5px',
                    }}
                >
                    Update Ready!
                </h2>

                <p
                    style={{
                        color: '#141210',
                        marginBottom: '28px',
                        fontSize: '18px',
                        fontWeight: 600,
                        lineHeight: 1.5,
                    }}
                >
                    AFE Career Tours App will restart in{' '}
                    <span
                        style={{
                            display: 'inline-block',
                            backgroundColor: '#FFE66D',
                            border: '2px solid #141210',
                            borderRadius: '8px',
                            padding: '2px 10px',
                            fontWeight: 800,
                            color: '#141210',
                        }}
                    >
                        {countdown} {countdown === 1 ? 'second' : 'seconds'}
                    </span>{' '}
                    for an important update. Don't worry your progress will not be lost.
                </p>

                {/* Progress bar countdown */}
                <div
                    className="neo-bar"
                    style={{
                        width: '100%',
                        height: '14px',
                        backgroundColor: '#EAEAE6',
                        border: '2px solid #141210',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        marginBottom: '32px',
                    }}
                >
                    <div
                        style={{
                            width: `${(countdown / 5) * 100}%`,
                            height: '100%',
                            backgroundColor: '#4ECDC4',
                            transition: 'width 1s linear',
                        }}
                    />
                </div>

                <div>
                    <button
                        type="button"
                        className="neo-btn neo-btn--teal"
                        onClick={() => {
                            if (!hasTriggeredRef.current) {
                                hasTriggeredRef.current = true;
                                onRestart();
                            }
                        }}
                        style={{
                            width: '100%',
                            padding: '16px 24px',
                            fontSize: '18px',
                            fontWeight: 700,
                        }}
                    >
                        Restart Now 🔄
                    </button>
                </div>
            </div>
            <style>{`
                @keyframes modalSlideIn {
                    from { transform: translateY(50px) scale(0.95); opacity: 0; }
                    to { transform: translateY(0) scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
}

import { useState, useEffect, useRef } from 'react';

interface UpdateRestartModalProps {
    isOpen: boolean;
    version?: string;
    onRestart: () => void;
    onClose?: () => void;
}

export function UpdateRestartModal({ isOpen, version, onRestart, onClose }: UpdateRestartModalProps) {
    const isImportant = Boolean(version && version.trim().endsWith('1'));
    const [countdown, setCountdown] = useState(30);
    const [isMinimized, setIsMinimized] = useState(false);
    const hasTriggeredRef = useRef(false);

    useEffect(() => {
        if (!isOpen) {
            setCountdown(30);
            setIsMinimized(false);
            hasTriggeredRef.current = false;
            return;
        }

        // On open, ensure progress save event is dispatched
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('app:save-progress'));
        }

        setCountdown(30);
        setIsMinimized(false);
        hasTriggeredRef.current = false;

        // If not an important update, do not run the auto-restart timer
        if (!isImportant) {
            return;
        }

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
    }, [isOpen, isImportant, onRestart]);

    if (!isOpen) return null;

    // Case 1: Important Update - Minimized view (Floating Top-Right Badge)
    if (isImportant && isMinimized) {
        return (
            <div
                style={{
                    position: 'fixed',
                    top: '20px',
                    right: '20px',
                    zIndex: 20000,
                    animation: 'widgetSlideDown 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                }}
            >
                <div
                    className="neo-card"
                    style={{
                        backgroundColor: '#FFFFFF',
                        border: '3px solid #141210',
                        boxShadow: '6px 6px 0px 0px #141210',
                        padding: '14px 18px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        borderRadius: '12px',
                    }}
                >
                    <div style={{ fontSize: '26px' }}>🚀</div>
                    <div>
                        <div style={{ fontSize: '11px', fontWeight: 800, color: '#E03131', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Important Update {version ? `v${version}` : ''}
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#141210', marginTop: '2px' }}>
                            Restarting in{' '}
                            <span
                                style={{
                                    backgroundColor: '#FFE66D',
                                    padding: '1px 6px',
                                    border: '1.5px solid #141210',
                                    borderRadius: '4px',
                                    fontWeight: 800,
                                }}
                            >
                                {countdown}s
                            </span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
                                padding: '8px 14px',
                                fontSize: '13px',
                                fontWeight: 800,
                                whiteSpace: 'nowrap',
                            }}
                        >
                            Restart Now 🔄
                        </button>
                        <button
                            type="button"
                            className="neo-btn"
                            onClick={() => setIsMinimized(false)}
                            style={{
                                padding: '8px 10px',
                                fontSize: '14px',
                                fontWeight: 800,
                                backgroundColor: '#F8F9FA',
                            }}
                            title="Expand modal"
                        >
                            ⤢
                        </button>
                    </div>
                </div>
                <style>{`
                    @keyframes widgetSlideDown {
                        from { transform: translateY(-30px); opacity: 0; }
                        to { transform: translateY(0); opacity: 1; }
                    }
                `}</style>
            </div>
        );
    }

    // Case 2: Important Update - Full Modal View (with 30s countdown & minimize option)
    if (isImportant) {
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
                        position: 'relative',
                        width: '90%',
                        maxWidth: '540px',
                        textAlign: 'center',
                        padding: '40px 36px',
                        animation: 'modalSlideIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                        backgroundColor: '#FFFFFF',
                        border: '3px solid #141210',
                        boxShadow: '8px 8px 0px 0px #141210',
                    }}
                >
                    {/* Minimize button top right */}
                    <button
                        type="button"
                        onClick={() => setIsMinimized(true)}
                        className="neo-btn"
                        style={{
                            position: 'absolute',
                            top: '16px',
                            right: '16px',
                            padding: '6px 12px',
                            fontSize: '13px',
                            fontWeight: 700,
                            backgroundColor: '#F8F9FA',
                        }}
                        title="Minimize to top right"
                    >
                        🗕 Minimize
                    </button>

                    <div style={{ fontSize: '50px', marginBottom: '12px' }}>🚀</div>

                    <div
                        style={{
                            display: 'inline-block',
                            backgroundColor: '#FFE3E3',
                            border: '2px solid #E03131',
                            borderRadius: '20px',
                            padding: '4px 14px',
                            fontSize: '12px',
                            fontWeight: 800,
                            color: '#E03131',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            marginBottom: '12px',
                        }}
                    >
                        Important Update {version ? `v${version}` : ''}
                    </div>

                    <h2
                        style={{
                            fontSize: '26px',
                            fontWeight: 800,
                            marginBottom: '14px',
                            color: '#141210',
                            letterSpacing: '-0.5px',
                        }}
                    >
                        Restarting for Important Update
                    </h2>

                    <p
                        style={{
                            color: '#141210',
                            marginBottom: '24px',
                            fontSize: '17px',
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
                        for an important update. Don't worry, your progress has been saved.
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
                            marginBottom: '28px',
                        }}
                    >
                        <div
                            style={{
                                width: `${(countdown / 30) * 100}%`,
                                height: '100%',
                                backgroundColor: '#4ECDC4',
                                transition: 'width 1s linear',
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
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
                                flex: 1,
                                padding: '14px 20px',
                                fontSize: '17px',
                                fontWeight: 800,
                            }}
                        >
                            Restart Immediately 🔄
                        </button>
                        <button
                            type="button"
                            className="neo-btn"
                            onClick={() => setIsMinimized(true)}
                            style={{
                                padding: '14px 20px',
                                fontSize: '15px',
                                fontWeight: 700,
                                backgroundColor: '#F8F9FA',
                            }}
                        >
                            Minimize 🗕
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

    // Case 3: Regular / Optional Update - Dismissible modal without auto-timer
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
                    position: 'relative',
                    width: '90%',
                    maxWidth: '520px',
                    textAlign: 'center',
                    padding: '40px 36px',
                    animation: 'modalSlideIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    backgroundColor: '#FFFFFF',
                    border: '3px solid #141210',
                    boxShadow: '8px 8px 0px 0px #141210',
                }}
            >
                <div style={{ fontSize: '50px', marginBottom: '12px' }}>📦</div>

                <div
                    style={{
                        display: 'inline-block',
                        backgroundColor: '#E6FCF5',
                        border: '2px solid #0CA678',
                        borderRadius: '20px',
                        padding: '4px 14px',
                        fontSize: '12px',
                        fontWeight: 800,
                        color: '#0CA678',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        marginBottom: '12px',
                    }}
                >
                    Update Available {version ? `v${version}` : ''}
                </div>

                <h2
                    style={{
                        fontSize: '26px',
                        fontWeight: 800,
                        marginBottom: '14px',
                        color: '#141210',
                        letterSpacing: '-0.5px',
                    }}
                >
                    New Version Ready!
                </h2>

                <p
                    style={{
                        color: '#141210',
                        marginBottom: '28px',
                        fontSize: '17px',
                        fontWeight: 600,
                        lineHeight: 1.5,
                    }}
                >
                    A new version of AFE Career Tours is downloaded and ready to install. You can restart now, or continue learning and it will update automatically the next time you start the app.
                </p>

                <div style={{ display: 'flex', gap: '14px', justifyContent: 'center' }}>
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
                            flex: 1,
                            padding: '14px 20px',
                            fontSize: '17px',
                            fontWeight: 800,
                        }}
                    >
                        Restart Now 🔄
                    </button>
                    {onClose && (
                        <button
                            type="button"
                            className="neo-btn"
                            onClick={onClose}
                            style={{
                                padding: '14px 20px',
                                fontSize: '15px',
                                fontWeight: 700,
                                backgroundColor: '#F8F9FA',
                            }}
                        >
                            Later / Cancel ✕
                        </button>
                    )}
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

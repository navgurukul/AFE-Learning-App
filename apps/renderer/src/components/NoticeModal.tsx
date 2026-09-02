import React from 'react';

export type NoticeModalVariant = 'locked' | 'success' | 'warning' | 'info';

interface NoticeModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    variant?: NoticeModalVariant;
    icon?: React.ReactNode;
    buttonText?: string;
    onClose: () => void;
}

const VARIANT_CONFIG: Record<NoticeModalVariant, { defaultIcon: string; badgeBg: string; buttonBg: string; buttonColor: string }> = {
    locked: {
        defaultIcon: '🔒',
        badgeBg: '#FFE08A',
        buttonBg: '#141210',
        buttonColor: '#FFFFFF',
    },
    success: {
        defaultIcon: '🎉',
        badgeBg: '#3FB873',
        buttonBg: '#3FB873',
        buttonColor: '#FFFFFF',
    },
    warning: {
        defaultIcon: '⚠️',
        badgeBg: '#FFAE63',
        buttonBg: '#FF6B35',
        buttonColor: '#FFFFFF',
    },
    info: {
        defaultIcon: '💡',
        badgeBg: '#4ECDC4',
        buttonBg: '#4ECDC4',
        buttonColor: '#141210',
    },
};

export function NoticeModal({
    isOpen,
    title,
    message,
    variant = 'info',
    icon,
    buttonText = 'Got It 👍',
    onClose,
}: NoticeModalProps) {
    if (!isOpen) return null;

    const config = VARIANT_CONFIG[variant] || VARIANT_CONFIG.info;
    const displayIcon = icon ?? config.defaultIcon;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(20, 18, 16, 0.6)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 10000,
                backdropFilter: 'blur(4px)',
            }}
            onClick={onClose}
        >
            <div
                className="neo-card"
                style={{
                    width: '90%',
                    maxWidth: '440px',
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
                <div
                    style={{
                        width: '76px',
                        height: '76px',
                        borderRadius: '50%',
                        backgroundColor: config.badgeBg,
                        border: '3px solid #141210',
                        boxShadow: '3px 3px 0 0 #141210',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '38px',
                        margin: '0 auto 20px auto',
                    }}
                >
                    {displayIcon}
                </div>

                {/* Title */}
                <h2
                    style={{
                        fontSize: '22px',
                        fontWeight: 800,
                        marginBottom: '12px',
                        color: '#141210',
                        lineHeight: 1.2,
                    }}
                >
                    {title}
                </h2>

                {/* Message */}
                <p
                    style={{
                        color: '#55524E',
                        marginBottom: '28px',
                        fontSize: '16px',
                        fontWeight: 600,
                        lineHeight: 1.5,
                    }}
                >
                    {message}
                </p>

                {/* Dismiss Button */}
                <button
                    type="button"
                    className="neo-tap"
                    onClick={onClose}
                    style={{
                        width: '100%',
                        padding: '14px 20px',
                        fontSize: '16px',
                        fontWeight: 800,
                        color: config.buttonColor,
                        backgroundColor: config.buttonBg,
                        border: '3px solid #141210',
                        borderRadius: '12px',
                        boxShadow: '4px 4px 0 0 #141210',
                        cursor: 'pointer',
                        transition: 'transform 0.1s ease',
                    }}
                >
                    {buttonText}
                </button>
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

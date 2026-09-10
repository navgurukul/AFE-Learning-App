import React, { useState, useEffect } from 'react';

interface UpdateWarningBannerProps {
    version?: string;
    onRestart: () => void;
    onOpenModal?: () => void;
}

export function UpdateWarningBanner({ version, onRestart, onOpenModal }: UpdateWarningBannerProps) {
    const isMajor = Boolean(version && version.trim().endsWith('1'));
    const storageKey = version ? `afe_major_update_dismiss_count_${version.trim()}` : '';

    const [dismissCount, setDismissCount] = useState<number>(0);
    const [isDismissed, setIsDismissed] = useState<boolean>(false);

    useEffect(() => {
        if (!storageKey) return;
        const stored = localStorage.getItem(storageKey);
        const count = stored ? parseInt(stored, 10) || 0 : 0;
        setDismissCount(count);
        // The banner is always shown on startup if an update is available
        setIsDismissed(false);
    }, [storageKey]);

    if (!version || isDismissed) {
        return null;
    }

    const isLockedOut = isMajor && dismissCount >= 3;

    const handleDismiss = () => {
        if (isLockedOut) return;

        if (isMajor && storageKey) {
            const newCount = dismissCount + 1;
            setDismissCount(newCount);
            localStorage.setItem(storageKey, String(newCount));
            if (newCount >= 3) {
                // Cannot be dismissed anymore once 3 is reached
                return;
            }
        }
        setIsDismissed(true);
    };

    return (
        <div
            style={{
                width: '100%',
                backgroundColor: isMajor ? '#FFF5F5' : '#E6FCF5',
                borderBottom: isMajor ? '2.5px solid #DC2626' : '2.5px solid #0CA678',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                padding: '10px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                zIndex: 10000,
                position: 'relative',
                boxSizing: 'border-box',
                animation: 'bannerSlideDown 0.25s ease-out',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '22px', flexShrink: 0 }}>
                    {isMajor ? '⚠️' : '📦'}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span
                            style={{
                                fontSize: '12px',
                                fontWeight: 900,
                                textTransform: 'uppercase',
                                letterSpacing: '0.6px',
                                color: isMajor ? '#DC2626' : '#0CA678',
                                backgroundColor: isMajor ? '#FEE2E2' : '#C3FAE8',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                border: `1px solid ${isMajor ? '#DC2626' : '#0CA678'}`,
                            }}
                        >
                            {isMajor ? 'Major Update' : 'Update Available'} (v{version})
                        </span>

                        {isMajor && (
                            <span
                                style={{
                                    fontSize: '11px',
                                    fontWeight: 800,
                                    color: isLockedOut ? '#DC2626' : '#78350F',
                                    backgroundColor: isLockedOut ? '#FEE2E2' : '#FEF3C7',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    border: `1px solid ${isLockedOut ? '#DC2626' : '#D97706'}`,
                                }}
                            >
                                {isLockedOut
                                    ? 'Lockout Active: 3/3 Dismissals Used'
                                    : `Dismissals: ${dismissCount}/3`}
                            </span>
                        )}
                    </div>

                    <div
                        style={{
                            fontSize: '13px',
                            fontWeight: 700,
                            color: '#141210',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {isLockedOut
                            ? 'Maximum dismissals reached. You must restart the application to apply this mandatory update.'
                            : isMajor
                            ? 'Please install this major update. A restart is required to apply the latest learning modules.'
                            : 'A new version has been downloaded and is ready to install.'}
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                {onOpenModal && (
                    <button
                        type="button"
                        onClick={onOpenModal}
                        style={{
                            fontFamily: 'inherit',
                            fontSize: '12px',
                            fontWeight: 700,
                            backgroundColor: '#FFFFFF',
                            color: '#141210',
                            border: '1.5px solid #141210',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            cursor: 'pointer',
                            boxShadow: '1.5px 1.5px 0 0 #141210',
                        }}
                    >
                        Details
                    </button>
                )}

                <button
                    type="button"
                    onClick={onRestart}
                    style={{
                        fontFamily: 'inherit',
                        fontSize: '13px',
                        fontWeight: 800,
                        backgroundColor: isMajor ? '#DC2626' : '#0CA678',
                        color: '#FFFFFF',
                        border: '2px solid #141210',
                        borderRadius: '6px',
                        padding: '6px 16px',
                        cursor: 'pointer',
                        boxShadow: '2px 2px 0 0 #141210',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                    }}
                >
                    Restart Now 🔄
                </button>

                {!isLockedOut && (
                    <button
                        type="button"
                        onClick={handleDismiss}
                        title={isMajor ? `Dismiss update (${3 - dismissCount} remaining)` : 'Dismiss banner'}
                        style={{
                            fontFamily: 'inherit',
                            fontSize: '13px',
                            fontWeight: 700,
                            background: 'transparent',
                            color: '#444444',
                            border: '1.5px solid #9CA3AF',
                            borderRadius: '6px',
                            padding: '6px 10px',
                            cursor: 'pointer',
                        }}
                    >
                        ✕
                    </button>
                )}
            </div>

            <style>{`
                @keyframes bannerSlideDown {
                    from { transform: translateY(-100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
}

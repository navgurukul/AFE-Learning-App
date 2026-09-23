import { useState } from 'react';
import { ipc } from '../lib/ipc.ts';
import { ConfirmModal } from './ConfirmModal.tsx';
import { useNavigate } from 'react-router-dom';

interface DeveloperModeBannerProps {
    isDevMode: boolean;
    serverUrl?: string;
    onStatusChange?: (isDev: boolean) => void;
}

export function DeveloperModeBanner({ isDevMode, serverUrl, onStatusChange }: DeveloperModeBannerProps) {
    const navigate = useNavigate();
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isPurging, setIsPurging] = useState(false);

    if (!isDevMode) return null;

    const handleTurnOffConfirm = async () => {
        setIsPurging(true);
        try {
            await ipc.turnOffDevModeAndPurge();
            if (onStatusChange) onStatusChange(false);
            setIsConfirmOpen(false);
            navigate('/');
            // Reload window to ensure clean slate across all memory caches and router state
            window.location.reload();
        } catch (error) {
            console.error('Failed to turn off developer mode and purge:', error);
            alert('Failed to turn off developer mode. Please try again.');
        } finally {
            setIsPurging(false);
        }
    };

    return (
        <>
            <div
                id="afe-developer-mode-banner"
                style={{
                    position: 'sticky',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 9999,
                    backgroundColor: '#FEF08A',
                    color: '#854D0E',
                    borderBottom: '3px solid #141210',
                    padding: '8px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 4px 0 rgba(0,0,0,0.1)',
                    fontFamily: 'inherit',
                    fontSize: 14,
                    fontWeight: 700,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{
                        backgroundColor: '#EAB308',
                        color: '#141210',
                        padding: '3px 8px',
                        borderRadius: 4,
                        border: '1.5px solid #141210',
                        fontSize: 12,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                    }}>
                        DEV MODE
                    </span>
                    <span style={{ fontSize: 15, color: '#141210' }}>
                        ⚠️ The developer mode is on
                    </span>
                    {serverUrl && (
                        <span style={{ fontSize: 12, color: '#713F12', fontWeight: 600 }}>
                            (Using: {serverUrl})
                        </span>
                    )}
                </div>

                <div>
                    <button
                        type="button"
                        id="afe-dev-mode-turn-off-btn"
                        onClick={() => setIsConfirmOpen(true)}
                        disabled={isPurging}
                        style={{
                            backgroundColor: '#EF4444',
                            color: '#FFFFFF',
                            border: '2px solid #141210',
                            borderRadius: 6,
                            padding: '5px 14px',
                            fontWeight: 700,
                            fontSize: 13,
                            cursor: 'pointer',
                            boxShadow: '2px 2px 0 #141210',
                            transition: 'all 0.1s ease',
                        }}
                    >
                        {isPurging ? 'Purging...' : 'Turn Off Developer Mode'}
                    </button>
                </div>
            </div>

            <ConfirmModal
                isOpen={isConfirmOpen}
                title="Turn Off Developer Mode?"
                message="Turning off Developer Mode will package and send dev logs to the dev server, purge the local log file, permanently purge ALL SQLite DB data (students, sessions, progress), and reset the app to a CLEAN SLATE. Are you sure you want to proceed?"
                confirmText={isPurging ? "Purging..." : "Yes, Purge & Turn Off"}
                cancelText="Cancel"
                submitting={isPurging}
                onConfirm={handleTurnOffConfirm}
                onCancel={() => setIsConfirmOpen(false)}
            />
        </>
    );
}

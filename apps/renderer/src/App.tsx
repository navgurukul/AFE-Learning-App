import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
import BeginLearning from './pages/BeginLearning.js';
import AvatarSelection from './pages/AvatarSelection.js';
import StudentDashboard from './pages/StudentDashboard.js';
import ModuleDetail from './pages/ModuleDetail.js';
import AILearningCenter from './pages/AILearningCenter.js';
import { FeedbackSurveyModal } from './components/FeedbackSurveyModal.tsx';
import { ConfirmModal } from './components/ConfirmModal.tsx';
import { SchoolSetupModal } from './components/SchoolSetupModal.tsx';
import { AdminPasswordModal } from './components/AdminPasswordModal.tsx';
import { UpdateRestartModal } from './components/UpdateRestartModal.tsx';
import { ipc } from './lib/ipc.ts';
import { exitPictureInPictureAndCleanup } from './lib/mediaCleanup.ts';

function App() {
    const navigate = useNavigate();
    const location = useLocation();
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
    const [isExitModalOpen, setIsExitModalOpen] = useState(false);
    const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
    const [downloadedVersion, setDownloadedVersion] = useState<string | undefined>(undefined);

    // School Setup state
    const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
    const [isAdminPwdOpen, setIsAdminPwdOpen] = useState(false);
    const [setupData, setSetupData] = useState<{
        schoolName: string;
        schoolUdise: string;
        state: string;
        city: string;
        district: string;
        districtCode: string;
        zipcodePostalCode?: string;
        schoolType: string;
    } | undefined>(undefined);

    // First-run setup check
    useEffect(() => {
        (async () => {
            try {
                const status = await ipc.getSetupStatus();
                if (!status.setupCompleted) {
                    setSetupData({
                        schoolName: status.schoolName,
                        schoolUdise: status.schoolUdise || '',
                        state: status.state,
                        city: status.city,
                        district: status.district,
                        districtCode: status.districtCode,
                        zipcodePostalCode: status.zipcodePostalCode || '110001',
                        schoolType: status.schoolType,
                    });
                    setIsSetupModalOpen(true);
                }
            } catch (e) {
                console.error('[App] Failed to check setup status:', e);
            }
        })();
    }, []);

    // Ctrl+Shift+A ×5 secret shortcut
    const ctrlShiftACountRef = useRef(0);
    const ctrlShiftATimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
            ctrlShiftACountRef.current++;

            // Reset counter after 3 seconds of inactivity
            if (ctrlShiftATimerRef.current) {
                clearTimeout(ctrlShiftATimerRef.current);
            }
            ctrlShiftATimerRef.current = setTimeout(() => {
                ctrlShiftACountRef.current = 0;
            }, 3000);

            if (ctrlShiftACountRef.current >= 5) {
                ctrlShiftACountRef.current = 0;
                if (ctrlShiftATimerRef.current) {
                    clearTimeout(ctrlShiftATimerRef.current);
                }
                setIsAdminPwdOpen(true);
            }
        }
    }, []);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    const handleAdminPasswordSuccess = async () => {
        try {
            const status = await ipc.getSetupStatus();
            setSetupData({
                schoolName: status.schoolName,
                schoolUdise: status.schoolUdise || '',
                state: status.state,
                city: status.city,
                district: status.district,
                districtCode: status.districtCode,
                zipcodePostalCode: status.zipcodePostalCode || '110001',
                schoolType: status.schoolType,
            });
            setIsSetupModalOpen(true);
        } catch (e) {
            console.error('[App] Failed to load setup data for re-edit:', e);
        }
    };

    useEffect(() => {
        if (!window.electronAPI?.on) return;

        const unsubscribeLogout = window.electronAPI.on('app:request-logout', async () => {
            console.log('[App] Received app:request-logout event from main process');
            await exitPictureInPictureAndCleanup();
            try {
                const metThreshold = await ipc.hasMetEngagementThreshold();
                if (metThreshold) {
                    setIsFeedbackOpen(true);
                } else {
                    await ipc.endSession(null, null);
                    navigate('/');
                }
            } catch (e) {
                await ipc.endSession(null, null);
                navigate('/');
            }
        });

        const unsubscribeExit = window.electronAPI.on('app:request-exit', () => {
            console.log('[App] Received app:request-exit event from main process');
            const isSessionPage = location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/module') || location.pathname.startsWith('/ai-tutor');
            if (!isSessionPage) {
                ipc.exitImmediately();
            } else {
                setIsExitModalOpen(true);
            }
        });

        const unsubscribeUpdate = window.electronAPI.on('updater:update-downloaded', (data?: { version?: string }) => {
            console.log('[App] Received updater:update-downloaded event from main process, version:', data?.version);
            setDownloadedVersion(data?.version);
            setIsUpdateModalOpen(true);
        });

        return () => {
            if (typeof unsubscribeLogout === 'function') unsubscribeLogout();
            if (typeof unsubscribeExit === 'function') unsubscribeExit();
            if (typeof unsubscribeUpdate === 'function') unsubscribeUpdate();
        };
    }, [location.pathname, navigate]);

    const handleFeedbackSubmit = async (
        csat: number,
        itp: number,
        overallRating: number,
        exploreCareerRating: number,
        seeMoreToursRating: number
    ) => {
        try {
            await exitPictureInPictureAndCleanup();
            await ipc.endSession(csat, itp, overallRating, exploreCareerRating, seeMoreToursRating);
            setIsFeedbackOpen(false);
            navigate('/');
        } catch (error) {
            console.error('Failed to end session on global exit:', error);
            navigate('/');
        }
    };

    const handleExitLogOut = async () => {
        setIsExitModalOpen(false);
        await exitPictureInPictureAndCleanup();
        // Only trigger feedback if user is inside a session (not on BeginLearning/AvatarSelection)
        if (location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/module') || location.pathname.startsWith('/ai-tutor')) {
            await ipc.setCloseOnSessionEnd();
            try {
                const metThreshold = await ipc.hasMetEngagementThreshold();
                if (metThreshold) {
                    setIsFeedbackOpen(true);
                } else {
                    await ipc.endSession(null, null);
                }
            } catch (e) {
                await ipc.endSession(null, null);
            }
        } else {
            await ipc.exitImmediately();
        }
    };

    const handleExitImmediately = async () => {
        setIsExitModalOpen(false);
        await exitPictureInPictureAndCleanup();
        await ipc.exitImmediately();
    };

    const handleRestartAndInstall = async () => {
        setIsUpdateModalOpen(false);
        await exitPictureInPictureAndCleanup();
        try {
            await ipc.restartAndInstall();
        } catch (err) {
            console.error('[App] Failed to restart and install update:', err);
        }
    };

    return (
        <div className="app">
            <Routes>
                <Route path="/" element={<BeginLearning />} />
                <Route path="/avatar-selection" element={<AvatarSelection />} />
                <Route path="/dashboard/:studentId" element={<StudentDashboard />} />
                <Route path="/module/:studentId/:moduleId" element={<ModuleDetail />} />
                <Route path="/ai-tutor/:studentId" element={<AILearningCenter />} />
            </Routes>

            <ConfirmModal
                isOpen={isExitModalOpen}
                title="Confirm Exit"
                message="Do you want to log out and give your feedback before exiting? Logging out saves your learning progress and opens the feedback survey."
                confirmText="Log Out & Exit"
                cancelText="Exit Immediately"
                onConfirm={handleExitLogOut}
                onCancel={handleExitImmediately}
            />

            <FeedbackSurveyModal
                isOpen={isFeedbackOpen}
                onClose={() => setIsFeedbackOpen(false)}
                onSubmit={handleFeedbackSubmit}
            />

            <SchoolSetupModal
                isOpen={isSetupModalOpen}
                onClose={() => setIsSetupModalOpen(false)}
                initialData={setupData}
            />

            <AdminPasswordModal
                isOpen={isAdminPwdOpen}
                onClose={() => setIsAdminPwdOpen(false)}
                onSuccess={handleAdminPasswordSuccess}
            />

            <UpdateRestartModal
                isOpen={isUpdateModalOpen}
                version={downloadedVersion}
                onRestart={handleRestartAndInstall}
                onClose={() => setIsUpdateModalOpen(false)}
            />
        </div>
    );
}

export default App;


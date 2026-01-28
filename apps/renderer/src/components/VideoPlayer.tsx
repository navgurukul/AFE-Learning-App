import { useRef, useState, useEffect } from 'react';
import { ipc } from '../lib/ipc.ts';

interface VideoPlayerProps {
    src: string;
    lessonId: string;
    studentId: string;
    initialProgress?: {
        watchedPercentage: number;
        totalWatchDuration: number;
        lastWatchedAt: string;
    };
    onCompleted?: () => void;
}

export function VideoPlayer({ src, lessonId, studentId, initialProgress, onCompleted }: VideoPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(initialProgress?.watchedPercentage || 0);
    const [duration, setDuration] = useState(0);
    const [watchTime, setWatchTime] = useState(initialProgress?.totalWatchDuration || 0);
    const lastUpdateRef = useRef<number>(0);
    const initialSeekDone = useRef(false);

    const currentTimeRef = useRef<number>(0);
    const durationRef = useRef<number>(0);

    useEffect(() => {
        // Auto-resume if previously watched
        if (videoRef.current && initialProgress && initialProgress.watchedPercentage > 0 && !initialSeekDone.current) {
            // Wait for metadata to load duration, then calculate time to seek to
            const handleMetadata = () => {
                if (videoRef.current && initialProgress) {
                    const resumeTime = (initialProgress.watchedPercentage / 100) * videoRef.current.duration;
                    // Only resume if not practically completed (>95%)
                    if (initialProgress.watchedPercentage < 95) {
                        videoRef.current.currentTime = resumeTime;
                    }
                    initialSeekDone.current = true;
                }
            };

            videoRef.current.addEventListener('loadedmetadata', handleMetadata);
            return () => videoRef.current?.removeEventListener('loadedmetadata', handleMetadata);
        }
    }, [initialProgress]);

    useEffect(() => {
        const handleBeforeUnload = () => {
            if (lastUpdateRef.current > 0 && isPlaying) {
                const now = Date.now();
                const deltaSeconds = Math.round((now - lastUpdateRef.current) / 1000);
                if (deltaSeconds > 0 && deltaSeconds < 3600) {
                    const pct = durationRef.current > 0 ? (currentTimeRef.current / durationRef.current) * 100 : progress;
                    ipc.updateVideoProgress(studentId, lessonId, pct, deltaSeconds).catch(() => { });
                }
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            // Save final progress on unmount
            const now = Date.now();
            if (lastUpdateRef.current > 0 && isPlaying) {
                const deltaSeconds = Math.round((now - lastUpdateRef.current) / 1000);
                if (deltaSeconds > 0 && deltaSeconds < 3600) {
                    const pct = durationRef.current > 0 ? (currentTimeRef.current / durationRef.current) * 100 : progress;
                    console.log(`[VideoPlayer] Unmount saving final progress: ${deltaSeconds}s`);
                    ipc.updateVideoProgress(studentId, lessonId, pct, deltaSeconds)
                        .catch(err => console.error('Failed to save video progress on unmount', err));
                    // Reset to avoid double save
                    lastUpdateRef.current = 0;
                }
            }
        };
    }, [isPlaying, progress, studentId, lessonId]); // Re-bind unmount if critical values change


    const handleTimeUpdate = async () => {
        if (!videoRef.current) return;

        const currentTime = videoRef.current.currentTime;
        const videoDuration = videoRef.current.duration;
        const currentProgress = (currentTime / videoDuration) * 100;

        setProgress(currentProgress);
        setDuration(videoDuration);
        currentTimeRef.current = currentTime;
        durationRef.current = videoDuration;

        // Update accumulated watch time
        const now = Date.now();
        // Initialize if first update
        if (lastUpdateRef.current === 0) {
            lastUpdateRef.current = now;
            return;
        }

        if (now - lastUpdateRef.current > 5000) {
            // Find how much time passed since last update
            if (isPlaying) {
                const deltaSeconds = Math.round((now - lastUpdateRef.current) / 1000);

                // Sanity check: If delta is suspicious (e.g. > 1 hour), it's likely a bug or clock jump
                if (deltaSeconds > 0 && deltaSeconds < 3600) {
                    await updateProgress(currentProgress, deltaSeconds);
                    setWatchTime(prev => prev + deltaSeconds);
                }
            } else {
                // Just update percentage without adding time
                await updateProgress(currentProgress, 0);
            }
            lastUpdateRef.current = now;
        }
    };

    const updateProgress = async (pct: number, durationDelta: number) => {
        try {
            await ipc.updateVideoProgress(studentId, lessonId, pct, durationDelta);
        } catch (err) {
            console.error('Failed to update progress', err);
        }
    };

    const handleEnded = async () => {
        setIsPlaying(false);
        await updateProgress(100, duration);
        if (onCompleted) {
            onCompleted();
        }
    };

    const togglePlay = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    return (
        <div style={{ width: '100%' }}>
            <div className="video-player-container" style={{
                width: '100%',
                aspectRatio: '16/9',
                maxHeight: '80vh',
                backgroundColor: '#000',
                borderRadius: '8px',
                overflow: 'hidden',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
            }}>
                <video
                    ref={videoRef}
                    src={src}
                    className="video-element"
                    style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        width: 'auto',
                        height: 'auto',
                        display: 'block'
                    }}
                    controls
                    onTimeUpdate={handleTimeUpdate}
                    onPlay={() => {
                        lastUpdateRef.current = Date.now();
                        setIsPlaying(true);
                    }}
                    onPause={() => setIsPlaying(false)}
                    onEnded={handleEnded}
                >
                    Your browser does not support the video tag.
                </video>
            </div>
            <div style={{ marginTop: '0.5rem', textAlign: 'center' }}>
                <p style={{ fontSize: '0.8rem', color: '#999' }}>
                    Time spent watching: {(() => {
                        const mins = Math.floor(watchTime / 60);
                        const secs = watchTime % 60;
                        return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
                    })()}
                </p>
            </div>
        </div>
    );
}

export default VideoPlayer;

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


    const handleTimeUpdate = async () => {
        if (!videoRef.current) return;

        const currentTime = videoRef.current.currentTime;
        const videoDuration = videoRef.current.duration;
        const currentProgress = (currentTime / videoDuration) * 100;

        setProgress(currentProgress);
        setDuration(videoDuration);

        // Update accumulated watch time (approximate)
        // This is a simple counter, ideally we'd track actual segments watched
        if (isPlaying) {
            // In a perfect world we use a more complex interval, but this suffices for "total time spent"
            // syncing it with exact playback time is tricky due to seeks
        }

        // Debounce updates to backend (every 5 seconds or 5% change)
        const now = Date.now();
        if (now - lastUpdateRef.current > 5000) {
            await updateProgress(currentProgress, Math.floor(currentTime)); // sending current pos as 'duration' used for resume logic mostly
            lastUpdateRef.current = now;
        }
    };

    const updateProgress = async (pct: number, currentPos: number) => {
        try {
            await ipc.updateVideoProgress(studentId, lessonId, pct, currentPos);
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
        <div className="video-player-container" style={{ width: '100%', backgroundColor: '#000', borderRadius: '8px', overflow: 'hidden' }}>
            <video
                ref={videoRef}
                src={src}
                className="video-element"
                style={{ width: '100%', display: 'block' }}
                controls
                onTimeUpdate={handleTimeUpdate}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={handleEnded}
            >
                Your browser does not support the video tag.
            </video>
            {/* Custom overlay or controls could go here if we wanted to hide native controls */}
        </div>
    );
}

export default VideoPlayer;

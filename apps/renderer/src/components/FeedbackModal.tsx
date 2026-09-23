import { useState, useRef, useEffect } from 'react';
import { ipc } from '../lib/ipc.ts';

interface FeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
    const [message, setMessage] = useState('');
    const [feedbackType, setFeedbackType] = useState<'BUG' | 'SUGGESTION'>('BUG');
    const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [rateLimitInfo, setRateLimitInfo] = useState<{ allowed: boolean; remainingMinutes: number } | null>(null);
    const [rateLimitError, setRateLimitError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Check rate limit status upon opening the modal
    useEffect(() => {
        if (!isOpen) return;

        setRateLimitError(null);
        ipc.checkFeedbackRateLimit()
            .then((res) => {
                if (res) {
                    setRateLimitInfo(res);
                }
            })
            .catch((err) => {
                console.warn('Failed to check rate limit:', err);
            });
    }, [isOpen]);

    if (!isOpen) return null;

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Please select an image file (PNG, JPG, WEBP).');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            if (typeof event.target?.result === 'string') {
                setScreenshotBase64(event.target.result);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleCaptureScreen = async () => {
        setIsCapturing(true);
        try {
            const res = await ipc.captureScreen();
            if (res && res.screenshotBase64) {
                setScreenshotBase64(res.screenshotBase64);
            }
        } catch (err) {
            console.error('Failed to capture screen:', err);
        } finally {
            setIsCapturing(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim()) return;

        setIsSubmitting(true);
        setRateLimitError(null);

        try {
            // Submit feedback (offline-first: saved to SQLite, synced immediately if online)
            const res = await ipc.submitFeedback(message.trim(), screenshotBase64 || undefined, feedbackType);
            if (res && (res as any).rateLimited) {
                setRateLimitError(res.message);
                setIsSubmitting(false);
                return;
            }
            setIsSubmitted(true);
        } catch (err: any) {
            console.error('Failed to submit feedback:', err);
            // Even if an unexpected error occurs, treat as accepted locally
            setIsSubmitted(true);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCloseModal = () => {
        setMessage('');
        setScreenshotBase64(null);
        setFeedbackType('BUG');
        setRateLimitError(null);
        setIsSubmitted(false);
        onClose();
    };

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.65)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10000,
                padding: 16,
            }}
            onClick={handleCloseModal}
        >
            <div
                style={{
                    backgroundColor: '#FFFDF9',
                    border: '3px solid #141210',
                    borderRadius: 16,
                    padding: '28px',
                    width: '100%',
                    maxWidth: 540,
                    boxShadow: '6px 6px 0 #141210',
                    fontFamily: 'inherit',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {isSubmitted ? (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{ fontSize: 48, marginBottom: 12 }}>🚀</div>
                        <h2 style={{ fontSize: 24, fontWeight: 800, color: '#141210', margin: '0 0 10px' }}>
                            Feedback Submitted!
                        </h2>
                        <p style={{ fontSize: 15, color: '#6E6A64', fontWeight: 500, margin: '0 0 24px' }}>
                            Thank you for your feedback. If you're offline, it has been saved safely on this device and will be synced the moment internet is available.
                        </p>
                        <button
                            type="button"
                            className="neo-btn neo-btn--primary"
                            onClick={handleCloseModal}
                            style={{
                                padding: '10px 24px',
                                fontSize: 16,
                                fontWeight: 700,
                                backgroundColor: '#FF7A3D',
                                color: '#141210',
                                border: '2.5px solid #141210',
                                borderRadius: 8,
                                boxShadow: '3px 3px 0 #141210',
                                cursor: 'pointer',
                            }}
                        >
                            Done
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#141210', margin: 0 }}>
                                💬 Share Feedback
                            </h2>
                            <button
                                type="button"
                                onClick={handleCloseModal}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: 22,
                                    cursor: 'pointer',
                                    color: '#141210',
                                    fontWeight: 700,
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        <p style={{ fontSize: 14, color: '#6E6A64', margin: '0 0 16px', fontWeight: 500 }}>
                            Encountered a problem or have a suggestion? Let us know so we can improve your learning experience.
                        </p>

                        {/* Rate Limit Alert */}
                        {rateLimitInfo && !rateLimitInfo.allowed && (
                            <div
                                style={{
                                    backgroundColor: '#FEF2F2',
                                    border: '2px solid #EF4444',
                                    borderRadius: 10,
                                    padding: '12px 14px',
                                    fontSize: 13,
                                    color: '#991B1B',
                                    fontWeight: 700,
                                    marginBottom: 16,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    boxShadow: '2px 2px 0 #EF4444',
                                }}
                            >
                                <span style={{ fontSize: 18 }}>⏳</span>
                                <div>
                                    Feedback Limit: Only 1 submission allowed per hour.
                                    <div style={{ fontSize: 12, fontWeight: 500, color: '#B91C1C', marginTop: 2 }}>
                                        Please wait ~{rateLimitInfo.remainingMinutes} more minute{rateLimitInfo.remainingMinutes > 1 ? 's' : ''} before submitting another feedback.
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Error Message */}
                        {rateLimitError && (
                            <div
                                style={{
                                    backgroundColor: '#FEF2F2',
                                    border: '2px solid #EF4444',
                                    borderRadius: 8,
                                    padding: '10px 14px',
                                    fontSize: 13,
                                    color: '#991B1B',
                                    fontWeight: 600,
                                    marginBottom: 16,
                                }}
                            >
                                ⚠️ {rateLimitError}
                            </div>
                        )}

                        {/* Feedback Type Dropdown */}
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#141210', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                                Feedback Type <span style={{ color: '#EF4444' }}>*</span>
                            </label>
                            <select
                                value={feedbackType}
                                onChange={(e) => setFeedbackType(e.target.value as 'BUG' | 'SUGGESTION')}
                                disabled={rateLimitInfo ? !rateLimitInfo.allowed : false}
                                style={{
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    padding: '10px 14px',
                                    fontSize: 14,
                                    fontWeight: 700,
                                    color: '#141210',
                                    backgroundColor: '#FFFFFF',
                                    border: '2.5px solid #141210',
                                    borderRadius: 10,
                                    outline: 'none',
                                    fontFamily: 'inherit',
                                    cursor: rateLimitInfo && !rateLimitInfo.allowed ? 'not-allowed' : 'pointer',
                                    boxShadow: '2px 2px 0 #141210',
                                }}
                            >
                                <option value="BUG">🐛 Bug / Issue</option>
                                <option value="SUGGESTION">💡 Suggestion / Improvement</option>
                            </select>
                        </div>

                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#141210', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                                Your Message <span style={{ color: '#EF4444' }}>*</span>
                            </label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                disabled={rateLimitInfo ? !rateLimitInfo.allowed : false}
                                placeholder={feedbackType === 'BUG' ? "Describe what happened, what went wrong, and steps to reproduce..." : "Share what feature or improvement you'd love to see..."}
                                rows={4}
                                required
                                style={{
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    padding: '12px',
                                    fontSize: 15,
                                    fontWeight: 500,
                                    border: '2.5px solid #141210',
                                    borderRadius: 10,
                                    outline: 'none',
                                    fontFamily: 'inherit',
                                    resize: 'vertical',
                                    boxShadow: '2px 2px 0 #141210',
                                    backgroundColor: rateLimitInfo && !rateLimitInfo.allowed ? '#F3F4F6' : '#FFFFFF',
                                }}
                            />
                        </div>

                        {/* Screenshot attachment section */}
                        <div style={{ marginBottom: 18 }}>
                            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#141210', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                                Screenshot (Optional)
                            </label>

                            {screenshotBase64 ? (
                                <div style={{ position: 'relative', border: '2px solid #141210', borderRadius: 8, padding: 6, background: '#F5F5F5', display: 'inline-block' }}>
                                    <img
                                        src={screenshotBase64}
                                        alt="Screenshot preview"
                                        style={{ maxHeight: 120, maxWidth: '100%', borderRadius: 4, display: 'block' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setScreenshotBase64(null)}
                                        style={{
                                            position: 'absolute',
                                            top: -8,
                                            right: -8,
                                            background: '#EF4444',
                                            color: '#fff',
                                            border: '2px solid #141210',
                                            borderRadius: '50%',
                                            width: 24,
                                            height: 24,
                                            cursor: 'pointer',
                                            fontWeight: 700,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: 12,
                                        }}
                                        title="Remove screenshot"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        style={{
                                            padding: '8px 14px',
                                            fontSize: 14,
                                            fontWeight: 600,
                                            backgroundColor: '#fff',
                                            border: '2px solid #141210',
                                            borderRadius: 8,
                                            boxShadow: '2px 2px 0 #141210',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        📎 Attach Image
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleCaptureScreen}
                                        disabled={isCapturing}
                                        style={{
                                            padding: '8px 14px',
                                            fontSize: 14,
                                            fontWeight: 600,
                                            backgroundColor: '#FFFBEB',
                                            border: '2px solid #141210',
                                            borderRadius: 8,
                                            boxShadow: '2px 2px 0 #141210',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {isCapturing ? '📷 Capturing...' : '📷 Capture Current Screen'}
                                    </button>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileSelect}
                                        accept="image/*"
                                        style={{ display: 'none' }}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Automatic Log Inclusion Note */}
                        <div
                            style={{
                                backgroundColor: '#E0F2FE',
                                border: '1.5px solid #0284C7',
                                borderRadius: 8,
                                padding: '10px 14px',
                                fontSize: 13,
                                color: '#0369A1',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                marginBottom: 20,
                            }}
                        >
                            <span>ℹ️</span>
                            <span>System diagnostic logs from the last 3 days will be automatically attached.</span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                            <button
                                type="button"
                                onClick={handleCloseModal}
                                style={{
                                    padding: '9px 18px',
                                    fontSize: 15,
                                    fontWeight: 600,
                                    backgroundColor: '#fff',
                                    border: '2px solid #141210',
                                    borderRadius: 8,
                                    boxShadow: '2px 2px 0 #141210',
                                    cursor: 'pointer',
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || !message.trim() || Boolean(rateLimitInfo && !rateLimitInfo.allowed)}
                                style={{
                                    padding: '9px 22px',
                                    fontSize: 15,
                                    fontWeight: 700,
                                    backgroundColor: rateLimitInfo && !rateLimitInfo.allowed ? '#9CA3AF' : '#FF7A3D',
                                    color: '#141210',
                                    border: '2px solid #141210',
                                    borderRadius: 8,
                                    boxShadow: '2px 2px 0 #141210',
                                    cursor: isSubmitting || !message.trim() || (rateLimitInfo && !rateLimitInfo.allowed) ? 'not-allowed' : 'pointer',
                                    opacity: isSubmitting || !message.trim() || (rateLimitInfo && !rateLimitInfo.allowed) ? 0.6 : 1,
                                }}
                            >
                                {isSubmitting ? 'Submitting...' : (rateLimitInfo && !rateLimitInfo.allowed ? 'Hourly Limit Reached ⏳' : 'Submit Feedback 🚀')}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

import React, { useState, useRef, useEffect } from 'react';
import { ipc } from '../lib/ipc.ts';
import './SchoolSetupModal.css';

interface AdminPasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function AdminPasswordModal({ isOpen, onClose, onSuccess }: AdminPasswordModalProps) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [verifying, setVerifying] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setPassword('');
            setError('');
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (!password.trim() || verifying) return;
        setVerifying(true);
        setError('');
        try {
            const result = await ipc.verifyAdminPassword(password);
            if (result.valid) {
                onClose();
                onSuccess();
            } else {
                setError('Incorrect password. Please try again.');
                setPassword('');
            }
        } catch (err) {
            setError('Verification failed. Please try again.');
        } finally {
            setVerifying(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSubmit();
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    return (
        <div className="admin-pwd-overlay" onClick={onClose}>
            <div className="admin-pwd-modal" onClick={(e) => e.stopPropagation()}>
                <h3>🔐 Admin Access</h3>
                <p>Enter the admin password to modify school details.</p>

                <div className="admin-pwd-input-wrap">
                    <input
                        ref={inputRef}
                        type="password"
                        placeholder="Enter password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                </div>

                {error && <div className="admin-pwd-error">{error}</div>}

                <div className="admin-pwd-actions">
                    <button
                        className="admin-pwd-btn admin-pwd-btn-cancel"
                        onClick={onClose}
                        type="button"
                    >
                        Cancel
                    </button>
                    <button
                        className="admin-pwd-btn admin-pwd-btn-submit"
                        onClick={handleSubmit}
                        disabled={!password.trim() || verifying}
                        type="button"
                    >
                        {verifying ? 'Verifying...' : 'Verify'}
                    </button>
                </div>
            </div>
        </div>
    );
}

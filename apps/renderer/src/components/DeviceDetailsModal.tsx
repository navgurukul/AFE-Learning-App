import React, { useState, useEffect } from 'react';
import { ipc } from '../lib/ipc.ts';
import './SchoolSetupModal.css';

interface DeviceDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialSerial: string;
    initialMac: string;
    schoolName?: string;
    partnerName?: string;
}

export function DeviceDetailsModal({
    isOpen,
    onClose,
    initialSerial,
    initialMac,
    schoolName,
    partnerName,
}: DeviceDetailsModalProps) {
    const [serialNumber, setSerialNumber] = useState(initialSerial);
    const [macAddress, setMacAddress] = useState(initialMac);
    const [isRedetecting, setIsRedetecting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [copiedField, setCopiedField] = useState<'serial' | 'mac' | null>(null);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    useEffect(() => {
        setSerialNumber(initialSerial);
        setMacAddress(initialMac);
        setStatusMessage(null);
    }, [initialSerial, initialMac, isOpen]);

    if (!isOpen) return null;

    const handleCopy = async (field: 'serial' | 'mac', text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedField(field);
            setTimeout(() => setCopiedField(null), 2000);
        } catch (e) {
            console.error('Failed to copy to clipboard:', e);
        }
    };

    const handleRedetect = async () => {
        setIsRedetecting(true);
        setStatusMessage(null);
        try {
            const detected = await ipc.redetectDeviceInfo();
            if (detected) {
                setSerialNumber(detected.serialNumber || 'UNKNOWN-SERIAL');
                setMacAddress(detected.macAddress || 'UNKNOWN-MAC');
                setStatusMessage('Redetected ✓');
                setTimeout(() => setStatusMessage(null), 3000);
            }
        } catch (error) {
            console.error('Failed to redetect device info:', error);
            setStatusMessage('Failed to redetect');
            setTimeout(() => setStatusMessage(null), 3000);
        } finally {
            setIsRedetecting(false);
        }
    };

    const handleConfirmAndClose = async () => {
        setIsSaving(true);
        try {
            // Persist edited / confirmed values to config
            await ipc.updateDeviceInfo({
                serialNumber: serialNumber.trim(),
                macAddress: macAddress.trim(),
            });
            onClose();
        } catch (error) {
            console.error('Failed to save updated device info:', error);
            onClose();
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="school-setup-overlay">
            <div className="device-details-modal compact-modal" onClick={(e) => e.stopPropagation()}>
                {/* Compact Header */}
                <div className="device-details-header-compact">
                    <div className="header-title-wrap">
                        <span className="header-icon">💻</span>
                        <h3 className="header-heading">Device Identifiers</h3>
                    </div>
                    {(partnerName || schoolName) && (
                        <div className="header-meta-pill" title={`${partnerName || ''} • ${schoolName || ''}`}>
                            📍 {[partnerName, schoolName].filter(Boolean).join(' • ')}
                        </div>
                    )}
                </div>

                <div className="device-details-body-compact">
                    {/* Minimalist Alert: Instruction, Warning, Repercussion */}
                    <div className="device-details-alert-box">
                        <span className="alert-icon">⚠️</span>
                        <div className="alert-content">
                            <div className="alert-instruction">
                                <strong>Instruction:</strong> Verify Serial Number matches physical laptop sticker.
                            </div>
                            <div className="alert-repercussion">
                                <strong>Warning:</strong> Incorrect serial corrupts server database & invalidates school sync.
                            </div>
                        </div>
                    </div>

                    {/* Compact Fields */}
                    <div className="device-details-fields-compact">
                        {/* Serial Number (Editable with Critical Tag) */}
                        <div className="device-field-card critical">
                            <div className="field-top-row">
                                <label className="field-label">
                                    Serial Number <span className="tag-critical">⚠️ Match Sticker</span>
                                </label>
                                <button
                                    type="button"
                                    className={`compact-copy-btn ${copiedField === 'serial' ? 'copied' : ''}`}
                                    onClick={() => handleCopy('serial', serialNumber)}
                                    title="Copy Serial Number"
                                >
                                    {copiedField === 'serial' ? 'Copied! ✓' : '📋 Copy'}
                                </button>
                            </div>
                            <input
                                type="text"
                                className="compact-input mono-font"
                                value={serialNumber}
                                onChange={(e) => setSerialNumber(e.target.value)}
                                placeholder="Device Serial Number"
                            />
                        </div>

                        {/* MAC Address (Hardware-Locked / Read-Only) */}
                        <div className="device-field-card readonly">
                            <div className="field-top-row">
                                <label className="field-label">
                                    MAC Address <span className="tag-readonly">🔒 Read-Only</span>
                                </label>
                                <button
                                    type="button"
                                    className={`compact-copy-btn ${copiedField === 'mac' ? 'copied' : ''}`}
                                    onClick={() => handleCopy('mac', macAddress)}
                                    title="Copy MAC Address"
                                >
                                    {copiedField === 'mac' ? 'Copied! ✓' : '📋 Copy'}
                                </button>
                            </div>
                            <input
                                type="text"
                                className="compact-input mono-font readonly-input"
                                value={macAddress}
                                readOnly
                                title="MAC Address is hardware-locked and cannot be edited"
                                placeholder="00:00:00:00:00:00"
                            />
                        </div>
                    </div>
                </div>

                {/* Compact Footer with Redetect on Left, Save on Right */}
                <div className="device-details-footer-compact">
                    <div className="footer-left-actions">
                        <button
                            type="button"
                            className="compact-redetect-btn"
                            onClick={handleRedetect}
                            disabled={isRedetecting}
                            title="Re-read serial and MAC from hardware BIOS/NIC"
                        >
                            {isRedetecting ? 'Detecting...' : '🔄 Redetect'}
                        </button>
                        {statusMessage && (
                            <span className="compact-status-badge">
                                {statusMessage}
                            </span>
                        )}
                    </div>
                    <button
                        type="button"
                        className="school-setup-btn school-setup-btn-save compact-save-btn"
                        onClick={handleConfirmAndClose}
                        disabled={isSaving}
                    >
                        {isSaving ? 'Saving...' : 'Confirm & Continue ✓'}
                    </button>
                </div>
            </div>
        </div>
    );
}

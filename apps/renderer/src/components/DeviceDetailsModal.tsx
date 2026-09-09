import React, { useState, useEffect, useCallback } from 'react';
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

interface RMSStatus {
    registeredInRMS: boolean;
    rmsDevice?: { id: number; serial_number: string; mac_address: string; system_id?: string };
    registeredInAFE?: boolean;
    isMismatch: boolean;
    suggestedSerialNumber?: string;
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
    const [rmsStatus, setRmsStatus] = useState<RMSStatus | null>(null);
    const [isCheckingRMS, setIsCheckingRMS] = useState(false);

    const checkStatus = useCallback(async (mac: string, serial: string) => {
        if (!mac || mac === 'UNKNOWN-MAC') return;
        setIsCheckingRMS(true);
        try {
            const res = await ipc.checkDeviceStatus({ macAddress: mac, serialNumber: serial });
            if (res && res.success) {
                setRmsStatus({
                    registeredInRMS: Boolean(res.registeredInRMS ?? (res as any).isRegisteredInRms),
                    rmsDevice: res.rmsDevice as any,
                    registeredInAFE: Boolean(res.registeredInAFE ?? (res as any).isRegisteredInAfe),
                    isMismatch: Boolean(res.isMismatch),
                    suggestedSerialNumber: res.suggestedSerialNumber,
                });
            } else {
                setRmsStatus(null);
            }
        } catch (e) {
            console.warn('[DeviceDetailsModal] Live RMS check error:', e);
            setRmsStatus(null);
        } finally {
            setIsCheckingRMS(false);
        }
    }, []);

    useEffect(() => {
        setSerialNumber(initialSerial);
        setMacAddress(initialMac);
        setStatusMessage(null);
        if (isOpen) {
            checkStatus(initialMac, initialSerial);
        }
    }, [initialSerial, initialMac, isOpen, checkStatus]);

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
                const detectedSerial = detected.serialNumber || 'UNKNOWN-SERIAL';
                const detectedMac = detected.macAddress || 'UNKNOWN-MAC';
                setSerialNumber(detectedSerial);
                setMacAddress(detectedMac);
                setStatusMessage('Redetected ✓');
                setTimeout(() => setStatusMessage(null), 3000);
                // Re-check live status with redetected identifiers
                checkStatus(detectedMac, detectedSerial);
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
            // Reconcile locally immediately & initiate non-blocking background server sync
            await ipc.reconcileDevice({
                serialNumber: serialNumber.trim(),
                macAddress: macAddress.trim(),
                oldSerialNumber: initialSerial
            });
            onClose();
        } catch (error) {
            console.error('Failed to reconcile device info:', error);
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

                    <div className="header-badges-wrap">
                        {isCheckingRMS ? (
                            <span className="device-status-pill checking">⚡ Checking RMS...</span>
                        ) : rmsStatus?.registeredInRMS ? (
                            <span className="device-status-pill registered" title={`RMS Device ID: ${rmsStatus.rmsDevice?.id || 'Active'}`}>
                                ✓ RMS Linked
                            </span>
                        ) : (
                            <span className="device-status-pill pending" title="Device will register automatically upon RMS sync">
                                ℹ️ Unregistered on RMS
                            </span>
                        )}

                        {(partnerName || schoolName) && (
                            <div className="header-meta-pill" title={`${partnerName || ''} • ${schoolName || ''}`}>
                                📍 {[partnerName, schoolName].filter(Boolean).join(' • ')}
                            </div>
                        )}
                    </div>
                </div>

                <div className="device-details-body-compact">
                    {/* Mismatch Resolution Banner if RMS has a different serial */}
                    {rmsStatus?.isMismatch && rmsStatus.suggestedSerialNumber && (
                        <div className="device-mismatch-banner">
                            <div className="mismatch-text">
                                <span className="mismatch-icon">⚠️</span>
                                <span>
                                    RMS Database registers this device as: <strong>{rmsStatus.suggestedSerialNumber}</strong>
                                </span>
                            </div>
                            <button
                                type="button"
                                className="btn-use-rms-serial"
                                onClick={() => {
                                    setSerialNumber(rmsStatus.suggestedSerialNumber!);
                                    setRmsStatus(prev => prev ? { ...prev, isMismatch: false } : null);
                                }}
                            >
                                Use RMS Serial
                            </button>
                        </div>
                    )}

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

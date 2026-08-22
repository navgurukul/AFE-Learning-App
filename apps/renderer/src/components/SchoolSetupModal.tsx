import React, { useState, useEffect } from 'react';
import { ipc } from '../lib/ipc.ts';
import './SchoolSetupModal.css';

const SCHOOL_TYPE_OPTIONS = [
    { value: 'Government School', label: '1. Government School' },
    { value: 'Government Aided School', label: '2. Government Aided School' },
    { value: 'Private School', label: '3. Private School' },
    { value: 'Central Government School (KV/JNV)', label: '4. Central Government School (KV/JNV)' },
    { value: 'EMRS / Tribal School', label: '5. EMRS / Tribal School' },
    { value: 'KGBV', label: '6. KGBV' },
    { value: 'Other', label: '7. Other' },
];

interface SchoolSetupModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Pre-filled values for re-edit */
    initialData?: {
        schoolName: string;
        schoolUdise: string;
        state: string;
        city: string;
        district: string;
        districtCode: string;
        schoolType: string;
    };
}

export function SchoolSetupModal({ isOpen, onClose, initialData }: SchoolSetupModalProps) {
    const [schoolName, setSchoolName] = useState('');
    const [schoolUdise, setSchoolUdise] = useState('');
    const [state, setState] = useState('');
    const [city, setCity] = useState('');
    const [district, setDistrict] = useState('');
    const [districtCode, setDistrictCode] = useState('');
    const [schoolType, setSchoolType] = useState('Government School');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (initialData) {
            setSchoolName(initialData.schoolName || '');
            setSchoolUdise(initialData.schoolUdise || '');
            setState(initialData.state || '');
            setCity(initialData.city || '');
            setDistrict(initialData.district || '');
            setDistrictCode(initialData.districtCode || '');
            setSchoolType(initialData.schoolType || 'Government School');
        }
    }, [initialData]);

    if (!isOpen) return null;

    const isFormValid = schoolName.trim() && state.trim() && district.trim();

    const handleSave = async () => {
        if (!isFormValid || saving) return;
        setSaving(true);
        try {
            await ipc.saveSchoolDetails({
                schoolName: schoolName.trim(),
                schoolUdise: schoolUdise.trim(),
                state: state.trim(),
                city: city.trim(),
                district: district.trim(),
                districtCode: districtCode.trim(),
                schoolType,
            });
            onClose();
        } catch (error) {
            console.error('Failed to save school details:', error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="school-setup-overlay" onClick={onClose}>
            <div className="school-setup-modal" onClick={(e) => e.stopPropagation()}>
                <div className="school-setup-header">
                    <h2>🏫 School / NGO Setup</h2>
                    <p>Enter your school or NGO details. This information will be used for reporting.</p>
                </div>

                <div className="school-setup-form">
                    <div className="school-setup-field">
                        <label>
                            Name of School / NGO <span className="required">*</span>
                        </label>
                        <input
                            type="text"
                            placeholder="e.g., Kendriya Vidyalaya No. 1"
                            value={schoolName}
                            onChange={(e) => setSchoolName(e.target.value)}
                            autoFocus
                        />
                    </div>

                    <div className="school-setup-field">
                        <label>School UDISE Code</label>
                        <input
                            type="text"
                            placeholder="e.g., 09010100101"
                            value={schoolUdise}
                            onChange={(e) => setSchoolUdise(e.target.value)}
                        />
                    </div>

                    <div className="school-setup-field">
                        <label>
                            Type of School <span className="required">*</span>
                        </label>
                        <select
                            value={schoolType}
                            onChange={(e) => setSchoolType(e.target.value)}
                        >
                            {SCHOOL_TYPE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="school-setup-row">
                        <div className="school-setup-field">
                            <label>
                                State <span className="required">*</span>
                            </label>
                            <input
                                type="text"
                                placeholder="e.g., Delhi"
                                value={state}
                                onChange={(e) => setState(e.target.value)}
                            />
                        </div>
                        <div className="school-setup-field">
                            <label>City</label>
                            <input
                                type="text"
                                placeholder="e.g., New Delhi"
                                value={city}
                                onChange={(e) => setCity(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="school-setup-row">
                        <div className="school-setup-field">
                            <label>
                                District <span className="required">*</span>
                            </label>
                            <input
                                type="text"
                                placeholder="e.g., South Delhi"
                                value={district}
                                onChange={(e) => setDistrict(e.target.value)}
                            />
                        </div>
                        <div className="school-setup-field">
                            <label>District Code</label>
                            <input
                                type="text"
                                placeholder="e.g., 0712"
                                value={districtCode}
                                onChange={(e) => setDistrictCode(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="school-setup-actions">
                        <button
                            className="school-setup-btn school-setup-btn-cancel"
                            onClick={onClose}
                            type="button"
                        >
                            Close
                        </button>
                        <button
                            className="school-setup-btn school-setup-btn-save"
                            onClick={handleSave}
                            disabled={!isFormValid || saving}
                            type="button"
                        >
                            {saving ? 'Saving...' : 'Save Details ✓'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

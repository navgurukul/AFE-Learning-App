import React, { useState, useEffect } from 'react';
import { ipc } from '../lib/ipc.ts';
import './SchoolSetupModal.css';

const PRESET_SCHOOLS = [
    {
        name: 'KGBV, Vanchanagiri, Warangal',
        district: 'Warangal',
        state: 'Telangana',
        schoolType: 'KGBV',
        zipcodePostalCode: '506001',
    },
    {
        name: 'TGMS, Vanchanagiri, Warangal',
        district: 'Warangal',
        state: 'Telangana',
        schoolType: 'Government School',
        zipcodePostalCode: '506001',
    },
    {
        name: 'ZPHS Somdi, Hanamkonda',
        district: 'Hanamkonda',
        state: 'Telangana',
        schoolType: 'Government School',
        zipcodePostalCode: '506001',
    },
    {
        name: 'ZPHS Markazi, Hanamkonda',
        district: 'Hanamkonda',
        state: 'Telangana',
        schoolType: 'Government School',
        zipcodePostalCode: '506001',
    },
    {
        name: 'ZPHS Shayampet, Hanamkonda',
        district: 'Hanamkonda',
        state: 'Telangana',
        schoolType: 'Government School',
        zipcodePostalCode: '506001',
    },
    {
        name: 'ZPHS, Mulugu',
        district: 'Mulugu',
        state: 'Telangana',
        schoolType: 'Government School',
        zipcodePostalCode: '506343',
    },
    {
        name: 'GGB, Mulugu',
        district: 'Mulugu',
        state: 'Telangana',
        schoolType: 'Government School',
        zipcodePostalCode: '506343',
    },
    {
        name: 'ZPHS, Tharapally, Warangal',
        district: 'Warangal',
        state: 'Telangana',
        schoolType: 'Government School',
        zipcodePostalCode: '506001',
    },
    {
        name: 'ZPHS Indiranagar, Siddipet',
        district: 'Siddipet',
        state: 'Telangana',
        schoolType: 'Government School',
        zipcodePostalCode: '502103',
    },
    {
        name: 'GHS Sapthagiri Colony, Karimnagar',
        district: 'Karimnagar',
        state: 'Telangana',
        schoolType: 'Government School',
        zipcodePostalCode: '505001',
    },
    {
        name: 'Sarswathi Shishumandir, Karimnagar',
        district: 'Karimnagar',
        state: 'Telangana',
        schoolType: 'Private School',
        zipcodePostalCode: '505001',
    },
    {
        name: 'ZPHS, Manthani',
        district: 'Peddapalli',
        state: 'Telangana',
        schoolType: 'Government School',
        zipcodePostalCode: '505184',
    },
    {
        name: 'ZPHS, Armur, Manthani',
        district: 'Peddapalli',
        state: 'Telangana',
        schoolType: 'Government School',
        zipcodePostalCode: '505184',
    },
    {
        name: 'ZPHS Perkakondaram, Nalgonda',
        district: 'Nalgonda',
        state: 'Telangana',
        schoolType: 'Government School',
        zipcodePostalCode: '508001',
    },
];

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
        zipcodePostalCode?: string;
        schoolType: string;
        countryCode?: string;
        partnerName?: string;
        distributionChannelHostId?: string;
    };
}

export function SchoolSetupModal({ isOpen, onClose, initialData }: SchoolSetupModalProps) {
    const [selectedDropdown, setSelectedDropdown] = useState('');
    const [customSchoolName, setCustomSchoolName] = useState('');
    const [schoolName, setSchoolName] = useState('');
    const [schoolUdise, setSchoolUdise] = useState('');
    const [state, setState] = useState('');
    const [city, setCity] = useState('');
    const [district, setDistrict] = useState('');
    const [districtCode, setDistrictCode] = useState('');
    const [zipcodePostalCode, setZipcodePostalCode] = useState('110001');
    const [schoolType, setSchoolType] = useState('Government School');
    const [countryCode, setCountryCode] = useState('IN');
    const [partnerName, setPartnerName] = useState('Sama Digital Foundation – 1');
    const [distributionChannelHostId, setDistributionChannelHostId] = useState('Sama Platform 1');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (initialData) {
            const rawName = initialData.schoolName || '';
            const matchingPreset = PRESET_SCHOOLS.find((s) => s.name === rawName);

            if (matchingPreset) {
                setSelectedDropdown(matchingPreset.name);
                setCustomSchoolName('');
            } else if (rawName) {
                setSelectedDropdown('__OTHER__');
                setCustomSchoolName(rawName);
            } else {
                setSelectedDropdown('');
                setCustomSchoolName('');
            }

            setSchoolName(rawName);
            setSchoolUdise(initialData.schoolUdise || '');
            setState(initialData.state || '');
            setCity(initialData.city || '');
            setDistrict(initialData.district || '');
            setDistrictCode(initialData.districtCode || '');
            setZipcodePostalCode(initialData.zipcodePostalCode || '110001');
            setSchoolType(initialData.schoolType || 'Government School');
            setCountryCode(initialData.countryCode || 'IN');
            setPartnerName(initialData.partnerName || 'Sama Digital Foundation – 1');
            setDistributionChannelHostId(initialData.distributionChannelHostId || 'Sama Platform 1');
        }
    }, [initialData]);

    if (!isOpen) return null;

    const handleDropdownChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setSelectedDropdown(val);

        if (val === '__OTHER__') {
            setSchoolName(customSchoolName);
        } else if (val) {
            const preset = PRESET_SCHOOLS.find((s) => s.name === val);
            if (preset) {
                setSchoolName(preset.name);
                if (preset.district) setDistrict(preset.district);
                if (preset.state) setState(preset.state);
                if (preset.schoolType) setSchoolType(preset.schoolType);
                if ((preset as any).zipcodePostalCode) setZipcodePostalCode((preset as any).zipcodePostalCode);
            } else {
                setSchoolName(val);
            }
        } else {
            setSchoolName('');
        }
    };

    const handleCustomNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setCustomSchoolName(val);
        setSchoolName(val);
    };

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
                zipcodePostalCode: zipcodePostalCode.trim() || '110001',
                schoolType,
                countryCode: countryCode.trim() || 'IN',
                partnerName: partnerName.trim() || 'Sama Digital Foundation – 1',
                distributionChannelHostId: distributionChannelHostId.trim() || 'Sama Platform 1',
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
                    <p>Select your school or NGO details. This information will be used for session reporting.</p>
                </div>

                <div className="school-setup-form">
                    <div className="school-setup-field">
                        <label>
                            Select School / NGO <span className="required">*</span>
                        </label>
                        <select
                            value={selectedDropdown}
                            onChange={handleDropdownChange}
                            autoFocus
                        >
                            <option value="">-- Select School --</option>
                            {PRESET_SCHOOLS.map((school) => (
                                <option key={school.name} value={school.name}>
                                    {school.name}
                                </option>
                            ))}
                            <option value="__OTHER__">➕ Other (Enter manually)</option>
                        </select>
                    </div>

                    {selectedDropdown === '__OTHER__' && (
                        <div className="school-setup-field">
                            <label>
                                Custom School / NGO Name <span className="required">*</span>
                            </label>
                            <input
                                type="text"
                                placeholder="Enter school name..."
                                value={customSchoolName}
                                onChange={handleCustomNameChange}
                                autoFocus
                            />
                        </div>
                    )}

                    <div className="school-setup-field">
                        <label>School UDISE Code</label>
                        <input
                            type="text"
                            placeholder="e.g., 09010100101"
                            value={schoolUdise}
                            onChange={(e) => setSchoolUdise(e.target.value)}
                        />
                    </div>

                    <div className="school-setup-row">
                        <div className="school-setup-field">
                            <label>Country Code <span className="required">*</span></label>
                            <input
                                type="text"
                                placeholder="e.g., IN"
                                value={countryCode}
                                onChange={(e) => setCountryCode(e.target.value)}
                            />
                        </div>
                        <div className="school-setup-field">
                            <label>Distribution Host ID <span className="required">*</span></label>
                            <input
                                type="text"
                                placeholder="e.g., Sama Platform 1"
                                value={distributionChannelHostId}
                                onChange={(e) => setDistributionChannelHostId(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="school-setup-field">
                        <label>Partner Name <span className="required">*</span></label>
                        <input
                            type="text"
                            placeholder="e.g., Sama Digital Foundation – 1"
                            value={partnerName}
                            onChange={(e) => setPartnerName(e.target.value)}
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
                                placeholder="e.g., Telangana"
                                value={state}
                                onChange={(e) => setState(e.target.value)}
                            />
                        </div>
                        <div className="school-setup-field">
                            <label>City</label>
                            <input
                                type="text"
                                placeholder="e.g., Warangal"
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
                                placeholder="e.g., Hanamkonda"
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

                    <div className="school-setup-field">
                        <label>
                            Zipcode / Postal Code (Pincode) <span className="required">*</span>
                        </label>
                        <input
                            type="text"
                            placeholder="e.g., 110001"
                            value={zipcodePostalCode}
                            onChange={(e) => setZipcodePostalCode(e.target.value)}
                        />
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

import React, { useState, useEffect } from 'react';
import { ipc } from '../lib/ipc.ts';
import { DeviceDetailsModal } from './DeviceDetailsModal.tsx';
import { SearchableSelect, SearchableOption } from './SearchableSelect.tsx';
import { PRESET_SCHOOLS } from './presetSchools.ts';
import './SchoolSetupModal.css';

export interface SchoolItem {
    id?: number | string;
    school_id?: string;
    udise?: string;
    name: string;
    city?: string;
    partner_name?: string;
    ngo_id?: string;
    distribution_host_id?: string;
    zipcode?: string;
    zipcodePostalCode?: string;
    state?: string;
    district?: string;
    district_code?: string;
    school_type?: string;
    schoolType?: string;
    school_type_id?: number | string | null;
    countryCode?: string;
}

export const SCHOOL_TYPE_MAP: Record<number, string> = {
    1: 'Government School',
    2: 'Government Aided School',
    3: 'Private School',
    4: 'Central Government School (KV/JNV)',
    5: 'EMRS / Tribal School',
    6: 'KGBV',
    7: 'Other',
};

export const SCHOOL_TYPE_OPTIONS = [
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
    const [schools, setSchools] = useState<SchoolItem[]>(PRESET_SCHOOLS);
    const [loadingSchools, setLoadingSchools] = useState(false);
    const [selectedDropdown, setSelectedDropdown] = useState('');
    const [schoolName, setSchoolName] = useState('');
    const [schoolUdise, setSchoolUdise] = useState('');
    const [state, setState] = useState('');
    const [city, setCity] = useState('');
    const [district, setDistrict] = useState('');
    const [districtCode, setDistrictCode] = useState('');
    const [zipcodePostalCode, setZipcodePostalCode] = useState('');
    const [schoolType, setSchoolType] = useState('Government School');
    const [countryCode, setCountryCode] = useState('IN');
    const [partnerName, setPartnerName] = useState('Sama Digital Platform');
    const [selectedNgoKey, setSelectedNgoKey] = useState('SAM-DEFAULT');
    const [distributionChannelHostId, setDistributionChannelHostId] = useState('Sama Platform');
    const [saving, setSaving] = useState(false);
    const [deviceModalOpen, setDeviceModalOpen] = useState(false);
    const [savedDeviceInfo, setSavedDeviceInfo] = useState({ serialNumber: '', macAddress: '' });
    const [devModeNotice, setDevModeNotice] = useState<string | null>(null);
    const devModeCountRef = React.useRef(0);
    const devModeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    // Ctrl + Shift + D x5 to activate Developer Mode
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = async (e: KeyboardEvent) => {
            if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
                e.preventDefault();
                devModeCountRef.current++;

                if (devModeTimerRef.current) {
                    clearTimeout(devModeTimerRef.current);
                }
                devModeTimerRef.current = setTimeout(() => {
                    devModeCountRef.current = 0;
                }, 3000);

                if (devModeCountRef.current >= 5) {
                    devModeCountRef.current = 0;
                    if (devModeTimerRef.current) {
                        clearTimeout(devModeTimerRef.current);
                    }
                    try {
                        await ipc.setDeveloperMode(true);
                        setDevModeNotice('Developer Mode Activated! Connected to Dev Server.');
                        setTimeout(() => setDevModeNotice(null), 5000);
                    } catch (err) {
                        console.error('Failed to activate developer mode:', err);
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    // Fetch schools from live API https://sama-api.thesama.in/api/schools/udise-map
    useEffect(() => {
        if (!isOpen) return;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        setLoadingSchools(true);

        const fetchSchools = async () => {
            try {
                let data: any = null;
                try {
                    const res = await fetch('https://sama-api.thesama.in/api/schools/udise-map', { signal: controller.signal });
                    if (res.ok) {
                        data = await res.json();
                    }
                } catch (e) {
                    console.warn('[SchoolSetupModal] Failed to fetch /api/schools/udise-map, trying /api/schools:', e);
                }

                if (!data || data.status !== 'success' || !data.data) {
                    const fallbackRes = await fetch('https://sama-api.thesama.in/api/schools', { signal: controller.signal });
                    if (fallbackRes.ok) {
                        data = await fallbackRes.json();
                    }
                }

                if (data && data.status === 'success' && data.data) {
                    const rawList: any[] = Array.isArray(data.data)
                        ? data.data
                        : (typeof data.data === 'object' ? Object.values(data.data) : []);

                    const fetchedSchools: SchoolItem[] = rawList
                        .map((item: any) => {
                            // If API is not sending any school_type_id, use 1 (Government School) as default
                            const typeId = item.school_type_id ? Number(item.school_type_id) : 1;
                            const resolvedSchoolType = SCHOOL_TYPE_MAP[typeId] || item.school_type || 'Government School';

                            return {
                                id: item.id ? String(item.id) : undefined,
                                school_id: item.school_id ? String(item.school_id) : undefined,
                                udise: item.udise ? String(item.udise) : '',
                                name: String(item.name || '').trim(),
                                city: item.city ? String(item.city) : '',
                                partner_name: item.partner_name ? String(item.partner_name) : 'Sama Digital Platform',
                                ngo_id: item.ngo_id ? String(item.ngo_id) : 'SAM-DEFAULT',
                                distribution_host_id: item.distribution_host_id ? String(item.distribution_host_id) : 'Sama Platform',
                                zipcode: item.zipcode ? String(item.zipcode) : '',
                                state: item.state ? String(item.state) : '',
                                district: item.district ? String(item.district) : '',
                                district_code: item.district_code ? String(item.district_code) : '',
                                school_type_id: typeId,
                                school_type: resolvedSchoolType,
                                schoolType: resolvedSchoolType,
                            };
                        })
                        .filter((s: SchoolItem) => s.name.length > 0);

                    // Sort alphabetically by school name
                    fetchedSchools.sort((a, b) => a.name.localeCompare(b.name));

                    if (fetchedSchools.length > 0) {
                        setSchools(fetchedSchools);
                    }
                }
            } catch (err) {
                console.warn('[SchoolSetupModal] Failed to fetch schools from API, using preset schools fallback:', err);
                setSchools(PRESET_SCHOOLS);
            } finally {
                clearTimeout(timeoutId);
                setLoadingSchools(false);
            }
        };

        fetchSchools();

        return () => {
            clearTimeout(timeoutId);
            controller.abort();
        };
    }, [isOpen]);

    // Handle initialData pre-fill (when re-editing or on open)
    useEffect(() => {
        if (initialData) {
            const rawName = initialData.schoolName || '';
            const matchingSchool = schools.find((s) =>
                (initialData.schoolUdise && s.udise && s.udise === initialData.schoolUdise) ||
                (s.name && rawName && s.name.toLowerCase() === rawName.toLowerCase())
            );

            if (matchingSchool) {
                setSelectedDropdown(matchingSchool.udise || matchingSchool.name);
                setSchoolName(matchingSchool.name);
                setSchoolUdise(matchingSchool.udise || initialData.schoolUdise || '');
                setState(matchingSchool.state || initialData.state || '');
                setCity(matchingSchool.city || initialData.city || '');
                setDistrict(matchingSchool.district || initialData.district || '');
                setDistrictCode(matchingSchool.district_code || initialData.districtCode || '');
                setZipcodePostalCode(matchingSchool.zipcode || matchingSchool.zipcodePostalCode || initialData.zipcodePostalCode || '110001');
                const typeId = matchingSchool.school_type_id ? Number(matchingSchool.school_type_id) : 1;
                setSchoolType(SCHOOL_TYPE_MAP[typeId] || matchingSchool.school_type || initialData.schoolType || 'Government School');
                setPartnerName(matchingSchool.partner_name || initialData.partnerName || 'Sama Digital Platform');
                setSelectedNgoKey(matchingSchool.ngo_id || 'SAM-DEFAULT');
                setDistributionChannelHostId(matchingSchool.distribution_host_id || initialData.distributionChannelHostId || 'Sama Platform');
            } else if (rawName) {
                setSelectedDropdown(rawName);
                setSchoolName(rawName);
                setSchoolUdise(initialData.schoolUdise || '');
                setState(initialData.state || '');
                setCity(initialData.city || '');
                setDistrict(initialData.district || '');
                setDistrictCode(initialData.districtCode || '');
                setZipcodePostalCode(initialData.zipcodePostalCode || '110001');
                setSchoolType(initialData.schoolType || 'Government School');
                setPartnerName(initialData.partnerName || 'Sama Digital Platform');
                setDistributionChannelHostId(initialData.distributionChannelHostId || 'Sama Platform');
            }
            setCountryCode(initialData.countryCode || 'IN');
        }
    }, [initialData, schools]);

    if (!isOpen) return null;

    if (deviceModalOpen) {
        return (
            <DeviceDetailsModal
                isOpen={true}
                onClose={() => {
                    setDeviceModalOpen(false);
                    onClose();
                }}
                initialSerial={savedDeviceInfo.serialNumber}
                initialMac={savedDeviceInfo.macAddress}
                schoolName={schoolName.trim()}
                partnerName={partnerName.trim() || 'Sama Digital Platform'}
            />
        );
    }

    const handleSchoolSelect = (val: string) => {
        setSelectedDropdown(val);

        if (val) {
            const school = schools.find((s) => (s.udise && s.udise === val) || s.name === val || s.school_id === val);
            if (school) {
                setSchoolName(school.name);
                setSchoolUdise(school.udise || '');
                setCity(school.city || '');
                setDistrict(school.district || '');
                setDistrictCode(school.district_code || '');
                setState(school.state || '');
                setZipcodePostalCode(school.zipcode || school.zipcodePostalCode || '110001');
                setPartnerName(school.partner_name || 'Sama Digital Platform');
                setSelectedNgoKey(school.ngo_id || 'SAM-DEFAULT');
                setDistributionChannelHostId(school.distribution_host_id || 'Sama Platform');

                // If the API is not sending any school_type_id then use 1 (Government School) as default
                const typeId = school.school_type_id ? Number(school.school_type_id) : 1;
                const resolvedType = SCHOOL_TYPE_MAP[typeId] || school.school_type || school.schoolType || 'Government School';
                setSchoolType(resolvedType);
            } else {
                setSchoolName(val);
            }
        } else {
            setSchoolName('');
            setSchoolUdise('');
            setCity('');
            setDistrict('');
            setDistrictCode('');
            setState('');
            setZipcodePostalCode('');
            setPartnerName('Sama Digital Platform');
            setSelectedNgoKey('SAM-DEFAULT');
            setDistributionChannelHostId('Sama Platform');
            setSchoolType('Government School');
        }
    };

    // Format school options with name, partner, city, district, and UDISE for live search
    const schoolOptions: SearchableOption[] = schools.map((school) => {
        const details = [
            school.partner_name,
            school.city,
            school.district,
            school.udise ? `UDISE: ${school.udise}` : undefined
        ].filter(Boolean).join(' • ');

        return {
            value: school.udise || school.name,
            label: school.name,
            subLabel: details || undefined,
            badge: school.state || undefined,
        };
    });

    const isFormValid = schoolName.trim().length > 0 && state.trim().length > 0 && district.trim().length > 0;

    const handleSave = async () => {
        if (!isFormValid || saving) return;
        setSaving(true);
        try {
            const finalPartnerName = partnerName.trim() || 'Sama Digital Platform';
            const saveRes = await ipc.saveSchoolDetails({
                schoolName: schoolName.trim(),
                schoolUdise: schoolUdise.trim(),
                state: state.trim(),
                city: city.trim(),
                district: district.trim(),
                districtCode: districtCode.trim(),
                zipcodePostalCode: zipcodePostalCode.trim() || '110001',
                schoolType,
                countryCode: countryCode.trim() || 'IN',
                partnerName: finalPartnerName,
                distributionChannelHostId: distributionChannelHostId.trim() || 'Sama Platform',
                ngoKey: selectedNgoKey || undefined,
            });

            const serial = (saveRes && (saveRes as any).serialNumber) ? (saveRes as any).serialNumber : 'UNKNOWN-SERIAL';
            const mac = (saveRes && (saveRes as any).macAddress) ? (saveRes as any).macAddress : 'UNKNOWN-MAC';

            setSavedDeviceInfo({ serialNumber: serial, macAddress: mac });
            setDeviceModalOpen(true);
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
                    <h2>School Setup</h2>
                    <p>Select your school from the list. All information is populated automatically.</p>
                    {devModeNotice && (
                        <div style={{
                            marginTop: 10,
                            padding: '10px 14px',
                            background: '#FEF3C7',
                            border: '2px solid #F59E0B',
                            borderRadius: 8,
                            color: '#92400E',
                            fontWeight: 700,
                            fontSize: 14,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                        }}>
                            <span style={{ fontWeight: 800 }}>[DEV]</span>
                            <span>{devModeNotice}</span>
                        </div>
                    )}
                </div>

                <div className="school-setup-body">
                    <div className="school-setup-form">
                        <div className="school-setup-field">
                            <label>
                                Select School <span className="required">*</span>
                            </label>
                            <SearchableSelect
                                id="school-setup-school-select"
                                options={schoolOptions}
                                value={selectedDropdown}
                                onChange={handleSchoolSelect}
                                placeholder="-- Search & Select School --"
                                searchPlaceholder="Type school name, city, district, UDISE, or partner..."
                                loading={loadingSchools}
                                loadingText="-- Loading schools from API... --"
                                allowOther={false}
                            />
                        </div>

                        <div className="school-setup-field">
                            <label>School UDISE Code</label>
                            <input
                                type="text"
                                placeholder="Populated automatically"
                                value={schoolUdise}
                                readOnly
                                tabIndex={-1}
                                className="school-setup-input-readonly"
                            />
                        </div>

                        <div className="school-setup-field">
                            <label>Partner Name / NGO <span className="required">*</span></label>
                            <input
                                type="text"
                                placeholder="Populated automatically"
                                value={partnerName}
                                readOnly
                                tabIndex={-1}
                                className="school-setup-input-readonly"
                            />
                        </div>

                        <div className="school-setup-row">
                            <div className="school-setup-field">
                                <label>Country Code <span className="required">*</span></label>
                                <input
                                    type="text"
                                    placeholder="e.g., IN"
                                    value={countryCode}
                                    readOnly
                                    tabIndex={-1}
                                    className="school-setup-input-readonly"
                                />
                            </div>
                            <div className="school-setup-field">
                                <label>Distribution Host ID <span className="required">*</span></label>
                                <input
                                    type="text"
                                    placeholder="Populated automatically"
                                    value={distributionChannelHostId}
                                    readOnly
                                    tabIndex={-1}
                                    className="school-setup-input-readonly"
                                />
                            </div>
                        </div>

                        <div className="school-setup-field">
                            <label>
                                Type of School <span className="required">*</span>
                            </label>
                            <select
                                value={schoolType}
                                disabled
                                tabIndex={-1}
                                aria-disabled="true"
                                className="school-setup-select-fixed"
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
                                    placeholder="Populated automatically"
                                    value={state}
                                    readOnly
                                    tabIndex={-1}
                                    className="school-setup-input-readonly"
                                />
                            </div>
                            <div className="school-setup-field">
                                <label>City</label>
                                <input
                                    type="text"
                                    placeholder="Populated automatically"
                                    value={city}
                                    readOnly
                                    tabIndex={-1}
                                    className="school-setup-input-readonly"
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
                                    placeholder="Populated automatically"
                                    value={district}
                                    readOnly
                                    tabIndex={-1}
                                    className="school-setup-input-readonly"
                                />
                            </div>
                            <div className="school-setup-field">
                                <label>District Code</label>
                                <input
                                    type="text"
                                    placeholder="Populated automatically"
                                    value={districtCode}
                                    readOnly
                                    tabIndex={-1}
                                    className="school-setup-input-readonly"
                                />
                            </div>
                        </div>

                        <div className="school-setup-field">
                            <label>
                                Zipcode / Postal Code (Pincode) <span className="required">*</span>
                            </label>
                            <input
                                type="text"
                                placeholder="Populated automatically"
                                value={zipcodePostalCode}
                                readOnly
                                tabIndex={-1}
                                className="school-setup-input-readonly"
                            />
                        </div>
                    </div>
                </div>

                <div className="school-setup-footer">
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
                        {saving ? 'Saving...' : 'Save Details'}
                    </button>
                </div>
            </div>
        </div>
    );
}

import React, { useState, useEffect } from 'react';
import { ipc } from '../lib/ipc.ts';
import { DeviceDetailsModal } from './DeviceDetailsModal.tsx';
import { SearchableSelect, SearchableOption } from './SearchableSelect.tsx';
import './SchoolSetupModal.css';

interface SchoolItem {
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
}

interface NgoItem {
    id: string;
    name: string;
    schools?: SchoolItem[];
}

const PRESET_SCHOOLS: SchoolItem[] = [
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

const FALLBACK_NGOS: NgoItem[] = [
    { id: 'SAM-DEFAULT', name: 'Sama Digital Foundation' },
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
    const [ngos, setNgos] = useState<NgoItem[]>(FALLBACK_NGOS);
    const [loadingNgos, setLoadingNgos] = useState(false);
    const [selectedNgo, setSelectedNgo] = useState('');
    const [selectedNgoKey, setSelectedNgoKey] = useState('SAM-DEFAULT');
    const [customNgo, setCustomNgo] = useState('');
    const [availableSchools, setAvailableSchools] = useState<SchoolItem[]>(PRESET_SCHOOLS);
    const [loadingSchools, setLoadingSchools] = useState(false);
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
    const [deviceModalOpen, setDeviceModalOpen] = useState(false);
    const [savedDeviceInfo, setSavedDeviceInfo] = useState({ serialNumber: '', macAddress: '' });

    // Helper to fetch schools for an NGO (with embedded fallback & API query)
    const fetchSchoolsForNgo = async (ngoId: string, embeddedSchools?: SchoolItem[]) => {
        if (embeddedSchools && embeddedSchools.length > 0) {
            setAvailableSchools(embeddedSchools);
        }

        if (!ngoId || ngoId === 'SAM-DEFAULT') {
            if (!embeddedSchools || embeddedSchools.length === 0) {
                setAvailableSchools(PRESET_SCHOOLS);
            }
            return;
        }

        setLoadingSchools(true);
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);
            const res = await fetch(`https://sama-api.thesama.in/api/schools?ngo_id=${encodeURIComponent(ngoId)}`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (res.ok) {
                const data = await res.json();
                if (data && data.status === 'success' && Array.isArray(data.data) && data.data.length > 0) {
                    const fetchedSchools: SchoolItem[] = data.data.map((item: any) => ({
                        school_id: item.school_id ? String(item.school_id) : undefined,
                        udise: item.udise ? String(item.udise) : '',
                        name: String(item.name || '').trim(),
                        city: item.city ? String(item.city) : '',
                        partner_name: item.partner_name ? String(item.partner_name) : '',
                        ngo_id: item.ngo_id ? String(item.ngo_id) : ngoId,
                        distribution_host_id: item.distribution_host_id ? String(item.distribution_host_id) : '',
                        zipcode: item.zipcode ? String(item.zipcode) : '',
                        state: item.state ? String(item.state) : '',
                        district: item.district ? String(item.district) : '',
                        district_code: item.district_code ? String(item.district_code) : '',
                        school_type: item.school_type ? String(item.school_type) : undefined,
                    })).filter((s: SchoolItem) => s.name.length > 0);

                    if (fetchedSchools.length > 0) {
                        setAvailableSchools(fetchedSchools);
                        return;
                    }
                }
            }
        } catch (err) {
            console.warn('[SchoolSetupModal] Failed to fetch schools for NGO from API:', err);
        } finally {
            setLoadingSchools(false);
        }

        if (!embeddedSchools || embeddedSchools.length === 0) {
            setAvailableSchools(PRESET_SCHOOLS);
        }
    };

    // Fetch NGOs from live API with graceful fallback to Sama Digital Foundation
    useEffect(() => {
        if (!isOpen) return;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000);

        setLoadingNgos(true);
        fetch('https://sama-api.thesama.in/api/ngos', { signal: controller.signal })
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then((data) => {
                if (data && data.status === 'success' && Array.isArray(data.data)) {
                    const mapped: NgoItem[] = data.data
                        .map((item: any) => ({
                            id: String(item.id || '').trim(),
                            name: String(item.organization_name || '').trim(),
                            schools: Array.isArray(item.schools)
                                ? item.schools.map((s: any) => ({
                                    school_id: s.school_id ? String(s.school_id) : undefined,
                                    udise: s.udise ? String(s.udise) : '',
                                    name: String(s.name || '').trim(),
                                    city: s.city ? String(s.city) : '',
                                    partner_name: s.partner_name ? String(s.partner_name) : '',
                                    ngo_id: s.ngo_id ? String(s.ngo_id) : '',
                                    distribution_host_id: s.distribution_host_id ? String(s.distribution_host_id) : '',
                                    zipcode: s.zipcode ? String(s.zipcode) : '',
                                    state: s.state ? String(s.state) : '',
                                    district: s.district ? String(s.district) : '',
                                    district_code: s.district_code ? String(s.district_code) : '',
                                    school_type: s.school_type ? String(s.school_type) : undefined,
                                }))
                                : undefined
                        }))
                        .filter((item: NgoItem) => item.name.length > 0);

                    // Ensure Sama Digital Foundation is present
                    const hasSama = mapped.some(
                        (n) => n.name.toLowerCase().includes('sama digital foundation')
                    );
                    if (!hasSama) {
                        mapped.unshift({ id: 'SAM-DEFAULT', name: 'Sama Digital Foundation', schools: PRESET_SCHOOLS as any });
                    }

                    // Sort alphabetically, keeping Sama Digital Foundation at top
                    mapped.sort((a, b) => {
                        if (a.id === 'SAM-DEFAULT') return -1;
                        if (b.id === 'SAM-DEFAULT') return 1;
                        return a.name.localeCompare(b.name);
                    });

                    setNgos(mapped);
                } else {
                    setNgos(FALLBACK_NGOS);
                }
            })
            .catch((err) => {
                console.warn('[SchoolSetupModal] Failed to fetch NGOs from API, falling back to Sama Digital Foundation:', err);
                setNgos(FALLBACK_NGOS);
            })
            .finally(() => {
                clearTimeout(timeoutId);
                setLoadingNgos(false);
            });

        return () => {
            clearTimeout(timeoutId);
            controller.abort();
        };
    }, [isOpen]);

    useEffect(() => {
        if (initialData) {
            const rawName = initialData.schoolName || '';
            const matchingPreset = availableSchools.find((s) => s.name === rawName) || PRESET_SCHOOLS.find((s) => s.name === rawName);

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

            const rawPartner = initialData.partnerName || '';
            const matchingNgo = ngos.find((n) => n.name.toLowerCase() === rawPartner.toLowerCase() || rawPartner.toLowerCase().includes(n.name.toLowerCase()));
            if (matchingNgo) {
                setSelectedNgo(matchingNgo.name);
                setSelectedNgoKey(matchingNgo.id);
                setCustomNgo('');
                fetchSchoolsForNgo(matchingNgo.id, matchingNgo.schools);
            } else if (rawPartner) {
                setSelectedNgo('__OTHER__');
                setSelectedNgoKey('');
                setCustomNgo(rawPartner);
            } else {
                setSelectedNgo('Sama Digital Foundation');
                setSelectedNgoKey('SAM-DEFAULT');
                setCustomNgo('');
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
        } else {
            // Default initial selection
            if (!selectedNgo) {
                setSelectedNgo('Sama Digital Foundation');
                setSelectedNgoKey('SAM-DEFAULT');
                setPartnerName('Sama Digital Foundation');
            }
        }
    }, [initialData, ngos]);

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
                partnerName={partnerName.trim() || (selectedNgo === '__OTHER__' ? customNgo.trim() : selectedNgo)}
            />
        );
    }

    const handleNgoSelect = (val: string) => {
        setSelectedNgo(val);
        setSelectedDropdown(''); // Reset school selection on NGO change
        if (val === '__OTHER__') {
            setPartnerName(customNgo);
            setSelectedNgoKey('');
            setAvailableSchools(PRESET_SCHOOLS);
        } else if (val) {
            setPartnerName(val);
            const match = ngos.find((n) => n.name === val);
            if (match) {
                setSelectedNgoKey(match.id);
                fetchSchoolsForNgo(match.id, match.schools);
            } else {
                setAvailableSchools(PRESET_SCHOOLS);
            }
        } else {
            setSelectedNgoKey('');
            setAvailableSchools(PRESET_SCHOOLS);
        }
    };

    const handleCustomNgoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setCustomNgo(val);
        setPartnerName(val);
    };

    const handleSchoolSelect = (val: string) => {
        setSelectedDropdown(val);

        if (val === '__OTHER__') {
            setSchoolName(customSchoolName);
        } else if (val) {
            const school = availableSchools.find((s) => s.name === val) || PRESET_SCHOOLS.find((s) => s.name === val);
            if (school) {
                setSchoolName(school.name);
                if (school.udise) setSchoolUdise(school.udise);
                if (school.city) setCity(school.city);
                if (school.district) setDistrict(school.district);
                if (school.district_code) setDistrictCode(school.district_code);
                if (school.state) setState(school.state);
                if (school.zipcode || school.zipcodePostalCode) {
                    setZipcodePostalCode(school.zipcode || school.zipcodePostalCode || '110001');
                }
                if (school.distribution_host_id) {
                    setDistributionChannelHostId(school.distribution_host_id);
                }
                if (school.school_type || school.schoolType) {
                    setSchoolType(school.school_type || school.schoolType || 'Government School');
                }
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

    const ngoOptions: SearchableOption[] = ngos.map((ngo) => ({
        value: ngo.name,
        label: ngo.name,
        badge: ngo.id !== 'SAM-DEFAULT' ? ngo.id : undefined,
        subLabel: ngo.schools && ngo.schools.length > 0 
            ? `${ngo.schools.length} school${ngo.schools.length > 1 ? 's' : ''}` 
            : undefined,
    }));

    const schoolOptions: SearchableOption[] = availableSchools.map((school) => {
        const details = [
            school.city,
            school.district,
            school.udise ? `UDISE: ${school.udise}` : undefined
        ].filter(Boolean).join(' • ');

        return {
            value: school.name,
            label: school.name,
            subLabel: details || undefined,
            badge: school.state || undefined,
        };
    });

    const isNgoValid = selectedNgo === '__OTHER__' ? customNgo.trim().length > 0 : selectedNgo.trim().length > 0;
    const isFormValid = isNgoValid && schoolName.trim() && state.trim() && district.trim();

    const handleSave = async () => {
        if (!isFormValid || saving) return;
        setSaving(true);
        try {
            const finalPartnerName = partnerName.trim() || (selectedNgo === '__OTHER__' ? customNgo.trim() : selectedNgo) || 'Sama Digital Foundation – 1';
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
                distributionChannelHostId: distributionChannelHostId.trim() || 'Sama Platform 1',
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
                    <h2>🏫 School & NGO Setup</h2>
                    <p>Select your NGO and school details. This information will be used for session reporting.</p>
                </div>

                <div className="school-setup-body">
                    <div className="school-setup-form">
                        <div className="school-setup-field">
                            <label>
                                Select NGO <span className="required">*</span>
                            </label>
                            <SearchableSelect
                                id="school-setup-ngo-select"
                                options={ngoOptions}
                                value={selectedNgo}
                                onChange={handleNgoSelect}
                                placeholder="-- Search & Select NGO --"
                                searchPlaceholder="Type NGO name or ID (e.g., sama, SAM-87)..."
                                loading={loadingNgos}
                                loadingText="-- Loading NGOs from API... --"
                                allowOther={true}
                                otherLabel="➕ Other (Enter manually)"
                                otherValue="__OTHER__"
                            />
                        </div>

                        {selectedNgo === '__OTHER__' && (
                            <div className="school-setup-field">
                                <label>
                                    Custom NGO Name <span className="required">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="Enter NGO name..."
                                    value={customNgo}
                                    onChange={handleCustomNgoChange}
                                    autoFocus
                                />
                            </div>
                        )}

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
                                searchPlaceholder="Search school by name, city, district, or UDISE..."
                                loading={loadingSchools}
                                loadingText="-- Loading schools from API... --"
                                allowOther={true}
                                otherLabel="➕ Other (Enter manually)"
                                otherValue="__OTHER__"
                            />
                        </div>

                        {selectedDropdown === '__OTHER__' && (
                            <div className="school-setup-field">
                                <label>
                                    Custom School Name <span className="required">*</span>
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
                        {saving ? 'Saving...' : 'Save Details ✓'}
                    </button>
                </div>
            </div>
        </div>
    );
}

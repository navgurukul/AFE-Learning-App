import React, { useState, useRef, useEffect } from 'react';

export interface SearchableOption {
    value: string;
    label: string;
    subLabel?: string;
    badge?: string;
}

interface SearchableSelectProps {
    options: SearchableOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    disabled?: boolean;
    loading?: boolean;
    loadingText?: string;
    allowOther?: boolean;
    otherLabel?: string;
    otherValue?: string;
    id?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
    options,
    value,
    onChange,
    placeholder = '-- Select --',
    searchPlaceholder = 'Type to search...',
    disabled = false,
    loading = false,
    loadingText = 'Loading...',
    allowOther = true,
    otherLabel = '➕ Other (Enter manually)',
    otherValue = '__OTHER__',
    id
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    // Selected option display text
    const selectedOption = options.find((opt) => opt.value === value);
    const displayLabel = value === otherValue 
        ? otherLabel 
        : (selectedOption ? selectedOption.label : (value || ''));

    // Filtered options based on search query
    const filteredOptions = options.filter((opt) => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return true;
        return (
            opt.label.toLowerCase().includes(q) ||
            (opt.subLabel && opt.subLabel.toLowerCase().includes(q)) ||
            (opt.badge && opt.badge.toLowerCase().includes(q)) ||
            opt.value.toLowerCase().includes(q)
        );
    });

    // Total items including "Other" if enabled
    const totalItems = filteredOptions.length + (allowOther ? 1 : 0);

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Auto-focus search input when opened
    useEffect(() => {
        if (isOpen) {
            setSearchQuery('');
            setHighlightedIndex(0);
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 50);
        }
    }, [isOpen]);

    // Ensure highlighted index stays in bounds
    useEffect(() => {
        if (highlightedIndex >= totalItems) {
            setHighlightedIndex(Math.max(0, totalItems - 1));
        }
    }, [totalItems, highlightedIndex]);

    const handleSelect = (val: string) => {
        onChange(val);
        setIsOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen) {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
                e.preventDefault();
                setIsOpen(true);
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIndex((prev) => (prev + 1) % Math.max(1, totalItems));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIndex((prev) => (prev - 1 + totalItems) % Math.max(1, totalItems));
                break;
            case 'Enter':
                e.preventDefault();
                if (highlightedIndex < filteredOptions.length) {
                    handleSelect(filteredOptions[highlightedIndex].value);
                } else if (allowOther && highlightedIndex === filteredOptions.length) {
                    handleSelect(otherValue);
                }
                break;
            case 'Escape':
                e.preventDefault();
                setIsOpen(false);
                break;
        }
    };

    // Scroll highlighted item into view
    useEffect(() => {
        if (isOpen && listRef.current) {
            const activeEl = listRef.current.children[highlightedIndex] as HTMLElement;
            if (activeEl) {
                activeEl.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [highlightedIndex, isOpen]);

    return (
        <div 
            className={`searchable-select-container ${disabled ? 'disabled' : ''} ${isOpen ? 'is-open' : ''}`}
            ref={containerRef}
            id={id}
            onKeyDown={handleKeyDown}
        >
            {/* Trigger Button */}
            <button
                type="button"
                className="searchable-select-trigger"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <span className={`searchable-select-value ${!displayLabel ? 'placeholder' : ''}`}>
                    {loading ? (loadingText || 'Loading...') : (displayLabel || placeholder)}
                </span>
                <span className="searchable-select-arrow" aria-hidden="true">
                    ▼
                </span>
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="searchable-select-dropdown">
                    {/* Search Input Box */}
                    <div className="searchable-select-search-wrap">
                        <span className="searchable-select-search-icon" aria-hidden="true">🔍</span>
                        <input
                            ref={searchInputRef}
                            type="text"
                            className="searchable-select-search-input"
                            placeholder={searchPlaceholder}
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setHighlightedIndex(0);
                            }}
                            onClick={(e) => e.stopPropagation()}
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                className="searchable-select-clear-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSearchQuery('');
                                    searchInputRef.current?.focus();
                                }}
                                title="Clear search"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Results Count / Info */}
                    <div className="searchable-select-count-bar">
                        <span>
                            {filteredOptions.length} of {options.length} found
                        </span>
                        {searchQuery && (
                            <span className="searchable-select-filter-tag">
                                Filter: "{searchQuery}"
                            </span>
                        )}
                    </div>

                    {/* Options List */}
                    <ul 
                        className="searchable-select-options-list" 
                        role="listbox" 
                        ref={listRef}
                    >
                        {filteredOptions.length === 0 ? (
                            <li className="searchable-select-no-results">
                                <span>No matches found</span>
                            </li>
                        ) : (
                            filteredOptions.map((opt, index) => {
                                const isSelected = opt.value === value;
                                const isHighlighted = index === highlightedIndex;
                                return (
                                    <li
                                        key={opt.value}
                                        role="option"
                                        aria-selected={isSelected}
                                        className={`searchable-select-option ${isSelected ? 'selected' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                        onClick={() => handleSelect(opt.value)}
                                        onMouseEnter={() => setHighlightedIndex(index)}
                                    >
                                        <div className="searchable-select-option-content">
                                            <div className="searchable-select-option-title-row">
                                                <span className="searchable-select-option-label">{opt.label}</span>
                                                {opt.badge && (
                                                    <span className="searchable-select-option-badge">{opt.badge}</span>
                                                )}
                                            </div>
                                            {opt.subLabel && (
                                                <span className="searchable-select-option-sublabel">{opt.subLabel}</span>
                                            )}
                                        </div>
                                        {isSelected && (
                                            <span className="searchable-select-checkmark" aria-hidden="true">✓</span>
                                        )}
                                    </li>
                                );
                            })
                        )}

                        {/* "Other (Enter manually)" item */}
                        {allowOther && (
                            <li
                                role="option"
                                aria-selected={value === otherValue}
                                className={`searchable-select-option other-option ${value === otherValue ? 'selected' : ''} ${highlightedIndex === filteredOptions.length ? 'highlighted' : ''}`}
                                onClick={() => handleSelect(otherValue)}
                                onMouseEnter={() => setHighlightedIndex(filteredOptions.length)}
                            >
                                <span className="searchable-select-option-label">{otherLabel}</span>
                                {value === otherValue && (
                                    <span className="searchable-select-checkmark" aria-hidden="true">✓</span>
                                )}
                            </li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
};

import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Globe, Check } from 'lucide-react';
import { COUNTRIES } from '../constants/countries';
import CountryFlag from './CountryFlag';

export default function CountrySelect({ value, flag, code, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Check if current value is custom or in list
  useEffect(() => {
    if (value) {
      const match = COUNTRIES.find(c => c.name.toLowerCase() === value.toLowerCase());
      if (!match && value !== '') {
        setIsCustom(true);
      } else {
        setIsCustom(false);
      }
    }
  }, [value]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
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

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const filteredCountries = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectCountry = (country) => {
    setIsCustom(false);
    onChange({
      country: country.name,
      countryCode: country.code,
      countryFlag: country.flag,
    });
    setIsOpen(false);
    setSearch('');
  };

  const handleSelectCustom = () => {
    setIsCustom(true);
    onChange({
      country: value || 'Custom',
      countryCode: 'XX',
      countryFlag: '🌐',
    });
    setIsOpen(false);
    setSearch('');
  };

  const handleCustomInputChange = (e) => {
    onChange({
      country: e.target.value,
      countryCode: 'XX',
      countryFlag: '🌐',
    });
  };

  return (
    <div 
      className="form-group" 
      ref={dropdownRef} 
      style={{ 
        position: 'relative',
        zIndex: isOpen ? 1200 : undefined 
      }}
    >
      <label className="form-label">
        Select Country
      </label>

      {/* Main Select Button */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.65rem 0.85rem',
          background: 'var(--bg-input)',
          border: isOpen ? '1px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          color: 'var(--text-primary)',
          fontSize: '0.9rem',
          boxShadow: isOpen ? '0 0 0 2px var(--brand-primary-subtle)' : 'none',
          transition: 'all 0.15s ease'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', overflow: 'hidden' }}>
          {isCustom ? (
            <>
              <Globe size={18} color="var(--brand-primary)" />
              <span style={{ fontWeight: 600 }}>{value && value !== 'Custom' ? value : 'Custom / Type manually'}</span>
            </>
          ) : value ? (
            <>
              <CountryFlag code={code} country={value} flag={flag} size="md" />
              <span style={{ fontWeight: 600 }}>{value}</span>
              {code && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({code})</span>}
            </>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>Select a Country...</span>
          )}
        </div>
        <ChevronDown size={16} color="var(--text-muted)" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </div>

      {/* Optional Custom Input if Custom is active */}
      {isCustom && (
        <div style={{ marginTop: '0.5rem' }}>
          <input
            type="text"
            placeholder="Type custom country or datacenter location..."
            value={value}
            onChange={handleCustomInputChange}
            className="form-input"
            style={{ fontSize: '0.85rem' }}
          />
        </div>
      )}

      {/* Dropdown Menu with solid elevated dark background and high zIndex */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 1400,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-card)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.75)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Search Input */}
          <div style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-card-solid)' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, color: 'var(--text-muted)' }} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search countries..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.5rem 0.45rem 2rem',
                  fontSize: '0.85rem',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* List items */}
          <div
            style={{
              maxHeight: '230px',
              overflowY: 'auto',
              padding: '0.35rem 0'
            }}
          >
            {/* Custom Option first */}
            <div
              onClick={handleSelectCustom}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                padding: '0.55rem 0.85rem',
                cursor: 'pointer',
                background: isCustom ? 'var(--brand-primary-subtle)' : 'transparent',
                color: isCustom ? 'var(--brand-primary)' : 'var(--text-primary)',
                fontSize: '0.85rem',
                fontWeight: 600,
                borderBottom: '1px solid var(--border-subtle)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--brand-primary-subtle)'}
              onMouseLeave={(e) => e.currentTarget.style.background = isCustom ? 'var(--brand-primary-subtle)' : 'transparent'}
            >
              <Globe size={16} color="var(--brand-primary)" />
              <span>Custom Country (Type manually)</span>
            </div>

            {filteredCountries.map((c) => {
              const isSelected = value?.toLowerCase() === c.name.toLowerCase();
              return (
                <div
                  key={c.code}
                  onClick={() => handleSelectCountry(c)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.5rem 0.85rem',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--brand-primary-subtle)' : 'transparent',
                    fontSize: '0.85rem',
                    transition: 'background 0.1s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--brand-primary-subtle)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = isSelected ? 'var(--brand-primary-subtle)' : 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <CountryFlag code={c.code} country={c.name} flag={c.flag} size="sm" />
                    <span style={{ color: 'var(--text-primary)', fontWeight: isSelected ? 700 : 500 }}>
                      {c.name}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {c.code}
                    </span>
                    {isSelected && <Check size={14} color="var(--brand-primary)" />}
                  </div>
                </div>
              );
            })}

            {filteredCountries.length === 0 && (
              <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                No countries match "{search}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

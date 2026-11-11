import React, { useState } from 'react';
import { COUNTRIES } from '../constants/countries';

/**
 * CountryFlag renders an official, high-definition national flag image
 * using FlagCDN (with high-DPI 2x retina support and graceful SVG/emoji fallback).
 * Solves the Windows OS limitation where country flag emojis are rendered as plain 2-letter text.
 */
export default function CountryFlag({
  code,
  country,
  flag,
  size = 'md',
  className = '',
  style = {}
}) {
  const [imgError, setImgError] = useState(false);

  // Derive ISO 3166-1 alpha-2 code
  let isoCode = (code || '').trim().toLowerCase();
  if (!isoCode && country) {
    const match = COUNTRIES.find(
      c => c.name.toLowerCase() === country.trim().toLowerCase()
    );
    if (match?.code) {
      isoCode = match.code.trim().toLowerCase();
    }
  }

  // Pre-set dimension ratios (standard 4:3 flag ratio)
  const sizeMap = {
    xs: { width: 16, height: 11, radius: 2 },
    sm: { width: 20, height: 14, radius: 3 },
    md: { width: 24, height: 17, radius: 3 },
    lg: { width: 32, height: 23, radius: 4 }
  };

  const dim = sizeMap[size] || sizeMap.md;
  const isValidCode = isoCode.length === 2 && /^[a-z]{2}$/.test(isoCode);

  if (isValidCode && !imgError) {
    return (
      <img
        src={`https://flagcdn.com/w40/${isoCode}.png`}
        srcSet={`https://flagcdn.com/w80/${isoCode}.png 2x`}
        alt={country || code || 'Flag'}
        title={country || code}
        width={dim.width}
        height={dim.height}
        loading="lazy"
        onError={() => setImgError(true)}
        style={{
          width: dim.width,
          height: dim.height,
          objectFit: 'cover',
          borderRadius: `${dim.radius}px`,
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.25)',
          border: '1px solid rgba(255, 255, 255, 0.18)',
          display: 'inline-block',
          verticalAlign: 'middle',
          flexShrink: 0,
          ...style
        }}
        className={className}
      />
    );
  }

  // Fallback to emoji or globe icon
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: dim.width,
        height: dim.height,
        fontSize: `${dim.height * 0.85}px`,
        lineHeight: 1,
        flexShrink: 0,
        ...style
      }}
      className={className}
      title={country || code}
    >
      {flag || '🌐'}
    </span>
  );
}

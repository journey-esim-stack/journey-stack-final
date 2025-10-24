import React from 'react';
import { Globe } from 'lucide-react';
import * as Flags from 'country-flag-icons/react/3x2';

interface FlagIconProps {
  countryCode: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

// Map size prop to pixel dimensions
const sizeMap = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32
};

/**
 * FlagIcon component renders SVG country flags
 * Uses country-flag-icons for consistent cross-platform rendering
 * Falls back to Globe icon for invalid or regional codes
 */
export function FlagIcon({ countryCode, size = 'md', className = '' }: FlagIconProps) {
  // Handle special cases
  if (!countryCode || countryCode === 'RG' || countryCode === 'GLOBAL') {
    return <Globe className={className} style={{ width: sizeMap[size], height: sizeMap[size] }} />;
  }

  // Get the flag component from country-flag-icons
  const code = countryCode.toUpperCase();
  const FlagComponent = (Flags as any)[code];

  if (!FlagComponent) {
    // Fallback to Globe icon if country code not found
    return <Globe className={className} style={{ width: sizeMap[size], height: sizeMap[size] }} />;
  }

  return (
    <FlagComponent
      title={code}
      className={`inline-block ${className}`}
      style={{ width: sizeMap[size], height: sizeMap[size] * 0.75 }} // 3x2 aspect ratio
    />
  );
}

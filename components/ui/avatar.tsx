'use client';

import React from 'react';

interface AvatarProps {
  src?: string | null;
  name: string;
  color?: string;
  className?: string;
  title?: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Renders the user's avatar image when one is set, or a colored initials
// badge otherwise. Never passes an empty string to <img src>, which the
// browser (and React) treats as "reload the current page" and logs as a
// console error — see mapUser() in lib/db/mappers.ts, which normalizes a
// missing avatar_url to '' rather than null/undefined.
export function Avatar({ src, name, color, className, title }: AvatarProps) {
  if (src) {
    return <img src={src} alt={name} title={title} className={className} />;
  }
  return (
    <div
      className={className}
      style={{ backgroundColor: color || '#3b82f6' }}
      title={title || name}
    >
      <span className="flex items-center justify-center w-full h-full text-white font-medium leading-none" style={{ fontSize: '0.7em' }}>
        {getInitials(name)}
      </span>
    </div>
  );
}

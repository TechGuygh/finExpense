import React from 'react';

export function Logo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M30 35 L50 20 L50 50 L30 50 Z" fill="var(--color-brand-primary)" />
      <path d="M30 60 L50 60 L50 80 L30 95 Z" fill="var(--color-brand-primary)" />
      <path d="M50 20 L70 5 L70 40 L50 40 Z" fill="var(--color-brand-secondary)" />
      <path d="M50 50 L70 50 L70 65 L50 80 Z" fill="var(--color-brand-secondary)" />
    </svg>
  );
}

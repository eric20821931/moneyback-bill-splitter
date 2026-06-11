import React from 'react';
import { cn } from '@/lib/utils';

interface ProjectIconProps {
  className?: string;
}

export const ProjectIcon: React.FC<ProjectIconProps> = ({ className }) => (
  <div
    className={cn(
      'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1ed760] text-black shadow-[rgba(0,0,0,0.35)_0px_6px_16px]',
      className
    )}
    aria-hidden="true"
  >
    <svg viewBox="0 0 36 36" className="h-7 w-7" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M18 7.5c-4.14 0-7.5 2.06-7.5 4.6s3.36 4.6 7.5 4.6 7.5-2.06 7.5-4.6-3.36-4.6-7.5-4.6Z"
        stroke="currentColor"
        strokeWidth="2.4"
      />
      <path
        d="M10.5 12.2v5.6c0 2.54 3.36 4.6 7.5 4.6s7.5-2.06 7.5-4.6v-5.6"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M10.5 17.8v5.25c0 2.55 3.36 4.62 7.5 4.62 1.33 0 2.58-.21 3.66-.6"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M21.5 22.4h6.25m0 0-2.35-2.35m2.35 2.35-2.35 2.35"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21.5 27.4h5.25"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  </div>
);

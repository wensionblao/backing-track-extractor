interface IconProps {
  size?: number
  className?: string
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
})

export function PlayIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path d="M8 5.5v13l10-6.5-10-6.5Z" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function PauseIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <rect x="8" y="5.5" width="2.6" height="13" rx="1" fill="currentColor" stroke="none" />
      <rect x="13.4" y="5.5" width="2.6" height="13" rx="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function DownloadIcon({ size = 15, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path d="M12 4v10" />
      <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
      <path d="M5 19h14" />
    </svg>
  )
}

export function SearchIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="5.5" />
      <path d="m15 15 4 4" />
    </svg>
  )
}

export function LinkIcon({ size = 15, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path d="M10 13.5a4 4 0 0 0 5.6 0l2.4-2.4a4 4 0 1 0-5.6-5.6l-1 1" />
      <path d="M14 10.5a4 4 0 0 0-5.6 0L6 12.9a4 4 0 1 0 5.6 5.6l1-1" />
    </svg>
  )
}

export function UploadIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path d="M12 15V5" />
      <path d="m7.5 9 4.5-4.5L16.5 9" />
      <path d="M5 15v3a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 18v-3" />
    </svg>
  )
}

export function ArrowIcon({ size = 15, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  )
}

export function CloseIcon({ size = 15, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  )
}

export function ZipIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path d="M6 4h9l3 3v13H6z" />
      <path d="M15 4v3h3" />
      <path d="M10.5 7v1.6M10.5 10.4v1.6M10.5 13.8v1.6" />
    </svg>
  )
}

export function SparkIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path d="M12 3.5 13.6 9l5.4 1.6-5.4 1.6L12 17.7 10.4 12.2 5 10.6 10.4 9 12 3.5Z" />
    </svg>
  )
}

export function BrandMark({ size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      strokeLinecap="round"
    >
      <g fill="var(--lime)">
        <rect x="3" y="9" width="2" height="6" rx="1" />
        <rect x="7" y="5" width="2" height="14" rx="1" />
        <rect x="11" y="2" width="2" height="20" rx="1" />
        <rect x="15" y="7" width="2" height="10" rx="1" />
        <rect x="19" y="11" width="2" height="2" rx="1" />
      </g>
    </svg>
  )
}

export function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
      <line x1="12" y1="2.5" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="21.5" />
      <line x1="2.5" y1="12" x2="5" y2="12" />
      <line x1="19" y1="12" x2="21.5" y2="12" />
      <line x1="4.9" y1="4.9" x2="6.7" y2="6.7" />
      <line x1="17.3" y1="17.3" x2="19.1" y2="19.1" />
      <line x1="4.9" y1="19.1" x2="6.7" y2="17.3" />
      <line x1="17.3" y1="6.7" x2="19.1" y2="4.9" />
    </svg>
  )
}

export function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
    </svg>
  )
}

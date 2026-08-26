export default function Logo({ compact = false }) {
  return (
    <div className="brand" aria-label="Nextstep">
      <svg className="brand-mark" viewBox="0 0 48 48" role="img" aria-label="Nextstep compass logo">
        <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M24 5.5 28.2 19.8 42.5 24l-14.3 4.2L24 42.5l-4.2-14.3L5.5 24l14.3-4.2L24 5.5Z" fill="currentColor" />
        <path d="m24 11 2.3 10.7L24 24l-2.3-2.3L24 11Z" fill="var(--color-brand-contrast)" />
        <circle cx="24" cy="24" r="2.4" fill="var(--color-brand-contrast)" />
      </svg>
      {!compact && <span className="brand-wordmark">Next<span>step</span></span>}
    </div>
  )
}

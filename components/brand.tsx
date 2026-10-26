import Link from "next/link";
export function Brand() {
  return (
    <Link className="brand" href="/#inicio" aria-label="Cura Café — início">
      <span>
        CURA CAFÉ<span className="brand-dot">.</span>
      </span>
      <small>Identificação provisória · logo em breve</small>
    </Link>
  );
}

export function Journey({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`journey ${className}`}
      viewBox="0 0 600 360"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M-30 300C210 300 15 50 235 50S290 240 400 240H640"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M-30 322C230 322 35 72 235 72S290 262 400 262H640"
        stroke="currentColor"
        strokeWidth="1"
        opacity=".35"
      />
      <circle cx="400" cy="240" r="9" fill="#BF9A50" />
      <path d="m560 232 8 8-8 8" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

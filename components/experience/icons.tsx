// Discreet line icons for the CURA Experience navigation (1.5px stroke).
const paths = {
  inicio: "M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z",
  cafe: "M12 3.5c-3.6 0-6 3.8-6 8.5s2.4 8.5 6 8.5 6-3.8 6-8.5-2.4-8.5-6-8.5Zm0 0c-1.6 2.6-1.6 5.6 0 8.5s1.6 5.9 0 8.5",
  aprender:
    "M3.5 8.5 12 4.5l8.5 4-8.5 4zM7 10.2v4.6c1.4 1.3 3 2 5 2s3.6-.7 5-2v-4.6M20.5 8.5V14",
  preparar:
    "M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5c-.8 1 .8 2 0 3M11 3.5c-.8 1 .8 2 0 3M14 3.5c-.8 1 .8 2 0 3",
  barista:
    "M4.5 6.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-4 3.5v-3.5h0a2 2 0 0 1-1.5-2zM8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01",
} as const;
export type IconName = keyof typeof paths;
export function Icon({
  name,
  className = "",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      className={`xp-icon ${className}`}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}

/**
 * Lightweight line-icon set (no dependency).
 * Inherit color via `currentColor`; size via the `className` prop.
 */

type IconProps = { className?: string };

function base(className?: string) {
  return {
    className: className ?? "w-6 h-6",
    fill: "none",
    viewBox: "0 0 24 24",
    strokeWidth: 1.7,
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

export function StoreIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M3 9.5 4.5 4h15L21 9.5M4 9.5V20h16V9.5M9 20v-5h6v5" />
      <path d="M3 9.5a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />
    </svg>
  );
}

export function TableIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18M8 18v2M16 18v2" />
    </svg>
  );
}

export function ReceiptIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M6 3h12v18l-3-1.8L12 21l-3-1.8L6 21V3Z" />
      <path d="M9 8h6M9 12h6" />
    </svg>
  );
}

export function WalletIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M3 7a2 2 0 0 1 2-2h12v4M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5a2 2 0 0 1-2-2Z" />
      <path d="M16 13h.01" />
    </svg>
  );
}

export function PlusIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function ArrowLeftIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function QrIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3M21 14v7M14 21h3" />
    </svg>
  );
}

export function DownloadIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
    </svg>
  );
}

export function LogoutIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}

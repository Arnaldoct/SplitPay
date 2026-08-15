import Link from "next/link";

/**
 * SplitPay brand wordmark — sleek gradient serif.
 * Use `size` to scale; pass `subtle` on dark surfaces for a plain-white variant.
 */
export function Wordmark({
  size = "md",
  className = "",
}: {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizes = {
    sm: "text-xl",
    md: "text-2xl",
    lg: "text-3xl",
    xl: "text-4xl sm:text-5xl",
  };
  return <span className={`wordmark ${sizes[size]} ${className}`}>SplitPay</span>;
}

/**
 * Surface card with consistent radius, border, and soft shadow.
 */
export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-white rounded-2xl border border-gray-200/80 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-violet-600 hover:bg-violet-700 text-white shadow-sm shadow-violet-600/20",
  secondary: "bg-gray-100 hover:bg-gray-200 text-gray-800",
  ghost: "bg-transparent hover:bg-gray-100 text-gray-600 hover:text-gray-900",
};

/**
 * Button — renders an <a>/<Link> when `href` is set, otherwise a <button>.
 */
export function Button({
  children,
  variant = "primary",
  href,
  className = "",
  ...props
}: {
  children: React.ReactNode;
  variant?: ButtonVariant;
  href?: string;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = `inline-flex items-center justify-center gap-2 font-semibold rounded-xl px-5 py-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${buttonVariants[variant]} ${className}`;

  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button className={cls} {...props}>
      {children}
    </button>
  );
}

/**
 * Small status pill.
 */
export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const tones = {
    neutral: "bg-gray-100 text-gray-700",
    success: "bg-emerald-100 text-emerald-800",
    warning: "bg-amber-100 text-amber-800",
    danger: "bg-red-100 text-red-800",
    info: "bg-violet-100 text-violet-800",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/**
 * Reusable Loading Spinner Component
 */

export function LoadingSpinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  return (
    <div className="flex items-center justify-center">
      <svg
        className={`animate-spin ${sizeClasses[size]} text-purple-600`}
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
        ></circle>
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
    </div>
  );
}

/**
 * Full Page Loading Component
 */
export function LoadingPage({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-gray-600">{message}</p>
      </div>
    </div>
  );
}

/**
 * Error Display Component
 */
export function ErrorMessage({
  title = "Something went wrong",
  message,
  retry,
}: {
  title?: string;
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
      <h3 className="text-sm font-semibold text-red-800 mb-1">{title}</h3>
      <p className="text-sm text-red-700">{message}</p>
      {retry && (
        <button
          onClick={retry}
          className="mt-3 text-sm text-red-800 hover:text-red-900 font-medium underline"
        >
          Try again
        </button>
      )}
    </div>
  );
}

/**
 * Empty State Component
 */
export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: string;
  title: string;
  message: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="text-center py-12 bg-white rounded-xl shadow-sm">
      <div className="text-6xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 mb-4">{message}</p>
      {action && (
        <a
          href={action.href}
          className="inline-block px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors"
        >
          {action.label}
        </a>
      )}
    </div>
  );
}

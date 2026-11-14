"use client";

// Window controls for the frameless desktop shell. The bridge is only active
// inside Tauri, so these stay hidden in the browser build.
import { desktop, isDesktop } from "@/lib/desktop";

export function WindowControls() {
  const desktopMode =
    typeof window !== "undefined" && isDesktop();
  if (!desktopMode) return null;

  return (
    <div className="no-drag flex items-center gap-1">
      <WinButton label="Свернуть" onClick={() => void desktop.minimize()}>
        <path d="M3 8h10" />
      </WinButton>
      <WinButton label="Развернуть" onClick={() => void desktop.toggleMaximize()}>
        <rect x="3.5" y="3.5" width="9" height="9" rx="1" />
      </WinButton>
      <WinButton label="Закрыть" danger onClick={() => void desktop.close()}>
        <path d="M4 4l8 8M12 4l-8 8" />
      </WinButton>
    </div>
  );
}

function WinButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`grid h-9 w-9 place-items-center rounded-lg text-white/45 transition-colors hover:text-white ${
        danger ? "hover:bg-red-500/70" : "hover:bg-white/[0.08]"
      }`}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
    </button>
  );
}

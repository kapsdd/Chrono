"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "./icons";

const CURRENT_VERSION = "3.2.1";
const VERSION_URL = "https://raw.githubusercontent.com/chrono-app/latest/main/version.json";
const RELEASE_URL = "https://github.com/chrono-app/releases/latest";

interface VersionInfo {
  version: string;
  url?: string;
  notes?: string;
}

export function UpdateBanner() {
  const [info, setInfo] = useState<VersionInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const dismissedVersion = window.localStorage.getItem("chrono.update.dismissed");
    if (dismissedVersion === CURRENT_VERSION) return;

    fetch(VERSION_URL, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: VersionInfo | null) => {
        if (data && data.version && isNewer(data.version, CURRENT_VERSION)) {
          setInfo(data);
        }
      })
      .catch(() => {});
  }, []);

  const dismiss = () => {
    setDismissed(true);
    window.localStorage.setItem("chrono.update.dismissed", CURRENT_VERSION);
  };

  if (!info || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        className="fixed bottom-4 right-4 z-[100] flex max-w-sm items-center gap-3 rounded-2xl border border-violet-400/30 bg-gradient-to-r from-violet-600/90 to-fuchsia-600/90 px-5 py-3.5 shadow-neon-strong backdrop-blur-sm"
      >
        <Icon name="bell" size={18} className="shrink-0 text-white/90" />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-white">
            Доступно обновление {info.version}
          </div>
          {info.notes && (
            <div className="mt-0.5 text-[11px] text-white/70 line-clamp-2">{info.notes}</div>
          )}
        </div>
        <a
          href={info.url || RELEASE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-lg bg-white/20 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-white/30 transition-colors"
        >
          Скачать
        </a>
        <button
          onClick={dismiss}
          className="shrink-0 grid h-6 w-6 place-items-center rounded-md text-white/50 hover:bg-white/10 hover:text-white"
        >
          <Icon name="close" size={14} />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}

function isNewer(latest: string, current: string): boolean {
  const parse = (v: string) => v.split(".").map(Number);
  const a = parse(latest);
  const b = parse(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff > 0) return true;
    if (diff < 0) return false;
  }
  return false;
}

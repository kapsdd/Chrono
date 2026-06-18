"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CAESAR_QUOTES, CAESAR_TITLE } from "@/lib/quotes";

interface Mote {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  dur: number;
}

// Cinematic Roman intro: the Caesar statue rises from the dark while his
// maxims cross-fade in gold. Auto-advances, but skippable with a click / key.
export function Intro({ onDone }: { onDone: () => void }) {
  const [quote, setQuote] = useState(0);
  const [leaving, setLeaving] = useState(false);

  const finish = () => {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(onDone, 900);
  };

  // Cycle quotes; auto-finish after the last has had its moment.
  useEffect(() => {
    const id = window.setInterval(() => {
      setQuote((q) => {
        if (q >= CAESAR_QUOTES.length - 1) {
          window.clearInterval(id);
          window.setTimeout(finish, 2600);
          return q;
        }
        return q + 1;
      });
    }, 2600);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Skip on any key / click.
  useEffect(() => {
    const onKey = () => finish();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving]);

  // Drifting dust motes — generated after mount so the random positions never
  // differ between the prerendered HTML and the client (no hydration mismatch).
  const [motes, setMotes] = useState<Mote[]>([]);
  useEffect(() => {
    setMotes(
      Array.from({ length: 36 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 1 + Math.random() * 2.5,
        delay: Math.random() * 6,
        dur: 6 + Math.random() * 8,
      })),
    );
  }, []);

  const q = CAESAR_QUOTES[quote];

  return (
    <AnimatePresence>
      {!leaving && (
        <motion.div
          key="intro"
          onClick={finish}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, filter: "blur(12px)" }}
          transition={{ duration: 0.9, ease: "easeInOut" }}
          className="absolute inset-0 z-50 cursor-pointer select-none overflow-hidden"
          style={{
            background:
              "radial-gradient(1200px 800px at 70% 30%, #3a1d5e 0%, #1a0f2e 45%, #08060f 100%)",
          }}
        >
          {/* god-ray sweep */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -inset-1/4"
            initial={{ opacity: 0, rotate: -8 }}
            animate={{ opacity: 0.5, rotate: 4 }}
            transition={{ duration: 7, ease: "easeInOut" }}
            style={{
              background:
                "conic-gradient(from 200deg at 75% 25%, transparent 0deg, rgba(216,178,90,0.12) 30deg, transparent 70deg, transparent 360deg)",
            }}
          />

          {/* dust */}
          {motes.map((m) => (
            <motion.span
              key={m.id}
              className="pointer-events-none absolute rounded-full bg-amber-200/40"
              style={{
                left: `${m.x}%`,
                top: `${m.y}%`,
                width: m.size,
                height: m.size,
              }}
              animate={{ y: [0, -40, 0], opacity: [0, 0.8, 0] }}
              transition={{
                duration: m.dur,
                delay: m.delay,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          ))}

          {/* Caesar statue */}
          <motion.img
            src="/caesar.jpg"
            alt="Gaius Julius Caesar"
            draggable={false}
            initial={{ opacity: 0, x: 120, scale: 1.08 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-none absolute bottom-0 right-[3%] h-[94%] w-auto object-contain"
            style={{
              filter:
                "drop-shadow(0 0 70px rgba(216,178,90,0.4)) drop-shadow(0 20px 40px rgba(0,0,0,0.6))",
              maskImage:
                "radial-gradient(68% 92% at 58% 52%, #000 52%, transparent 86%)",
              WebkitMaskImage:
                "radial-gradient(68% 92% at 58% 52%, #000 52%, transparent 86%)",
              mixBlendMode: "luminosity",
            }}
          />
          {/* warm relight over the statue */}
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-0 right-0 h-full w-1/2"
            style={{
              background:
                "radial-gradient(600px 700px at 78% 60%, rgba(240,217,140,0.18), transparent 70%)",
              mixBlendMode: "overlay",
            }}
          />

          {/* left column: emblem, title, quote */}
          <div className="relative z-10 flex h-full flex-col justify-center pl-[7%] pr-4">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 1 }}
              className="mb-6 flex items-center gap-3"
            >
              <LaurelMark />
              <span className="font-mono text-[11px] uppercase tracking-[0.5em] text-amber-200/70">
                S · P · Q · R
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, letterSpacing: "0.5em" }}
              animate={{ opacity: 1, letterSpacing: "0.18em" }}
              transition={{ delay: 0.7, duration: 1.6, ease: "easeOut" }}
              className="max-w-xl font-serif text-2xl font-semibold text-amber-100/90 sm:text-3xl"
              style={{ textShadow: "0 0 30px rgba(216,178,90,0.45)" }}
            >
              {CAESAR_TITLE}
            </motion.h1>

            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "16rem" }}
              transition={{ delay: 1, duration: 1.4, ease: "easeInOut" }}
              className="my-7 h-px bg-gradient-to-r from-amber-300/80 via-amber-200/30 to-transparent"
            />

            <div className="min-h-[7rem] max-w-xl">
              <AnimatePresence mode="wait">
                <motion.div
                  key={quote}
                  initial={{ opacity: 0, y: 18, filter: "blur(6px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -14, filter: "blur(6px)" }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                >
                  <p
                    className="font-serif text-3xl italic text-amber-50 sm:text-[2.6rem] sm:leading-tight"
                    style={{ textShadow: "0 2px 24px rgba(0,0,0,0.5)" }}
                  >
                    {q.latin}
                  </p>
                  <p className="mt-3 text-base text-amber-100/55 sm:text-lg">
                    {q.ru}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* quote progress pips */}
            <div className="mt-9 flex items-center gap-2">
              {CAESAR_QUOTES.map((_, i) => (
                <span
                  key={i}
                  className={
                    "h-1 rounded-full transition-all duration-500 " +
                    (i === quote
                      ? "w-8 bg-amber-300"
                      : i < quote
                        ? "w-3 bg-amber-300/40"
                        : "w-3 bg-white/10")
                  }
                />
              ))}
            </div>
          </div>

          {/* skip hint */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.4, duration: 1 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 font-mono text-[11px] uppercase tracking-[0.3em] text-white/30"
          >
            нажмите, чтобы продолжить
          </motion.div>

          {/* cinematic letterbox */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black/70 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/70 to-transparent" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function LaurelMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3c-3 3-4 7-4 10 0 3 1.6 6 4 8 2.4-2 4-5 4-8 0-3-1-7-4-10z"
        stroke="#e9cf8c"
        strokeWidth="1.2"
        opacity="0.9"
      />
      <path
        d="M8 9c-2 .5-3.4 1.8-4 3.6M16 9c2 .5 3.4 1.8 4 3.6"
        stroke="#e9cf8c"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  );
}

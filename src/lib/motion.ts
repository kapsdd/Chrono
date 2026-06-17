import type { Transition } from "framer-motion";

/** Shared spring — the single easing voice across CHRONO's motion. */
export const SPRING: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 34,
  mass: 0.8,
};

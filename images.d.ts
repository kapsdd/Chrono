// Static image imports (e.g. okno/icon.png in src/lib/brand.ts).
// Next adds this reference to the generated next-env.d.ts, but that file only
// exists after a build and is gitignored — this committed copy lets a standalone
// `tsc --noEmit` resolve image modules (*.png, *.ico, ...) too.
/// <reference types="next/image-types/global" />

declare global {
  interface Window {
    chrono?: {
      isDesktop?: boolean;
      minimize?: () => void;
      toggleMaximize?: () => void;
      close?: () => void;
      googleSignIn?: () => Promise<{ idToken: string | null; error: string | null }>;
    };
  }
}

export {};

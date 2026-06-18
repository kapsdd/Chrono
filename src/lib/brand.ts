// The app icon, imported so webpack emits it as a hashed static asset (works in
// the static export and the Electron bundle alike). Displayed inside a rounded,
// overflow-hidden container in the UI so the icon's white PNG corners are
// clipped away without needing to edit the source image.
import iconPng from "../../okno/icon.ico";

export const APP_ICON = iconPng.src;

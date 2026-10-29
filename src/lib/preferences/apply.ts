import type { Preferences } from "./schema"

// Set on <html> by the root layout, where the stylesheets read them, so the first paint already matches.
export function preferenceAttributes(prefs: Preferences) {
  return {
    "data-theme": prefs.theme,
    "data-accent": prefs.accent,
    "data-text-size": prefs.textSize,
    "data-motion": prefs.motion,
    "data-colorblind": prefs.colorblind ? "" : undefined,
    "data-readable-font": prefs.readableFont ? "" : undefined,
  }
}

// Checked at every sign-in, since a role change can take away a page saved earlier.
export function resolveHomePage(homePage: string | null, visible: string[], fallback: string): string {
  return homePage && visible.includes(homePage) ? homePage : fallback
}

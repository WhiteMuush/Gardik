"use client"

import { Check, Monitor, Moon, Sun, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Preferences } from "@/lib/preferences/schema"
import { Segmented, SettingRow } from "./controls"
import type { UpdatePreference } from "./PreferencesForm"

const themes: { value: Preferences["theme"]; label: string; icon: LucideIcon; page: string; card: string }[] =
  [
    { value: "light", label: "Light", icon: Sun, page: "#FFF5E5", card: "#FFFFFF" },
    { value: "dark", label: "Dark", icon: Moon, page: "#1B1726", card: "#2A2438" },
    {
      value: "system",
      label: "System",
      icon: Monitor,
      page: "linear-gradient(135deg,#FFF5E5 50%,#1B1726 50%)",
      card: "#8F88A0",
    },
  ]

// Swatches of the light-theme values in preferences.css, each 4.5:1 against white text.
const accents: { value: Preferences["accent"]; label: string; hex: string }[] = [
  { value: "violet", label: "Violet", hex: "#7F27FF" },
  { value: "blue", label: "Blue", hex: "#1D4ED8" },
  { value: "teal", label: "Teal", hex: "#0F766E" },
  { value: "rose", label: "Rose", hex: "#BE185D" },
  { value: "orange", label: "Orange", hex: "#C2410C" },
]

export function AppearanceSection({ prefs, update }: { prefs: Preferences; update: UpdatePreference }) {
  const { theme, accent, textSize } = prefs

  return (
    <>
      <div>
        <p className="text-sm font-medium text-foreground">Theme</p>
        <p className="text-sm text-muted-foreground">System follows the setting of your computer.</p>
        <div role="radiogroup" aria-label="Theme" className="mt-3 grid grid-cols-3 gap-3">
          {themes.map(({ value, label, icon: Icon, page, card }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={theme === value}
              onClick={() => update("theme", value)}
              className={cn(
                "rounded-xl border p-2 text-left transition-colors",
                theme === value
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-border hover:border-primary/40"
              )}
            >
              <span aria-hidden className="block h-16 rounded-lg p-2" style={{ background: page }}>
                <span className="block h-2 w-1/2 rounded-full" style={{ background: card }} />
                <span className="mt-2 block h-6 rounded-md" style={{ background: card }} />
              </span>
              <span className="mt-2 flex items-center gap-1.5 px-1 text-sm text-foreground">
                <Icon className="hidden size-3.5 text-muted-foreground sm:block" />
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <SettingRow title="Accent color" description="Buttons, links and the active page in the menu.">
        <div role="radiogroup" aria-label="Accent color" className="flex gap-2">
          {accents.map((a) => (
            <button
              key={a.value}
              type="button"
              role="radio"
              aria-checked={accent === a.value}
              aria-label={a.label}
              title={a.label}
              onClick={() => update("accent", a.value)}
              className={cn(
                "flex size-8 items-center justify-center rounded-full ring-offset-2 ring-offset-card transition-shadow",
                accent === a.value && "ring-2 ring-foreground/40"
              )}
              style={{ background: a.hex }}
            >
              {accent === a.value && <Check className="size-4 text-white" />}
            </button>
          ))}
        </div>
      </SettingRow>

      <SettingRow title="Text size" description="Applies to every page of Gardik.">
        <Segmented
          label="Text size"
          value={textSize}
          onChange={(v) => update("textSize", v)}
          options={[
            { value: "small", label: "Small" },
            { value: "default", label: "Default" },
            { value: "large", label: "Large" },
          ]}
        />
      </SettingRow>
    </>
  )
}

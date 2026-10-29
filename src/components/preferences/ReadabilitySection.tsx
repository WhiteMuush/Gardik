"use client"

import type { Preferences } from "@/lib/preferences/schema"
import { Segmented, SettingRow, Switch } from "./controls"
import type { UpdatePreference } from "./PreferencesForm"

// Read from the severity tokens, so the preview shows the palette the switch really applies.
const levels = [
  { label: "Critical", dot: "bg-severity-critical" },
  { label: "High", dot: "bg-severity-high" },
  { label: "Medium", dot: "bg-severity-medium" },
  { label: "Low", dot: "bg-severity-low" },
  { label: "OK", dot: "bg-severity-ok" },
]

export function ReadabilitySection({ prefs, update }: { prefs: Preferences; update: UpdatePreference }) {
  const { motion, colorblind, readableFont } = prefs

  return (
    <>
      <SettingRow
        title="Animations"
        description="System follows the reduced motion setting of your computer."
      >
        <Segmented
          label="Animations"
          value={motion}
          onChange={(v) => update("motion", v)}
          options={[
            { value: "system", label: "System" },
            { value: "reduce", label: "Reduced" },
            { value: "full", label: "Full" },
          ]}
        />
      </SettingRow>

      <SettingRow
        title="Color-blind friendly severity"
        description="Severity colors that stay distinct without telling red from green."
        below={
          <p aria-hidden className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-foreground">
            {levels.map((level) => (
              <span key={level.label} className="inline-flex items-center gap-1.5">
                <span className={`size-2.5 rounded-full ${level.dot}`} />
                {level.label}
              </span>
            ))}
          </p>
        }
      >
        <Switch
          label="Color-blind friendly severity"
          checked={colorblind}
          onChange={(v) => update("colorblind", v)}
        />
      </SettingRow>

      <SettingRow
        title="Easier-to-read font"
        description="A wider font, with more space between letters and words."
      >
        <Switch
          label="Easier-to-read font"
          checked={readableFont}
          onChange={(v) => update("readableFont", v)}
        />
      </SettingRow>
    </>
  )
}

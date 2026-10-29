"use client"

import { useRef, useState } from "react"
import { Check } from "lucide-react"
import { preferenceAttributes } from "@/lib/preferences/apply"
import type { Preferences } from "@/lib/preferences/schema"
import { AppearanceSection } from "./AppearanceSection"
import { ReadabilitySection } from "./ReadabilitySection"
import { RegionSection } from "./RegionSection"
import { SettingsGroup } from "./controls"

export type UpdatePreference = <K extends keyof Preferences>(key: K, value: Preferences[K]) => void

// Written straight onto <html> so the choice shows at once, before the server answers.
function applyToDocument(prefs: Preferences) {
  const root = document.documentElement
  for (const [name, value] of Object.entries(preferenceAttributes(prefs))) {
    if (value === undefined) root.removeAttribute(name)
    else root.setAttribute(name, value)
  }
}

type Props = { initial: Preferences; homePages: { path: string; label: string }[] }

export function PreferencesForm({ initial, homePages }: Props) {
  const [prefs, setPrefs] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const hideSaved = useRef<ReturnType<typeof setTimeout>>(undefined)

  const update: UpdatePreference = (key, value) => {
    const previous = prefs
    const next = { ...prefs, [key]: value }
    setPrefs(next)
    applyToDocument(next)
    setError(null)
    setSaved(false)
    void fetch("/api/account/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    })
      .then(async (res) => {
        if (res.ok) {
          setSaved(true)
          clearTimeout(hideSaved.current)
          hideSaved.current = setTimeout(() => setSaved(false), 2500)
          return
        }
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? "Could not save this setting")
      })
      .catch((e: unknown) => {
        setPrefs(previous)
        applyToDocument(previous)
        setError(e instanceof Error ? e.message : "Could not save this setting")
      })
  }

  return (
    <div>
      {/* Kept mounted so screen readers announce each change of its text. */}
      <p role="status" className="mb-2 flex h-5 items-center gap-1.5 text-sm">
        {error ? <span className="text-severity-critical-fg">{error}</span> : null}
        {saved ? (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Check className="size-4 text-primary" />
            Saved
          </span>
        ) : null}
      </p>
      <SettingsGroup title="Appearance" description="Colors and size of the interface.">
        <AppearanceSection prefs={prefs} update={update} />
      </SettingsGroup>
      <SettingsGroup title="Readability" description="Display preferences that make Gardik easier to use.">
        <ReadabilitySection prefs={prefs} update={update} />
      </SettingsGroup>
      <SettingsGroup title="Region" description="Time zone and the page you land on.">
        <RegionSection prefs={prefs} update={update} homePages={homePages} />
      </SettingsGroup>
    </div>
  )
}

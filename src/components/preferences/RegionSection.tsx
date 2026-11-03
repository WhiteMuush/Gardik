"use client"

import { useSyncExternalStore } from "react"
import type { Preferences } from "@/lib/preferences/schema"
import { SettingRow } from "./controls"
import type { UpdatePreference } from "./PreferencesForm"

const selectClass = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm sm:w-64"
const noop = () => () => {}
const noZones: string[] = []
// Cached because useSyncExternalStore loops when a snapshot is a new array on every read.
let zoneList: string[] | undefined
const allZones = () => (zoneList ??= Intl.supportedValuesOf("timeZone"))

type Props = { prefs: Preferences; update: UpdatePreference; homePages: { path: string; label: string }[] }

export function RegionSection({ prefs, update, homePages }: Props) {
  // The browser zone is only known on the client, so the server render prints UTC.
  const detected = useSyncExternalStore(
    noop,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => "UTC"
  )
  const zones = useSyncExternalStore(noop, allZones, () => noZones)

  return (
    <>
      <SettingRow title="Time zone" description="Dates in alerts, reports and the audit log use it.">
        <select
          aria-label="Time zone"
          value={prefs.timeZone ?? "auto"}
          onChange={(e) => update("timeZone", e.target.value === "auto" ? null : e.target.value)}
          className={selectClass}
        >
          <option value="auto">Automatic ({detected})</option>
          {zones.map((z) => (
            <option key={z} value={z}>
              {z.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </SettingRow>

      <SettingRow title="Home page" description="Where Gardik opens after you sign in.">
        <select
          aria-label="Home page"
          value={prefs.homePage ?? "auto"}
          onChange={(e) => update("homePage", e.target.value === "auto" ? null : e.target.value)}
          className={selectClass}
        >
          <option value="auto">Default for your role</option>
          {homePages.map((p) => (
            <option key={p.path} value={p.path}>
              {p.label}
            </option>
          ))}
        </select>
      </SettingRow>
    </>
  )
}

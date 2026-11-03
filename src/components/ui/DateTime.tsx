"use client"

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react"

const SavedZone = createContext<string | null>(null)

export function TimeZoneProvider({ zone, children }: { zone: string | null; children: ReactNode }) {
  return <SavedZone.Provider value={zone}>{children}</SavedZone.Provider>
}

const noop = () => () => {}
const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

// The saved zone wins; "Automatic" uses the browser, which the server cannot see, so it renders UTC first.
export function useTimeZone(): string {
  const saved = useContext(SavedZone)
  const detected = useSyncExternalStore(noop, browserZone, () => "UTC")
  return saved ?? detected
}

type Props = { value: string | Date; options: Intl.DateTimeFormatOptions }

export function DateTime({ value, options }: Props) {
  const timeZone = useTimeZone()
  const date = new Date(value)
  return (
    <time dateTime={date.toISOString()}>
      {new Intl.DateTimeFormat("en-US", { ...options, timeZone }).format(date)}
    </time>
  )
}

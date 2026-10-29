// Order matters: Edge and Android user agents also name Chrome and Linux, and Chrome names Safari.
const BROWSERS: [RegExp, string][] = [
  [/Edg\//, "Edge"],
  [/Firefox\//, "Firefox"],
  [/Chrome\//, "Chrome"],
  [/Safari\//, "Safari"],
]

const SYSTEMS: [RegExp, string][] = [
  [/iPhone|iPad/, "iOS"],
  [/Android/, "Android"],
  [/Windows/, "Windows"],
  [/Macintosh|Mac OS X/, "macOS"],
  [/Linux/, "Linux"],
]

function match(ua: string, table: [RegExp, string][]): string | null {
  return table.find(([pattern]) => pattern.test(ua))?.[1] ?? null
}

export function describeUserAgent(ua: string | null): string {
  if (!ua) return "Unknown device"
  const browser = match(ua, BROWSERS)
  const system = match(ua, SYSTEMS)
  if (!browser && !system) return "Unknown device"
  return `${browser ?? "Unknown browser"} on ${system ?? "an unknown system"}`
}

import { lookup } from "dns/promises"

// Admin-supplied outbound URLs are attacker-controlled, and https alone does not block an internal host behind TLS.

function isPrivateV4(ip: string): boolean {
  const parts = ip.split(".")
  if (parts.length !== 4) return false
  const [a, b] = parts.map((p) => Number(p))
  if (parts.some((p) => p === "" || !/^\d+$/.test(p)) || [a, b].some(Number.isNaN)) return false

  if (a === 0) return true // "this network"
  if (a === 10) return true // RFC1918
  if (a === 127) return true // loopback
  if (a === 169 && b === 254) return true // link-local, covers 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return true // RFC1918 /12
  if (a === 192 && b === 168) return true // RFC1918
  if (a === 100 && b >= 64 && b <= 127) return true // RFC6598 carrier-grade NAT
  if (a >= 224) return true // multicast and reserved
  return false
}

export function isPrivateAddress(ip: string): boolean {
  const addr = ip
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "")

  // An IPv4-mapped v6 address reaches its v4 host, so it is unwrapped before the check.
  const mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return isPrivateV4(mapped[1])

  if (addr.includes(":")) {
    if (addr === "::" || addr === "::1") return true
    if (addr.startsWith("fe80")) return true // link-local
    if (/^f[cd]/.test(addr)) return true // unique local fc00::/7
    return false
  }

  return isPrivateV4(addr)
}

export type OutboundUrl = { url: URL } | { error: string }

// Synchronous checks only; a hostname must still pass resolvesToPublicHost before the request.
export function parseOutboundUrl(raw: string): OutboundUrl {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return { error: "Invalid URL" }
  }
  if (url.protocol !== "https:") return { error: "URL must use https" }
  if (url.username || url.password) return { error: "URL must not embed credentials" }
  if (isPrivateAddress(url.hostname)) return { error: "URL must point to a public host" }
  return { url }
}

// Checked when saved and again before delivery, since DNS rebinding can repoint a public name to a private address.
export async function resolvesToPublicHost(hostname: string): Promise<boolean> {
  if (isPrivateAddress(hostname)) return false
  try {
    const records = await lookup(hostname, { all: true })
    return records.length > 0 && records.every((r) => !isPrivateAddress(r.address))
  } catch {
    return false
  }
}

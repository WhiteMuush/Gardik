import { lookup } from "dns/promises"

// Outbound URLs are supplied by admins (webhooks, directory endpoints), so they
// are attacker-controlled from the server's point of view: a request the app
// makes reaches whatever the network reaches, including sibling services and
// the cloud metadata endpoint. Forcing https already blocks the AWS IMDS
// address, which is http only, but not an internal host behind TLS.

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
  const addr = ip.trim().toLowerCase().replace(/^\[|\]$/g, "")

  // An IPv4-mapped v6 address reaches the same host as the v4 it wraps, so it
  // has to be unwrapped rather than treated as an opaque v6 string.
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

// Synchronous checks only: shape, scheme, credentials, and a literal private
// address. A hostname still has to be resolved before the request is made, see
// resolvesToPublicHost.
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

// A hostname that looks public can still resolve into the private space, which
// is the whole point of a DNS rebinding attack. Checked at write time so a bad
// endpoint is refused up front, and again before delivery so a record that was
// valid when saved cannot be repointed later.
export async function resolvesToPublicHost(hostname: string): Promise<boolean> {
  if (isPrivateAddress(hostname)) return false
  try {
    const records = await lookup(hostname, { all: true })
    return records.length > 0 && records.every((r) => !isPrivateAddress(r.address))
  } catch {
    return false
  }
}

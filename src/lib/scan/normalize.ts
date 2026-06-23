import type { ArtifactKind } from "@prisma/client"

// Normalize a data-type label to lowercase snake_case.
export function normalizeType(raw: string): string {
  return raw.toLowerCase().trim().replace(/\s+/g, "_")
}

// Map a free-text artifact label from a stealer-log feed onto an ArtifactKind.
// Returns null for labels that are not a recognized stealer artifact so callers
// can drop them rather than guess.
export function normalizeArtifact(raw: string): ArtifactKind | null {
  const v = raw.toLowerCase().trim()
  if (v.includes("cookie")) return "COOKIE"
  if (v.includes("token") || v.includes("jwt") || v.includes("session")) return "TOKEN"
  if (v.includes("autofill") || v.includes("form")) return "AUTOFILL"
  if (v.includes("password") || v.includes("credential") || v === "pass") return "PASSWORD"
  return null
}

// Common TLDs stripped from a breach label so "LinkedIn.com" collapses onto
// "LinkedIn". Only a single trailing TLD is removed.
const TRAILING_TLD = /\.(com|net|org|io|co|info|biz)$/

// Canonical key used to recognize the same breach reported under slightly
// different labels by different providers. Conservative on purpose: it folds
// case, whitespace, punctuation and a trailing TLD, but keeps digits so
// "Collection #1" and "Collection #2" stay distinct (no false merge). Labels
// from different namespaces (an IntelX bucket vs "LinkedIn") will not collide.
export function canonicalBreachKey(name: string): string {
  const base = name.toLowerCase().trim().replace(/\s+/g, " ").replace(TRAILING_TLD, "")
  return base.replace(/[^a-z0-9]+/g, "")
}

// Parse a breach date; returns epoch (1970) when missing or invalid.
export function parseBreachDate(raw?: string | null): Date {
  if (!raw) return new Date(0)
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? new Date(0) : d
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

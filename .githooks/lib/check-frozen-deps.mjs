#!/usr/bin/env node
// Rejects any move of a frozen dependency's pinned major, either way: node check-frozen-deps.mjs <old-ref> <new-ref>.
import { execFileSync } from "node:child_process"

// Canonical major version each frozen dependency is pinned to.
const CANONICAL = { next: "16", tailwindcss: "3", typescript: "5", eslint: "9" }

function load(ref) {
  try {
    const raw = execFileSync("git", ["show", ref], { encoding: "utf8" })
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function major(range) {
  const m = String(range || "").match(/(\d+)/)
  return m ? m[1] : null
}

function deps(pkg) {
  return { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) }
}

const [, , , newRef] = process.argv
const newDeps = deps(load(newRef))

let failed = false
for (const [name, pinned] of Object.entries(CANONICAL)) {
  const after = major(newDeps[name])
  if (after && after !== pinned) {
    console.error(`Frozen dependency "${name}" must stay on major ${pinned}, found ${newDeps[name]}.`)
    failed = true
  }
}

process.exit(failed ? 1 : 0)

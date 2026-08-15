/**
 * License gate and third-party notice generator.
 *
 * Reads package-lock.json (not node_modules): the lockfile carries a `license`
 * field on every entry, so the check is deterministic, needs no install, and
 * yields the same answer on every platform. Walking node_modules instead would
 * report a different set of packages on Linux than on macOS, because optional
 * platform-specific binaries (sharp's libvips builds) only install on the host
 * they target.
 *
 * Scope is the runtime tree: entries the lockfile marks `dev: true` are skipped
 * because they never reach a deployed artifact. A copyleft build tool is not a
 * distribution problem; a copyleft runtime dependency is.
 *
 * The gate is an allowlist, not a denylist. A license nobody has reviewed yet
 * fails the build and has to be added here on purpose, which is the whole point:
 * a new AGPL transitive should stop a merge rather than land unnoticed.
 *
 *   node scripts/check-licenses.mjs          # verify (CI)
 *   node scripts/check-licenses.mjs --write  # regenerate the notices file
 */
import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const LOCKFILE = join(root, "package-lock.json")
const NOTICES = join(root, "THIRD-PARTY-NOTICES.md")

// Reviewed and accepted. Permissive unless noted; the copyleft entries are
// weak (file-level or library-level) and are documented in OBLIGATIONS below.
const ALLOWED = new Set([
  "0BSD",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "BlueOak-1.0.0",
  "CC-BY-4.0",
  "CC0-1.0",
  "EPL-2.0",
  "ISC",
  "LGPL-3.0-or-later",
  "MIT",
  "MPL-2.0",
  "Python-2.0",
  "Unlicense",
  "Zlib",
])

// Some packages predate SPDX or simply write the field by hand.
const SPELLING = new Map([
  ["MIT License", "MIT"],
  ["MIT and ISC", "MIT AND ISC"],
])

// Packages that ship a LICENSE file but no `license` field for the lockfile to
// record. Each was read by hand; do not add an entry without doing the same.
const MISSING_FIELD = new Map([
  ["png-js", "MIT"], // LICENSE: "MIT License, Copyright (c) 2017 Devon Govett"
  ["seq-queue", "MIT"], // LICENSE: "(The MIT License), Copyright (c) 2012 Netease, Inc."
])

const OBLIGATIONS = [
  [
    "LGPL-3.0-or-later",
    "Used as a pre-built shared library (libvips, pulled in by sharp) that is " +
      "loaded at runtime and never modified. The license reaches the library, " +
      "not the application linking against it. Redistributing DataShield as " +
      "software means passing along this notice and the library's own license " +
      "text; running it as a hosted service triggers nothing.",
  ],
  [
    "MPL-2.0",
    "File-level copyleft. Only changes made to the MPL-covered files themselves " +
      "must be published under the MPL. Depending on these packages places no " +
      "condition on DataShield's own source.",
  ],
  [
    "EPL-2.0",
    "Weak copyleft at the module level, same shape as the MPL: modifications to " +
      "the EPL-covered files are covered, surrounding code is not.",
  ],
  [
    "CC-BY-4.0",
    "Attribution required when the covered material is redistributed. This file " +
      "is that attribution.",
  ],
]

function normalize(license) {
  return SPELLING.get(license) ?? license
}

/** Splits an SPDX expression ("(MIT AND Zlib)", "MIT OR Apache-2.0") into ids. */
function identifiers(expression) {
  return expression
    .replace(/[()]/g, " ")
    .split(/\s+(?:AND|OR|WITH|and|or)\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function runtimePackages() {
  const lock = JSON.parse(readFileSync(LOCKFILE, "utf8"))
  const seen = new Map()

  for (const [path, entry] of Object.entries(lock.packages)) {
    if (path === "" || entry.dev || entry.link) continue
    const name = path.slice(path.lastIndexOf("node_modules/") + "node_modules/".length)
    const license = entry.license ? normalize(entry.license) : MISSING_FIELD.get(name)
    seen.set(`${name}@${entry.version}`, { name, version: entry.version, license })
  }

  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
}

function render(packages) {
  const byLicense = new Map()
  for (const pkg of packages) {
    const key = pkg.license ?? "UNKNOWN"
    if (!byLicense.has(key)) byLicense.set(key, [])
    byLicense.get(key).push(`${pkg.name}@${pkg.version}`)
  }

  const lines = [
    "# Third-party notices",
    "",
    "DataShield itself is licensed under the terms in `LICENSE`. This file lists",
    "the third-party packages it depends on at runtime and their licenses, so a",
    "redistribution under Section 3.d of that license carries the attribution",
    "those packages require.",
    "",
    "Generated from `package-lock.json`; do not edit by hand. Regenerate with",
    "`npm run licenses:write`. Build-time-only dependencies are excluded: they",
    "are not part of anything that ships.",
    "",
    `Runtime packages: ${packages.length}.`,
    "",
    "## Obligations worth knowing",
    "",
  ]

  const present = new Set(packages.flatMap((p) => (p.license ? identifiers(p.license) : [])))
  for (const [license, note] of OBLIGATIONS) {
    if (present.has(license)) lines.push(`**${license}.** ${note}`, "")
  }

  lines.push("## Packages by license", "")
  for (const [license, names] of [...byLicense.entries()].sort((a, b) => b[1].length - a[1].length)) {
    lines.push(`### ${license} (${names.length})`, "")
    for (const name of names.sort()) lines.push(`- ${name}`)
    lines.push("")
  }

  return lines.join("\n")
}

const packages = runtimePackages()

const unknown = packages.filter((p) => !p.license)
const forbidden = packages.filter(
  (p) => p.license && !identifiers(p.license).every((id) => ALLOWED.has(id))
)

if (unknown.length > 0 || forbidden.length > 0) {
  for (const pkg of unknown) {
    console.error(`[licenses] no license metadata: ${pkg.name}@${pkg.version}`)
  }
  for (const pkg of forbidden) {
    console.error(`[licenses] license not on the allowlist: ${pkg.name}@${pkg.version} (${pkg.license})`)
  }
  console.error(
    "\nRead the package's own LICENSE file, then either add the identifier to ALLOWED\n" +
      "in scripts/check-licenses.mjs (with an OBLIGATIONS entry if it carries any) or\n" +
      "drop the dependency. Do not silence this by guessing."
  )
  process.exit(1)
}

const generated = render(packages)

if (process.argv.includes("--write")) {
  writeFileSync(NOTICES, generated)
  console.log(`[licenses] wrote THIRD-PARTY-NOTICES.md (${packages.length} runtime packages)`)
  process.exit(0)
}

let committed = ""
try {
  committed = readFileSync(NOTICES, "utf8")
} catch {
  console.error("[licenses] THIRD-PARTY-NOTICES.md is missing. Run: npm run licenses:write")
  process.exit(1)
}

if (committed !== generated) {
  console.error(
    "[licenses] THIRD-PARTY-NOTICES.md is stale: the dependency tree changed.\n" +
      "Run: npm run licenses:write"
  )
  process.exit(1)
}

console.log(`[licenses] ok: ${packages.length} runtime packages, all licenses reviewed`)

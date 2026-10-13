// Fails when facts that live in several files drift apart: the Node major
// (.nvmrc is the source of truth) and a hardcoded release number in the README,
// which goes stale on the next release.
import { readFileSync, readdirSync } from "node:fs"

const read = (path) => readFileSync(path, "utf8")
const node = read(".nvmrc").trim().split(".")[0]
const problems = []

function expect(file, found, label) {
  if (found.length === 0) problems.push(`${file}: no ${label} found, the check needs updating`)
  for (const value of found) {
    if (value !== node) problems.push(`${file}: ${label} is ${value}, .nvmrc says ${node}`)
  }
}

const all = (text, re) => [...text.matchAll(re)].map((m) => m[1])

expect("package.json", all(read("package.json"), /"node": "(\d+)\.x"/g), "engines.node")
for (const file of readdirSync(".github/workflows")) {
  const path = `.github/workflows/${file}`
  const found = all(read(path), /node-version: (\d+)/g)
  if (found.length > 0) expect(path, found, "node-version")
}
expect("Dockerfile", all(read("Dockerfile"), /ARG NODE_VERSION=(\d+)/g), "NODE_VERSION")
expect("Dockerfile.dev", all(read("Dockerfile.dev"), /FROM node:(\d+)/g), "base image")
for (const path of ["Makefile", "README.md", "scripts/doctor.sh"]) {
  expect(path, all(read(path), /Node(?:\.js)? (\d+)/g), "Node version")
}
expect("scripts/doctor.sh", all(read("scripts/doctor.sh"), /#v(\d+)\./g), "version test")

const release = read("README.md").match(/\bv\d+\.\d+\.\d+\b/)
if (release) problems.push(`README.md: mentions ${release[0]}, link the Releases page instead`)

if (problems.length > 0) {
  for (const p of problems) console.error(`[consistency] ${p}`)
  process.exit(1)
}
console.log(`[consistency] OK (Node ${node} everywhere)`)

#!/usr/bin/env node
// Block major-version bumps of frozen dependencies.
// Usage: node check-frozen-deps.mjs <old-pkg-ref> <new-pkg-ref>
// Refs are `git show` targets, e.g. "origin/main:package.json" or ":package.json".
import { execFileSync } from "node:child_process";

const FROZEN = ["next", "tailwindcss", "typescript", "eslint"];

function load(ref) {
  try {
    const raw = execFileSync("git", ["show", ref], { encoding: "utf8" });
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function major(range) {
  const m = String(range || "").match(/(\d+)/);
  return m ? m[1] : null;
}

function deps(pkg) {
  return { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
}

const [, , oldRef, newRef] = process.argv;
const oldDeps = deps(load(oldRef));
const newDeps = deps(load(newRef));

let failed = false;
for (const name of FROZEN) {
  const before = major(oldDeps[name]);
  const after = major(newDeps[name]);
  if (before && after && before !== after) {
    console.error(
      `Frozen dependency "${name}" major bump ${oldDeps[name]} -> ${newDeps[name]} is forbidden.`
    );
    failed = true;
  }
}

process.exit(failed ? 1 : 0);

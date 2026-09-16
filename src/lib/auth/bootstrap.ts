// 24 hours rather than the 72 that INVITATION_TTL_HOURS gives a colleague being
// invited: a deployment is finished in one sitting or the next morning, and an
// expired bootstrap link is reissued by restarting the container, so the shorter
// window costs the operator nothing.
export const BOOTSTRAP_INVITATION_TTL_HOURS = 24

// The token is supplied by the operator rather than generated, so the container
// never has a secret to print. This floor is what stops a caller handing in
// something guessable; `openssl rand -base64 32` clears it comfortably.
export const MIN_BOOTSTRAP_TOKEN_LENGTH = 32

export type BootstrapConfig = { email: string; token: string; domain: string }

// silent distinguishes "nobody asked for a bootstrap", the normal state of every
// running instance and every development machine, from "somebody asked and got
// it wrong", which has to be said out loud.
export type ResolveResult =
  | { ok: true; config: BootstrapConfig }
  | { ok: false; silent: boolean; reason: string }

export function resolveBootstrapConfig(env: NodeJS.ProcessEnv): ResolveResult {
  const email = (env.BOOTSTRAP_ADMIN_EMAIL ?? "").trim().toLowerCase()
  const token = (env.BOOTSTRAP_INVITE_TOKEN ?? "").trim()

  if (email === "" && token === "") {
    return { ok: false, silent: true, reason: "not configured" }
  }
  if (email === "") {
    return { ok: false, silent: false, reason: "BOOTSTRAP_ADMIN_EMAIL is not set" }
  }
  if (token === "") {
    return { ok: false, silent: false, reason: "BOOTSTRAP_INVITE_TOKEN is not set" }
  }
  if (token.length < MIN_BOOTSTRAP_TOKEN_LENGTH) {
    return {
      ok: false,
      silent: false,
      reason: `BOOTSTRAP_INVITE_TOKEN is shorter than ${MIN_BOOTSTRAP_TOKEN_LENGTH} characters`,
    }
  }

  const at = email.lastIndexOf("@")
  const domain = at === -1 ? "" : email.slice(at + 1)
  if (at < 1 || !domain.includes(".") || /\s/.test(email)) {
    return { ok: false, silent: false, reason: "BOOTSTRAP_ADMIN_EMAIL is not a usable address" }
  }

  return { ok: true, config: { email, token, domain } }
}

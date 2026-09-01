// Base URL the app is reachable at, used to build links that leave the process
// (invitation links, alert emails) and to derive the WebAuthn relying party.
//
// Two names are accepted on purpose. The Better Auth migration renamed AUTH_URL
// to BETTER_AUTH_URL in .env.example, but deployments provisioned before that
// still export the old name, and reading only one of them is how invitation
// links ended up pointing at localhost in production.
export function appBaseUrl(): string {
  const raw = process.env.AUTH_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000"
  return raw.replace(/\/+$/, "")
}

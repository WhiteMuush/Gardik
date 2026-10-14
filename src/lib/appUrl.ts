// Reads AUTH_URL and BETTER_AUTH_URL, since reading only one sent invitation links to localhost in production.
export function appBaseUrl(): string {
  const raw = process.env.AUTH_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000"
  return raw.replace(/\/+$/, "")
}

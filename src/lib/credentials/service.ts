// Non-sensitive hint shown in the UI: only the last 4 characters.
export function keyHint(key: string): string {
  return `••••${key.slice(-4)}`
}

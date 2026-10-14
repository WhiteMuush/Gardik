// A source answered without results; `status` is null for a non-HTTP failure such as an unfinished search.
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly retryAfterMs: number | null = null
  ) {
    super(message)
    this.name = "ProviderError"
  }
}

export function parseRetryAfter(value: string | null, now: number = Date.now()): number | null {
  if (!value) return null
  const seconds = Number(value)
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
  const at = Date.parse(value)
  return Number.isNaN(at) ? null : Math.max(0, at - now)
}

export function errorFromResponse(source: string, res: Response): ProviderError {
  return new ProviderError(
    `${source} error ${res.status}`,
    res.status,
    parseRetryAfter(res.headers.get("retry-after"))
  )
}

// Only a network failure (a fetch TypeError) is retried, since a bug or a malformed payload would fail again.
export function isRetryable(err: unknown): boolean {
  if (err instanceof ProviderError) {
    return err.status === null || err.status === 429 || err.status >= 500
  }
  return err instanceof TypeError
}

export function failureReason(err: unknown): string {
  if (err instanceof ProviderError) {
    if (err.status === null) return err.message
    if (err.status === 429) return "Rate limited by the source"
    if (err.status === 401 || err.status === 403) return "API key rejected"
    if (err.status >= 500) return `Source unavailable (HTTP ${err.status})`
    return `Unexpected response (HTTP ${err.status})`
  }
  return err instanceof TypeError ? "Network error" : "Unexpected error"
}

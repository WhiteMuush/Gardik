// A failed save returns null instead of throwing, so callers cannot ignore it by accident.
export async function saveRequest(url: string, method: string, body?: unknown): Promise<Response | null> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    return res.ok ? res : null
  } catch {
    return null
  }
}

/** Browser helper for our JSON routes. Returns the server's plain-language error and field errors. */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; fields: Record<string, string> };

export async function sendJson<T>(url: string, method: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, data: data as T };
    return { ok: false, error: data.error ?? "Something went wrong. Please try again.", fields: data.fields ?? {} };
  } catch {
    return { ok: false, error: "We couldn't reach Here For YOU. Check your internet connection and try again.", fields: {} };
  }
}

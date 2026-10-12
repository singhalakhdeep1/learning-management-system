'use client';

/** fetch() for the app's own API: sends JSON, and turns error responses into Errors carrying the server's message. */
export async function api<T = unknown>(url: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(url, {
    method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
    headers: options.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message = (data as { error?: string } | null)?.error ?? `Request failed (${response.status})`;
    throw new Error(message);
  }

  return data as T;
}

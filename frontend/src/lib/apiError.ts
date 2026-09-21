/**
 * Helpers for turning an unknown thrown API error into something safe to show a
 * user — the backend's own message, never a raw "Request failed with status
 * code 409" or a bare status code.
 *
 * Duck-typed against the axios error shape (err.response.{status,data}) so it
 * doesn't hard-depend on importing axios; works for any client exposing a
 * similar `response` object.
 */

interface NestErrorBody {
  statusCode?: number;
  message?: string | string[];
  error?: string;
}

function getResponse(
  err: unknown,
): { status?: number; data?: NestErrorBody } | null {
  if (err && typeof err === "object" && "response" in err) {
    const resp = (err as { response?: unknown }).response;
    if (resp && typeof resp === "object") {
      const { status, data } = resp as {
        status?: number;
        data?: NestErrorBody;
      };
      return { status, data };
    }
  }
  return null;
}

export function getApiStatus(err: unknown): number | undefined {
  return getResponse(err)?.status;
}

export function getApiErrorMessage(err: unknown): string | null {
  const data = getResponse(err)?.data;
  if (data) {
    const m = data.message;
    if (Array.isArray(m)) return m[0] ?? null;
    if (typeof m === "string" && m.trim()) return m;
    if (typeof data.error === "string" && data.error.trim()) return data.error;
    return null;
  }
  if (
    err instanceof Error &&
    err.message &&
    !/^request failed with status code/i.test(err.message)
  )
    return err.message;
  return null;
}

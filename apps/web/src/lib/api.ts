export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public field?: string) { super(message); }
}

/** Cliente del API. Mismo origen (/api), cookies HttpOnly y encabezado anti-CSRF. */
export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'reloj' },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.');
  }
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* respuesta no JSON */ }
  if (!res.ok) {
    const e = data?.error;
    throw new ApiError(res.status, e?.code ?? 'ERROR', e?.message ?? 'No pudimos completar la acción. Inténtalo nuevamente.', e?.field);
  }
  return data as T;
}

export const fetcher = <T = any>(path: string) => api<T>(path);

export function errMsg(e: unknown): string {
  return e instanceof ApiError ? e.message : 'Algo salió mal. Inténtalo nuevamente.';
}

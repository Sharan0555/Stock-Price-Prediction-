const DEFAULT_TIMEOUT_MS = 8000;

const normalizeBase = (value: string) => value.replace(/\/+$/, "");

export function getApiBaseUrl(): string {
  const envBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (envBase && envBase.trim().length > 0) {
    return normalizeBase(envBase);
  }
  return "http://localhost:8001";
}

export function getApiBaseCandidates(): string[] {
  return [getApiBaseUrl()];
}

async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  if (init?.signal) {
    return fetch(url, init);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchWithApiFallback(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const endpoint = path.startsWith("/") ? path : `/${path}`;
  let lastError: unknown = null;
  const candidates = getApiBaseCandidates();

  for (const base of candidates) {
    try {
      const res = await fetchWithTimeout(`${base}${endpoint}`, init);
      if (res.ok) {
        return res;
      }
      if (res.status === 404 || res.status === 405) {
        lastError = new Error(`Not found on ${base}`);
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error("Unable to reach backend.");
}

export async function fetchJsonWithFallback<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetchWithApiFallback(path, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

const DEFAULT_LOCAL_API = "http://127.0.0.1:8002";
const LEGACY_LOCAL_API = "http://127.0.0.1:8001";
const DEFAULT_TIMEOUT_MS = 8000;

const normalizeBase = (value: string) => value.replace(/\/+$/, "");
const getConfiguredApiBase = () =>
  process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL;

export function getApiBaseUrl(): string {
  const envBase = getConfiguredApiBase();
  if (envBase && envBase.trim().length > 0) {
    return normalizeBase(envBase);
  }

  if (typeof window === "undefined") {
    return DEFAULT_LOCAL_API;
  }

  const { protocol, hostname, port } = window.location;
  if (port === "3000" || port === "3001") {
    return `${protocol}//${hostname}:8002`;
  }

  return normalizeBase(`${protocol}//${hostname}`);
}

export function getApiBaseCandidates(): string[] {
  const candidates: string[] = [];
  const envBase = getConfiguredApiBase();
  if (envBase && envBase.trim().length > 0) {
    candidates.push(normalizeBase(envBase));
  }

  if (typeof window !== "undefined") {
    const { protocol, hostname, port, origin } = window.location;
    if (port === "3000" || port === "3001") {
      candidates.push(`${protocol}//${hostname}:8002`);
      candidates.push(`${protocol}//${hostname}:8001`);
      if (origin) candidates.push(normalizeBase(origin));
    } else {
      candidates.push(DEFAULT_LOCAL_API);
      candidates.push(LEGACY_LOCAL_API);
      if (origin) candidates.push(normalizeBase(origin));
    }
  } else {
    candidates.push(DEFAULT_LOCAL_API);
    candidates.push(LEGACY_LOCAL_API);
  }

  const deduped = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (deduped.has(candidate)) continue;
    deduped.add(candidate);
  }

  return Array.from(deduped);
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

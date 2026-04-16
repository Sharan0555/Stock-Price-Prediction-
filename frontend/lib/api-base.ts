const DEFAULT_TIMEOUT_MS = 8000;
const LOCAL_API_PORTS = ["8001", "8002"] as const;
const LOCAL_API_HOSTS = ["localhost", "127.0.0.1"] as const;

const normalizeBase = (value: string) => value.trim().replace(/\/+$/, "");

const isLocalHost = (hostname: string) =>
  LOCAL_API_HOSTS.includes(hostname as (typeof LOCAL_API_HOSTS)[number]);

function pushCandidate(candidates: string[], seen: Set<string>, value: string | null | undefined) {
  if (!value) return;
  const normalized = normalizeBase(value);
  if (!normalized || seen.has(normalized)) return;
  seen.add(normalized);
  candidates.push(normalized);
}

function addExpandedBaseCandidates(
  candidates: string[],
  seen: Set<string>,
  value: string | null | undefined,
) {
  if (!value) return;
  pushCandidate(candidates, seen, value);

  try {
    const url = new URL(value);
    if (!isLocalHost(url.hostname)) return;

    const path = url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "");
    const protocol = url.protocol || "http:";
    const ports = url.port ? [url.port] : [...LOCAL_API_PORTS];

    for (const host of LOCAL_API_HOSTS) {
      for (const port of ports) {
        pushCandidate(candidates, seen, `${protocol}//${host}:${port}${path}`);
      }
    }
  } catch {
    // Ignore invalid URL strings and keep the raw candidate.
  }
}

function getBackendUnavailableMessage(candidates: string[]): string {
  const localCandidate = candidates.find((candidate) => {
    try {
      const url = new URL(candidate);
      return isLocalHost(url.hostname);
    } catch {
      return false;
    }
  });

  if (localCandidate) {
    return `Could not reach the backend. Start the API server and try again. Expected local API at ${localCandidate}.`;
  }

  const primaryCandidate = candidates[0];
  if (primaryCandidate) {
    return `Could not reach the backend. Start the API server and try again. Expected API at ${primaryCandidate}.`;
  }

  return "Could not reach the backend. Start the API server and try again.";
}

export function getApiBaseUrl(): string {
  const envBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  const url = envBase ? normalizeBase(envBase) : "http://localhost:8001";
  console.log("[API Base URL]", url);
  return url;
}

export function getWebSocketBaseUrl(): string {
  const envWs = process.env.NEXT_PUBLIC_WS_URL?.trim();
  if (envWs) {
    return normalizeBase(envWs);
  }

  const base = getApiBaseUrl();
  if (base.startsWith("https://")) {
    return `wss://${base.slice("https://".length)}`;
  }
  if (base.startsWith("http://")) {
    return `ws://${base.slice("http://".length)}`;
  }
  if (typeof window !== "undefined") {
    return `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`;
  }
  return base;
}

export function getApiBaseCandidates(): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();
  const envBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

  // Add the configured API base URL first (skip window.location.origin as that's the frontend)
  addExpandedBaseCandidates(candidates, seen, envBase);

  if (typeof window !== "undefined" && isLocalHost(window.location.hostname)) {
    for (const host of LOCAL_API_HOSTS) {
      for (const port of LOCAL_API_PORTS) {
        pushCandidate(candidates, seen, `http://${host}:${port}`);
      }
    }
  }

  if (candidates.length === 0) {
    addExpandedBaseCandidates(candidates, seen, "http://localhost:8001");
  }

  return candidates;
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

// DEPRECATED: This function is no longer used. All API calls now use direct fetch to http://localhost:8001
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

  if (lastError instanceof DOMException && lastError.name === "AbortError") {
    throw new Error(getBackendUnavailableMessage(candidates));
  }

  if (lastError instanceof TypeError) {
    throw new Error(getBackendUnavailableMessage(candidates));
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error("Unable to reach backend.");
}

type ApiErrorPayload = {
  detail?: string;
  message?: string;
  error?: string;
};

export async function readApiErrorMessage(
  res: Response,
  fallback: string,
): Promise<string> {
  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      const data = (await res.json()) as ApiErrorPayload | string | null;
      if (typeof data === "string" && data.trim()) {
        return data.trim();
      }
      if (data && typeof data === "object") {
        const message = data.detail || data.message || data.error;
        if (typeof message === "string" && message.trim()) {
          return message.trim();
        }
      }
    } catch {
      // Fall through to plain-text handling.
    }
  }

  try {
    const text = (await res.text()).trim();
    if (text) {
      return text;
    }
  } catch {
    // Ignore body read errors and use the fallback below.
  }

  return fallback;
}

export async function fetchJsonWithFallback<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetchWithApiFallback(path, init);
  if (!res.ok) {
    throw new Error(await readApiErrorMessage(res, `Request failed (${res.status})`));
  }
  return (await res.json()) as T;
}

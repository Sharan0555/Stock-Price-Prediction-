export const AUTH_STATE_CHANGE_EVENT = "stock-price-auth-change";

const TOKEN_KEY = "token";
const USER_EMAIL_KEY = "user_email";

function getSessionValue(key: string): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(key);
}

function removeStoredAuthValue(key: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(key);
  window.localStorage.removeItem(key);
}

export function getToken(): string | null {
  return getSessionValue(TOKEN_KEY);
}

function emitAuthStateChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(AUTH_STATE_CHANGE_EVENT, {
      detail: {
        token: getToken(),
        userEmail: getUserEmail(),
      },
    }),
  );
}

export function setToken(token: string) {
  window.sessionStorage.setItem(TOKEN_KEY, token);
  window.localStorage.removeItem(TOKEN_KEY);
  emitAuthStateChange();
}

export function setUserEmail(email: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(USER_EMAIL_KEY, email);
  window.localStorage.removeItem(USER_EMAIL_KEY);
  emitAuthStateChange();
}

export function getUserEmail(): string | null {
  return getSessionValue(USER_EMAIL_KEY);
}

export function clearToken() {
  removeStoredAuthValue(TOKEN_KEY);
  removeStoredAuthValue(USER_EMAIL_KEY);
  emitAuthStateChange();
}

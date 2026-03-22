export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("token");
}

export function setToken(token: string) {
  window.localStorage.setItem("token", token);
}

export function setUserEmail(email: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("user_email", email);
}

export function getUserEmail(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("user_email");
}

export function clearToken() {
  window.localStorage.removeItem("token");
  window.localStorage.removeItem("user_email");
}

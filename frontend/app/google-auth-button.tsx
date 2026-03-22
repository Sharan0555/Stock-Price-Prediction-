"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithApiFallback } from "@/lib/api-base";
import { setToken, setUserEmail } from "@/lib/auth";

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: {
              theme?: string;
              size?: string;
              text?: string;
              shape?: string;
              logo_alignment?: string;
              width?: number;
            },
          ) => void;
          cancel: () => void;
        };
      };
    };
  }
}

const GOOGLE_SCRIPT_ID = "google-identity-script";
let googleScriptPromise: Promise<void> | null = null;

const loadGoogleScript = () => {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (window.google?.accounts?.id) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load Google Identity Services.")),
      );
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_SCRIPT_ID;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Identity Services."));
    document.head.appendChild(script);
  });

  return googleScriptPromise;
};

type GoogleAuthButtonProps = {
  onError?: (message: string | null) => void;
  mode?: "login" | "register";
};

export default function GoogleAuthButton({
  onError,
  mode = "login",
}: GoogleAuthButtonProps) {
  const router = useRouter();
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const initializedRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId || !buttonRef.current || initializedRef.current) return;
    let cancelled = false;

    loadGoogleScript()
      .then(() => {
        if (cancelled) return;
        const google = window.google?.accounts?.id;
        if (!google) {
          throw new Error("Google Identity Services not available.");
        }

        google.initialize({
          client_id: clientId,
          callback: async (response) => {
            if (!response?.credential) return;
            setLoading(true);
            setLocalError(null);
            onError?.(null);
            try {
              const res = await fetchWithApiFallback("/api/v1/auth/google", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ credential: response.credential, mode }),
              });
              if (!res.ok) {
                const text = await res.text();
                throw new Error(text || `Google login failed (${res.status})`);
              }
              const data = (await res.json()) as { access_token: string; user?: { email?: string } };
              setToken(data.access_token);
              if (data.user?.email) setUserEmail(data.user.email);
              router.replace("/");
            } catch (err) {
              const message = err instanceof Error ? err.message : "Google login failed.";
              setLocalError(message);
              onError?.(message);
            } finally {
              setLoading(false);
            }
          },
        });

        if (buttonRef.current) {
          const width = Math.min(360, buttonRef.current.clientWidth || 360);
          buttonRef.current.innerHTML = "";
          google.renderButton(buttonRef.current, {
            theme: "outline",
            size: "large",
            text: "continue_with",
            shape: "rectangular",
            logo_alignment: "left",
            width,
          });
          initializedRef.current = true;
        }
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Google sign-in is unavailable.";
        setLocalError(message);
        onError?.(message);
      });

    return () => {
      cancelled = true;
      window.google?.accounts?.id?.cancel();
    };
  }, [clientId, mode, onError, router]);

  if (!clientId) {
    return (
      <div className="google-auth__notice">
        Google sign-in is not configured. Set `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.
      </div>
    );
  }

  return (
    <div className="google-auth google-auth--groww">
      <div className={`google-auth__button ${loading ? "is-loading" : ""}`}>
        <div ref={buttonRef} />
      </div>
      {localError && <div className="google-auth__error">{localError}</div>}
    </div>
  );
}

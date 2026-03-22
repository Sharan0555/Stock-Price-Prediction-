"use client";

import { ReactNode, useEffect, useMemo, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";

const PUBLIC_ROUTES = ["/auth/login", "/auth/register"];

type AuthGateProps = {
  children: ReactNode;
};

const useHydrated = () =>
  useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

export default function AuthGate({ children }: AuthGateProps) {
  const pathname = usePathname();
  const router = useRouter();
  const hydrated = useHydrated();

  const isPublic = useMemo(() => {
    if (!hydrated || !pathname) return false;
    return PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
  }, [hydrated, pathname]);

  const token = useMemo(() => {
    if (!hydrated || !pathname) return null;
    return getToken();
  }, [hydrated, pathname]);
  const shouldBlock = hydrated && Boolean(pathname) && !isPublic && !token;

  useEffect(() => {
    if (shouldBlock) {
      router.replace("/auth/login");
    }
  }, [router, shouldBlock]);

  if (!hydrated || !pathname || shouldBlock) {
    return <div className="min-h-screen" />;
  }

  return <>{children}</>;
}

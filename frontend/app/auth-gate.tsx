"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";

type AuthGateProps = {
  children: ReactNode;
};

const PUBLIC_AUTH_ROUTES = ["/auth/login", "/auth/register"];

export default function AuthGate({ children }: AuthGateProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    if (!pathname) return;

    const isPublicAuthRoute = PUBLIC_AUTH_ROUTES.some((route) =>
      pathname.startsWith(route),
    );
    const hasToken = Boolean(getToken());

    if (!hasToken && !isPublicAuthRoute) {
      router.replace("/auth/login");
      return;
    }

    if (hasToken && isPublicAuthRoute) {
      router.replace("/");
      return;
    }

    setIsCheckingAuth(false);
  }, [pathname, router]);

  if (isCheckingAuth) {
    return null;
  }

  return <>{children}</>;
}

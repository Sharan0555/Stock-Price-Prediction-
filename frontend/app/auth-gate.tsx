"use client";

import { ReactNode } from "react";

type AuthGateProps = {
  children: ReactNode;
};

export default function AuthGate({ children }: AuthGateProps) {
  // Authentication disabled - allow all access
  return <>{children}</>;
}

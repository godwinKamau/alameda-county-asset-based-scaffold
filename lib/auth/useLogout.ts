"use client";

import { useClerk } from "@clerk/nextjs";
import { useCallback } from "react";
import { LOGOUT_REDIRECT_URL } from "@/lib/auth/constants";

export { LOGOUT_REDIRECT_URL };

export function useLogout() {
  const { signOut } = useClerk();

  return useCallback(async () => {
    await signOut({ redirectUrl: LOGOUT_REDIRECT_URL });
  }, [signOut]);
}

"use client";

import { useLogout } from "@/lib/auth/useLogout";

function LogOutIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5"
      stroke="currentColor"
      strokeWidth={1.75}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
      />
    </svg>
  );
}

export function LogoutButton() {
  const logout = useLogout();

  return (
    <button
      type="button"
      onClick={() => void logout()}
      className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-brand-dark transition-colors hover:bg-brand-soft/80"
    >
      <LogOutIcon />
      Log out
    </button>
  );
}

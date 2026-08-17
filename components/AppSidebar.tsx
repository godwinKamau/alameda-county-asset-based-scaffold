"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import { LogoutButton } from "@/components/LogoutButton";
import { apiFetch } from "@/lib/ui/api-fetch";
import type { TeacherRole } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  match?: (pathname: string) => boolean;
}

function NavIconDashboard() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}

function NavIconStudents() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
    </svg>
  );
}

function NavIconProgress() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function NavIconSaved() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  );
}

function NavIconAdmin() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: <NavIconDashboard />,
    match: (p) => p === "/dashboard",
  },
  {
    href: "/students",
    label: "Students",
    icon: <NavIconStudents />,
    match: (p) => p.startsWith("/students") || p.startsWith("/student/"),
  },
  {
    href: "/progress",
    label: "Progress",
    icon: <NavIconProgress />,
    match: (p) => p.startsWith("/progress"),
  },
  {
    href: "/saved",
    label: "Saved Insights",
    icon: <NavIconSaved />,
    match: (p) => p.startsWith("/saved"),
  },
];

const adminNavItem: NavItem = {
  href: "/admin",
  label: "Admin",
  icon: <NavIconAdmin />,
  match: (p) => p.startsWith("/admin"),
};

interface AppSidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

function roleLabel(role: TeacherRole | null): string {
  if (role === "admin" || role === "eld_coordinator") {
    return "Administrator";
  }
  return "Teacher";
}

export function AppSidebar({ mobileOpen = false, onClose }: AppSidebarProps) {
  const pathname = usePathname();
  const { user, isLoaded } = useUser();
  const [role, setRole] = useState<TeacherRole | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRole() {
      try {
        const response = await apiFetch("/api/me");
        if (!response.ok) return;
        const data = (await response.json()) as { role?: TeacherRole };
        if (!cancelled && data.role) {
          setRole(data.role);
        }
      } catch {
        // Keep the default Teacher label if the role cannot be loaded.
      }
    }

    void loadRole();
    return () => {
      cancelled = true;
    };
  }, []);

  const displayName =
    user?.fullName?.trim() ||
    user?.firstName?.trim() ||
    user?.primaryEmailAddress?.emailAddress?.split("@")[0] ||
    "Teacher";

  const sidebarContent = (
    <>
      <div className="border-b border-white/10 px-5 py-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-soft/70">
          ELPAC Writing Analysis
        </p>
        <div className="mt-4 flex items-center gap-3">
          {isLoaded && user ? (
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "h-12 w-12 rounded-full ring-2 ring-white/20",
                },
              }}
            />
          ) : (
            <div className="h-12 w-12 animate-pulse rounded-full bg-white/10" />
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold text-white">{displayName}</p>
            <p className="text-sm text-brand-soft/80">{roleLabel(role)}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Main">
        {[...navItems, ...(role === "admin" || role === "eld_coordinator"
          ? [adminNavItem]
          : [])].map((item) => {
          const isActive = item.match
            ? item.match(pathname)
            : pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-brand text-white shadow-sm"
                  : "text-brand-soft hover:bg-white/10 hover:text-white"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-3 py-4">
        <LogoutButton />
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[280px] flex-col border-r border-white/10 bg-brand-dark lg:flex">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-brand-dark/40 lg:hidden"
          aria-label="Close menu"
          onClick={onClose}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-white/10 bg-brand-dark transition-transform duration-200 lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!mobileOpen}
      >
        {sidebarContent}
      </aside>
    </>
  );
}

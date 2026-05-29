"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import { LogoutButton } from "@/components/LogoutButton";

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

function NavIconAnalyze() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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
    href: "/analyze",
    label: "Analyze",
    icon: <NavIconAnalyze />,
    match: (p) => p.startsWith("/analyze"),
  },
  {
    href: "/admin",
    label: "Admin",
    icon: <NavIconAdmin />,
    match: (p) => p.startsWith("/admin"),
  },
];

interface AppSidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export function AppSidebar({ mobileOpen = false, onClose }: AppSidebarProps) {
  const pathname = usePathname();
  const { user, isLoaded } = useUser();

  const displayName =
    user?.fullName?.trim() ||
    user?.firstName?.trim() ||
    user?.primaryEmailAddress?.emailAddress?.split("@")[0] ||
    "Teacher";

  const sidebarContent = (
    <>
      <div className="border-b border-brand-soft/60 px-5 py-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          ELPAC Writing Analysis
        </p>
        <div className="mt-4 flex items-center gap-3">
          {isLoaded && user ? (
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "h-12 w-12 rounded-full ring-2 ring-brand-soft",
                },
              }}
            />
          ) : (
            <div className="h-12 w-12 animate-pulse rounded-full bg-brand-soft" />
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold text-brand-dark">{displayName}</p>
            <p className="text-sm text-muted">Teacher</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Main">
        {navItems.map((item) => {
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
                  : "text-brand-dark hover:bg-brand-soft/80"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-brand-soft/60 px-3 py-4">
        <LogoutButton />
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[280px] flex-col border-r border-brand-soft/80 bg-white lg:flex">
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
        className={`fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-brand-soft/80 bg-white transition-transform duration-200 lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!mobileOpen}
      >
        {sidebarContent}
      </aside>
    </>
  );
}

"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

interface AppHeaderProps {
  title: string;
}

export function AppHeader({ title }: AppHeaderProps) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            ELPAC Writing Analysis
          </p>
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/dashboard" className="text-slate-600 hover:text-slate-900">
            Dashboard
          </Link>
          <Link href="/analyze" className="text-slate-600 hover:text-slate-900">
            Analyze
          </Link>
          <Link href="/admin" className="text-slate-600 hover:text-slate-900">
            Admin
          </Link>
          <UserButton afterSignOutUrl="/login" />
        </nav>
      </div>
    </header>
  );
}

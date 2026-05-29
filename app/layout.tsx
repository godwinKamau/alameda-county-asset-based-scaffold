import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { LOGOUT_REDIRECT_URL } from "@/lib/auth/constants";
import "./globals.css";

export const metadata: Metadata = {
  title: "ELPAC Writing Analysis",
  description:
    "Teacher-facing English Learner proficiency analysis tool grounded in ELPAC PLDs",
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider afterSignOutUrl={LOGOUT_REDIRECT_URL}>
      <html lang="en">
        <body className="min-h-screen antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}

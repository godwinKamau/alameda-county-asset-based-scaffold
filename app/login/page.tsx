import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            ELPAC Writing Analysis
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-brand-dark">
            Teacher sign in
          </h1>
          <p className="mt-2 text-sm text-muted">
            Sign in to analyze student writing artifacts
          </p>
        </div>
        <div className="ui-card p-6">
          <SignIn routing="hash" />
        </div>
      </div>
    </main>
  );
}

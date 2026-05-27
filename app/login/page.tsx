import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">
            ELPAC Writing Analysis
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Sign in to analyze student writing artifacts
          </p>
        </div>
        <SignIn routing="hash" />
      </div>
    </main>
  );
}

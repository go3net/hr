import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Form panel */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[380px]">
          <div className="mb-8 flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-[15px] font-bold text-white">
              G
            </span>
            <span className="text-lg font-semibold tracking-[-0.01em]">Go3net Office</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-[-0.02em]">Welcome back</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Sign in to your workspace to continue.
          </p>

          <Suspense>
            <LoginForm />
          </Suspense>

          <div className="my-6 flex items-center gap-3 text-[12px] text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or continue with
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            {["Google", "Microsoft", "GitHub"].map((provider) => (
              <Button key={provider} asChild variant="outline" className="text-[13px]">
                <a href={`/api/auth/oauth/${provider.toLowerCase()}`}>{provider}</a>
              </Button>
            ))}
          </div>

          <p className="mt-8 text-center text-[13px] text-muted-foreground">
            New to Go3net Office?{" "}
            <Link href="/register" className="font-medium text-primary hover:underline">
              Create a workspace
            </Link>
          </p>
        </div>
      </div>

      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#1E293B] via-[#134e6f] to-[#2DA9DD] lg:block">
        <div className="absolute inset-0 opacity-30 [background:radial-gradient(circle_at_70%_20%,#00C2FF55,transparent_60%)]" />
        <div className="relative flex h-full flex-col justify-end p-12 text-white">
          <blockquote className="max-w-md">
            <p className="text-[22px] font-medium leading-snug tracking-[-0.01em]">
              &ldquo;One workspace for our people, projects, and payroll. Go3net Office replaced
              five tools on day one.&rdquo;
            </p>
            <footer className="mt-4 text-sm text-white/70">
              Operations Director · Lagos MetroWorks
            </footer>
          </blockquote>
          <div className="mt-10 flex gap-8 text-sm text-white/60">
            <span>99.9% uptime</span>
            <span>Enterprise security</span>
            <span>AI-powered</span>
          </div>
        </div>
      </div>
    </div>
  );
}

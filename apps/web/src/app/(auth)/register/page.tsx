import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create your workspace" };

const highlights = [
  "HR, payroll, projects, CRM and finance in one place",
  "Nigerian PAYE and pension handled for you",
  "Invite your team and set who sees what",
];

export default function RegisterPage() {
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

          <h1 className="text-2xl font-semibold tracking-[-0.02em]">Create your workspace</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Set up your company in a minute — you&apos;ll be the workspace admin.
          </p>

          <RegisterForm />

          <p className="mt-8 text-center text-[13px] text-muted-foreground">
            Already have a workspace?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#1E293B] via-[#134e6f] to-[#2DA9DD] lg:block">
        <div className="absolute inset-0 opacity-30 [background:radial-gradient(circle_at_70%_20%,#00C2FF55,transparent_60%)]" />
        <div className="relative flex h-full flex-col justify-end p-12 text-white">
          <h2 className="max-w-md text-[26px] font-semibold leading-snug tracking-[-0.01em]">
            Everything your company runs on, in one workspace.
          </h2>
          <ul className="mt-6 space-y-3">
            {highlights.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-[15px] text-white/85">
                <Check className="mt-0.5 size-4 shrink-0 text-[#00C2FF]" />
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-10 flex gap-8 text-sm text-white/60">
            <span>14-day free trial</span>
            <span>No card required</span>
            <span>Cancel anytime</span>
          </div>
        </div>
      </div>
    </div>
  );
}

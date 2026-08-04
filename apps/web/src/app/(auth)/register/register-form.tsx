"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";

const schema = z.object({
  company: z.string().min(2, "Enter your company name"),
  subdomain: z
    .string()
    .min(2, "At least 2 characters")
    .max(40, "Too long")
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and dashes only"),
  name: z.string().min(2, "Enter your full name"),
  email: z.string().email("Enter a valid work email"),
  password: z
    .string()
    .min(10, "At least 10 characters")
    .regex(/[a-zA-Z]/, "Include at least one letter")
    .regex(/[0-9]/, "Include at least one number"),
});

type FormValues = z.infer<typeof schema>;

/**
 * "Go3net Technologies" → "go3net-technologies".
 * While typing we keep a trailing dash — stripping it would swallow the
 * space the moment it's pressed and make the key feel broken.
 */
function slugify(value: string, { final = false } = {}): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, 40);

  return final ? slug.replace(/-+$/, "") : slug;
}

export function RegisterForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [subdomainTouched, setSubdomainTouched] = useState(false);
  // Mirrored locally so the address preview stays reactive without watch().
  const [subdomain, setSubdomain] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { company: "", subdomain: "", name: "", email: "", password: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    // Tidy any trailing dash left over from typing before sending.
    const payload = { ...values, subdomain: slugify(values.subdomain, { final: true }) };
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        // Surface field-level validation from the API where we can.
        const fields = (json?.errors ?? json?.error?.fields) as Record<string, string[]> | undefined;
        if (fields) {
          for (const [field, messages] of Object.entries(fields)) {
            if (field in values) {
              setError(field as keyof FormValues, { message: messages[0] });
            }
          }
        }
        setServerError(
          json?.error?.message ?? json?.message ?? "Could not create the workspace. Check the form and try again.",
        );
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setServerError("Something went wrong — please try again.");
    }
  };

  return (
    <form className="mt-8 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      {serverError && (
        <div className="rounded-[10px] border border-danger/30 bg-[var(--danger-soft)] px-3 py-2.5 text-[13px] text-danger">
          {serverError}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="company">Company name</Label>
        <Input
          id="company"
          placeholder="Go3net Technologies"
          autoComplete="organization"
          {...register("company", {
            onChange: (e) => {
              if (subdomainTouched) return;
              const slug = slugify(e.target.value);
              setValue("subdomain", slug);
              setSubdomain(slug);
            },
          })}
        />
        <FieldError message={errors.company?.message} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="subdomain">Workspace link</Label>
        <div className="flex h-9 items-center rounded-[10px] border border-border bg-surface shadow-card focus-within:border-primary focus-within:ring-2 focus-within:ring-ring">
          <input
            id="subdomain"
            placeholder="go3net"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="h-full min-w-0 flex-1 rounded-l-[10px] bg-transparent px-3 text-base sm:text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
            {...register("subdomain", {
              onChange: (e) => {
                setSubdomainTouched(true);
                const slug = slugify(e.target.value);
                setValue("subdomain", slug);
                setSubdomain(slug);
              },
            })}
          />
          <span className="shrink-0 border-l border-border px-3 text-[13px] text-muted-foreground">
            .go3net.app
          </span>
        </div>
        <p className="text-[12px] text-muted-foreground">
          Your team will sign in at{" "}
          <span className="font-medium text-foreground">
            {subdomain || "yourcompany"}.go3net.app
          </span>{" "}
          — letters, numbers and dashes only (spaces become dashes). This isn&apos;t your office
          address; you can add that later in Settings.
        </p>
        <FieldError message={errors.subdomain?.message} />
      </div>

      <div className="h-px bg-border" />

      <div className="space-y-1.5">
        <Label htmlFor="name">Your full name</Label>
        <Input id="name" placeholder="Adaeze Okafor" autoComplete="name" {...register("name")} />
        <FieldError message={errors.name?.message} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Work email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@company.com"
          autoComplete="email"
          {...register("email")}
        />
        <FieldError message={errors.email?.message} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="At least 10 characters"
          autoComplete="new-password"
          {...register("password")}
        />
        <FieldError message={errors.password?.message} />
      </div>

      <Button className="w-full" type="submit" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="animate-spin" /> : <Sparkles className="size-4" />}
        Create workspace
      </Button>

      <p className="text-center text-[12px] text-muted-foreground">
        Free for 14 days · No card required
      </p>
    </form>
  );
}

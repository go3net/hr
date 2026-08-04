"use client";

import { useState } from "react";
import {
  BadgeCheck,
  Check,
  Loader2,
  Landmark,
  Plus,
  ShieldQuestion,
  Trash2,
  UserRound,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input, Label } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger, Select } from "@/components/ui/dialog";
import {
  type MyProfile,
  useAddNextOfKin,
  useMyProfile,
  useRemoveNextOfKin,
  useUpdateMyProfile,
} from "@/hooks/use-api";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

function Meter({ percent }: { percent: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn(
          "h-full rounded-full transition-all",
          percent === 100
            ? "bg-[var(--success,#22C55E)]"
            : percent >= 50
              ? "bg-[var(--primary,#2DA9DD)]"
              : "bg-[var(--warning,#F59E0B)]",
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function PersonalSection({ profile }: { profile: MyProfile }) {
  const update = useUpdateMyProfile();
  const [form, setForm] = useState({
    phone: profile.phone ?? "",
    date_of_birth: profile.date_of_birth ?? "",
    gender: profile.gender ?? "",
    marital_status: profile.marital_status ?? "",
    address: profile.address ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const save = () => {
    setError(null);
    setSaved(false);
    update.mutate(
      {
        phone: form.phone || null,
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
        marital_status: form.marital_status || null,
        address: form.address || null,
      },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        },
        onError: (err) => setError(err instanceof ApiError ? err.message : "Could not save."),
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserRound className="size-4 text-primary" />
          Personal details
        </CardTitle>
        <CardDescription>How we reach you, and who you are on paper.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="p-phone">Phone number</Label>
            <Input id="p-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="080…" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="p-dob">Date of birth</Label>
            <Input id="p-dob" type="date" value={form.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="p-gender">Gender</Label>
            <Select id="p-gender" value={form.gender} onChange={(e) => set("gender", e.target.value)}>
              <option value="">Select…</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="p-marital">Marital status</Label>
            <Select id="p-marital" value={form.marital_status} onChange={(e) => set("marital_status", e.target.value)}>
              <option value="">Select…</option>
              <option value="single">Single</option>
              <option value="married">Married</option>
              <option value="divorced">Divorced</option>
              <option value="widowed">Widowed</option>
            </Select>
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="p-address">Home address</Label>
          <Input id="p-address" value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Street, area, city" />
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <div className="flex justify-end">
          <Button onClick={save} disabled={update.isPending}>
            {update.isPending ? <Loader2 className="size-4 animate-spin" /> : saved ? <Check className="size-4" /> : null}
            {saved ? "Saved" : "Save details"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StatutorySection({ profile }: { profile: MyProfile }) {
  const update = useUpdateMyProfile();
  const [form, setForm] = useState({
    nin: profile.nin ?? "",
    bvn: profile.bvn ?? "",
    bank_name: profile.bank_name ?? "",
    bank_account_number: profile.bank_account_number ?? "",
    pension_pin: profile.pension_pin ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const save = () => {
    setError(null);
    setSaved(false);
    update.mutate(
      {
        nin: form.nin || null,
        bvn: form.bvn || null,
        bank_name: form.bank_name || null,
        bank_account_number: form.bank_account_number || null,
        pension_pin: form.pension_pin || null,
      },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        },
        onError: (err) => setError(err instanceof ApiError ? err.message : "Could not save."),
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Landmark className="size-4 text-primary" />
          Statutory & payment
        </CardTitle>
        <CardDescription>
          Needed for payroll, tax and pension. Stored encrypted and visible only to you and HR.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="p-nin">NIN</Label>
            <Input id="p-nin" inputMode="numeric" maxLength={11} value={form.nin} onChange={(e) => set("nin", e.target.value)} placeholder="11 digits" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="p-bvn">BVN</Label>
            <Input id="p-bvn" inputMode="numeric" maxLength={11} value={form.bvn} onChange={(e) => set("bvn", e.target.value)} placeholder="11 digits" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="p-bank">Bank name</Label>
            <Input id="p-bank" value={form.bank_name} onChange={(e) => set("bank_name", e.target.value)} placeholder="e.g. GTBank" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="p-account">Account number</Label>
            <Input id="p-account" inputMode="numeric" maxLength={10} value={form.bank_account_number} onChange={(e) => set("bank_account_number", e.target.value)} placeholder="10 digits" />
          </div>
        </div>
        <div className="grid gap-2 sm:max-w-[50%]">
          <Label htmlFor="p-pension">Pension PIN (optional)</Label>
          <Input id="p-pension" value={form.pension_pin} onChange={(e) => set("pension_pin", e.target.value)} />
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <div className="flex justify-end">
          <Button onClick={save} disabled={update.isPending}>
            {update.isPending ? <Loader2 className="size-4 animate-spin" /> : saved ? <Check className="size-4" /> : null}
            {saved ? "Saved" : "Save details"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function KinDialog({ kind }: { kind: "emergency-contacts" | "guarantors" }) {
  const [open, setOpen] = useState(false);
  const add = useAddNextOfKin(kind);
  const isContact = kind === "emergency-contacts";
  const [form, setForm] = useState({ name: "", relationship: "", occupation: "", phone: "", address: "" });
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = () => {
    setError(null);
    add.mutate(
      isContact
        ? { name: form.name, relationship: form.relationship, phone: form.phone, address: form.address || undefined }
        : { name: form.name, occupation: form.occupation, phone: form.phone, address: form.address || undefined },
      {
        onSuccess: () => {
          setOpen(false);
          setForm({ name: "", relationship: "", occupation: "", phone: "", address: "" });
        },
        onError: (err) => setError(err instanceof ApiError ? err.message : "Could not save."),
      },
    );
  };

  const secondField = isContact ? form.relationship : form.occupation;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="size-4" />
          Add
        </Button>
      </DialogTrigger>
      <DialogContent title={isContact ? "Add emergency contact" : "Add guarantor"}>
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="k-name">Full name</Label>
            <Input id="k-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="k-second">{isContact ? "Relationship" : "Occupation"}</Label>
              <Input
                id="k-second"
                value={secondField}
                onChange={(e) => set(isContact ? "relationship" : "occupation", e.target.value)}
                placeholder={isContact ? "e.g. Sister" : "e.g. Banker"}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="k-phone">Phone</Label>
              <Input id="k-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="k-address">Address (optional)</Label>
            <Input id="k-address" value={form.address} onChange={(e) => set("address", e.target.value)} />
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="flex justify-end">
            <Button onClick={submit} disabled={add.isPending || !form.name.trim() || !form.phone.trim() || !secondField.trim()}>
              {add.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function KinSection({
  title,
  description,
  kind,
  people,
}: {
  title: string;
  description: string;
  kind: "emergency-contacts" | "guarantors";
  people: MyProfile["emergency_contacts"];
}) {
  const remove = useRemoveNextOfKin(kind);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ShieldQuestion className="size-4 text-primary" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <KinDialog kind={kind} />
      </CardHeader>
      <CardContent>
        {people.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">None added yet.</p>
        ) : (
          <div className="space-y-2">
            {people.map((person) => (
              <div key={person.id} className="flex items-center justify-between rounded-[10px] border border-border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{person.name}</p>
                  <p className="truncate text-[12px] text-muted-foreground">
                    {person.relationship ?? person.occupation} · {person.phone}
                    {person.address ? ` · ${person.address}` : ""}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${person.name}`}
                  className="text-danger"
                  onClick={() => remove.mutate(person.id)}
                  disabled={remove.isPending}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ProfileClient() {
  const { data: profile, isPending, isError } = useMyProfile();

  if (isPending) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <Card className="mx-auto max-w-2xl p-10 text-center">
        <p className="text-sm font-medium text-foreground">No employee record yet</p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Your account isn&apos;t linked to an employee profile. Ask HR to add you to the staff
          list, then refresh this page.
        </p>
      </Card>
    );
  }

  const { completeness } = profile;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">My profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Keep your details current — HR uses them for payroll, benefits and emergencies.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {completeness.percent === 100 ? (
                <BadgeCheck className="size-5 text-success" />
              ) : null}
              <p className="text-sm font-medium text-foreground">
                {completeness.percent === 100 ? "Your profile is complete" : "Profile completion"}
              </p>
            </div>
            <span className="text-sm font-semibold text-foreground">{completeness.percent}%</span>
          </div>
          <Meter percent={completeness.percent} />
          {completeness.missing.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {completeness.missing.map((item) => (
                <Badge key={item.key} variant="warning">{item.label}</Badge>
              ))}
            </div>
          ) : null}
          <div className="grid gap-1 pt-2 text-[13px] text-muted-foreground sm:grid-cols-2">
            <p>Employee code: <span className="text-foreground">{profile.employee_code}</span></p>
            <p>Department: <span className="text-foreground">{profile.department ?? "—"}</span></p>
            <p>Position: <span className="text-foreground">{profile.position ?? "—"}</span></p>
            <p>Reports to: <span className="text-foreground">{profile.manager ?? "—"}</span></p>
          </div>
        </CardContent>
      </Card>

      <PersonalSection profile={profile} />
      <StatutorySection profile={profile} />
      <KinSection
        title="Emergency contact"
        description="Who we call if something happens at work."
        kind="emergency-contacts"
        people={profile.emergency_contacts}
      />
      <KinSection
        title="Guarantor"
        description="Required by HR as part of your employment file."
        kind="guarantors"
        people={profile.guarantors}
      />
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormMessage, friendlyAuthError, MIN_PASSWORD_LENGTH } from "@/components/auth/auth-card";
import { useFinance } from "@/components/providers/finance-provider";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export default function AccountPage() {
  const { user, accountsEnabled, signOut } = useFinance();
  const router = useRouter();

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-3xl font-semibold text-ink">Account</h1>
        <Card>
          <p className="text-sm text-ink">
            {accountsEnabled ? "You're using SemesterFi as a guest. Your plan is saved only in this browser." : "Accounts aren't set up on this server yet."}
          </p>
          {accountsEnabled ? (
            <div className="mt-4 flex gap-3">
              <Link href="/signup">
                <Button>Create an account</Button>
              </Link>
              <Link href="/login">
                <Button variant="secondary">Log in</Button>
              </Link>
            </div>
          ) : null}
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">Account</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">{user.email}</h1>
      </header>

      <ChangePasswordCard />

      <Card>
        <CardHeader title="Log out" eyebrow="This device" />
        <p className="text-sm text-muted">Your plan stays saved in your account.</p>
        <Button
          className="mt-4"
          variant="secondary"
          onClick={async () => {
            await signOut();
            router.push("/");
          }}
        >
          Log out
        </Button>
      </Card>

      <DeleteAccountCard />
    </div>
  );
}

function ChangePasswordCard() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) return setMessage({ tone: "error", text: `Use at least ${MIN_PASSWORD_LENGTH} characters.` });
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    setPassword("");
    setMessage(error ? { tone: "error", text: friendlyAuthError(error.message) } : { tone: "info", text: "Password updated." });
  }

  return (
    <Card>
      <CardHeader title="Change password" eyebrow="Security" />
      <form className="flex flex-wrap items-end gap-3" onSubmit={submit}>
        <div className="min-w-[220px] flex-1">
          <Label htmlFor="new-password">New password</Label>
          <Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </div>
        <Button type="submit" disabled={busy || !password}>
          {busy ? "Saving..." : "Update password"}
        </Button>
      </form>
      {message ? (
        <div className="mt-3">
          <FormMessage tone={message.tone}>{message.text}</FormMessage>
        </div>
      ) : null}
    </Card>
  );
}

function DeleteAccountCard() {
  const router = useRouter();
  const { signOut } = useFinance();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function deleteAccount() {
    if (!window.confirm("Delete your account and your saved plan? This can't be undone.")) return;
    setBusy(true);
    setError(null);
    const response = await fetch("/api/account/delete", { method: "POST" });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!response.ok) return setError(result.error ?? "Couldn't delete your account.");
    await signOut();
    router.push("/");
  }

  return (
    <Card className="border-coral/40">
      <CardHeader title="Delete account" eyebrow="Permanent" />
      <p className="text-sm text-muted">Deletes your login and your saved plan for good.</p>
      {error ? (
        <div className="mt-3">
          <FormMessage tone="error">{error}</FormMessage>
        </div>
      ) : null}
      <Button className="mt-4" variant="danger" onClick={deleteAccount} disabled={busy}>
        {busy ? "Deleting..." : "Delete my account"}
      </Button>
    </Card>
  );
}

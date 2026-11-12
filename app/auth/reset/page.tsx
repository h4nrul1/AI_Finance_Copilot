"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthCard, FormMessage, friendlyAuthError, MIN_PASSWORD_LENGTH } from "@/components/auth/auth-card";
import { useFinance } from "@/components/providers/finance-provider";
import { Button } from "@/components/ui/button";
import { Input, Label, PasswordInput } from "@/components/ui/input";
import { getBrowserSupabase } from "@/lib/supabase/browser";

/** Reached from the password-reset email; the link has already signed the student in. */
export default function ResetPasswordPage() {
  const router = useRouter();
  const { user, status } = useFinance();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) return setError(`Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`);
    if (password !== confirm) return setError("The two passwords don't match.");
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) return setError(friendlyAuthError(updateError.message));
    router.push("/");
  }

  return (
    <AuthCard title="Choose a new password">
      {status !== "loading" && !user ? (
        <FormMessage tone="error">This reset link has expired or was already used. Request a new one from the log-in page.</FormMessage>
      ) : (
        <form className="space-y-4" onSubmit={submit}>
          <div>
            <Label htmlFor="reset-password">New password</Label>
            <PasswordInput id="reset-password" autoComplete="new-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
            <p className="mt-1 text-xs text-muted">At least {MIN_PASSWORD_LENGTH} characters.</p>
          </div>
          <div>
            <Label htmlFor="reset-confirm">Confirm new password</Label>
            <PasswordInput id="reset-confirm" autoComplete="new-password" required value={confirm} onChange={(event) => setConfirm(event.target.value)} />
          </div>
          {error ? <FormMessage tone="error">{error}</FormMessage> : null}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Saving..." : "Save new password"}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}

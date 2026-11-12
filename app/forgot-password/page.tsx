"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthCard, FormMessage, friendlyAuthError } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset`
    });
    setBusy(false);
    if (resetError) return setError(friendlyAuthError(resetError.message));
    setSent(true);
  }

  return (
    <AuthCard
      title="Reset your password"
      subtitle="We'll email you a link to choose a new one."
      footer={
        <Link href="/login" className="underline">
          Back to log in
        </Link>
      }
    >
      {sent ? (
        // Same message whether or not the email has an account, so the form can't be used to look up accounts.
        <FormMessage tone="info">If an account exists for {email.trim()}, a reset link is on its way. Check your inbox and spam folder.</FormMessage>
      ) : (
        <form className="space-y-4" onSubmit={submit}>
          <div>
            <Label htmlFor="forgot-email">Email</Label>
            <Input id="forgot-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          {error ? <FormMessage tone="error">{error}</FormMessage> : null}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Sending..." : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}

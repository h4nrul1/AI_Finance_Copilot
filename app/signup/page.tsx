"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthCard, FormMessage, friendlyAuthError, MIN_PASSWORD_LENGTH } from "@/components/auth/auth-card";
import { useFinance } from "@/components/providers/finance-provider";
import { Button } from "@/components/ui/button";
import { Input, Label, PasswordInput } from "@/components/ui/input";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export default function SignupPage() {
  const router = useRouter();
  const { state, status } = useFinance();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const [busy, setBusy] = useState(false);
  const bringsGuestPlan = status === "ready" && state.mode === "personal";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) return setError(`Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`);
    if (password !== confirm) return setError("The two passwords don't match.");
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/` }
    });
    setBusy(false);
    if (signUpError) return setError(friendlyAuthError(signUpError.message));
    // With email confirmation on, there's no session until the student clicks the link in their inbox.
    if (data.session) router.push("/");
    else setCheckEmail(true);
  }

  if (checkEmail) {
    return (
      <AuthCard title="Check your email" subtitle={`We sent a confirmation link to ${email.trim()}.`}>
        <p className="text-sm leading-6 text-ink">
          Click the link to finish creating your account. {bringsGuestPlan ? "Your current plan will be saved to it when you log in." : ""}
        </p>
        <p className="mt-3 text-sm text-muted">Didn&apos;t get it? Check your spam folder, or try signing up again in a few minutes.</p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle={bringsGuestPlan ? "Your current plan will be saved to your account." : "Save your plan and use it on any device."}
      footer={
        <>
          Already have an account? <Link href="/login" className="font-semibold text-moss underline">Log in</Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={submit}>
        <div>
          <Label htmlFor="signup-email">Email</Label>
          <Input id="signup-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div>
          <Label htmlFor="signup-password">Password</Label>
          <PasswordInput
            id="signup-password"
           
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <p className="mt-1 text-xs text-muted">At least {MIN_PASSWORD_LENGTH} characters.</p>
        </div>
        <div>
          <Label htmlFor="signup-confirm">Confirm password</Label>
          <PasswordInput id="signup-confirm" autoComplete="new-password" required value={confirm} onChange={(event) => setConfirm(event.target.value)} />
        </div>
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Creating account..." : "Create account"}
        </Button>
      </form>
    </AuthCard>
  );
}

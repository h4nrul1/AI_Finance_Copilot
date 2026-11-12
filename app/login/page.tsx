"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCard, ContinueAsGuest, FormMessage, friendlyAuthError } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input, Label, PasswordInput } from "@/components/ui/input";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const linkExpired = useSearchParams().get("link") === "expired";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (signInError) {
      setError(friendlyAuthError(signInError.message));
      return;
    }
    router.push("/");
  }

  return (
    <AuthCard
      title="Log in"
      subtitle="Pick up your semester plan on any device."
      footer={
        <>
          New here? <Link href="/signup" className="font-semibold text-moss underline">Create an account</Link> or{" "}
          <ContinueAsGuest />.
        </>
      }
    >
      <form className="space-y-4" onSubmit={submit}>
        <div>
          <Label htmlFor="login-email">Email</Label>
          <Input id="login-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password">Password</Label>
            <Link href="/forgot-password" className="text-xs text-muted underline hover:text-ink">
              Forgot password?
            </Link>
          </div>
          <PasswordInput id="login-password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
        </div>
        {linkExpired && !error ? (
          <FormMessage tone="info">That email link has expired or was already used. Log in, or request a new reset link.</FormMessage>
        ) : null}
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Logging in..." : "Log in"}
        </Button>
      </form>
    </AuthCard>
  );
}

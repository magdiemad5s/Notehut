"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Mail,
  MailCheck,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { PasswordField } from "@/components/auth/password-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

type ResendStatus = {
  kind: "success" | "error";
  message: string;
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered") === "true";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [resendStatus, setResendStatus] = useState<ResendStatus | null>(null);
  const errorId = error ? "login-error" : undefined;

  function clearFeedback() {
    setError(null);
    setNeedsConfirmation(false);
    setResendStatus(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    clearFeedback();

    if (!email.trim() || !password.trim()) {
      const message = "Email and password are required.";
      setError(message);
      toast.error(message);
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        const isUnconfirmed = signInError.message
          .toLowerCase()
          .includes("email not confirmed");
        setError(signInError.message);
        setNeedsConfirmation(isUnconfirmed);
        if (!isUnconfirmed) {
          toast.error(signInError.message);
        }
        return;
      }

      toast.success("Signed in successfully!");
      router.push("/dashboard");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResendConfirmation() {
    if (!email.trim()) return;
    setResendStatus(null);
    setResending(true);
    try {
      const supabase = createClient();
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email,
      });
      if (resendError) {
        setResendStatus({ kind: "error", message: resendError.message });
        toast.error(resendError.message);
      } else {
        const message = "Confirmation email sent. Check your inbox.";
        setResendStatus({ kind: "success", message });
        toast.success("Confirmation email resent! Check your inbox.");
      }
    } catch {
      const message = "Failed to resend confirmation email.";
      setResendStatus({ kind: "error", message });
      toast.error(message);
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="w-full">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          Welcome back
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-[2.15rem]">
          Pick up where you left off.
        </h1>
        <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
          Sign in to open your notes, practice sets, and learning progress.
        </p>
      </div>

      {registered && (
        <div
          className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-100"
          role="status"
          aria-live="polite"
        >
          <MailCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium">Your account is ready.</p>
            <p className="mt-1 leading-5 text-emerald-800 dark:text-emerald-200">
              Check your email for the confirmation link, then return here to sign in.
            </p>
          </div>
        </div>
      )}

      <form
        className="space-y-5"
        onSubmit={handleSubmit}
        noValidate
        aria-busy={loading}
      >
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <div className="relative">
            <Mail
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="email"
              type="email"
              required
              aria-required="true"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (error || resendStatus) clearFeedback();
              }}
              disabled={loading}
              autoComplete="email"
              inputMode="email"
              spellCheck={false}
              aria-invalid={Boolean(error)}
              aria-describedby={errorId}
              className="h-11 pl-10 text-[0.95rem]"
            />
          </div>
        </div>

        <PasswordField
          id="password"
          label="Password"
          value={password}
          required
          aria-required="true"
          onChange={(event) => {
            setPassword(event.target.value);
            if (error || resendStatus) clearFeedback();
          }}
          disabled={loading}
          autoComplete="current-password"
          aria-invalid={Boolean(error)}
          aria-describedby={errorId}
        />

        {error && (
          <div
            id="login-error"
            className="flex items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/5 p-3.5 text-sm text-destructive"
            role="alert"
            aria-live="assertive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {needsConfirmation ? "Confirm your email to continue" : "We couldn't sign you in"}
              </p>
              <p className="mt-1 break-words leading-5">{error}</p>
              {needsConfirmation && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full border-destructive/25 bg-background text-foreground hover:bg-muted"
                  disabled={resending}
                  onClick={handleResendConfirmation}
                >
                  {resending && <Loader2 className="animate-spin" aria-hidden="true" />}
                  {resending ? "Resending..." : "Resend confirmation email"}
                </Button>
              )}
              {resendStatus && (
                <p
                  className={
                    resendStatus.kind === "success"
                      ? "mt-3 flex items-center gap-2 text-emerald-700 dark:text-emerald-300"
                      : "mt-3"
                  }
                  role={resendStatus.kind === "error" ? "alert" : "status"}
                >
                  {resendStatus.kind === "success" && (
                    <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                  )}
                  {resendStatus.message}
                </p>
              )}
            </div>
          </div>
        )}

        <Button
          className="h-11 w-full gap-2 shadow-sm"
          type="submit"
          size="lg"
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <ArrowRight aria-hidden="true" />
          )}
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to NoteHut?{" "}
        <Link
          href="/register"
          className="font-semibold text-foreground underline decoration-border underline-offset-4 transition-colors hover:text-primary focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Create an account
        </Link>
      </p>

      <div className="mt-8 flex items-center justify-center gap-2 border-t pt-5 text-xs text-muted-foreground">
        <ShieldCheck className="size-4" aria-hidden="true" />
        Secure access to your personal study workspace
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

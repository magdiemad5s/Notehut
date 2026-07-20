"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertCircle, ArrowRight, Check, Loader2, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { PasswordField } from "@/components/auth/password-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

type RegistrationError = {
  field: "email" | "password" | "confirm-password" | "form";
  message: string;
};

function Requirement({ met, children }: { met: boolean; children: React.ReactNode }) {
  return (
    <li
      className={
        met
          ? "flex items-center gap-2 text-foreground"
          : "flex items-center gap-2 text-muted-foreground"
      }
    >
      <span
        className={
          met
            ? "grid size-4 place-items-center rounded-full bg-emerald-600 text-white"
            : "size-4 rounded-full border border-border bg-background"
        }
        aria-hidden="true"
      >
        {met && <Check className="size-3" strokeWidth={3} />}
      </span>
      <span className="sr-only">{met ? "Requirement met: " : "Requirement not met: "}</span>
      {children}
    </li>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<RegistrationError | null>(null);
  const passwordIsLongEnough = password.length >= 6;
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;

  function clearError() {
    if (formError) setFormError(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);

    if (!email.trim()) {
      setFormError({ field: "email", message: "Email is required" });
      return;
    }

    if (password.length < 6) {
      setFormError({
        field: "password",
        message: "Password must be at least 6 characters",
      });
      return;
    }

    if (password !== confirmPassword) {
      setFormError({
        field: "confirm-password",
        message: "Passwords do not match",
      });
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/login?registered=true`,
        },
      });

      if (signUpError) {
        setFormError({ field: "form", message: signUpError.message });
        toast.error(signUpError.message);
        return;
      }

      toast.success("Check your email for a confirmation link");
      router.push("/login?registered=true");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setFormError({ field: "form", message });
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  const emailError = formError?.field === "email" ? formError.message : undefined;
  const passwordError =
    formError?.field === "password" ? formError.message : undefined;
  const confirmationError =
    formError?.field === "confirm-password" ? formError.message : undefined;
  const submitError = formError?.field === "form" ? formError.message : undefined;

  return (
    <div className="w-full">
      <div className="mb-7">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          Start studying with purpose
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-[2.15rem]">
          Create your NoteHut account.
        </h1>
        <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
          Set up your workspace and turn source material into focused practice.
        </p>
      </div>

      <form
        className="space-y-4"
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
                clearError();
              }}
              disabled={loading}
              autoComplete="email"
              inputMode="email"
              spellCheck={false}
              aria-invalid={Boolean(emailError)}
              aria-describedby={emailError ? "email-error" : undefined}
              className="h-11 pl-10 text-[0.95rem]"
            />
          </div>
          {emailError && (
            <p
              id="email-error"
              className="text-xs leading-relaxed text-destructive"
              role="alert"
            >
              {emailError}
            </p>
          )}
        </div>

        <div role={passwordError ? "alert" : undefined}>
          <PasswordField
            id="password"
            label="Password"
            value={password}
            required
            aria-required="true"
            onChange={(event) => {
              setPassword(event.target.value);
              clearError();
            }}
            disabled={loading}
            autoComplete="new-password"
            aria-describedby="password-requirements"
            error={passwordError}
          />
        </div>

        <div role={confirmationError ? "alert" : undefined}>
          <PasswordField
            id="confirm-password"
            label="Confirm password"
            value={confirmPassword}
            required
            aria-required="true"
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              clearError();
            }}
            disabled={loading}
            autoComplete="new-password"
            error={confirmationError}
          />
        </div>

        <ul
          id="password-requirements"
          className="grid gap-1.5 rounded-xl border bg-muted/35 px-3.5 py-3 text-xs sm:grid-cols-2"
          aria-label="Password requirements"
          aria-live="polite"
        >
          <Requirement met={passwordIsLongEnough}>At least 6 characters</Requirement>
          <Requirement met={passwordsMatch}>Password entries match</Requirement>
        </ul>

        {submitError && (
          <div
            className="flex items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/5 p-3.5 text-sm text-destructive"
            role="alert"
            aria-live="assertive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-medium">We couldn&apos;t create your account</p>
              <p className="mt-1 break-words leading-5">{submitError}</p>
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
          {loading ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-foreground underline decoration-border underline-offset-4 transition-colors hover:text-primary focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Sign in
        </Link>
      </p>

      <div className="mt-7 flex items-center justify-center gap-2 border-t pt-5 text-center text-xs leading-5 text-muted-foreground">
        <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
        Your uploads and study history stay in your account workspace
      </div>
    </div>
  );
}

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle,
  FileText,
  GraduationCap,
  Key,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: BookOpen,
    title: "One workspace per subject",
    description:
      "Keep source material, grounded questions, and practice exams together instead of scattering study work across tabs.",
  },
  {
    icon: GraduationCap,
    title: "Practice that adapts",
    description:
      "Generate mixed-format exams and let missed concepts shape what NoteHut brings back into your next review.",
  },
  {
    icon: MessageSquare,
    title: "Answers tied to your notes",
    description:
      "Ask questions in context and get explanations grounded in the documents inside the topic you are studying.",
  },
];

const steps = [
  {
    number: "01",
    title: "Bring your material",
    description: "Create a topic and upload the PDFs you actually need to learn.",
  },
  {
    number: "02",
    title: "Turn reading into recall",
    description: "Ask focused questions or generate an exam from the same source material.",
  },
  {
    number: "03",
    title: "Review with intention",
    description: "Use your error history to spend the next session on the concepts that need it.",
  },
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const primaryHref = user ? "/dashboard" : "/register";
  const primaryLabel = user ? "Open your workspace" : "Start studying free";

  return (
    <div className="min-h-dvh overflow-x-hidden bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/75 bg-background/88 backdrop-blur-xl supports-[backdrop-filter]:bg-background/78">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            <BrandMark />
          </Link>

          <nav
            aria-label="Marketing navigation"
            className="ml-6 hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex"
          >
            <a className="transition-colors hover:text-foreground" href="#features">
              Why NoteHut
            </a>
            <a className="transition-colors hover:text-foreground" href="#how-it-works">
              How it works
            </a>
            <a className="transition-colors hover:text-foreground" href="#privacy">
              Privacy
            </a>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {!user && (
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "h-9 px-3",
                )}
              >
                Sign in
              </Link>
            )}
            <Link
              href={primaryHref}
              className={cn(buttonVariants({ size: "sm" }), "h-9 px-3.5")}
            >
              {user ? "Dashboard" : "Get started"}
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative border-b border-border/70">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-72 bg-[linear-gradient(to_bottom,oklch(0.955_0.025_273),transparent)] opacity-60"
            aria-hidden="true"
          />
          <div className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.88fr_1.12fr] lg:gap-16 lg:px-8 lg:py-24">
            <div className="max-w-xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/7 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                <Sparkles className="size-3.5" />
                Adaptive study, grounded in your notes
              </div>
              <h1 className="max-w-[12ch] text-4xl font-bold leading-[1.04] tracking-[-0.045em] sm:text-5xl lg:text-[3.65rem]">
                Study what matters. Remember{" "}
                <span className="box-decoration-clone bg-amber-200/75 px-1 dark:bg-amber-400/25">
                  what sticks.
                </span>
              </h1>
              <p className="mt-6 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                NoteHut turns your PDFs into a focused study workspace—grounded chat,
                custom exams, and a review plan that follows your weak spots.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={primaryHref}
                  className={cn(buttonVariants({ size: "lg" }), "group")}
                >
                  {primaryLabel}
                  <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
                </Link>
                <a
                  href="#how-it-works"
                  className={buttonVariants({ variant: "outline", size: "lg" })}
                >
                  See how it works
                </a>
              </div>

              <div className="mt-8 grid max-w-lg gap-3 border-t border-border pt-5 text-sm text-muted-foreground sm:grid-cols-3">
                {["Email sign-up", "Your AI provider", "No AI markup"].map((item) => (
                  <span key={item} className="flex items-center gap-2">
                    <CheckCircle className="size-4 shrink-0 text-primary" />
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-2xl" aria-label="NoteHut study workspace preview">
              <div className="absolute -left-6 top-14 -z-10 hidden h-36 w-20 border-l-2 border-t-2 border-amber-300/70 lg:block" aria-hidden="true" />
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(30,41,59,0.16)]">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-7 place-items-center rounded-md bg-indigo-600 text-white">
                      <BookOpen className="size-3.5" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-slate-900">Cell biology</p>
                      <p className="text-[11px] text-slate-500">3 source documents</p>
                    </div>
                  </div>
                  <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                    Ready to study
                  </span>
                </div>

                <div className="grid sm:grid-cols-[1.15fr_0.85fr]">
                  <div className="border-b border-slate-200 p-4 sm:border-b-0 sm:border-r sm:p-6">
                    <div className="mb-5 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                        <GraduationCap className="size-4 text-indigo-600" />
                        Adaptive exam
                      </div>
                      <span className="text-[11px] font-medium text-slate-500">4 of 10</span>
                    </div>
                    <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full w-2/5 rounded-full bg-indigo-600" />
                    </div>
                    <p className="text-sm font-semibold leading-6 text-slate-900">
                      What role does the cell membrane play in maintaining homeostasis?
                    </p>
                    <div className="mt-4 space-y-2.5">
                      {[
                        ["A", "It stores genetic information", false],
                        ["B", "It controls what enters and leaves", true],
                        ["C", "It produces energy for the cell", false],
                      ].map(([letter, label, selected]) => (
                        <div
                          key={String(letter)}
                          className={cn(
                            "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-xs text-slate-600",
                            selected
                              ? "border-indigo-300 bg-indigo-50 text-slate-900"
                              : "border-slate-200",
                          )}
                        >
                          <span
                            className={cn(
                              "grid size-5 shrink-0 place-items-center rounded-full border text-[10px] font-bold",
                              selected
                                ? "border-indigo-600 bg-indigo-600 text-white"
                                : "border-slate-300",
                            )}
                          >
                            {letter}
                          </span>
                          {label}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-50/70 p-4 sm:p-6">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                      <BarChart3 className="size-4 text-amber-600" />
                      Review focus
                    </div>
                    <p className="mt-2 text-[11px] leading-5 text-slate-500">
                      Your next exam will revisit concepts that need another pass.
                    </p>
                    <div className="mt-5 space-y-4">
                      {[
                        ["Membrane transport", "78%", "bg-rose-500"],
                        ["Cell signaling", "52%", "bg-amber-500"],
                        ["Organelles", "22%", "bg-emerald-500"],
                      ].map(([label, width, color]) => (
                        <div key={String(label)}>
                          <div className="mb-1.5 flex justify-between gap-2 text-[11px] font-medium text-slate-600">
                            <span>{label}</span>
                            <span>{width}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-200">
                            <div className={cn("h-full rounded-full", color)} style={{ width: String(width) }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 rounded-lg border border-indigo-100 bg-white p-3 shadow-sm">
                      <div className="flex items-start gap-2.5">
                        <Sparkles className="mt-0.5 size-3.5 shrink-0 text-indigo-600" />
                        <p className="text-[11px] leading-5 text-slate-600">
                          Suggested next: review passive transport, then take a 5-question check.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="absolute -bottom-5 left-5 hidden items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-lg sm:flex">
                <span className="grid size-8 place-items-center rounded-md bg-amber-50 text-amber-700">
                  <FileText className="size-4" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold text-slate-800">chapter-04.pdf</p>
                  <p className="text-[10px] text-slate-500">Processed and ready</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="scroll-mt-20 bg-card py-16 sm:py-20">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
              <div>
                <p className="text-sm font-semibold text-primary">Built for active study</p>
                <h2 className="mt-3 text-3xl font-bold tracking-[-0.035em] sm:text-4xl">
                  Less organizing. More learning.
                </h2>
                <p className="mt-4 max-w-md leading-7 text-muted-foreground">
                  The useful parts of a study session stay connected—from the source PDF to the question you missed.
                </p>
              </div>

              <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
                {features.map((feature) => (
                  <article key={feature.title} className="bg-card p-6 sm:p-7">
                    <div className="mb-8 grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                      <feature.icon className="size-5" />
                    </div>
                    <h3 className="font-semibold tracking-tight">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {feature.description}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-20 border-y border-border/75 bg-muted/45 py-16 sm:py-20">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-primary">A clearer study loop</p>
              <h2 className="mt-3 text-3xl font-bold tracking-[-0.035em] sm:text-4xl">
                From source material to focused recall.
              </h2>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {steps.map((step) => (
                <article key={step.number} className="relative border-t-2 border-foreground/15 pt-6">
                  <span className="font-mono text-xs font-semibold tracking-[0.14em] text-primary">
                    {step.number}
                  </span>
                  <h3 className="mt-6 text-lg font-semibold tracking-tight">{step.title}</h3>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                    {step.description}
                  </p>
                </article>
              ))}
            </div>

            <div className="mt-12 grid gap-3 sm:grid-cols-3">
              {([
                [UploadCloud, "PDFs up to 25 MB"],
                [MessageSquare, "Grounded topic chat"],
                [BarChart3, "Weakness-aware review"],
              ] as const).map(([Icon, label]) => {
                const ItemIcon = Icon;
                return (
                  <div key={String(label)} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium">
                    <ItemIcon className="size-4 text-primary" />
                    {label}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="privacy" className="scroll-mt-20 bg-[#11182c] py-16 text-white sm:py-20">
          <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-300/20 bg-indigo-300/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-indigo-200">
                <ShieldCheck className="size-3.5" />
                Bring your own key
              </div>
              <h2 className="mt-5 text-3xl font-bold tracking-[-0.035em] sm:text-4xl">
                Your study workspace should work on your terms.
              </h2>
              <p className="mt-5 max-w-xl leading-7 text-slate-300">
                Connect a compatible cloud model or your own local AI setup. NoteHut keeps your configuration in browser storage and sends credentials only with the AI requests that need them.
              </p>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-300">
                <span className="flex items-center gap-2"><CheckCircle className="size-4 text-amber-300" />No AI usage markup</span>
                <span className="flex items-center gap-2"><CheckCircle className="size-4 text-amber-300" />Local-model friendly</span>
                <span className="flex items-center gap-2"><CheckCircle className="size-4 text-amber-300" />Keys are not saved to the app database</span>
              </div>
            </div>

            <div className="border border-white/10 bg-white/[0.04] p-5 sm:p-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-9 place-items-center rounded-lg bg-indigo-400/15 text-indigo-200"><Key className="size-4" /></span>
                  <div>
                    <p className="text-sm font-semibold">AI connection</p>
                    <p className="text-xs text-slate-400">Configured by you</p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-300">Connected</span>
              </div>
              <dl className="mt-5 space-y-4 text-sm">
                <div className="flex items-center justify-between gap-4"><dt className="text-slate-400">Provider</dt><dd className="font-medium">Custom compatible API</dd></div>
                <div className="flex items-center justify-between gap-4"><dt className="text-slate-400">Embedding model</dt><dd className="font-mono text-xs text-slate-200">qwen3-embedding</dd></div>
                <div className="flex items-center justify-between gap-4"><dt className="text-slate-400">Key storage</dt><dd className="font-medium">This browser</dd></div>
              </dl>
            </div>
          </div>
        </section>

        <section className="bg-card py-16 sm:py-20">
          <div className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 text-center sm:px-6">
            <span className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="size-6" />
            </span>
            <h2 className="mt-6 text-3xl font-bold tracking-[-0.035em] sm:text-4xl">
              Make the next study session count.
            </h2>
            <p className="mt-4 max-w-xl leading-7 text-muted-foreground">
              Build a workspace around the material you need to know, then let every question sharpen what comes next.
            </p>
            <Link href={primaryHref} className={cn(buttonVariants({ size: "lg" }), "group mt-8")}>
              {primaryLabel}
              <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-background py-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
          <BrandMark iconClassName="size-8" wordmarkClassName="text-base" />
          <p className="text-center text-xs leading-5 text-muted-foreground sm:text-right">
            © {new Date().getFullYear()} NoteHut. Adaptive study, grounded in your material.
          </p>
        </div>
      </footer>
    </div>
  );
}

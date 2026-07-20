import Image from "next/image";
import Link from "next/link";
import { BookOpenCheck, FileText, Target } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";

const studySteps = [
  { icon: FileText, label: "Bring your notes" },
  { icon: BookOpenCheck, label: "Build focused exams" },
  { icon: Target, label: "Strengthen weak spots" },
];

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="min-h-dvh bg-background lg:grid lg:grid-cols-[minmax(0,1.04fr)_minmax(26rem,0.96fr)]">
      <aside className="relative isolate overflow-hidden border-b border-white/10 bg-slate-950 px-5 py-5 text-white sm:px-8 sm:py-7 lg:flex lg:min-h-dvh lg:flex-col lg:border-b-0 lg:border-r lg:px-10 lg:py-8 xl:px-14">
        <div
          className="pointer-events-none absolute -left-32 top-20 size-80 rounded-full bg-indigo-500/20 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-24 bottom-16 size-72 rounded-full bg-amber-300/10 blur-3xl"
          aria-hidden="true"
        />

        <Link
          href="/"
          className="relative z-10 inline-flex w-fit rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-4 focus-visible:ring-offset-slate-950"
          aria-label="NoteHut home"
        >
          <BrandMark inverse />
        </Link>

        <div className="relative z-10 mt-5 flex flex-1 flex-col justify-center lg:mt-10">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-200">
              Your adaptive study workspace
            </p>
            <p className="mt-2 max-w-lg text-2xl font-semibold leading-tight tracking-[-0.035em] text-white sm:text-3xl lg:mt-3 lg:text-4xl xl:text-[2.7rem]">
              Turn your study material into progress you can see.
            </p>
            <p className="mt-4 hidden max-w-lg text-sm leading-6 text-slate-300 lg:block xl:text-base xl:leading-7">
              Organize source material, generate targeted practice, and revisit the
              concepts that need another pass—all in one focused workspace.
            </p>
          </div>

          <figure className="group relative mt-5 h-32 overflow-hidden rounded-xl border border-white/15 bg-slate-900 shadow-2xl shadow-black/35 sm:h-44 lg:mt-8 lg:h-auto lg:aspect-[16/11] lg:rounded-2xl">
            <Image
              src="/images/notehut-study-workspace.webp"
              alt="NoteHut study workspace organizing learning notes and focused practice"
              fill
              priority
              sizes="(min-width: 1024px) 52vw, 100vw"
              className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.015]"
            />
            <div
              className="absolute inset-0 bg-linear-to-t from-slate-950/80 via-transparent to-slate-950/10"
              aria-hidden="true"
            />
            <figcaption className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-4 p-3 text-xs text-slate-200 sm:p-4 lg:p-5">
              <span className="font-medium text-white">A calmer way to prepare</span>
              <span className="hidden text-slate-300 sm:inline">
                Notes → practice → insight
              </span>
            </figcaption>
          </figure>

          <ul
            className="mt-7 hidden grid-cols-3 gap-3 xl:grid"
            aria-label="How NoteHut helps you study"
          >
            {studySteps.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-center gap-2.5 border-t border-white/15 pt-3 text-xs leading-5 text-slate-300"
              >
                <Icon
                  className="size-4 shrink-0 text-indigo-300"
                  aria-hidden="true"
                />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <section
        className="relative flex min-h-[34rem] items-center justify-center overflow-hidden px-5 py-10 sm:px-8 sm:py-14 lg:min-h-dvh lg:px-10 xl:px-16"
        aria-label="Account access"
      >
        <div
          className="pointer-events-none absolute -right-28 -top-28 size-72 rounded-full bg-primary/5 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative z-10 w-full max-w-md">{children}</div>
      </section>
    </main>
  );
}

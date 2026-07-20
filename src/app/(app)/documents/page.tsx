import Link from "next/link";
import { ArrowRight, FileText, FolderOpen, Plus, UploadCloud } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function DocumentsPage() {
  return (
    <div className="space-y-6 sm:space-y-8">
      <header className="max-w-2xl space-y-1.5">
        <p className="text-sm font-medium text-primary">Study library</p>
        <h1 className="text-2xl font-heading font-bold tracking-tight sm:text-3xl">
          Documents
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
          Keep source material organized inside topics so it is ready for chat,
          review, and exam generation.
        </p>
      </header>

      <Card className="border border-dashed border-border/80 bg-card px-5 py-10 text-center shadow-none ring-0 sm:px-8 sm:py-14">
        <div className="mx-auto grid size-14 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
          <FileText className="size-6" aria-hidden="true" />
        </div>
        <h2 className="mt-5 text-xl font-heading font-semibold tracking-tight">
          Build your document library
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
          Documents are added from a topic. Create one for a course or project,
          then upload the material you want NoteHut to work with.
        </p>
        <div className="mx-auto mt-6 flex max-w-md flex-col justify-center gap-2.5 sm:flex-row">
          <Link
            href="/topics/new"
            className={buttonVariants({ className: "w-full sm:w-auto" })}
          >
            <Plus className="size-4" aria-hidden="true" />
            Create a topic
          </Link>
          <Link
            href="/topics"
            className={buttonVariants({
              variant: "outline",
              className: "w-full sm:w-auto",
            })}
          >
            Browse topics
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="mx-auto mt-8 grid max-w-2xl gap-3 border-t pt-6 text-left sm:grid-cols-2">
          <div className="flex gap-3 rounded-lg bg-muted/50 p-3.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-background text-primary ring-1 ring-foreground/10">
              <FolderOpen className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="font-medium text-foreground">Organized by topic</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                Keep related files and study work together.
              </p>
            </div>
          </div>
          <div className="flex gap-3 rounded-lg bg-muted/50 p-3.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-background text-primary ring-1 ring-foreground/10">
              <UploadCloud className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="font-medium text-foreground">Upload from a topic</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                Open any topic to add and manage its sources.
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

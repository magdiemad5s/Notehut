import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, FileText, ArrowRight, BookOpen } from "lucide-react";

export default async function TopicsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: topics } = await supabase
    .from("topics")
    .select("id, name, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-heading font-bold tracking-tight sm:text-3xl">Topics</h1>
          <p className="text-sm text-muted-foreground">Organize documents into focused study workspaces.</p>
        </div>
        <Link
          href="/topics/new"
          className={buttonVariants({ variant: "default" })}
        >
          <Plus className="size-4" />
          New Topic
        </Link>
      </div>

      {!topics || topics.length === 0 ? (
        <Card className="border-dashed p-8 text-center sm:p-12">
          <div className="mx-auto mb-4 w-fit rounded-full bg-muted p-4"><BookOpen className="size-8 text-muted-foreground" /></div>
          <h2 className="text-lg font-semibold">No topics yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">Create a topic to group documents, ask focused questions, and generate adaptive exams.</p>
          <Link href="/topics/new" className={buttonVariants({ className: "mt-5" })}><Plus className="size-4" />Create your first topic</Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {topics.map((topic) => (
            <Link key={topic.id} href={`/topics/${topic.id}`}>
              <Card className="flex items-center gap-4 p-4 transition-all hover:-translate-y-0.5 hover:bg-muted/50 hover:shadow-sm">
                <div className="rounded-lg bg-primary/10 p-2.5 text-primary"><FileText className="size-5" /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{topic.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(topic.created_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

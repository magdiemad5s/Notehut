import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Plus,
  UploadCloud,
  MessageSquare,
  BookOpen,
  ArrowRight,
  FileText,
  BarChart3,
} from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch all data in parallel for efficiency
  const [
    topicsResult,
    documentsResult,
    recentTopicsResult,
    weaknessesResult,
  ] = await Promise.all([
    supabase
      .from("topics")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("topics")
      .select("id, name, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("user_weaknesses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);

  const topicsCount = topicsResult.count ?? 0;
  const documentsCount = documentsResult.count ?? 0;
  const recentTopics = recentTopicsResult.data ?? [];
  const weaknessesCount = weaknessesResult.count ?? 0;
  const hasTopics = topicsCount > 0;
  const email = user.email ?? "User";

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Welcome section */}
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium text-primary">Study overview</p>
        <h1 className="text-2xl font-heading font-bold tracking-tight [overflow-wrap:anywhere] sm:text-3xl">
          Welcome back, {email}
        </h1>
        <p className="text-muted-foreground">
          Here&apos;s what&apos;s happening with your study materials
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <Card size="sm" className="relative overflow-hidden">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-sm text-muted-foreground">Topics</CardTitle>
            <div className="rounded-lg bg-primary/10 p-2 text-primary"><BookOpen className="size-4" /></div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums sm:text-3xl">{topicsCount}</p>
          </CardContent>
        </Card>
        <Card size="sm" className="relative overflow-hidden">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-sm text-muted-foreground">Documents</CardTitle>
            <div className="rounded-lg bg-primary/10 p-2 text-primary"><FileText className="size-4" /></div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums sm:text-3xl">{documentsCount}</p>
          </CardContent>
        </Card>
        <Card size="sm" className="relative col-span-2 overflow-hidden sm:col-span-1">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-sm text-muted-foreground">Review areas</CardTitle>
            <div className="rounded-lg bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400"><BarChart3 className="size-4" /></div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums sm:text-3xl">
              {weaknessesCount > 0 ? weaknessesCount : "\u2014"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions row */}
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        <Link
          href="/topics/new"
          className={buttonVariants({
            variant: "outline",
            className:
              "h-auto min-h-28 flex-col items-start gap-3 whitespace-normal p-5 text-left hover:border-primary/30 hover:bg-muted/60 sm:min-h-32",
          })}
        >
          <Plus className="size-5 shrink-0" />
          <div className="space-y-1">
            <p className="font-medium">Create a Topic</p>
            <p className="text-xs text-muted-foreground font-normal">
              Organize your study materials into topics
            </p>
          </div>
        </Link>
        <Link
          href="/topics"
          className={buttonVariants({
            variant: "outline",
            className:
              "h-auto min-h-28 flex-col items-start gap-3 whitespace-normal p-5 text-left hover:border-primary/30 hover:bg-muted/60 sm:min-h-32",
          })}
        >
          <UploadCloud className="size-5 shrink-0" />
          <div className="space-y-1">
            <p className="font-medium">Upload Documents</p>
            <p className="text-xs text-muted-foreground font-normal">
              Upload PDFs and documents to your topics
            </p>
          </div>
        </Link>
        <Link
          href="/chat"
          className={buttonVariants({
            variant: "outline",
            className:
              "h-auto min-h-28 flex-col items-start gap-3 whitespace-normal p-5 text-left hover:border-primary/30 hover:bg-muted/60 sm:col-span-2 sm:min-h-32 lg:col-span-1",
          })}
        >
          <MessageSquare className="size-5 shrink-0" />
          <div className="space-y-1">
            <p className="font-medium">Start Chat</p>
            <p className="text-xs text-muted-foreground font-normal">
              Chat with AI about your study materials
            </p>
          </div>
        </Link>
      </div>

      {/* Conditional: recent topics or empty state */}
      {hasTopics ? (
        <section>
          <h2 className="text-lg font-heading font-semibold mb-3">
            Recent Topics
          </h2>
          <div className="space-y-3">
            {recentTopics.map((topic) => (
              <Link key={topic.id} href={`/topics/${topic.id}`}>
                <Card className="flex items-center gap-3 p-4 transition-colors hover:bg-muted/50">
                  <BookOpen className="size-5 shrink-0 text-muted-foreground" />
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
        </section>
      ) : (
        <Card className="border-dashed p-8 text-center sm:p-12">
          <div className="mx-auto mb-4 w-fit rounded-full bg-muted p-4"><BookOpen className="size-8 text-muted-foreground" /></div>
          <h3 className="text-xl font-heading font-semibold">
            Start your learning journey
          </h3>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto">
            Create your first topic to begin uploading documents and generating
            exams
          </p>
          <Link
            href="/topics/new"
            className={buttonVariants({ className: "mt-6" })}
          >
            <Plus className="size-4" />
            Create First Topic
          </Link>
        </Card>
      )}
    </div>
  );
}

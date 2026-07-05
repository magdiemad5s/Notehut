import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, FileText } from "lucide-react";

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold">Topics</h1>
        <Link
          href="/topics/new"
          className={buttonVariants({ variant: "default" })}
        >
          <Plus className="size-4" />
          New Topic
        </Link>
      </div>

      {!topics || topics.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          No topics yet. Create one to get started.
        </Card>
      ) : (
        <div className="space-y-3">
          {topics.map((topic) => (
            <Link key={topic.id} href={`/topics/${topic.id}`}>
              <Card className="flex items-center gap-3 p-4 transition-colors hover:bg-muted/50">
                <FileText className="size-5 shrink-0 text-muted-foreground" />
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
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

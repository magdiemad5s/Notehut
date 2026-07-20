import { createClient } from "@/lib/supabase/server";
import WeaknessesChart from "@/components/weaknesses-chart";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BookOpen } from "lucide-react";

export default async function WeaknessesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: weaknesses } = await supabase
    .from("user_weaknesses")
    .select("topic_name, error_count")
    .eq("user_id", user.id)
    .order("error_count", { ascending: false });

  return (
    <div className="space-y-8">
      <div className="space-y-1"><h1 className="text-2xl font-heading font-bold tracking-tight sm:text-3xl">Your Review Areas</h1><p className="text-sm text-muted-foreground">Use your exam history to decide what to study next.</p></div>

      <WeaknessesChart weaknesses={weaknesses || []} />

      {!weaknesses || weaknesses.length === 0 ? (
        <Card className="border-dashed p-8 text-center">
          <div className="mx-auto mb-4 w-fit rounded-full bg-muted p-4"><BookOpen className="size-8 text-muted-foreground" /></div>
          <h2 className="font-semibold">No review areas yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">Take an exam to identify the concepts that deserve another look.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          <h2 className="text-lg font-heading font-semibold">
            Topics to Review
          </h2>
          {weaknesses.map((w) => (
            <Link
              key={w.topic_name}
              href="/topics"
              className={buttonVariants({
                variant: "outline",
                className: "h-auto w-full justify-start gap-3 whitespace-normal p-4 text-left hover:bg-muted/50",
              })}
            >
              <BookOpen className="size-4 shrink-0" />
              <span className="flex-1 truncate text-left">{w.topic_name}</span>
              <span className="text-xs text-muted-foreground">
                {w.error_count} error{w.error_count !== 1 ? "s" : ""}
              </span>
              <ArrowRight className="size-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

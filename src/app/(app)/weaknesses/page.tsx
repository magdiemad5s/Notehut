import { createClient } from "@/lib/supabase/server";
import WeaknessesChart from "@/components/weaknesses-chart";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";

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
    <div className="space-y-6">
      <h1 className="text-2xl font-heading font-bold">Your Weaknesses</h1>

      <WeaknessesChart weaknesses={weaknesses || []} />

      {!weaknesses || weaknesses.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          No weaknesses tracked yet. Keep studying and taking exams to identify
          areas for improvement.
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
                className: "w-full justify-start gap-3",
              })}
            >
              <BookOpen className="size-4 shrink-0" />
              <span className="flex-1 truncate text-left">{w.topic_name}</span>
              <span className="text-xs text-muted-foreground">
                {w.error_count} error{w.error_count !== 1 ? "s" : ""}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

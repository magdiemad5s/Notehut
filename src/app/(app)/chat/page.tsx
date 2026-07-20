import { Card } from "@/components/ui/card";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { BookOpen, MessageSquare } from "lucide-react";

export default function ChatPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-1"><h1 className="text-2xl font-heading font-bold tracking-tight sm:text-3xl">Chat</h1><p className="text-sm text-muted-foreground">Ask questions grounded in the documents inside a topic.</p></div>
      <Card className="border-dashed p-8 text-center sm:p-12">
        <div className="mx-auto mb-4 w-fit rounded-full bg-muted p-4"><MessageSquare className="size-8 text-muted-foreground" /></div>
        <h2 className="text-lg font-semibold">Open a topic to start chatting</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">Choose a study topic and NoteHut will answer using that topic&apos;s processed documents.</p>
        <Link href="/topics" className={buttonVariants({ className: "mt-5" })}><BookOpen className="size-4" />Browse topics</Link>
      </Card>
    </div>
  );
}

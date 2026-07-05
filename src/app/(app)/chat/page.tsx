import { Card } from "@/components/ui/card";

export default function ChatPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-heading font-bold">Chat</h1>
      <Card className="p-8 text-center text-muted-foreground">
        Your conversations will appear here
      </Card>
    </div>
  );
}

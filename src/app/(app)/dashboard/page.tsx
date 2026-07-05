import { Card } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-heading font-bold">Dashboard</h1>
      <Card className="p-8 text-center text-muted-foreground">
        Your documents and topics will appear here
      </Card>
    </div>
  );
}

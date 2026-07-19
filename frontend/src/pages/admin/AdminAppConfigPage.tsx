import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function AdminAppConfigPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          Application configuration
        </h2>
        <p className="text-muted-foreground max-w-2xl text-sm">
          Adjust global application settings and monitoring preferences.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>
            This section is under construction. Application configuration
            options will be added here.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

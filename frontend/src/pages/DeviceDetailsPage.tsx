import { ArrowLeft, Cpu, Network, Server } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function DeviceDetailsPage() {
  const { deviceId } = useParams();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link to="/dashboard/devices">
            <ArrowLeft className="size-4" />
            Back to devices
          </Link>
        </Button>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="size-5" />
            Device details
          </CardTitle>
          <CardDescription>
            Detailed view for device {deviceId} is planned for the next step.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-dashed p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Cpu className="size-4" />
                Device information
              </div>
              <p className="text-muted-foreground text-sm">
                Metrics, inventory, and health checks will appear here once the
                backend endpoint is connected.
              </p>
            </div>

            <div className="rounded-lg border border-dashed p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Network className="size-4" />
                Connectivity
              </div>
              <p className="text-muted-foreground text-sm">
                Interface status, uptime, and recent events will be displayed
                here in a later iteration.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { ArrowLeft, Loader2, Pencil, Plus, Settings2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { MetricsTimeRangeControl } from "@/components/charts/MetricsTimeRangeControl";
import { Modal } from "@/components/admin/Modal";
import { DashboardSectionWidget } from "@/components/dashboard/DashboardSectionWidget";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthErrorMessage } from "@/contexts/AuthContext";
import { isAdmin } from "@/lib/auth";
import {
  canEditDashboard,
  fetchDashboard,
  fetchDashboardSectionDetail,
  fetchDashboardSections,
  getVisibilityLabel,
  updateDashboard,
  type Dashboard,
  type DashboardSectionDetail,
  type DashboardSectionSummary,
  type DashboardVisibility,
} from "@/lib/dashboardsApi";
import { routes } from "@/lib/routes";
import { createDefaultMetricsRange, type DateRange } from "@/lib/timeRangePresets";
import { cn } from "@/lib/utils";

interface DashboardSettingsValues {
  name: string;
  description: string;
  visibility: DashboardVisibility;
}

function VisibilityBadge({ visibility }: { visibility: DashboardVisibility }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        visibility === "PUBLIC" &&
          "border-sky-500/30 bg-sky-500/10 text-sky-300",
        visibility === "ADMIN_ONLY" &&
          "border-amber-500/30 bg-amber-500/10 text-amber-300",
        visibility === "PRIVATE" &&
          "border-violet-500/30 bg-violet-500/10 text-violet-300",
      )}
    >
      {getVisibilityLabel(visibility)}
    </span>
  );
}

export function DashboardViewPage() {
  const { dashboardId } = useParams<{ dashboardId: string }>();
  const resolvedDashboardId = Number(dashboardId);
  const navigate = useNavigate();
  const { user } = useAuth();
  const admin = isAdmin(user);

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [sections, setSections] = useState<DashboardSectionSummary[]>([]);
  const [sectionDetails, setSectionDetails] = useState<DashboardSectionDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [metricsRange, setMetricsRange] = useState<DateRange>(createDefaultMetricsRange);

  const editable = dashboard
    ? canEditDashboard(dashboard, user?.id, admin)
    : false;

  const loadDashboard = useCallback(async () => {
    if (!Number.isFinite(resolvedDashboardId)) {
      navigate(routes.dashboards);
      return;
    }

    setLoading(true);

    try {
      const [dashboardResult, sectionSummaries] = await Promise.all([
        fetchDashboard(resolvedDashboardId),
        fetchDashboardSections(resolvedDashboardId),
      ]);

      setDashboard(dashboardResult);
      setSections(sectionSummaries);

      const details = await Promise.all(
        sectionSummaries.map((section) =>
          fetchDashboardSectionDetail(resolvedDashboardId, section.id),
        ),
      );
      setSectionDetails(details);
    } catch (error) {
      toast.error(getAuthErrorMessage(error));
      navigate(routes.dashboards);
    } finally {
      setLoading(false);
    }
  }, [navigate, resolvedDashboardId]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const settingsForm = useForm<DashboardSettingsValues>({
    defaultValues: {
      name: "",
      description: "",
      visibility: "PRIVATE",
    },
  });

  useEffect(() => {
    if (!dashboard) return;

    settingsForm.reset({
      name: dashboard.name,
      description: dashboard.description,
      visibility:
        dashboard.visibility === "ADMIN_ONLY" ? "PRIVATE" : dashboard.visibility,
    });
  }, [dashboard, settingsForm]);

  const handleSaveSettings = async (values: DashboardSettingsValues) => {
    if (!dashboard) return;

    setSavingSettings(true);

    try {
      const updated = await updateDashboard(dashboard.id, {
        name: values.name.trim(),
        description: values.description.trim(),
        ...(admin ? { visibility: values.visibility } : {}),
      });
      setDashboard(updated);
      toast.success("Dashboard settings saved");
      setSettingsOpen(false);
    } catch (error) {
      toast.error(getAuthErrorMessage(error));
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading || !dashboard) {
    return (
      <div className="text-muted-foreground flex min-h-60 items-center justify-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <Button type="button" variant="ghost" size="sm" asChild className="-ml-2 w-fit">
            <Link to={routes.dashboards}>
              <ArrowLeft className="size-4" />
              Back to dashboards
            </Link>
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold tracking-tight">{dashboard.name}</h2>
              <VisibilityBadge visibility={dashboard.visibility} />
            </div>
            {dashboard.description ? (
              <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
                {dashboard.description}
              </p>
            ) : null}
            <p className="text-muted-foreground mt-2 text-xs">
              Owner: {dashboard.ownerUsername ?? "Unknown"} · {sections.length} section
              {sections.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {editable ? (
            <>
              <Button type="button" variant="outline" onClick={() => setSettingsOpen(true)}>
                <Settings2 className="size-4" />
                Dashboard settings
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link to={routes.dashboardSections(String(resolvedDashboardId))}>
                  <Pencil className="size-4" />
                  Edit sections
                </Link>
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {sections.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No sections yet</CardTitle>
            <CardDescription>
              {editable
                ? "Open Edit sections to add chart sections to this dashboard."
                : "This dashboard does not contain any sections yet."}
            </CardDescription>
          </CardHeader>
          {editable ? (
            <CardContent>
              <Button type="button" asChild>
                <Link to={routes.dashboardSections(String(resolvedDashboardId))}>
                  <Plus className="size-4" />
                  Edit sections
                </Link>
              </Button>
            </CardContent>
          ) : null}
        </Card>
      ) : (
        <>
          <MetricsTimeRangeControl
            idPrefix="dashboard"
            start={metricsRange.start}
            end={metricsRange.end}
            onApply={(start, end) => setMetricsRange({ start, end })}
          />

          <div className="grid grid-cols-1 gap-6">
            {sectionDetails.map((section) => (
              <DashboardSectionWidget
                key={section.id}
                dashboardId={resolvedDashboardId}
                section={section}
                range={metricsRange}
              />
            ))}
          </div>
        </>
      )}

      <Modal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Dashboard settings"
        description="Update dashboard name, description, and visibility."
        className="max-w-xl"
      >
        <Form {...settingsForm}>
          <form
            className="space-y-4"
            onSubmit={settingsForm.handleSubmit(handleSaveSettings)}
          >
            <FormField
              control={settingsForm.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={settingsForm.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            {admin ? (
              <FormField
                control={settingsForm.control}
                name="visibility"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Visibility</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="PUBLIC">Shared — visible to all users</SelectItem>
                        <SelectItem value="PRIVATE">
                          Private — owner and admins only
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSettingsOpen(false)}
                disabled={savingSettings}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={savingSettings}>
                {savingSettings ? "Saving..." : "Save settings"}
              </Button>
            </div>
          </form>
        </Form>
      </Modal>
    </div>
  );
}
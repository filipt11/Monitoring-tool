import { ArrowLeft, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { DashboardSectionForm } from "@/components/dashboard/DashboardSectionForm";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthErrorMessage } from "@/contexts/AuthContext";
import { isAdmin } from "@/lib/auth";
import {
  canEditDashboard,
  fetchDashboard,
  fetchDashboardSectionDetail,
  type Dashboard,
  type DashboardSectionDetail,
} from "@/lib/dashboardsApi";
import { routes } from "@/lib/routes";

export function DashboardSectionEditPage() {
  const { dashboardId, sectionId } = useParams<{
    dashboardId: string;
    sectionId?: string;
  }>();
  const resolvedDashboardId = Number(dashboardId);
  const isEditing = sectionId != null && sectionId !== "new";
  const resolvedSectionId = isEditing ? Number(sectionId) : null;
  const navigate = useNavigate();
  const { user } = useAuth();
  const admin = isAdmin(user);

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [section, setSection] = useState<DashboardSectionDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const viewRoute = routes.dashboardView(String(resolvedDashboardId));
  const sectionsRoute = routes.dashboardSections(String(resolvedDashboardId));

  const goBackToSections = useCallback(() => {
    navigate(sectionsRoute);
  }, [navigate, sectionsRoute]);

  const goBackToDashboard = useCallback(() => {
    navigate(viewRoute);
  }, [navigate, viewRoute]);

  useEffect(() => {
    if (!Number.isFinite(resolvedDashboardId)) {
      navigate(routes.dashboards);
      return;
    }

    if (isEditing && !Number.isFinite(resolvedSectionId)) {
      navigate(routes.dashboardSections(String(resolvedDashboardId)));
      return;
    }

    let active = true;
    setLoading(true);

    void (async () => {
      try {
        const dashboardResult = await fetchDashboard(resolvedDashboardId);

        if (!canEditDashboard(dashboardResult, user?.id, admin)) {
          toast.error("You do not have permission to edit this dashboard.");
          navigate(viewRoute);
          return;
        }

        if (!active) return;
        setDashboard(dashboardResult);

        if (isEditing && resolvedSectionId != null) {
          const sectionResult = await fetchDashboardSectionDetail(
            resolvedDashboardId,
            resolvedSectionId,
          );
          if (active) {
            setSection(sectionResult);
          }
        } else if (active) {
          setSection(null);
        }
      } catch (error) {
        if (active) {
          toast.error(getAuthErrorMessage(error));
          navigate(routes.dashboardSections(String(resolvedDashboardId)));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [
    admin,
    isEditing,
    navigate,
    resolvedDashboardId,
    resolvedSectionId,
    user?.id,
    viewRoute,
  ]);

  if (loading || !dashboard) {
    return (
      <div className="text-muted-foreground flex min-h-60 items-center justify-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Loading section...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Button type="button" variant="ghost" size="sm" asChild className="-ml-2 w-fit">
          <Link to={routes.dashboardSections(String(resolvedDashboardId))}>
            <ArrowLeft className="size-4" />
            Back to sections
          </Link>
        </Button>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            {isEditing ? "Edit section" : "Add section"}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {dashboard.name} — configure chart type, data source, and metrics
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isEditing ? section?.name ?? "Section" : "New section"}</CardTitle>
          <CardDescription>
            Save to return to the dashboard view, or cancel to go back to the sections list.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DashboardSectionForm
            dashboardId={resolvedDashboardId}
            section={isEditing ? section : null}
            onCancel={goBackToSections}
            onSaved={goBackToDashboard}
          />
        </CardContent>
      </Card>
    </div>
  );
}

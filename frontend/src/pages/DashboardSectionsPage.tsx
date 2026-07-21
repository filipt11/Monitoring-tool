import { ArrowLeft, Loader2, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { Modal } from "@/components/admin/Modal";
import { DashboardSectionsSortableTable } from "@/components/dashboard/DashboardSectionsSortableTable";
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
  deleteDashboardSection,
  fetchDashboard,
  fetchDashboardSections,
  reorderDashboardSections,
  type Dashboard,
  type DashboardSectionSummary,
} from "@/lib/dashboardsApi";
import { routes } from "@/lib/routes";
export function DashboardSectionsPage() {
  const { dashboardId } = useParams<{ dashboardId: string }>();
  const resolvedDashboardId = Number(dashboardId);
  const navigate = useNavigate();
  const { user } = useAuth();
  const admin = isAdmin(user);

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [sections, setSections] = useState<DashboardSectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<DashboardSectionSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const editable = dashboard
    ? canEditDashboard(dashboard, user?.id, admin)
    : false;

  const loadData = useCallback(async () => {
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

      if (!canEditDashboard(dashboardResult, user?.id, admin)) {
        toast.error("You do not have permission to edit this dashboard.");
        navigate(routes.dashboardView(String(resolvedDashboardId)));
        return;
      }

      setDashboard(dashboardResult);
      setSections(sectionSummaries);
    } catch (error) {
      toast.error(getAuthErrorMessage(error));
      navigate(routes.dashboards);
    } finally {
      setLoading(false);
    }
  }, [admin, navigate, resolvedDashboardId, user?.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);

    try {
      await deleteDashboardSection(resolvedDashboardId, deleteTarget.id);
      toast.success(`Section "${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
      await loadData();
    } catch (error) {
      toast.error(getAuthErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  };

  const handleReorder = async (reorderedSections: DashboardSectionSummary[]) => {
    const previousSections = sections;
    setSections(reorderedSections);
    setSavingOrder(true);

    try {
      const updatedSections = await reorderDashboardSections(
        resolvedDashboardId,
        reorderedSections.map((section) => section.id),
      );
      setSections(updatedSections);
    } catch (error) {
      setSections(previousSections);
      toast.error(getAuthErrorMessage(error));
    } finally {
      setSavingOrder(false);
    }
  };
  if (loading || !dashboard) {
    return (
      <div className="text-muted-foreground flex min-h-60 items-center justify-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Loading sections...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <Button type="button" variant="ghost" size="sm" asChild className="-ml-2 w-fit">
            <Link to={routes.dashboardView(String(resolvedDashboardId))}>
              <ArrowLeft className="size-4" />
              Back to dashboard
            </Link>
          </Button>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Edit sections</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Manage chart sections for <span className="font-medium">{dashboard.name}</span>
            </p>
          </div>
        </div>

        {editable ? (
          <Button type="button" asChild>
            <Link to={routes.dashboardSectionNew(String(resolvedDashboardId))}>
              <Plus className="size-4" />
              Add section
            </Link>
          </Button>
        ) : null}
      </div>

      {sections.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No sections configured</CardTitle>
            <CardDescription>
              Add a section to define chart type, data sources, and metrics.
            </CardDescription>
          </CardHeader>
          {editable ? (
            <CardContent>
              <Button type="button" asChild>
                <Link to={routes.dashboardSectionNew(String(resolvedDashboardId))}>
                  <Plus className="size-4" />
                  Add section
                </Link>
              </Button>
            </CardContent>
          ) : null}
        </Card>
      ) : (
        <DashboardSectionsSortableTable
          dashboardId={resolvedDashboardId}
          sections={sections}
          editable={editable}
          savingOrder={savingOrder}
          onReorder={(reorderedSections) => void handleReorder(reorderedSections)}
          onDelete={setDeleteTarget}
        />
      )}
      <Modal
        open={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        title="Delete section"
        description={
          deleteTarget
            ? `Delete "${deleteTarget.name}" from this dashboard? This cannot be undone.`
            : undefined
        }
        className="max-w-md"
      >
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setDeleteTarget(null)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleDelete()}
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Delete section"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

import {
  LayoutDashboard,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Modal } from "@/components/admin/Modal";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  createDashboard,
  deleteDashboard,
  fetchDashboards,
  getVisibilityLabel,
  type Dashboard,
  type DashboardVisibility,
} from "@/lib/dashboardsApi";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

type DashboardFilter = "all" | "mine" | "shared";

interface DashboardFormValues {
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

function matchesFilter(
  dashboard: Dashboard,
  filter: DashboardFilter,
  userId: number | undefined,
) {
  switch (filter) {
    case "mine":
      return dashboard.ownerId === userId;
    case "shared":
      return dashboard.visibility === "PUBLIC";
    default:
      return true;
  }
}

function CreateDashboardDialog({
  open,
  admin,
  onClose,
  onSuccess,
}: {
  open: boolean;
  admin: boolean;
  onClose: () => void;
  onSuccess: (dashboard: Dashboard) => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<DashboardFormValues>({
    defaultValues: {
      name: "",
      description: "",
      visibility: admin ? "PUBLIC" : "PRIVATE",
    },
  });

  useEffect(() => {
    if (!open) {
      form.reset({
        name: "",
        description: "",
        visibility: admin ? "PUBLIC" : "PRIVATE",
      });
    }
  }, [admin, form, open]);

  const onSubmit = async (values: DashboardFormValues) => {
    setIsSubmitting(true);

    try {
      const dashboard = await createDashboard({
        name: values.name.trim(),
        description: values.description.trim(),
        ...(admin ? { visibility: values.visibility } : {}),
      });
      toast.success(`Dashboard "${dashboard.name}" created`);
      onSuccess(dashboard);
    } catch (error) {
      toast.error(getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create dashboard"
      description="Build a custom monitoring view with chart sections."
      className="max-w-xl"
    >
      <Form {...form}>
        <form className="space-y-4" noValidate onSubmit={form.handleSubmit(onSubmit)}>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input autoComplete="off" placeholder="Network overview" {...field} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Input autoComplete="off" placeholder="Optional description" {...field} />
                </FormControl>
              </FormItem>
            )}
          />

          {admin ? (
            <FormField
              control={form.control}
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
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create dashboard"}
            </Button>
          </div>
        </form>
      </Form>
    </Modal>
  );
}

export function DashboardsPage() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const location = useLocation();
  const navigate = useNavigate();

  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [dashboardFilter, setDashboardFilter] = useState<DashboardFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Dashboard | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadDashboards = useCallback(async () => {
    setLoading(true);

    try {
      const result = await fetchDashboards();
      setDashboards(result.content);
    } catch (error) {
      toast.error(getAuthErrorMessage(error));
      setDashboards([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboards();
  }, [loadDashboards, location.key]);

  useEffect(() => {
    setPage(0);
  }, [searchInput, dashboardFilter]);

  const filteredDashboards = useMemo(() => {
    const query = searchInput.trim().toLowerCase();

    return dashboards.filter((dashboard) => {
      if (!matchesFilter(dashboard, dashboardFilter, user?.id)) {
        return false;
      }

      if (!query) {
        return true;
      }

      return (
        dashboard.name.toLowerCase().includes(query) ||
        dashboard.description.toLowerCase().includes(query)
      );
    });
  }, [dashboardFilter, dashboards, searchInput, user?.id]);

  const totalElements = filteredDashboards.length;
  const totalPages = totalElements === 0 ? 0 : Math.ceil(totalElements / PAGE_SIZE);
  const pageDashboards = filteredDashboards.slice(
    page * PAGE_SIZE,
    page * PAGE_SIZE + PAGE_SIZE,
  );

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setActionLoading(true);

    try {
      await deleteDashboard(deleteTarget.id);
      toast.success(`Dashboard "${deleteTarget.name}" deleted`);
      setDeleteTarget(null);

      if (pageDashboards.length === 1 && page > 0) {
        setPage((current) => current - 1);
      }

      await loadDashboards();
    } catch (error) {
      toast.error(getAuthErrorMessage(error));
    } finally {
      setActionLoading(false);
    }
  };

  const pageStart = totalElements === 0 ? 0 : page * PAGE_SIZE + 1;
  const pageEnd = Math.min((page + 1) * PAGE_SIZE, totalElements);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">Dashboards</h2>
          <p className="text-muted-foreground max-w-2xl text-sm">
            Create custom dashboards with chart sections backed by devices, device groups,
            interfaces, or interface groups.
          </p>
        </div>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Create dashboard
        </Button>
      </div>

      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Your dashboards</CardTitle>
            <CardDescription>
              Open a dashboard to add sections and view live metrics.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select
              value={dashboardFilter}
              onValueChange={(value) => setDashboardFilter(value as DashboardFilter)}
            >
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All dashboards</SelectItem>
                <SelectItem value="mine">Mine</SelectItem>
                <SelectItem value="shared">Shared</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative w-full sm:w-72">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search dashboards"
                className="h-9 pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-muted-foreground flex min-h-40 items-center justify-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" />
              Loading dashboards...
            </div>
          ) : totalElements === 0 ? (
            <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-10 text-center">
              <LayoutDashboard className="text-muted-foreground size-8" />
              <div>
                <p className="font-medium">No dashboards yet</p>
                <p className="text-muted-foreground text-sm">
                  Create your first dashboard to start building sections.
                </p>
              </div>
              <Button type="button" onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                Create dashboard
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-lg border">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Name</th>
                      <th className="px-4 py-3 text-left font-medium">Description</th>
                      <th className="px-4 py-3 text-left font-medium">Visibility</th>
                      <th className="px-4 py-3 text-left font-medium">Owner</th>
                      <th className="px-4 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {pageDashboards.map((dashboard) => {
                      const editable = canEditDashboard(dashboard, user?.id, admin);

                      return (
                        <tr key={dashboard.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3 font-medium">
                            <Link
                              to={routes.dashboardView(String(dashboard.id))}
                              className="text-primary hover:underline"
                            >
                              {dashboard.name}
                            </Link>
                          </td>
                          <td className="text-muted-foreground px-4 py-3">
                            {dashboard.description || "—"}
                          </td>
                          <td className="px-4 py-3">
                            <VisibilityBadge visibility={dashboard.visibility} />
                          </td>
                          <td className="text-muted-foreground px-4 py-3">
                            {dashboard.ownerUsername ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button type="button" variant="ghost" size="icon">
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link to={routes.dashboardView(String(dashboard.id))}>
                                    <Pencil className="size-4" />
                                    Open dashboard
                                  </Link>
                                </DropdownMenuItem>
                                {editable ? (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => setDeleteTarget(dashboard)}
                                    >
                                      <Trash2 className="size-4" />
                                      Delete
                                    </DropdownMenuItem>
                                  </>
                                ) : null}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalElements > PAGE_SIZE ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-muted-foreground text-xs">
                    Showing {pageStart}-{pageEnd} of {totalElements} dashboards
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((current) => Math.max(0, current - 1))}
                      disabled={page === 0}
                    >
                      Previous
                    </Button>
                    <span className="text-muted-foreground text-xs">
                      Page {page + 1} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPage((current) => Math.min(totalPages - 1, current + 1))
                      }
                      disabled={page >= totalPages - 1}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateDashboardDialog
        open={createOpen}
        admin={admin}
        onClose={() => setCreateOpen(false)}
        onSuccess={(dashboard) => {
          setCreateOpen(false);
          navigate(routes.dashboardView(String(dashboard.id)));
        }}
      />

      <Modal
        open={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        title="Delete dashboard"
        description={
          deleteTarget
            ? `Delete "${deleteTarget.name}" and all of its sections? This cannot be undone.`
            : undefined
        }
        className="max-w-md"
      >
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setDeleteTarget(null)}
            disabled={actionLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleDelete()}
            disabled={actionLoading}
          >
            {actionLoading ? "Deleting..." : "Delete dashboard"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

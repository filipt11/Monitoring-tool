import {
  ChevronDown,
  ChevronRight,
  Eye,
  FolderTree,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Server,
  Trash2,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { Modal } from "@/components/admin/Modal";
import { StyledCheckbox } from "@/components/admin/StyledCheckbox";
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
  addDevicesToGroup,
  canEditDeviceGroup,
  createDeviceGroup,
  deleteDeviceGroup,
  fetchDeviceGroupDetail,
  fetchDeviceGroups,
  getVisibilityLabel,
  removeDevicesFromGroup,
  updateDeviceGroup,
  type DeviceGroup,
  type DeviceGroupDevice,
  type DeviceGroupVisibility,
} from "@/lib/deviceGroupsApi";
import { fetchDeviceList } from "@/lib/devicesApi";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;
const GROUP_DEVICE_PAGE_SIZE = 10;

type GroupFilter = "all" | "mine" | "shared";

interface GroupFormValues {
  name: string;
  description: string;
  visibility: DeviceGroupVisibility;
}

function VisibilityBadge({ visibility }: { visibility: DeviceGroupVisibility }) {
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
  group: DeviceGroup,
  filter: GroupFilter,
  userId: number | undefined,
) {
  switch (filter) {
    case "mine":
      return group.ownerId === userId;
    case "shared":
      return group.visibility === "PUBLIC";
    default:
      return true;
  }
}

function toggleExpandedGroup(
  groupId: number,
  setExpandedGroupIds: Dispatch<SetStateAction<Set<number>>>,
) {
  setExpandedGroupIds((current) => {
    const next = new Set(current);
    if (next.has(groupId)) {
      next.delete(groupId);
    } else {
      next.add(groupId);
    }
    return next;
  });
}

function GroupDevicesPanel({
  group,
  editable,
  onManageDevices,
  refreshKey,
}: {
  group: DeviceGroup;
  editable: boolean;
  onManageDevices: () => void;
  refreshKey: number;
}) {
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [devices, setDevices] = useState<DeviceGroupDevice[]>([]);
  const [totalElements, setTotalElements] = useState(group.deviceCount);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [group.id, refreshKey]);

  useEffect(() => {
    let active = true;
    setLoading(true);

    void fetchDeviceGroupDetail(group.id, page, GROUP_DEVICE_PAGE_SIZE)
      .then((detail) => {
        if (!active) return;
        setDevices(detail.devices.content);
        setTotalElements(detail.devices.totalElements);
        setTotalPages(detail.devices.totalPages);
      })
      .catch((error) => {
        if (active) {
          toast.error(getAuthErrorMessage(error));
          setDevices([]);
          setTotalElements(0);
          setTotalPages(0);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [group.id, page, refreshKey]);

  const pageStart = totalElements === 0 ? 0 : page * GROUP_DEVICE_PAGE_SIZE + 1;
  const pageEnd = Math.min((page + 1) * GROUP_DEVICE_PAGE_SIZE, totalElements);

  if (loading) {
    return (
      <div className="text-muted-foreground flex min-h-24 items-center justify-center px-4 py-3 text-sm">
        Loading devices...
      </div>
    );
  }

  if (totalElements === 0) {
    return (
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm">No devices in this group.</p>
        {editable ? (
          <Button type="button" variant="outline" size="sm" onClick={onManageDevices}>
            <Plus className="size-4" />
            Add devices
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3 px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Devices in {group.name} ({totalElements})
        </p>
        {editable ? (
          <Button type="button" variant="outline" size="sm" onClick={onManageDevices}>
            <Server className="size-4" />
            Manage devices
          </Button>
        ) : (
          <p className="text-muted-foreground text-xs">Read-only shared group</p>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border bg-background/60">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Hostname</th>
              <th className="px-3 py-2 text-left font-medium">IP address</th>
              <th className="px-3 py-2 text-left font-medium">Vendor</th>
              <th className="px-3 py-2 text-left font-medium">Model</th>
              <th className="px-3 py-2 text-right font-medium">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {devices.map((device) => (
              <tr key={device.id} className="hover:bg-muted/30">
                <td className="px-3 py-2 font-medium">
                  {device.hostname || "Unnamed device"}
                </td>
                <td className="text-muted-foreground px-3 py-2">{device.ip}</td>
                <td className="text-muted-foreground px-3 py-2">
                  {device.vendor || "—"}
                </td>
                <td className="text-muted-foreground px-3 py-2">
                  {device.model || "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  <Button variant="link" className="h-auto p-0 text-sm" asChild>
                    <Link to={routes.deviceDetails(String(device.id))}>Open</Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-xs">
            Showing {pageStart}-{pageEnd} of {totalElements} devices
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
  );
}

export function DeviceGroupsPage() {
  const { user } = useAuth();
  const admin = isAdmin(user);

  const [groups, setGroups] = useState<DeviceGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [groupFilter, setGroupFilter] = useState<GroupFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<DeviceGroup | null>(null);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<DeviceGroup | null>(null);
  const [manageDevicesGroup, setManageDevicesGroup] = useState<DeviceGroup | null>(null);
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<number>>(() => new Set());
  const [devicesRefreshKey, setDevicesRefreshKey] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);

  const loadGroups = useCallback(async () => {
    setLoading(true);

    try {
      const result = await fetchDeviceGroups();
      setGroups(result.content);
    } catch (error) {
      toast.error(getAuthErrorMessage(error));
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    setPage(0);
  }, [searchInput, groupFilter]);

  const filteredGroups = useMemo(() => {
    const query = searchInput.trim().toLowerCase();

    return groups.filter((group) => {
      if (!matchesFilter(group, groupFilter, user?.id)) {
        return false;
      }

      if (!query) {
        return true;
      }

      return (
        group.name.toLowerCase().includes(query) ||
        group.description.toLowerCase().includes(query)
      );
    });
  }, [groups, groupFilter, searchInput, user?.id]);

  const totalElements = filteredGroups.length;
  const totalPages = totalElements === 0 ? 0 : Math.ceil(totalElements / PAGE_SIZE);
  const pageGroups = filteredGroups.slice(
    page * PAGE_SIZE,
    page * PAGE_SIZE + PAGE_SIZE,
  );

  const handleDelete = async () => {
    if (!deleteGroupTarget) return;

    setActionLoading(true);

    try {
      await deleteDeviceGroup(deleteGroupTarget.id);
      toast.success(`Group "${deleteGroupTarget.name}" deleted`);
      setDeleteGroupTarget(null);

      if (pageGroups.length === 1 && page > 0) {
        setPage((current) => current - 1);
      }

      await loadGroups();
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
          <h2 className="text-2xl font-semibold tracking-tight">Device Groups</h2>
          <p className="text-muted-foreground max-w-2xl text-sm">
            Organize devices into groups for dashboards and monitoring views.
            Shared groups are visible to everyone; private groups are only visible
            to you and administrators.
          </p>
        </div>

        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Create group
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Groups</CardTitle>
              <CardDescription>
                {totalElements} group{totalElements === 1 ? "" : "s"}
                {groupFilter === "mine" ? " created by you" : ""}
                {groupFilter === "shared" ? " shared with all users" : ""}
              </CardDescription>
            </div>

            <div className="flex w-full flex-col gap-3 sm:flex-row lg:max-w-2xl">
              <Select
                value={groupFilter}
                onValueChange={(value) => setGroupFilter(value as GroupFilter)}
              >
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="Filter groups" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All groups</SelectItem>
                  <SelectItem value="mine">My groups</SelectItem>
                  <SelectItem value="shared">Shared groups</SelectItem>
                </SelectContent>
              </Select>

              <div className="relative flex-1">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search by name or description"
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="text-muted-foreground flex min-h-48 items-center justify-center rounded-lg border border-dashed text-sm">
              Loading groups...
            </div>
          ) : pageGroups.length === 0 ? (
            <div className="text-muted-foreground flex min-h-48 items-center justify-center rounded-lg border border-dashed text-sm">
              {searchInput || groupFilter !== "all"
                ? "No groups match your filters."
                : "No groups yet. Create one to get started."}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-lg border">
                <table className="min-w-full divide-y divide-border text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Name</th>
                      <th className="px-4 py-3 text-left font-medium">Description</th>
                      {admin ? (
                        <th className="px-4 py-3 text-left font-medium">Owner</th>
                      ) : null}
                      <th className="px-4 py-3 text-left font-medium">Visibility</th>
                      <th className="px-4 py-3 text-left font-medium">Devices</th>
                      <th className="px-4 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-background/80">
                    {pageGroups.map((group) => {
                      const editable = canEditDeviceGroup(group, user?.id, admin);
                      const isExpanded = expandedGroupIds.has(group.id);

                      return (
                        <Fragment key={group.id}>
                          <tr className="hover:bg-muted/40">
                            <td className="px-4 py-3 font-medium">
                              <button
                                type="button"
                                className="flex items-center gap-2 text-left"
                                onClick={() =>
                                  toggleExpandedGroup(group.id, setExpandedGroupIds)
                                }
                              >
                                {isExpanded ? (
                                  <ChevronDown className="text-muted-foreground size-4 shrink-0" />
                                ) : (
                                  <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                                )}
                                <span>{group.name}</span>
                              </button>
                            </td>
                            <td className="text-muted-foreground max-w-xs truncate px-4 py-3">
                              {group.description || "—"}
                            </td>
                            {admin ? (
                              <td className="text-muted-foreground px-4 py-3">
                                {group.ownerUsername ?? "—"}
                              </td>
                            ) : null}
                            <td className="px-4 py-3">
                              <VisibilityBadge visibility={group.visibility} />
                            </td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                className="text-primary hover:underline"
                                onClick={() =>
                                  toggleExpandedGroup(group.id, setExpandedGroupIds)
                                }
                              >
                                {group.deviceCount}
                              </button>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={actionLoading}
                                  >
                                    <MoreHorizontal className="size-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() =>
                                      toggleExpandedGroup(group.id, setExpandedGroupIds)
                                    }
                                  >
                                    <Eye className="size-4" />
                                    {isExpanded ? "Hide devices" : "View devices"}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => setManageDevicesGroup(group)}
                                    disabled={!editable}
                                  >
                                    <Server className="size-4" />
                                    Manage devices
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => setEditGroup(group)}
                                    disabled={!editable}
                                  >
                                    <Pencil className="size-4" />
                                    Edit group
                                  </DropdownMenuItem>
                                  {editable ? <DropdownMenuSeparator /> : null}
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() => setDeleteGroupTarget(group)}
                                    disabled={!editable}
                                  >
                                    <Trash2 className="size-4" />
                                    Delete group
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                          {isExpanded ? (
                            <tr className="bg-muted/20">
                              <td colSpan={admin ? 6 : 5} className="border-t border-border/60 p-0">
                                <GroupDevicesPanel
                                  group={group}
                                  editable={editable}
                                  refreshKey={devicesRefreshKey}
                                  onManageDevices={() => setManageDevicesGroup(group)}
                                />
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-muted-foreground text-sm">
                  Showing {pageStart}-{pageEnd} of {totalElements}
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
                  <span className="text-muted-foreground text-sm">
                    Page {totalPages === 0 ? 0 : page + 1} of {totalPages}
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
            </div>
          )}
        </CardContent>
      </Card>

      <CreateGroupDialog
        open={createOpen}
        admin={admin}
        onClose={() => setCreateOpen(false)}
        onSuccess={async () => {
          setCreateOpen(false);
          setPage(0);
          await loadGroups();
        }}
      />

      <EditGroupDialog
        group={editGroup}
        admin={admin}
        onClose={() => setEditGroup(null)}
        onSuccess={async () => {
          setEditGroup(null);
          await loadGroups();
        }}
      />

      <ManageDevicesDialog
        group={manageDevicesGroup}
        onClose={() => setManageDevicesGroup(null)}
        onSuccess={async () => {
          await loadGroups();
          setDevicesRefreshKey((current) => current + 1);
        }}
      />

      <Modal
        open={!!deleteGroupTarget}
        onClose={() => setDeleteGroupTarget(null)}
        title="Delete group"
        description={
          deleteGroupTarget
            ? `This will permanently remove "${deleteGroupTarget.name}" and its device assignments.`
            : undefined
        }
      >
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setDeleteGroupTarget(null)}
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
            {actionLoading ? (
              <>
                <Loader2 className="animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete group"
            )}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function CreateGroupDialog({
  open,
  admin,
  onClose,
  onSuccess,
}: {
  open: boolean;
  admin: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<GroupFormValues>({
    defaultValues: {
      name: "",
      description: "",
      visibility: "PUBLIC",
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
  }, [open, form, admin]);

  const onSubmit = async (values: GroupFormValues) => {
    setIsSubmitting(true);

    try {
      const payload = {
        name: values.name.trim(),
        description: values.description.trim(),
        ...(admin ? { visibility: values.visibility } : {}),
      };

      await createDeviceGroup(payload);
      toast.success(`Group "${values.name.trim()}" created`);
      await onSuccess();
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
      title="Create group"
      description={
        admin
          ? "Create a shared group visible to all users, or a private group visible to the owner and admins."
          : "Create a private group visible only to you and administrators."
      }
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
                  <Input autoComplete="off" placeholder="Core switches" {...field} />
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
                  <Input
                    autoComplete="off"
                    placeholder="Optional description"
                    {...field}
                  />
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
                        <SelectValue placeholder="Select visibility" />
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

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <FolderTree className="size-4" />
                  Create group
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </Modal>
  );
}

function EditGroupDialog({
  group,
  admin,
  onClose,
  onSuccess,
}: {
  group: DeviceGroup | null;
  admin: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<GroupFormValues>({
    defaultValues: {
      name: "",
      description: "",
      visibility: "PRIVATE",
    },
  });

  useEffect(() => {
    if (!group) return;

    form.reset({
      name: group.name,
      description: group.description,
      visibility: group.visibility,
    });
  }, [group, form]);

  const onSubmit = async (values: GroupFormValues) => {
    if (!group) return;

    setIsSubmitting(true);

    try {
      const payload = {
        name: values.name.trim(),
        description: values.description.trim(),
        ...(admin ? { visibility: values.visibility } : {}),
      };

      await updateDeviceGroup(group.id, payload);
      toast.success(`Group "${values.name.trim()}" updated`);
      await onSuccess();
    } catch (error) {
      toast.error(getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={!!group}
      onClose={onClose}
      title={group ? `Edit ${group.name}` : "Edit group"}
      description="Update group name, description, and visibility."
      className="max-w-xl"
    >
      {group ? (
        <Form {...form}>
          <form className="space-y-4" noValidate onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" {...field} />
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
                    <Input autoComplete="off" {...field} />
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
                          <SelectValue placeholder="Select visibility" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="PUBLIC">Shared — visible to all users</SelectItem>
                        <SelectItem value="PRIVATE">
                          Private — owner and admins only
                        </SelectItem>
                        {group.visibility === "ADMIN_ONLY" ? (
                          <SelectItem value="ADMIN_ONLY">
                            Admin only (legacy)
                          </SelectItem>
                        ) : null}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Pencil className="size-4" />
                    Save changes
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      ) : null}
    </Modal>
  );
}

function ManageDevicesDialog({
  group,
  onClose,
  onSuccess,
}: {
  group: DeviceGroup | null;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<
    { id: number; hostname: string; ipAddress: string }[]
  >([]);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<number[]>([]);
  const [groupDevices, setGroupDevices] = useState<DeviceGroupDevice[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!group) {
      setAvailableDevices([]);
      setSelectedDeviceIds([]);
      setGroupDevices([]);
      setSearch("");
      return;
    }

    setSelectedDeviceIds([]);
    setSearch("");

    let active = true;
    setLoading(true);

    void Promise.all([fetchDeviceList(), fetchDeviceGroupDetail(group.id, 0, 1000)])
      .then(([deviceList, groupDetail]) => {
        if (!active) return;
        setAvailableDevices(deviceList.devices);
        setGroupDevices(groupDetail.devices.content);
      })
      .catch((error) => {
        if (active) {
          toast.error(getAuthErrorMessage(error));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [group]);

  const groupDeviceIds = new Set(groupDevices.map((device) => device.id));

  const addableDevices = availableDevices.filter((device) => {
    if (groupDeviceIds.has(device.id)) {
      return false;
    }

    const query = search.trim().toLowerCase();
    if (!query) {
      return true;
    }

    return (
      device.hostname.toLowerCase().includes(query) ||
      device.ipAddress.toLowerCase().includes(query)
    );
  });

  const toggleDeviceSelection = (deviceId: number, checked: boolean) => {
    setSelectedDeviceIds((current) =>
      checked
        ? [...current, deviceId]
        : current.filter((id) => id !== deviceId),
    );
  };

  const handleAddDevices = async () => {
    if (!group || selectedDeviceIds.length === 0) return;

    setSaving(true);

    try {
      await addDevicesToGroup(group.id, selectedDeviceIds);
      const detail = await fetchDeviceGroupDetail(group.id, 0, 1000);
      setGroupDevices(detail.devices.content);
      setSelectedDeviceIds([]);
      toast.success(
        `Added ${selectedDeviceIds.length} device${selectedDeviceIds.length === 1 ? "" : "s"} to group`,
      );
      await onSuccess();
    } catch (error) {
      toast.error(getAuthErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveDevice = async (device: DeviceGroupDevice) => {
    if (!group) return;

    setSaving(true);

    try {
      await removeDevicesFromGroup(group.id, [device.id]);
      const detail = await fetchDeviceGroupDetail(group.id, 0, 1000);
      setGroupDevices(detail.devices.content);
      toast.success(`Removed ${device.hostname || device.ip} from group`);
      await onSuccess();
    } catch (error) {
      toast.error(getAuthErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!group}
      onClose={onClose}
      title={group ? `Manage devices — ${group.name}` : "Manage devices"}
      description="Add or remove devices assigned to this group."
      className="max-w-2xl"
    >
      {group ? (
        <div className="space-y-6">
          <div>
            <h4 className="mb-2 text-sm font-medium">
              Devices in group ({groupDevices.length})
            </h4>
            {groupDevices.length === 0 ? (
              <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
                No devices in this group yet.
              </p>
            ) : (
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border p-3">
                {groupDevices.map((device) => (
                  <div
                    key={device.id}
                    className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {device.hostname || "Unnamed device"}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {device.ip}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="link" className="h-auto p-0 text-xs" asChild>
                        <Link to={routes.deviceDetails(String(device.id))}>View</Link>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={saving}
                        onClick={() => void handleRemoveDevice(device)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h4 className="mb-2 text-sm font-medium">Add devices</h4>
            <div className="relative mb-3">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search available devices"
                className="pl-9"
              />
            </div>

            {loading ? (
              <div className="text-muted-foreground flex min-h-32 items-center justify-center rounded-lg border border-dashed text-sm">
                Loading devices...
              </div>
            ) : addableDevices.length === 0 ? (
              <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
                {search
                  ? "No matching devices available to add."
                  : "All available devices are already in this group."}
              </p>
            ) : (
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border p-3">
                {addableDevices.map((device) => (
                  <StyledCheckbox
                    key={device.id}
                    label={`${device.hostname} (${device.ipAddress})`}
                    checked={selectedDeviceIds.includes(device.id)}
                    onChange={(event) =>
                      toggleDeviceSelection(device.id, event.target.checked)
                    }
                  />
                ))}
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button
                type="button"
                disabled={saving || selectedDeviceIds.length === 0}
                onClick={() => void handleAddDevices()}
              >
                {saving ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Plus className="size-4" />
                    Add selected ({selectedDeviceIds.length})
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

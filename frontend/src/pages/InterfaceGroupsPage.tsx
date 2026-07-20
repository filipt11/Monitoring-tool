import {
  ChevronDown,
  ChevronRight,
  Eye,
  FolderTree,
  Loader2,
  MoreHorizontal,
  Network,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation } from "react-router-dom";
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
  addInterfacesToGroup,
  canEditInterfaceGroup,
  createInterfaceGroup,
  deleteInterfaceGroup,
  fetchInterfaceGroupDetail,
  fetchInterfaceGroups,
  getVisibilityLabel,
  fetchInterfaceCatalog,
  removeInterfacesFromGroup,
  updateInterfaceGroup,
  type InterfaceGroup,
  type InterfaceGroupMember,
  type InterfaceGroupVisibility,
} from "@/lib/interfaceGroupsApi";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;
const GROUP_INTERFACE_PAGE_SIZE = 10;
const GROUP_MEMBER_FETCH_SIZE = 1000;

function matchesInterfaceSearch(iface: InterfaceGroupMember, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  return (
    iface.deviceHostname.toLowerCase().includes(normalizedQuery) ||
    iface.deviceIp.toLowerCase().includes(normalizedQuery) ||
    iface.name.toLowerCase().includes(normalizedQuery) ||
    String(iface.ifIndex).includes(normalizedQuery) ||
    iface.adminStatus.toLowerCase().includes(normalizedQuery) ||
    iface.operStatus.toLowerCase().includes(normalizedQuery)
  );
}

type GroupFilter = "all" | "mine" | "shared";

interface GroupFormValues {
  name: string;
  description: string;
  visibility: InterfaceGroupVisibility;
}

function VisibilityBadge({ visibility }: { visibility: InterfaceGroupVisibility }) {
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
  group: InterfaceGroup,
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

function GroupInterfacesPanel({
  group,
  editable,
  onManageInterfaces,
  refreshKey,
  onInterfaceCountChange,
}: {
  group: InterfaceGroup;
  editable: boolean;
  onManageInterfaces: () => void;
  refreshKey: number;
  onInterfaceCountChange?: (groupId: number, interfaceCount: number) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [interfaces, setInterfaces] = useState<InterfaceGroupMember[]>([]);
  const [totalElements, setTotalElements] = useState(group.interfaceCount);

  useEffect(() => {
    setPage(0);
    setSearchInput("");
  }, [group.id, refreshKey]);

  useEffect(() => {
    setPage(0);
  }, [searchInput]);

  useEffect(() => {
    let active = true;
    setLoading(true);

    const fetchSize = Math.max(group.interfaceCount, GROUP_MEMBER_FETCH_SIZE);

    void fetchInterfaceGroupDetail(group.id, 0, fetchSize)
      .then((detail) => {
        if (!active) return;
        setInterfaces(detail.interfaces.content);
        setTotalElements(detail.interfaces.totalElements);
        onInterfaceCountChange?.(group.id, detail.interfaces.totalElements);
      })
      .catch((error) => {
        if (active) {
          toast.error(getAuthErrorMessage(error));
          setInterfaces([]);
          setTotalElements(0);
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
  }, [group.id, group.interfaceCount, refreshKey, onInterfaceCountChange]);

  const filteredInterfaces = useMemo(
    () => interfaces.filter((iface) => matchesInterfaceSearch(iface, searchInput)),
    [interfaces, searchInput],
  );
  const filteredTotal = filteredInterfaces.length;
  const totalPages =
    filteredTotal === 0 ? 0 : Math.ceil(filteredTotal / GROUP_INTERFACE_PAGE_SIZE);
  const visibleInterfaces = filteredInterfaces.slice(
    page * GROUP_INTERFACE_PAGE_SIZE,
    page * GROUP_INTERFACE_PAGE_SIZE + GROUP_INTERFACE_PAGE_SIZE,
  );
  const pageStart = filteredTotal === 0 ? 0 : page * GROUP_INTERFACE_PAGE_SIZE + 1;
  const pageEnd = Math.min((page + 1) * GROUP_INTERFACE_PAGE_SIZE, filteredTotal);

  if (loading) {
    return (
      <div className="text-muted-foreground flex min-h-24 items-center justify-center px-4 py-3 text-sm">
        Loading interfaces...
      </div>
    );
  }

  if (totalElements === 0) {
    return (
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm">No interfaces in this group.</p>
        {editable ? (
          <Button type="button" variant="outline" size="sm" onClick={onManageInterfaces}>
            <Plus className="size-4" />
            Add interfaces
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3 px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Interfaces in {group.name} ({totalElements})
        </p>
        {editable ? (
          <Button type="button" variant="outline" size="sm" onClick={onManageInterfaces}>
            <Network className="size-4" />
            Manage interfaces
          </Button>
        ) : (
          <p className="text-muted-foreground text-xs">Read-only shared group</p>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search by device, IP, interface, or status"
          className="h-9 pl-9"
        />
      </div>

      {filteredTotal === 0 ? (
        <div className="text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-center text-sm">
          No interfaces match your search.
        </div>
      ) : (
      <div className="overflow-x-auto rounded-lg border bg-background/60">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Device</th>
              <th className="px-3 py-2 text-left font-medium">IP address</th>
              <th className="px-3 py-2 text-left font-medium">Interface</th>
              <th className="px-3 py-2 text-left font-medium">Index</th>
              <th className="px-3 py-2 text-left font-medium">Admin</th>
              <th className="px-3 py-2 text-left font-medium">Oper</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visibleInterfaces.map((iface) => (
              <tr key={iface.id} className="hover:bg-muted/30">
                <td className="px-3 py-2 font-medium">
                  <Link
                    to={routes.deviceDetails(String(iface.deviceId))}
                    className="text-primary hover:underline"
                  >
                    {iface.deviceHostname || "Unknown device"}
                  </Link>
                </td>
                <td className="text-muted-foreground px-3 py-2">{iface.deviceIp}</td>
                <td className="px-3 py-2 font-medium">{iface.name}</td>
                <td className="text-muted-foreground px-3 py-2">{iface.ifIndex}</td>
                <td className="text-muted-foreground px-3 py-2">{iface.adminStatus}</td>
                <td className="text-muted-foreground px-3 py-2">{iface.operStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {filteredTotal > GROUP_INTERFACE_PAGE_SIZE ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-xs">
            Showing {pageStart}-{pageEnd} of {filteredTotal} interfaces
            {searchInput.trim() ? ` (filtered from ${totalElements})` : ""}
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

export function InterfaceGroupsPage() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const location = useLocation();

  const [groups, setGroups] = useState<InterfaceGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [groupFilter, setGroupFilter] = useState<GroupFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<InterfaceGroup | null>(null);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<InterfaceGroup | null>(null);
  const [manageInterfacesGroup, setManageInterfacesGroup] = useState<InterfaceGroup | null>(null);
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<number>>(() => new Set());
  const [interfacesRefreshKey, setInterfacesRefreshKey] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);

  const loadGroups = useCallback(async () => {
    setLoading(true);

    try {
      const result = await fetchInterfaceGroups();
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
  }, [loadGroups, location.key]);

  const handleInterfaceCountChange = useCallback((groupId: number, interfaceCount: number) => {
    setGroups((current) =>
      current.map((group) =>
        group.id === groupId ? { ...group, interfaceCount } : group,
      ),
    );
  }, []);

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
      await deleteInterfaceGroup(deleteGroupTarget.id);
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
          <h2 className="text-2xl font-semibold tracking-tight">Interface Groups</h2>
          <p className="text-muted-foreground max-w-2xl text-sm">
            Organize interfaces into groups for dashboards and monitoring views.
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
                      <th className="px-4 py-3 text-left font-medium">Interfaces</th>
                      <th className="px-4 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-background/80">
                    {pageGroups.map((group) => {
                      const editable = canEditInterfaceGroup(group, user?.id, admin);
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
                                {group.interfaceCount}
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
                                    {isExpanded ? "Hide interfaces" : "View interfaces"}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => setManageInterfacesGroup(group)}
                                    disabled={!editable}
                                  >
                                    <Network className="size-4" />
                                    Manage interfaces
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
                                <GroupInterfacesPanel
                                  group={group}
                                  editable={editable}
                                  refreshKey={interfacesRefreshKey}
                                  onManageInterfaces={() => setManageInterfacesGroup(group)}
                                  onInterfaceCountChange={handleInterfaceCountChange}
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

      <ManageInterfacesDialog
        group={manageInterfacesGroup}
        onClose={() => setManageInterfacesGroup(null)}
        onSuccess={async () => {
          await loadGroups();
          setInterfacesRefreshKey((current) => current + 1);
        }}
      />

      <Modal
        open={!!deleteGroupTarget}
        onClose={() => setDeleteGroupTarget(null)}
        title="Delete group"
        description={
          deleteGroupTarget
            ? `This will permanently remove "${deleteGroupTarget.name}" and its interface assignments.`
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

      await createInterfaceGroup(payload);
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
  group: InterfaceGroup | null;
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

      await updateInterfaceGroup(group.id, payload);
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

function ManageInterfacesDialog({
  group,
  onClose,
  onSuccess,
}: {
  group: InterfaceGroup | null;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [availableInterfaces, setAvailableInterfaces] = useState<InterfaceGroupMember[]>([]);
  const [selectedInterfaceIds, setSelectedInterfaceIds] = useState<number[]>([]);
  const [groupInterfaces, setGroupInterfaces] = useState<InterfaceGroupMember[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!group) {
      setAvailableInterfaces([]);
      setSelectedInterfaceIds([]);
      setGroupInterfaces([]);
      setSearch("");
      return;
    }

    setSelectedInterfaceIds([]);
    setSearch("");

    let active = true;
    setLoading(true);

    void Promise.all([fetchInterfaceCatalog(), fetchInterfaceGroupDetail(group.id, 0, 1000)])
      .then(([catalog, groupDetail]) => {
        if (!active) return;
        setAvailableInterfaces(catalog.content);
        setGroupInterfaces(groupDetail.interfaces.content);
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

  const groupInterfaceIds = new Set(groupInterfaces.map((iface) => iface.id));

  const addableInterfaces = availableInterfaces.filter((iface) => {
    if (groupInterfaceIds.has(iface.id)) {
      return false;
    }

    const query = search.trim().toLowerCase();
    if (!query) {
      return true;
    }

    return (
      iface.deviceHostname.toLowerCase().includes(query) ||
      iface.deviceIp.toLowerCase().includes(query) ||
      iface.name.toLowerCase().includes(query)
    );
  });

  const toggleInterfaceSelection = (interfaceId: number, checked: boolean) => {
    setSelectedInterfaceIds((current) =>
      checked
        ? [...current, interfaceId]
        : current.filter((id) => id !== interfaceId),
    );
  };

  const handleAddInterfaces = async () => {
    if (!group || selectedInterfaceIds.length === 0) return;

    setSaving(true);

    try {
      await addInterfacesToGroup(group.id, selectedInterfaceIds);
      const detail = await fetchInterfaceGroupDetail(group.id, 0, 1000);
      setGroupInterfaces(detail.interfaces.content);
      setSelectedInterfaceIds([]);
      toast.success(
        `Added ${selectedInterfaceIds.length} interface${selectedInterfaceIds.length === 1 ? "" : "s"} to group`,
      );
      await onSuccess();
    } catch (error) {
      toast.error(getAuthErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveInterface = async (iface: InterfaceGroupMember) => {
    if (!group) return;

    setSaving(true);

    try {
      await removeInterfacesFromGroup(group.id, [iface.id]);
      const detail = await fetchInterfaceGroupDetail(group.id, 0, 1000);
      setGroupInterfaces(detail.interfaces.content);
      toast.success(`Removed ${iface.deviceHostname} — ${iface.name} from group`);
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
      title={group ? `Manage interfaces — ${group.name}` : "Manage interfaces"}
      description="Add or remove interfaces assigned to this group."
      className="max-w-2xl"
    >
      {group ? (
        <div className="space-y-6">
          <div>
            <h4 className="mb-2 text-sm font-medium">
              Interfaces in group ({groupInterfaces.length})
            </h4>
            {groupInterfaces.length === 0 ? (
              <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
                No interfaces in this group yet.
              </p>
            ) : (
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border p-3">
                {groupInterfaces.map((iface) => (
                  <div
                    key={iface.id}
                    className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {iface.deviceHostname} — {iface.name}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {iface.deviceIp} · ifIndex {iface.ifIndex}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="link" className="h-auto p-0 text-xs" asChild>
                        <Link to={routes.deviceDetails(String(iface.deviceId))}>View device</Link>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={saving}
                        onClick={() => void handleRemoveInterface(iface)}
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
            <h4 className="mb-2 text-sm font-medium">Add interfaces</h4>
            <div className="relative mb-3">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by device or interface name"
                className="pl-9"
              />
            </div>

            {loading ? (
              <div className="text-muted-foreground flex min-h-32 items-center justify-center rounded-lg border border-dashed text-sm">
                Loading interfaces...
              </div>
            ) : addableInterfaces.length === 0 ? (
              <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
                {search
                  ? "No matching interfaces available to add."
                  : "All available interfaces are already in this group."}
              </p>
            ) : (
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border p-3">
                {addableInterfaces.map((iface) => (
                  <StyledCheckbox
                    key={iface.id}
                    label={`${iface.deviceHostname} — ${iface.name} (${iface.deviceIp})`}
                    checked={selectedInterfaceIds.includes(iface.id)}
                    onChange={(event) =>
                      toggleInterfaceSelection(iface.id, event.target.checked)
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
                disabled={saving || selectedInterfaceIds.length === 0}
                onClick={() => void handleAddInterfaces()}
              >
                {saving ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Plus className="size-4" />
                    Add selected ({selectedInterfaceIds.length})
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

import {
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Server,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
import { getAuthErrorMessage } from "@/contexts/AuthContext";
import {
  createAdminDevice,
  deleteAdminDevice,
  fetchAdminDevice,
  fetchAdminDevices,
  rediscoverAdminDevice,
  searchAdminDevices,
  updateAdminDevice,
  type AdminDevice,
} from "@/lib/adminDevicesApi";
import type {
  CreateDeviceFormValues,
  UpdateDeviceFormValues,
} from "@/lib/validations/adminDevices";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

function HttpsBadge({ https }: { https: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        https
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          : "border-slate-500/30 bg-slate-500/10 text-slate-300",
      )}
    >
      {https ? "HTTPS" : "HTTP"}
    </span>
  );
}

function parsePort(value: string) {
  return Number.parseInt(value, 10);
}

export function AdminManageDevicesPage() {
  const [devices, setDevices] = useState<AdminDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editDevice, setEditDevice] = useState<AdminDevice | null>(null);
  const [deleteDevice, setDeleteDevice] = useState<AdminDevice | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(0);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const loadDevices = useCallback(async () => {
    setLoading(true);

    try {
      const result = searchQuery
        ? await searchAdminDevices(searchQuery, page, PAGE_SIZE)
        : await fetchAdminDevices(page, PAGE_SIZE);

      setDevices(result.content);
      setTotalPages(result.totalPages);
      setTotalElements(result.totalElements);
    } catch (error) {
      toast.error(getAuthErrorMessage(error));
      setDevices([]);
      setTotalPages(0);
      setTotalElements(0);
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery]);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  const handleRediscover = async (device: AdminDevice) => {
    setActionLoading(true);

    try {
      await rediscoverAdminDevice(device.id);
      toast.success(`Rediscovery triggered for ${device.hostname || device.ip}`);
      await loadDevices();
    } catch (error) {
      toast.error(getAuthErrorMessage(error));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDevice) return;

    setActionLoading(true);

    try {
      await deleteAdminDevice(deleteDevice.id);
      toast.success(`${deleteDevice.hostname || deleteDevice.ip} has been deleted`);
      setDeleteDevice(null);

      if (devices.length === 1 && page > 0) {
        setPage((current) => current - 1);
      } else {
        await loadDevices();
      }
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
          <h2 className="text-2xl font-semibold tracking-tight">Manage Devices</h2>
          <p className="text-muted-foreground max-w-2xl text-sm">
            Add, update, rediscover, and remove monitored devices. Changes are
            sent through the application server to the poller service.
          </p>
        </div>

        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Add device
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>All devices</CardTitle>
              <CardDescription>
                {totalElements} device{totalElements === 1 ? "" : "s"} total
              </CardDescription>
            </div>

            <div className="relative w-full lg:max-w-sm">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by hostname or IP"
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="text-muted-foreground flex min-h-48 items-center justify-center rounded-lg border border-dashed text-sm">
              Loading devices...
            </div>
          ) : devices.length === 0 ? (
            <div className="text-muted-foreground flex min-h-48 items-center justify-center rounded-lg border border-dashed text-sm">
              {searchQuery ? "No devices match your search." : "No devices found."}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-lg border">
                <table className="min-w-full divide-y divide-border text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Hostname</th>
                      <th className="px-4 py-3 text-left font-medium">IP address</th>
                      <th className="px-4 py-3 text-left font-medium">Vendor</th>
                      <th className="px-4 py-3 text-left font-medium">Model</th>
                      <th className="px-4 py-3 text-left font-medium">Port</th>
                      <th className="px-4 py-3 text-left font-medium">Protocol</th>
                      <th className="px-4 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-background/80">
                    {devices.map((device) => (
                      <tr key={device.id} className="hover:bg-muted/40">
                        <td className="px-4 py-3 font-medium">
                          <Button variant="link" className="h-auto p-0 text-sm" asChild>
                            <Link to={`/dashboard/devices/${device.id}`}>
                              {device.hostname || "Unnamed device"}
                            </Link>
                          </Button>
                        </td>
                        <td className="text-muted-foreground px-4 py-3">{device.ip}</td>
                        <td className="text-muted-foreground px-4 py-3">
                          {device.vendor || "—"}
                        </td>
                        <td className="text-muted-foreground px-4 py-3">
                          {device.model || "—"}
                        </td>
                        <td className="px-4 py-3">{device.port}</td>
                        <td className="px-4 py-3">
                          <HttpsBadge https={device.https} />
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
                              <DropdownMenuItem onClick={() => setEditDevice(device)}>
                                <Pencil className="size-4" />
                                Edit device
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => void handleRediscover(device)}
                              >
                                <RefreshCw className="size-4" />
                                Rediscover
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => setDeleteDevice(device)}
                              >
                                <Trash2 className="size-4" />
                                Delete device
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
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

      <CreateDeviceDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={async () => {
          setCreateOpen(false);
          setPage(0);
          await loadDevices();
        }}
      />

      <EditDeviceDialog
        device={editDevice}
        onClose={() => setEditDevice(null)}
        onSuccess={async () => {
          setEditDevice(null);
          await loadDevices();
        }}
      />

      <Modal
        open={!!deleteDevice}
        onClose={() => setDeleteDevice(null)}
        title="Delete device"
        description={
          deleteDevice
            ? `This will permanently remove ${deleteDevice.hostname || deleteDevice.ip} from monitoring.`
            : undefined
        }
      >
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setDeleteDevice(null)}
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
              "Delete device"
            )}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function CreateDeviceDialog({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CreateDeviceFormValues>({
    defaultValues: {
      ip: "",
      vendor: "",
      username: "",
      password: "",
      port: "443",
      https: true,
    },
  });

  useEffect(() => {
    if (!open) {
      form.reset({
        ip: "",
        vendor: "",
        username: "",
        password: "",
        port: "443",
        https: true,
      });
    }
  }, [open, form]);

  const onSubmit = async (values: CreateDeviceFormValues) => {
    setIsSubmitting(true);

    try {
      await createAdminDevice({
        ip: values.ip.trim(),
        vendor: values.vendor.trim(),
        username: values.username.trim(),
        password: values.password,
        port: parsePort(values.port),
        https: values.https,
      });
      toast.success(`Device ${values.ip.trim()} added`);
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
      title="Add device"
      description="Register a new device for monitoring via the poller."
      className="max-w-xl"
    >
      <Form {...form}>
        <form className="space-y-4" noValidate onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="ip"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>IP address</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" placeholder="192.168.1.1" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="vendor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vendor</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" placeholder="cisco" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" placeholder="admin" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="text" autoComplete="off" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="port"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Port</FormLabel>
                  <FormControl>
                    <Input type="text" inputMode="numeric" autoComplete="off" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="https"
              render={({ field }) => (
                <FormItem className="pt-8">
                  <FormControl>
                    <StyledCheckbox
                      label="Use HTTPS"
                      checked={field.value}
                      onChange={(event) => field.onChange(event.target.checked)}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Server className="size-4" />
                  Add device
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </Modal>
  );
}

function EditDeviceDialog({
  device,
  onClose,
  onSuccess,
}: {
  device: AdminDevice | null;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const form = useForm<UpdateDeviceFormValues>({
    defaultValues: {
      port: "443",
      https: true,
      username: "",
      password: "",
    },
  });

  useEffect(() => {
    if (!device) {
      return;
    }

    let active = true;
    setIsLoadingDetails(true);

    void fetchAdminDevice(device.id)
      .then((details) => {
        if (!active) return;

        form.reset({
          port: String(details.port),
          https: details.https,
          username: details.username,
          password: details.password,
        });
      })
      .catch((error) => {
        if (active) {
          toast.error(getAuthErrorMessage(error));
          form.reset({
            port: String(device.port),
            https: device.https,
            username: "",
            password: "",
          });
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingDetails(false);
        }
      });

    return () => {
      active = false;
    };
  }, [device, form]);

  const onSubmit = async (values: UpdateDeviceFormValues) => {
    if (!device) return;

    setIsSubmitting(true);

    try {
      await updateAdminDevice(device.id, {
        port: parsePort(values.port),
        https: values.https,
        username: values.username.trim(),
        password: values.password,
      });
      toast.success(`Device ${device.hostname || device.ip} updated`);
      await onSuccess();
    } catch (error) {
      toast.error(getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={!!device}
      onClose={onClose}
      title={device ? `Edit ${device.hostname || device.ip}` : "Edit device"}
      description="Update connection settings and credentials."
      className="max-w-xl"
    >
      {device ? (
        isLoadingDetails ? (
          <div className="text-muted-foreground flex min-h-48 items-center justify-center text-sm">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Loading device credentials...
          </div>
        ) : (
          <Form {...form}>
            <form className="space-y-4" noValidate onSubmit={form.handleSubmit(onSubmit)}>
              <div className="rounded-lg border p-4 text-sm">
                <p className="text-muted-foreground">
                  <span className="text-foreground font-medium">IP:</span> {device.ip}
                </p>
                <p className="text-muted-foreground mt-1">
                  <span className="text-foreground font-medium">Vendor:</span>{" "}
                  {device.vendor || "—"}
                </p>
                <p className="text-muted-foreground mt-1">
                  <span className="text-foreground font-medium">Model:</span>{" "}
                  {device.model || "—"}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="port"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Port</FormLabel>
                      <FormControl>
                        <Input type="text" inputMode="numeric" autoComplete="off" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="https"
                  render={({ field }) => (
                    <FormItem className="pt-8">
                      <FormControl>
                        <StyledCheckbox
                          label="Use HTTPS"
                          checked={field.value}
                          onChange={(event) => field.onChange(event.target.checked)}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input type="text" autoComplete="off" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="text" autoComplete="off" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

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
        )
      ) : null}
    </Modal>
  );
}

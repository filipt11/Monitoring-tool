import {
  KeyRound,
  Loader2,
  Mail,
  MoreHorizontal,
  Plus,
  Search,
  Shield,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Modal } from "@/components/admin/Modal";
import { PasswordRequirementsHint } from "@/components/admin/PasswordRequirementsHint";
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
import { getAuthErrorMessage, useAuth } from "@/contexts/AuthContext";
import {
  createAdminUser,
  deleteAdminUser,
  disableAdminUser,
  enableAdminUser,
  fetchAdminUsers,
  formatUserRole,
  isProtectedAdminAccount,
  resetAdminUserPassword,
  searchAdminUsers,
  updateAdminUserEmail,
  type AdminUser,
} from "@/lib/adminUsersApi";
import type {
  CreateAdminUserFormValues,
  ResetAdminUserPasswordFormValues,
  UpdateAdminUserEmailFormValues,
} from "@/lib/validations/adminUsers";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

function RoleBadge({ role }: { role: string }) {
  const isAdmin = role === "ROLE_ADMIN";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium",
        isAdmin
          ? "border-violet-500/30 bg-violet-500/10 text-violet-300"
          : "border-sky-500/30 bg-sky-500/10 text-sky-300",
      )}
    >
      {isAdmin ? <Shield className="size-3" /> : null}
      {formatUserRole(role)}
    </span>
  );
}

function StatusBadge({ isBanned }: { isBanned: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        isBanned
          ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
      )}
    >
      {isBanned ? "Disabled" : "Active"}
    </span>
  );
}

export function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(0);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const loadUsers = useCallback(async () => {
    setLoading(true);

    try {
      const result = searchQuery
        ? await searchAdminUsers(searchQuery, page, PAGE_SIZE)
        : await fetchAdminUsers(page, PAGE_SIZE);

      setUsers(result.content);
      setTotalPages(result.totalPages);
      setTotalElements(result.totalElements);
    } catch (error) {
      toast.error(getAuthErrorMessage(error));
      setUsers([]);
      setTotalPages(0);
      setTotalElements(0);
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const handleToggleDisabled = async (targetUser: AdminUser) => {
    setActionLoading(true);

    try {
      if (targetUser.isBanned) {
        await enableAdminUser(targetUser.id);
        toast.success(`${targetUser.username} has been enabled`);
      } else {
        await disableAdminUser(targetUser.id);
        toast.success(`${targetUser.username} has been disabled`);
      }

      await loadUsers();
    } catch (error) {
      toast.error(getAuthErrorMessage(error));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteUser) return;

    setActionLoading(true);

    try {
      await deleteAdminUser(deleteUser.id);
      toast.success(`${deleteUser.username} has been deleted`);
      setDeleteUser(null);

      if (users.length === 1 && page > 0) {
        setPage((current) => current - 1);
      } else {
        await loadUsers();
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
          <h2 className="text-2xl font-semibold tracking-tight">Users</h2>
          <p className="text-muted-foreground max-w-2xl text-sm">
            Create, update, disable, and delete user accounts. Password and email
            changes use the administration endpoints from the backend.
          </p>
        </div>

        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Create user
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>All users</CardTitle>
              <CardDescription>
                {totalElements} user{totalElements === 1 ? "" : "s"} total
              </CardDescription>
            </div>

            <div className="relative w-full lg:max-w-sm">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by username"
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="text-muted-foreground flex min-h-48 items-center justify-center rounded-lg border border-dashed text-sm">
              Loading users...
            </div>
          ) : users.length === 0 ? (
            <div className="text-muted-foreground flex min-h-48 items-center justify-center rounded-lg border border-dashed text-sm">
              {searchQuery
                ? "No users match your search."
                : "No users found."}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-lg border">
                <table className="min-w-full divide-y divide-border text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Username</th>
                      <th className="px-4 py-3 text-left font-medium">Email</th>
                      <th className="px-4 py-3 text-left font-medium">Role</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-background/80">
                    {users.map((entry) => {
                      const isSelf = entry.id === currentUser?.id;
                      const isProtected = isProtectedAdminAccount(entry);

                      return (
                        <tr key={entry.id} className="hover:bg-muted/40">
                          <td className="px-4 py-3 font-medium">
                            {entry.username}
                            {isSelf ? (
                              <span className="text-muted-foreground ml-2 text-xs">
                                (you)
                              </span>
                            ) : null}
                          </td>
                          <td className="text-muted-foreground px-4 py-3">
                            {entry.email}
                          </td>
                          <td className="px-4 py-3">
                            <RoleBadge role={entry.role} />
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge isBanned={entry.isBanned} />
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
                                <DropdownMenuItem onClick={() => setEditUser(entry)}>
                                  <Mail className="size-4" />
                                  Edit user
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => void handleToggleDisabled(entry)}
                                  disabled={isProtected}
                                >
                                  {entry.isBanned ? (
                                    <>
                                      <UserCheck className="size-4" />
                                      Enable user
                                    </>
                                  ) : (
                                    <>
                                      <UserX className="size-4" />
                                      Disable user
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  disabled={isProtected || isSelf}
                                  onClick={() => setDeleteUser(entry)}
                                >
                                  <Trash2 className="size-4" />
                                  Delete user
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
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
                      setPage((current) =>
                        Math.min(totalPages - 1, current + 1),
                      )
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

      <CreateUserDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={async () => {
          setCreateOpen(false);
          setPage(0);
          await loadUsers();
        }}
      />

      <EditUserDialog
        user={editUser}
        onClose={() => setEditUser(null)}
        onSuccess={async () => {
          setEditUser(null);
          await loadUsers();
        }}
      />

      <Modal
        open={!!deleteUser}
        onClose={() => setDeleteUser(null)}
        title="Delete user"
        description={
          deleteUser
            ? `This will permanently remove ${deleteUser.username}. This action cannot be undone.`
            : undefined
        }
      >
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setDeleteUser(null)}
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
              "Delete user"
            )}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function CreateUserDialog({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CreateAdminUserFormValues>({
    defaultValues: {
      username: "",
      email: "",
      password: "",
      password2: "",
      role: "user",
    },
  });

  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  const onSubmit = async (values: CreateAdminUserFormValues) => {
    setIsSubmitting(true);

    try {
      await createAdminUser(values);
      toast.success(`User ${values.username} created`);
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
      title="Create user"
      description="Add a new account with admin or user role."
    >
      <Form {...form}>
        <form
          className="space-y-4"
          noValidate
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input autoComplete="off" placeholder="monitoring-user" {...field} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    autoComplete="off"
                    placeholder="user@company.com"
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
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
                  <Input type="password" autoComplete="new-password" {...field} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password2"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm password</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="new-password" {...field} />
                </FormControl>
              </FormItem>
            )}
          />

          <PasswordRequirementsHint />

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
                  <UserPlus className="size-4" />
                  Create user
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </Modal>
  );
}

function EditUserDialog({
  user,
  onClose,
  onSuccess,
}: {
  user: AdminUser | null;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}) {
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  const emailForm = useForm<UpdateAdminUserEmailFormValues>({
    defaultValues: { email: "" },
  });

  const passwordForm = useForm<ResetAdminUserPasswordFormValues>({
    defaultValues: { password: "" },
  });

  useEffect(() => {
    if (user) {
      emailForm.reset({ email: user.email });
      passwordForm.reset({ password: "" });
    }
  }, [user, emailForm, passwordForm]);

  const onSubmitEmail = async (values: UpdateAdminUserEmailFormValues) => {
    if (!user) return;

    setIsSubmittingEmail(true);

    try {
      await updateAdminUserEmail(user.id, values.email);
      toast.success(`Email updated for ${user.username}`);
      await onSuccess();
    } catch (error) {
      toast.error(getAuthErrorMessage(error));
    } finally {
      setIsSubmittingEmail(false);
    }
  };

  const onSubmitPassword = async (values: ResetAdminUserPasswordFormValues) => {
    if (!user) return;

    setIsSubmittingPassword(true);

    try {
      await resetAdminUserPassword(user.id, values.password);
      toast.success(`Password reset for ${user.username}`);
      passwordForm.reset({ password: "" });
    } catch (error) {
      toast.error(getAuthErrorMessage(error));
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  return (
    <Modal
      open={!!user}
      onClose={onClose}
      title={user ? `Edit ${user.username}` : "Edit user"}
      description="Update email or reset the user's password."
      className="max-w-xl"
    >
      {user ? (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <RoleBadge role={user.role} />
            <StatusBadge isBanned={user.isBanned} />
          </div>

          <div className="space-y-4 rounded-lg border p-4">
            <div>
              <h4 className="text-sm font-medium">Email address</h4>
              <p className="text-muted-foreground text-sm">
                Change the email address associated with this account.
              </p>
            </div>

            <Form {...emailForm}>
              <form
                className="space-y-4"
                noValidate
                onSubmit={emailForm.handleSubmit(onSubmitEmail)}
              >
                <FormField
                  control={emailForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="text" autoComplete="off" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="flex justify-end">
                  <Button type="submit" disabled={isSubmittingEmail}>
                    {isSubmittingEmail ? (
                      <>
                        <Loader2 className="animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Mail className="size-4" />
                        Save email
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </div>

          <div className="space-y-4 rounded-lg border p-4">
            <div>
              <h4 className="text-sm font-medium">Reset password</h4>
              <p className="text-muted-foreground text-sm">
                Sets a new password without requiring the current one.
              </p>
            </div>

            <Form {...passwordForm}>
              <form
                className="space-y-4"
                noValidate
                onSubmit={passwordForm.handleSubmit(onSubmitPassword)}
              >
                <FormField
                  control={passwordForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New password</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="new-password" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <PasswordRequirementsHint />

                <div className="flex justify-end">
                  <Button type="submit" disabled={isSubmittingPassword}>
                    {isSubmittingPassword ? (
                      <>
                        <Loader2 className="animate-spin" />
                        Resetting...
                      </>
                    ) : (
                      <>
                        <KeyRound className="size-4" />
                        Reset password
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

import { apiFetch } from "@/api/client";

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  role: string;
  isBanned: boolean;
}

interface AdminUserResponseDto {
  id: number;
  username: string;
  email: string;
  role: string;
  isBanned?: boolean;
  banned?: boolean;
}

export interface AdminUsersPageResult {
  content: AdminUser[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

interface SpringPageMetadata {
  size?: number;
  number?: number;
  totalElements?: number;
  totalPages?: number;
}

interface SpringPageResponse<T> {
  content?: T[];
  page?: SpringPageMetadata;
  totalElements?: number;
  totalPages?: number;
  number?: number;
  size?: number;
}

function normalizeUser(dto: AdminUserResponseDto): AdminUser {
  return {
    id: dto.id,
    username: dto.username,
    email: dto.email,
    role: dto.role,
    isBanned: dto.isBanned ?? dto.banned ?? false,
  };
}

function normalizePage(
  response: SpringPageResponse<AdminUserResponseDto>,
): AdminUsersPageResult {
  const content = response.content ?? [];
  const metadata = response.page ?? response;
  const size = metadata.size ?? content.length;
  const totalElements = metadata.totalElements ?? content.length;
  const totalPages =
    metadata.totalPages ??
    (totalElements === 0 ? 0 : Math.max(1, Math.ceil(totalElements / Math.max(size, 1))));

  return {
    content: content.map(normalizeUser),
    totalElements,
    totalPages,
    number: metadata.number ?? 0,
    size,
  };
}

function buildPageQuery(page: number, size: number) {
  return new URLSearchParams({
    page: String(page),
    size: String(size),
    sort: "username,asc",
  });
}

export async function fetchAdminUsers(page = 0, size = 10) {
  const query = buildPageQuery(page, size);
  const response = await apiFetch<SpringPageResponse<AdminUserResponseDto>>(
    `/administration/api/users?${query.toString()}`,
  );
  return normalizePage(response);
}

export async function searchAdminUsers(username: string, page = 0, size = 10) {
  const query = buildPageQuery(page, size);
  query.set("username", username);
  const response = await apiFetch<SpringPageResponse<AdminUserResponseDto>>(
    `/administration/api/users/search?${query.toString()}`,
  );
  return normalizePage(response);
}

export async function createAdminUser(payload: {
  username: string;
  email: string;
  password: string;
  password2: string;
  role: "admin" | "user";
}) {
  const response = await apiFetch<AdminUserResponseDto>(
    "/administration/api/users",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
  return normalizeUser(response);
}

export async function updateAdminUserEmail(id: number, email: string) {
  const response = await apiFetch<AdminUserResponseDto>(
    `/api/users/update/email/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify({ email }),
    },
  );
  return normalizeUser(response);
}

export async function resetAdminUserPassword(id: number, password: string) {
  const response = await apiFetch<AdminUserResponseDto>(
    `/administration/users/update/password/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify({ password }),
    },
  );
  return normalizeUser(response);
}

export async function deleteAdminUser(id: number) {
  return apiFetch<{ message: string }>(`/api/users/${id}`, {
    method: "DELETE",
  });
}

export async function disableAdminUser(id: number) {
  const response = await apiFetch<AdminUserResponseDto>(
    `/administration/api/user/disable/${id}`,
    {
      method: "POST",
    },
  );
  return normalizeUser(response);
}

export async function enableAdminUser(id: number) {
  const response = await apiFetch<AdminUserResponseDto>(
    `/administration/api/user/enable/${id}`,
    {
      method: "POST",
    },
  );
  return normalizeUser(response);
}

export function formatUserRole(role: string) {
  if (role === "ROLE_ADMIN") return "Admin";
  if (role === "ROLE_USER") return "User";
  return role;
}

export function isProtectedAdminAccount(user: AdminUser) {
  return user.username === "admin";
}

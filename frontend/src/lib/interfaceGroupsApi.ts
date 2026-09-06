import { apiFetch } from "@/api/client";
import {
  buildPageQuery,
  normalizeSpringPage,
  type PaginatedResult,
  type SpringPageResponse,
} from "@/lib/springPage";

export type InterfaceGroupVisibility = "PUBLIC" | "ADMIN_ONLY" | "PRIVATE";

export interface InterfaceGroupMember {
  id: number;
  deviceId: number;
  deviceHostname: string;
  deviceIp: string;
  name: string;
  ifIndex: number;
  mac: string | null;
  speedBps: number | null;
  adminStatus: string;
  operStatus: string;
  discoveredAt: string | null;
}

export interface InterfaceGroup {
  id: number;
  name: string;
  description: string;
  visibility: InterfaceGroupVisibility;
  ownerId: number | null;
  ownerUsername: string | null;
  interfaceCount: number;
}

export interface InterfaceGroupDetail extends InterfaceGroup {
  interfaces: PaginatedResult<InterfaceGroupMember>;
}

export interface InterfaceGroupPayload {
  name: string;
  description: string;
  visibility?: InterfaceGroupVisibility;
}

interface InterfaceGroupDetailResponse {
  id: number;
  name: string;
  description: string;
  visibility: InterfaceGroupVisibility;
  ownerId: number | null;
  ownerUsername: string | null;
  interfaces: SpringPageResponse<InterfaceGroupMember>;
}

function normalizeInterfaceGroupMember(dto: InterfaceGroupMember): InterfaceGroupMember {
  return {
    id: dto.id,
    deviceId: dto.deviceId,
    deviceHostname: dto.deviceHostname,
    deviceIp: dto.deviceIp,
    name: dto.name,
    ifIndex: dto.ifIndex,
    mac: dto.mac ?? null,
    speedBps: dto.speedBps ?? null,
    adminStatus: dto.adminStatus,
    operStatus: dto.operStatus,
    discoveredAt: dto.discoveredAt ?? null,
  };
}

function normalizeInterfaceGroup(
  dto: InterfaceGroup & { interfaces?: InterfaceGroupMember[] },
): InterfaceGroup {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description ?? "",
    visibility: dto.visibility,
    ownerId: dto.ownerId ?? null,
    ownerUsername: dto.ownerUsername ?? null,
    interfaceCount: dto.interfaceCount ?? dto.interfaces?.length ?? 0,
  };
}

export async function fetchInterfaceGroups(page = 0, size = 1000) {
  const query = buildPageQuery(page, size, "name,asc");
  const response = await apiFetch<SpringPageResponse<InterfaceGroup>>(
    `/api/interface-group?${query.toString()}`,
  );
  return normalizeSpringPage(response, normalizeInterfaceGroup);
}

export async function fetchInterfaceGroupDetail(groupId: number, page = 0, size = 10) {
  const query = buildPageQuery(page, size, "name,asc");
  const response = await apiFetch<InterfaceGroupDetailResponse>(
    `/api/interface-group/${groupId}?${query.toString()}`,
  );

  const interfaces = normalizeSpringPage(response.interfaces, normalizeInterfaceGroupMember);

  return {
    id: response.id,
    name: response.name,
    description: response.description ?? "",
    visibility: response.visibility,
    ownerId: response.ownerId ?? null,
    ownerUsername: response.ownerUsername ?? null,
    interfaceCount: interfaces.totalElements,
    interfaces,
  } satisfies InterfaceGroupDetail;
}

export async function fetchInterfaceCatalog(page = 0, size = 1000) {
  const query = buildPageQuery(page, size, "name,asc");
  const response = await apiFetch<SpringPageResponse<InterfaceGroupMember>>(
    `/api/interfaces?${query.toString()}`,
  );
  return normalizeSpringPage(response, normalizeInterfaceGroupMember);
}

export async function fetchInterfaceById(interfaceId: number) {
  const response = await apiFetch<InterfaceGroupMember>(`/api/interfaces/${interfaceId}`);
  return normalizeInterfaceGroupMember(response);
}

export async function createInterfaceGroup(payload: InterfaceGroupPayload) {
  const response = await apiFetch<InterfaceGroup>("/api/interface-group", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return normalizeInterfaceGroup(response);
}

export async function updateInterfaceGroup(id: number, payload: InterfaceGroupPayload) {
  const response = await apiFetch<InterfaceGroup>(`/api/interface-group/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return normalizeInterfaceGroup(response);
}

export async function deleteInterfaceGroup(id: number) {
  return apiFetch<{ message: string }>(`/api/interface-group/${id}`, {
    method: "DELETE",
  });
}

export async function addInterfacesToGroup(groupId: number, interfaceIds: number[]) {
  return apiFetch<{ interfaceCount: number }>(
    `/api/interface-group/${groupId}/add-interfaces`,
    {
      method: "POST",
      body: JSON.stringify(interfaceIds),
    },
  );
}

export async function removeInterfacesFromGroup(groupId: number, interfaceIds: number[]) {
  return apiFetch<{ interfaceCount: number }>(
    `/api/interface-group/${groupId}/delete-interfaces`,
    {
      method: "POST",
      body: JSON.stringify(interfaceIds),
    },
  );
}

export function getVisibilityLabel(visibility: InterfaceGroupVisibility) {
  switch (visibility) {
    case "PUBLIC":
      return "Shared";
    case "ADMIN_ONLY":
      return "Admin only";
    case "PRIVATE":
      return "Private";
  }
}

export function canEditInterfaceGroup(
  group: InterfaceGroup,
  userId: number | undefined,
  admin: boolean,
) {
  if (admin) return true;
  return group.visibility === "PRIVATE" && group.ownerId === userId;
}

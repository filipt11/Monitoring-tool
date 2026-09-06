import { apiFetch } from "@/api/client";
import {
  buildPageQuery,
  normalizeSpringPage,
  type PaginatedResult,
  type SpringPageResponse,
} from "@/lib/springPage";

export type DeviceGroupVisibility = "PUBLIC" | "ADMIN_ONLY" | "PRIVATE";

export interface DeviceGroupDevice {
  id: number;
  ip: string;
  hostname: string;
  vendor: string;
  model: string;
  port: number;
  https: boolean;
}

export interface DeviceGroup {
  id: number;
  name: string;
  description: string;
  visibility: DeviceGroupVisibility;
  ownerId: number | null;
  ownerUsername: string | null;
  deviceCount: number;
}

export interface DeviceGroupDetail extends DeviceGroup {
  devices: PaginatedResult<DeviceGroupDevice>;
}

export interface DeviceGroupPayload {
  name: string;
  description: string;
  visibility?: DeviceGroupVisibility;
}

interface DeviceGroupDetailResponse {
  id: number;
  name: string;
  description: string;
  visibility: DeviceGroupVisibility;
  ownerId: number | null;
  ownerUsername: string | null;
  devices: SpringPageResponse<DeviceGroupDevice>;
}

function normalizeDeviceGroupDevice(dto: DeviceGroupDevice): DeviceGroupDevice {
  return {
    id: dto.id,
    ip: dto.ip,
    hostname: dto.hostname,
    vendor: dto.vendor,
    model: dto.model,
    port: dto.port,
    https: dto.https ?? false,
  };
}

function normalizeDeviceGroup(
  dto: DeviceGroup & { devices?: DeviceGroupDevice[] },
): DeviceGroup {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description ?? "",
    visibility: dto.visibility,
    ownerId: dto.ownerId ?? null,
    ownerUsername: dto.ownerUsername ?? null,
    deviceCount: dto.deviceCount ?? dto.devices?.length ?? 0,
  };
}

export async function fetchDeviceGroups(page = 0, size = 1000) {
  const query = buildPageQuery(page, size, "name,asc");
  const response = await apiFetch<SpringPageResponse<DeviceGroup>>(
    `/api/device-group?${query.toString()}`,
  );
  return normalizeSpringPage(response, normalizeDeviceGroup);
}

export async function fetchDeviceGroupDetail(groupId: number, page = 0, size = 10) {
  const query = buildPageQuery(page, size, "hostname,asc");
  const response = await apiFetch<DeviceGroupDetailResponse>(
    `/api/device-group/${groupId}?${query.toString()}`,
  );

  const devices = normalizeSpringPage(response.devices, normalizeDeviceGroupDevice);

  return {
    id: response.id,
    name: response.name,
    description: response.description ?? "",
    visibility: response.visibility,
    ownerId: response.ownerId ?? null,
    ownerUsername: response.ownerUsername ?? null,
    deviceCount: devices.totalElements,
    devices,
  } satisfies DeviceGroupDetail;
}

export async function createDeviceGroup(payload: DeviceGroupPayload) {
  const response = await apiFetch<DeviceGroup>("/api/device-group", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return normalizeDeviceGroup(response);
}

export async function updateDeviceGroup(id: number, payload: DeviceGroupPayload) {
  const response = await apiFetch<DeviceGroup>(`/api/device-group/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return normalizeDeviceGroup(response);
}

export async function deleteDeviceGroup(id: number) {
  return apiFetch<{ message: string }>(`/api/device-group/${id}`, {
    method: "DELETE",
  });
}

export async function addDevicesToGroup(groupId: number, deviceIds: number[]) {
  return apiFetch<{ deviceCount: number }>(`/api/device-group/${groupId}/add-devices`, {
    method: "POST",
    body: JSON.stringify(deviceIds),
  });
}

export async function removeDevicesFromGroup(groupId: number, deviceIds: number[]) {
  return apiFetch<{ deviceCount: number }>(`/api/device-group/${groupId}/delete-devices`, {
    method: "POST",
    body: JSON.stringify(deviceIds),
  });
}

export function getVisibilityLabel(visibility: DeviceGroupVisibility) {
  switch (visibility) {
    case "PUBLIC":
      return "Shared";
    case "ADMIN_ONLY":
      return "Admin only";
    case "PRIVATE":
      return "Private";
  }
}

export function canEditDeviceGroup(
  group: DeviceGroup,
  userId: number | undefined,
  admin: boolean,
) {
  if (admin) return true;
  return group.visibility === "PRIVATE" && group.ownerId === userId;
}

import { apiFetch } from "@/api/client";
import {
  buildPageQuery,
  normalizeSpringPage,
  type SpringPageResponse,
} from "@/lib/springPage";

export interface AdminDevice {
  id: number;
  ip: string;
  hostname: string;
  vendor: string;
  model: string;
  port: number;
  https: boolean;
}

interface DeviceNoCredentialsResponse {
  id: number;
  ip: string;
  hostname: string;
  vendor: string;
  model: string;
  port: number;
  https?: boolean;
}

interface DeviceResponse extends DeviceNoCredentialsResponse {
  username: string;
  password: string;
}

function normalizeDevice(dto: DeviceNoCredentialsResponse): AdminDevice {
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

function looksLikeIpQuery(query: string) {
  return /^[\d.a-fA-F:]+$/.test(query);
}

export async function fetchAdminDevices(page = 0, size = 10) {
  const query = buildPageQuery(page, size, "hostname,asc");
  const response = await apiFetch<SpringPageResponse<DeviceNoCredentialsResponse>>(
    `/api/devices?${query.toString()}`,
  );
  return normalizeSpringPage(response, normalizeDevice);
}

export async function searchAdminDevices(search: string, page = 0, size = 10) {
  const trimmed = search.trim();
  if (!trimmed) {
    return fetchAdminDevices(page, size);
  }

  const query = buildPageQuery(page, size, "hostname,asc");
  const encoded = encodeURIComponent(trimmed);
  const path = looksLikeIpQuery(trimmed)
    ? `/api/devices/search/ip?ip=${encoded}&${query.toString()}`
    : `/api/devices/search/hostname?name=${encoded}&${query.toString()}`;

  const response = await apiFetch<SpringPageResponse<DeviceNoCredentialsResponse>>(path);
  return normalizeSpringPage(response, normalizeDevice);
}

export async function fetchAdminDevice(id: number) {
  const response = await apiFetch<DeviceResponse>(`/api/devices/${id}`);
  return {
    ...normalizeDevice(response),
    username: response.username,
    password: response.password,
  };
}

export async function createAdminDevice(payload: {
  ip: string;
  vendor: string;
  username: string;
  password: string;
  port: number;
  https: boolean;
}) {
  return apiFetch<DeviceNoCredentialsResponse>("/api/devices", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAdminDevice(
  id: number,
  payload: {
    port: number;
    https: boolean;
    username: string;
    password: string;
  },
) {
  const response = await apiFetch<DeviceResponse>(`/api/devices/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return {
    ...normalizeDevice(response),
    username: response.username,
    password: response.password,
  };
}

export async function deleteAdminDevice(id: number) {
  return apiFetch<{ message: string }>(`/api/devices/${id}`, {
    method: "DELETE",
  });
}

export async function rediscoverAdminDevice(id: number) {
  return apiFetch<DeviceNoCredentialsResponse>(`/api/devices/rediscover/${id}`, {
    method: "POST",
  });
}

export function formatDeviceModel(vendor: string, model: string) {
  if (vendor && model) return `${vendor} ${model}`;
  return vendor || model || "—";
}

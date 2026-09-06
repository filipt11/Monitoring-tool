import { apiFetch } from "@/api/client";
import {
  buildPageQuery,
  normalizeSpringPage,
  type SpringPageResponse,
} from "@/lib/springPage";
import type { DeviceGroupVisibility } from "@/lib/deviceGroupsApi";

export type DashboardVisibility = DeviceGroupVisibility;

export interface Dashboard {
  id: number;
  name: string;
  description: string;
  visibility: DashboardVisibility;
  ownerId: number | null;
  ownerUsername: string | null;
}

export interface DashboardPayload {
  name: string;
  description: string;
  visibility?: DashboardVisibility;
}

export type DashboardSectionSourceType =
  | "DEVICE_LIST"
  | "DEVICE_GROUP"
  | "INTERFACE_LIST"
  | "INTERFACE_GROUP";

export interface DashboardSectionSummary {
  id: number;
  dashboardId: number;
  name: string;
  graphType: string;
  metrics: string[];
  sourceType: DashboardSectionSourceType;
  sourceItemCount: number;
  sortOrder: number;
}

export interface DashboardSectionDetail {
  id: number;
  dashboardId: number;
  name: string;
  graphType: string;
  metrics: string[];
  sourceType: DashboardSectionSourceType;
  deviceIds: number[];
  deviceGroupId: number | null;
  interfaceIds: number[];
  interfaceGroupId: number | null;
  sortOrder: number;
}

export interface DashboardSectionPayload {
  name: string;
  graphType: string;
  metrics: string[];
  sourceType: DashboardSectionSourceType;
  deviceIds?: number[];
  deviceGroupId?: number | null;
  interfaceIds?: number[];
  interfaceGroupId?: number | null;
}

function normalizeDashboard(dto: Dashboard): Dashboard {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description ?? "",
    visibility: dto.visibility,
    ownerId: dto.ownerId ?? null,
    ownerUsername: dto.ownerUsername ?? null,
  };
}

function normalizeSectionSummary(dto: DashboardSectionSummary): DashboardSectionSummary {
  return {
    id: dto.id,
    dashboardId: dto.dashboardId,
    name: dto.name,
    graphType: dto.graphType,
    metrics: dto.metrics ?? [],
    sourceType: dto.sourceType,
    sourceItemCount: dto.sourceItemCount ?? 0,
    sortOrder: dto.sortOrder ?? 0,
  };
}

function normalizeSectionDetail(dto: DashboardSectionDetail): DashboardSectionDetail {
  return {
    id: dto.id,
    dashboardId: dto.dashboardId,
    name: dto.name,
    graphType: dto.graphType,
    metrics: dto.metrics ?? [],
    sourceType: dto.sourceType,
    deviceIds: dto.deviceIds ?? [],
    deviceGroupId: dto.deviceGroupId ?? null,
    interfaceIds: dto.interfaceIds ?? [],
    interfaceGroupId: dto.interfaceGroupId ?? null,
    sortOrder: dto.sortOrder ?? 0,
  };
}

export function sortDashboardSections<T extends { sortOrder: number; id: number }>(
  sections: T[],
): T[] {
  return [...sections].sort((left, right) => left.sortOrder - right.sortOrder || left.id - right.id);
}

export async function fetchDashboards(page = 0, size = 1000) {
  const query = buildPageQuery(page, size, "name,asc");
  const response = await apiFetch<SpringPageResponse<Dashboard>>(
    `/api/dashboard?${query.toString()}`,
  );
  return normalizeSpringPage(response, normalizeDashboard);
}

export async function fetchDashboard(dashboardId: number) {
  const response = await apiFetch<Dashboard>(`/api/dashboard/${dashboardId}`);
  return normalizeDashboard(response);
}

export async function createDashboard(payload: DashboardPayload) {
  const response = await apiFetch<Dashboard>("/api/dashboard", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return normalizeDashboard(response);
}

export async function updateDashboard(id: number, payload: DashboardPayload) {
  const response = await apiFetch<Dashboard>(`/api/dashboard/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return normalizeDashboard(response);
}

export async function deleteDashboard(id: number) {
  return apiFetch<{ message: string }>(`/api/dashboard/${id}`, {
    method: "DELETE",
  });
}

export async function fetchDashboardSections(dashboardId: number) {
  const response = await apiFetch<DashboardSectionSummary[]>(
    `/api/dashboard/${dashboardId}/sections`,
  );
  return sortDashboardSections(response.map(normalizeSectionSummary));
}

export async function fetchDashboardSectionDetail(dashboardId: number, sectionId: number) {
  const response = await apiFetch<DashboardSectionDetail>(
    `/api/dashboard/${dashboardId}/sections/${sectionId}`,
  );
  return normalizeSectionDetail(response);
}

export async function createDashboardSection(
  dashboardId: number,
  payload: DashboardSectionPayload,
) {
  const response = await apiFetch<DashboardSectionDetail>(
    `/api/dashboard/${dashboardId}/sections`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
  return normalizeSectionDetail(response);
}

export async function updateDashboardSection(
  dashboardId: number,
  sectionId: number,
  payload: DashboardSectionPayload,
) {
  const response = await apiFetch<DashboardSectionDetail>(
    `/api/dashboard/${dashboardId}/sections/${sectionId}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
  return normalizeSectionDetail(response);
}

export async function deleteDashboardSection(dashboardId: number, sectionId: number) {
  return apiFetch<{ message: string }>(
    `/api/dashboard/${dashboardId}/sections/${sectionId}`,
    {
      method: "DELETE",
    },
  );
}

const COPY_SUFFIX_PATTERN = /\s\((\d+)\)$/;

/** Strips a trailing " (n)" copy suffix from a section name. */
export function getSectionCopyBaseName(name: string): string {
  return name.replace(COPY_SUFFIX_PATTERN, "");
}

/** Builds the next available copy name, e.g. "CPU" -> "CPU (1)", then "CPU (2)". */
export function buildCopySectionName(sourceName: string, existingNames: string[]): string {
  const baseName = getSectionCopyBaseName(sourceName.trim());
  const existing = new Set(existingNames);

  let copyNumber = 1;
  while (existing.has(`${baseName} (${copyNumber})`)) {
    copyNumber += 1;
  }

  return `${baseName} (${copyNumber})`;
}

export function sectionDetailToPayload(
  detail: DashboardSectionDetail,
  name: string,
): DashboardSectionPayload {
  const payload: DashboardSectionPayload = {
    name,
    graphType: detail.graphType,
    metrics: [...detail.metrics],
    sourceType: detail.sourceType,
  };

  switch (detail.sourceType) {
    case "DEVICE_LIST":
      payload.deviceIds = [...detail.deviceIds];
      break;
    case "DEVICE_GROUP":
      payload.deviceGroupId = detail.deviceGroupId;
      break;
    case "INTERFACE_LIST":
      payload.interfaceIds = [...detail.interfaceIds];
      break;
    case "INTERFACE_GROUP":
      payload.interfaceGroupId = detail.interfaceGroupId;
      break;
  }

  return payload;
}

export async function copyDashboardSection(
  dashboardId: number,
  sectionId: number,
  existingNames: string[],
) {
  const detail = await fetchDashboardSectionDetail(dashboardId, sectionId);
  const name = buildCopySectionName(detail.name, existingNames);

  return createDashboardSection(
    dashboardId,
    sectionDetailToPayload(detail, name),
  );
}

export async function reorderDashboardSections(dashboardId: number, sectionIds: number[]) {
  const response = await apiFetch<DashboardSectionSummary[]>(
    `/api/dashboard/${dashboardId}/sections/order`,
    {
      method: "PUT",
      body: JSON.stringify({ sectionIds }),
    },
  );
  return sortDashboardSections(response.map(normalizeSectionSummary));
}

export function getVisibilityLabel(visibility: DashboardVisibility) {
  switch (visibility) {
    case "PUBLIC":
      return "Shared";
    case "ADMIN_ONLY":
      return "Admin only";
    case "PRIVATE":
      return "Private";
  }
}

export function canEditDashboard(
  dashboard: Dashboard,
  userId: number | undefined,
  admin: boolean,
) {
  if (admin) return true;
  return dashboard.visibility === "PRIVATE" && dashboard.ownerId === userId;
}

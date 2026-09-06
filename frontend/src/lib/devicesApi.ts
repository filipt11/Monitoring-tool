import { apiFetch } from "@/api/client";

export interface DeviceRecord {
  id: number;
  hostname: string;
  ipAddress: string;
  type?: string;
}

export interface DeviceListResult {
  devices: DeviceRecord[];
  totalElements: number;
}

export function normalizeDevices(payload: unknown): DeviceRecord[] {
  if (Array.isArray(payload)) {
    return payload.flatMap((item) => {
      if (typeof item !== "object" || item === null) {
        return [];
      }

      const data = item as Record<string, unknown>;
      const vendor = typeof data.vendor === "string" ? data.vendor : undefined;
      const model = typeof data.model === "string" ? data.model : undefined;
      const type =
        typeof data.type === "string"
          ? data.type
          : [vendor, model].filter(Boolean).join(" / ") || undefined;

      return [
        {
          id: Number(data.id ?? data.deviceId ?? 0) || Date.now() + Math.random(),
          hostname: String(data.hostname ?? data.name ?? "Unnamed device"),
          ipAddress: String(data.ipAddress ?? data.ip ?? data.address ?? "Unknown"),
          type,
        },
      ];
    });
  }

  if (payload && typeof payload === "object") {
    const data = payload as Record<string, unknown>;
    const nestedCandidates = [data.content, data.devices, data.items, data.data];

    for (const nested of nestedCandidates) {
      if (Array.isArray(nested)) {
        return normalizeDevices(nested);
      }
    }
  }

  return [];
}

export function parseDeviceList(payload: unknown): DeviceListResult {
  const devices = normalizeDevices(payload);

  if (payload && typeof payload === "object") {
    const data = payload as Record<string, unknown>;
    const totalElements =
      typeof data.totalElements === "number" ? data.totalElements : devices.length;

    return { devices, totalElements };
  }

  return { devices, totalElements: devices.length };
}

/** Loads devices from the backend, optionally filtered by hostname or IP. */
export async function fetchDeviceList(query?: string): Promise<DeviceListResult> {
  const trimmedQuery = query?.trim() ?? "";
  const listSize = "size=1000";

  const searchPaths = trimmedQuery
    ? [
        `/api/devices/search/hostname?name=${encodeURIComponent(trimmedQuery)}&${listSize}`,
        `/api/devices/search/ip?ip=${encodeURIComponent(trimmedQuery)}&${listSize}`,
      ]
    : [`/api/devices?${listSize}`];

  for (const path of searchPaths) {
    try {
      const data = await apiFetch<unknown>(path);
      const result = parseDeviceList(data);

      if (result.devices.length > 0 || !trimmedQuery) {
        return result;
      }
    } catch {
      // Try the next search path.
    }
  }

  return { devices: [], totalElements: 0 };
}

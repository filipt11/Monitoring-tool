import { fetchDeviceGroupDetail } from "@/lib/deviceGroupsApi";
import { fetchDeviceList } from "@/lib/devicesApi";
import { fetchInterfaceCatalog, fetchInterfaceGroupDetail } from "@/lib/interfaceGroupsApi";
import type { DashboardSectionDetail } from "@/lib/dashboardsApi";
import { toInterfaceMetricKey } from "@/lib/metricsApi";

export interface ResolvedInterfaceSource {
  interfaceId: number;
  deviceId: number;
  ifIndex: number;
  deviceHostname: string;
  interfaceName: string;
  label: string;
  metricKey: string;
}

export interface ResolvedSectionSources {
  scope: "device" | "interface";
  deviceIds: string[];
  deviceLabels: Record<string, string>;
  interfaces: ResolvedInterfaceSource[];
}

function buildInterfaceLabel(
  hostname: string,
  name: string,
  deviceId: number,
  ifIndex: number,
): string {
  const host = hostname || `Device ${deviceId}`;
  return `${host} / ${name || `if${ifIndex}`}`;
}

export async function resolveSectionSources(
  section: DashboardSectionDetail,
): Promise<ResolvedSectionSources> {
  switch (section.sourceType) {
    case "DEVICE_LIST": {
      const deviceIds = section.deviceIds.map(String);
      const deviceResult = await fetchDeviceList();
      const deviceLabels = Object.fromEntries(
        deviceResult.devices
          .filter((device) => deviceIds.includes(String(device.id)))
          .map((device) => [
            String(device.id),
            device.hostname || device.ipAddress || `Device ${device.id}`,
          ]),
      );

      for (const deviceId of deviceIds) {
        if (!deviceLabels[deviceId]) {
          deviceLabels[deviceId] = `Device ${deviceId}`;
        }
      }

      return {
        scope: "device",
        deviceIds,
        deviceLabels,
        interfaces: [],
      };
    }

    case "DEVICE_GROUP": {
      if (!section.deviceGroupId) {
        return { scope: "device", deviceIds: [], deviceLabels: {}, interfaces: [] };
      }

      const detail = await fetchDeviceGroupDetail(section.deviceGroupId, 0, 1000);
      const deviceIds = detail.devices.content.map((device) => String(device.id));
      const deviceLabels = Object.fromEntries(
        detail.devices.content.map((device) => [
          String(device.id),
          device.hostname || device.ip || `Device ${device.id}`,
        ]),
      );

      return { scope: "device", deviceIds, deviceLabels, interfaces: [] };
    }

    case "INTERFACE_LIST": {
      if (section.interfaceIds.length === 0) {
        return { scope: "interface", deviceIds: [], deviceLabels: {}, interfaces: [] };
      }

      const catalog = await fetchInterfaceCatalog(0, 2000);
      const selected = new Set(section.interfaceIds);
      const interfaces = catalog.content
        .filter((entry) => selected.has(entry.id))
        .map((entry) => ({
          interfaceId: entry.id,
          deviceId: entry.deviceId,
          ifIndex: entry.ifIndex,
          deviceHostname: entry.deviceHostname || `Device ${entry.deviceId}`,
          interfaceName: entry.name || `if${entry.ifIndex}`,
          label: buildInterfaceLabel(
            entry.deviceHostname,
            entry.name,
            entry.deviceId,
            entry.ifIndex,
          ),
          metricKey: toInterfaceMetricKey(entry.deviceId, entry.ifIndex),
        }));

      return { scope: "interface", deviceIds: [], deviceLabels: {}, interfaces };
    }

    case "INTERFACE_GROUP": {
      if (!section.interfaceGroupId) {
        return { scope: "interface", deviceIds: [], deviceLabels: {}, interfaces: [] };
      }

      const detail = await fetchInterfaceGroupDetail(section.interfaceGroupId, 0, 2000);
      const interfaces = detail.interfaces.content.map((entry) => ({
        interfaceId: entry.id,
        deviceId: entry.deviceId,
        ifIndex: entry.ifIndex,
        deviceHostname: entry.deviceHostname || `Device ${entry.deviceId}`,
        interfaceName: entry.name || `if${entry.ifIndex}`,
        label: buildInterfaceLabel(
          entry.deviceHostname,
          entry.name,
          entry.deviceId,
          entry.ifIndex,
        ),
        metricKey: toInterfaceMetricKey(entry.deviceId, entry.ifIndex),
      }));

      return { scope: "interface", deviceIds: [], deviceLabels: {}, interfaces };
    }

    default:
      return { scope: "device", deviceIds: [], deviceLabels: {}, interfaces: [] };
  }
}

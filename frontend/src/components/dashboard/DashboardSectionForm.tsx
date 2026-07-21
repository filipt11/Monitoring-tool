import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { StyledCheckbox } from "@/components/admin/StyledCheckbox";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAuthErrorMessage } from "@/contexts/AuthContext";
import {
  DASHBOARD_GRAPH_TYPES,
  DASHBOARD_SOURCE_TYPES,
  getMetricsForScope,
  getSourceScope,
} from "@/lib/dashboardConfig";
import {
  createDashboardSection,
  updateDashboardSection,
  type DashboardSectionDetail,
  type DashboardSectionPayload,
  type DashboardSectionSourceType,
} from "@/lib/dashboardsApi";
import { fetchDeviceGroups } from "@/lib/deviceGroupsApi";
import { fetchDeviceList } from "@/lib/devicesApi";
import { fetchInterfaceCatalog, fetchInterfaceGroups } from "@/lib/interfaceGroupsApi";

interface SectionFormValues {
  name: string;
  graphType: string;
  sourceType: DashboardSectionSourceType;
  deviceIds: number[];
  deviceGroupId: string;
  interfaceIds: number[];
  interfaceGroupId: string;
  metrics: string[];
}

interface DashboardSectionFormProps {
  dashboardId: number;
  section?: DashboardSectionDetail | null;
  onCancel: () => void;
  onSaved: () => void;
}

function buildPayload(values: SectionFormValues): DashboardSectionPayload {
  const payload: DashboardSectionPayload = {
    name: values.name.trim(),
    graphType: values.graphType,
    metrics: values.metrics,
    sourceType: values.sourceType,
  };

  switch (values.sourceType) {
    case "DEVICE_LIST":
      payload.deviceIds = values.deviceIds;
      break;
    case "DEVICE_GROUP":
      payload.deviceGroupId = Number(values.deviceGroupId);
      break;
    case "INTERFACE_LIST":
      payload.interfaceIds = values.interfaceIds;
      break;
    case "INTERFACE_GROUP":
      payload.interfaceGroupId = Number(values.interfaceGroupId);
      break;
  }

  return payload;
}

function defaultValues(section?: DashboardSectionDetail | null): SectionFormValues {
  return {
    name: section?.name ?? "",
    graphType: section?.graphType ?? DASHBOARD_GRAPH_TYPES[0].id,
    sourceType: section?.sourceType ?? "DEVICE_LIST",
    deviceIds: section?.deviceIds ?? [],
    deviceGroupId: section?.deviceGroupId ? String(section.deviceGroupId) : "",
    interfaceIds: section?.interfaceIds ?? [],
    interfaceGroupId: section?.interfaceGroupId ? String(section.interfaceGroupId) : "",
    metrics: section?.metrics ?? [],
  };
}

function preserveMainScroll(action: () => void) {
  const main = document.querySelector("main");
  const scrollTop = main?.scrollTop ?? 0;

  action();

  requestAnimationFrame(() => {
    if (main) {
      main.scrollTop = scrollTop;
    }
  });
}

export function DashboardSectionForm({
  dashboardId,
  section,
  onCancel,
  onSaved,
}: DashboardSectionFormProps) {
  const isEditing = section != null;
  const [saving, setSaving] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [devices, setDevices] = useState<Array<{ id: number; label: string }>>([]);
  const [deviceGroups, setDeviceGroups] = useState<Array<{ id: number; label: string }>>([]);
  const [interfaces, setInterfaces] = useState<Array<{ id: number; label: string }>>([]);
  const [interfaceGroups, setInterfaceGroups] = useState<Array<{ id: number; label: string }>>([]);
  const [deviceSearch, setDeviceSearch] = useState("");
  const [interfaceSearch, setInterfaceSearch] = useState("");

  const form = useForm<SectionFormValues>({
    defaultValues: defaultValues(section),
  });

  const sourceType = form.watch("sourceType");
  const selectedMetrics = form.watch("metrics");
  const selectedDeviceIds = form.watch("deviceIds");
  const selectedInterfaceIds = form.watch("interfaceIds");
  const scope = getSourceScope(sourceType);
  const availableMetrics = useMemo(() => getMetricsForScope(scope), [scope]);

  useEffect(() => {
    form.reset(defaultValues(section));
  }, [form, section]);

  useEffect(() => {
    let active = true;
    setCatalogLoading(true);

    void Promise.all([
      fetchDeviceList(),
      fetchDeviceGroups(),
      fetchInterfaceCatalog(0, 2000),
      fetchInterfaceGroups(),
    ])
      .then(([deviceResult, groupResult, interfaceResult, interfaceGroupResult]) => {
        if (!active) return;

        setDevices(
          deviceResult.devices.map((device) => ({
            id: device.id,
            label: `${device.hostname} (${device.ipAddress})`,
          })),
        );
        setDeviceGroups(
          groupResult.content.map((group) => ({
            id: group.id,
            label: group.name,
          })),
        );
        setInterfaces(
          interfaceResult.content.map((entry) => ({
            id: entry.id,
            label: `${entry.deviceHostname} / ${entry.name} (${entry.deviceIp})`,
          })),
        );
        setInterfaceGroups(
          interfaceGroupResult.content.map((group) => ({
            id: group.id,
            label: group.name,
          })),
        );
      })
      .catch((error) => {
        if (active) {
          toast.error(getAuthErrorMessage(error));
        }
      })
      .finally(() => {
        if (active) {
          setCatalogLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const validKeys = new Set(availableMetrics.map((metric) => metric.key));
    const filtered = selectedMetrics.filter((metric) => validKeys.has(metric));

    if (filtered.length !== selectedMetrics.length) {
      form.setValue("metrics", filtered);
    }
  }, [availableMetrics, form, selectedMetrics]);

  const filteredDevices = useMemo(() => {
    const query = deviceSearch.trim().toLowerCase();
    if (!query) return devices;
    return devices.filter((device) => device.label.toLowerCase().includes(query));
  }, [deviceSearch, devices]);

  const filteredInterfaces = useMemo(() => {
    const query = interfaceSearch.trim().toLowerCase();
    if (!query) return interfaces;
    return interfaces.filter((entry) => entry.label.toLowerCase().includes(query));
  }, [interfaceSearch, interfaces]);

  const toggleMetric = (metricKey: string) => {
    preserveMainScroll(() => {
      const current = form.getValues("metrics");
      form.setValue(
        "metrics",
        current.includes(metricKey)
          ? current.filter((entry) => entry !== metricKey)
          : [...current, metricKey],
        { shouldDirty: true },
      );
    });
  };

  const toggleDevice = (deviceId: number) => {
    preserveMainScroll(() => {
      const current = form.getValues("deviceIds");
      form.setValue(
        "deviceIds",
        current.includes(deviceId)
          ? current.filter((entry) => entry !== deviceId)
          : [...current, deviceId],
        { shouldDirty: true },
      );
    });
  };

  const toggleInterface = (interfaceId: number) => {
    preserveMainScroll(() => {
      const current = form.getValues("interfaceIds");
      form.setValue(
        "interfaceIds",
        current.includes(interfaceId)
          ? current.filter((entry) => entry !== interfaceId)
          : [...current, interfaceId],
        { shouldDirty: true },
      );
    });
  };

  const onSubmit = async (values: SectionFormValues) => {
    if (values.metrics.length === 0) {
      toast.error("Select at least one metric.");
      return;
    }

    if (values.sourceType === "DEVICE_LIST" && values.deviceIds.length === 0) {
      toast.error("Select at least one device.");
      return;
    }

    if (values.sourceType === "DEVICE_GROUP" && !values.deviceGroupId) {
      toast.error("Select a device group.");
      return;
    }

    if (values.sourceType === "INTERFACE_LIST" && values.interfaceIds.length === 0) {
      toast.error("Select at least one interface.");
      return;
    }

    if (values.sourceType === "INTERFACE_GROUP" && !values.interfaceGroupId) {
      toast.error("Select an interface group.");
      return;
    }

    setSaving(true);

    try {
      const payload = buildPayload(values);

      if (isEditing && section) {
        await updateDashboardSection(dashboardId, section.id, payload);
        toast.success("Section updated");
      } else {
        await createDashboardSection(dashboardId, payload);
        toast.success("Section created");
      }

      onSaved();
    } catch (error) {
      toast.error(getAuthErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form {...form}>
      <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="name"
          rules={{
            required: "Section name is required",
            minLength: { value: 2, message: "Name must be at least 2 characters" },
            maxLength: { value: 50, message: "Name must be at most 50 characters" },
          }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Section name</FormLabel>
              <FormControl>
                <Input placeholder="CPU utilization" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="graphType"
            rules={{ required: "Chart type is required" }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Chart type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select chart type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {DASHBOARD_GRAPH_TYPES.map((entry) => (
                      <SelectItem key={entry.id} value={entry.id}>
                        {entry.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="sourceType"
            rules={{ required: "Component type is required" }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Component source</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={(value) =>
                    field.onChange(value as DashboardSectionSourceType)
                  }
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select source type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {DASHBOARD_SOURCE_TYPES.map((entry) => (
                      <SelectItem key={entry.id} value={entry.id}>
                        {entry.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {catalogLoading ? (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Loading source catalogs...
          </div>
        ) : null}

        {sourceType === "DEVICE_LIST" ? (
          <div className="space-y-2">
            <FormLabel>Devices</FormLabel>
            <Input
              placeholder="Search devices"
              value={deviceSearch}
              onChange={(event) => setDeviceSearch(event.target.value)}
            />
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border p-3">
              {filteredDevices.length === 0 ? (
                <p className="text-muted-foreground text-sm">No devices found.</p>
              ) : (
                filteredDevices.map((device) => (
                  <StyledCheckbox
                    key={device.id}
                    id={`section-device-${device.id}`}
                    label={device.label}
                    checked={selectedDeviceIds.includes(device.id)}
                    onChange={() => toggleDevice(device.id)}
                  />
                ))
              )}
            </div>
          </div>
        ) : null}

        {sourceType === "DEVICE_GROUP" ? (
          <FormField
            control={form.control}
            name="deviceGroupId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Device group</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select device group" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {deviceGroups.map((group) => (
                      <SelectItem key={group.id} value={String(group.id)}>
                        {group.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
        ) : null}

        {sourceType === "INTERFACE_LIST" ? (
          <div className="space-y-2">
            <FormLabel>Interfaces</FormLabel>
            <Input
              placeholder="Search interfaces"
              value={interfaceSearch}
              onChange={(event) => setInterfaceSearch(event.target.value)}
            />
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border p-3">
              {filteredInterfaces.length === 0 ? (
                <p className="text-muted-foreground text-sm">No interfaces found.</p>
              ) : (
                filteredInterfaces.map((entry) => (
                  <StyledCheckbox
                    key={entry.id}
                    id={`section-interface-${entry.id}`}
                    label={entry.label}
                    checked={selectedInterfaceIds.includes(entry.id)}
                    onChange={() => toggleInterface(entry.id)}
                  />
                ))
              )}
            </div>
          </div>
        ) : null}

        {sourceType === "INTERFACE_GROUP" ? (
          <FormField
            control={form.control}
            name="interfaceGroupId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Interface group</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select interface group" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {interfaceGroups.map((group) => (
                      <SelectItem key={group.id} value={String(group.id)}>
                        {group.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
        ) : null}

        <div className="space-y-2">
          <FormLabel>Metrics</FormLabel>
          <div className="grid gap-2 sm:grid-cols-2">
            {availableMetrics.map((metric) => (
              <StyledCheckbox
                key={metric.key}
                label={metric.label}
                checked={selectedMetrics.includes(metric.key)}
                onChange={() => toggleMetric(metric.key)}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || catalogLoading}>
            {saving ? "Saving..." : isEditing ? "Save section" : "Add section"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

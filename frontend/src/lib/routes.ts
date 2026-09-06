export const routes = {
  mainPage: "/main-page",
  devices: "/devices",
  deviceGroups: "/device-groups",
  interfaceGroups: "/interface-groups",
  dashboards: "/dashboards",
  dashboardView: (dashboardId: string) => `/dashboards/${dashboardId}`,
  dashboardSections: (dashboardId: string) => `/dashboards/${dashboardId}/sections`,
  dashboardSectionNew: (dashboardId: string) => `/dashboards/${dashboardId}/sections/new`,
  dashboardSectionEdit: (dashboardId: string, sectionId: string) =>
    `/dashboards/${dashboardId}/sections/${sectionId}/edit`,
  /** @deprecated Use dashboardView */
  dashboardEditor: (dashboardId: string) => `/dashboards/${dashboardId}`,
  deviceDetails: (deviceId: string) => `/devices/${deviceId}`,
  interfaces: "/interfaces",
  interfaceDetails: (interfaceId: string) => `/interfaces/${interfaceId}`,
  admin: {
    users: "/admin/users",
    devices: "/admin/devices",
    configuration: "/admin/configuration",
  },
  login: "/login",
  register: "/register",
} as const;

export const defaultAuthenticatedPath = routes.mainPage;

import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { Toaster } from "sonner";

import { ScrollLockOverride } from "@/components/ScrollLockOverride";
import { AdminRoute } from "@/components/AdminRoute";
import { GuestRoute, ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout, AuthLayout } from "@/components/layout/AppLayout";
import { AuthProvider } from "@/contexts/AuthContext";
import { defaultAuthenticatedPath, routes } from "@/lib/routes";
import { AdminAppConfigPage } from "@/pages/admin/AdminAppConfigPage";
import { AdminManageDevicesPage } from "@/pages/admin/AdminManageDevicesPage";
import { AdminUsersPage } from "@/pages/admin/AdminUsersPage";
import { DeviceDetailsPage } from "@/pages/DeviceDetailsPage";
import { DashboardViewPage } from "@/pages/DashboardViewPage";
import { DashboardSectionsPage } from "@/pages/DashboardSectionsPage";
import { DashboardSectionEditPage } from "@/pages/DashboardSectionEditPage";
import { DashboardsPage } from "@/pages/DashboardsPage";
import { DeviceGroupsPage } from "@/pages/DeviceGroupsPage";
import { InterfaceGroupsPage } from "@/pages/InterfaceGroupsPage";
import { DevicesPage } from "@/pages/DevicesPage";
import { InterfacesPage } from "@/pages/InterfacesPage";
import { InterfaceDetailsPage } from "@/pages/InterfaceDetailsPage";
import { LoginPage } from "@/pages/LoginPage";
import { MainPage } from "@/pages/MainPage";
import { RegisterPage } from "@/pages/RegisterPage";

function LegacyDeviceDetailsRedirect() {
  const { deviceId } = useParams<{ deviceId: string }>();

  if (!deviceId) {
    return <Navigate to={routes.devices} replace />;
  }

  return <Navigate to={routes.deviceDetails(deviceId)} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <ScrollLockOverride />
      <Routes>
        <Route element={<GuestRoute />}>
          <Route element={<AuthLayout />}>
            <Route path={routes.login} element={<LoginPage />} />
            <Route path={routes.register} element={<RegisterPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path={routes.mainPage} element={<MainPage />} />
            <Route path={routes.devices} element={<DevicesPage />} />
            <Route path={routes.interfaces} element={<InterfacesPage />} />
            <Route path={routes.deviceGroups} element={<DeviceGroupsPage />} />
            <Route path={routes.interfaceGroups} element={<InterfaceGroupsPage />} />
            <Route path={routes.dashboards} element={<DashboardsPage />} />
            <Route path={`${routes.dashboards}/:dashboardId`} element={<DashboardViewPage />} />
            <Route
              path={`${routes.dashboards}/:dashboardId/sections`}
              element={<DashboardSectionsPage />}
            />
            <Route
              path={`${routes.dashboards}/:dashboardId/sections/new`}
              element={<DashboardSectionEditPage />}
            />
            <Route
              path={`${routes.dashboards}/:dashboardId/sections/:sectionId/edit`}
              element={<DashboardSectionEditPage />}
            />
            <Route path={`${routes.devices}/:deviceId`} element={<DeviceDetailsPage />} />
            <Route path={`${routes.interfaces}/:interfaceId`} element={<InterfaceDetailsPage />} />

            <Route element={<AdminRoute />}>
              <Route path={routes.admin.users} element={<AdminUsersPage />} />
              <Route path={routes.admin.devices} element={<AdminManageDevicesPage />} />
              <Route path={routes.admin.configuration} element={<AdminAppConfigPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="/" element={<Navigate to={defaultAuthenticatedPath} replace />} />
        <Route path="/dashboard" element={<Navigate to={routes.mainPage} replace />} />
        <Route path="/dashboard/devices" element={<Navigate to={routes.devices} replace />} />
        <Route
          path="/dashboard/devices/:deviceId"
          element={<LegacyDeviceDetailsRedirect />}
        />
        <Route path="/dashboard/admin/users" element={<Navigate to={routes.admin.users} replace />} />
        <Route path="/dashboard/admin/devices" element={<Navigate to={routes.admin.devices} replace />} />
        <Route
          path="/dashboard/admin/configuration"
          element={<Navigate to={routes.admin.configuration} replace />}
        />
        <Route path="*" element={<Navigate to={defaultAuthenticatedPath} replace />} />
      </Routes>

      <Toaster richColors closeButton position="top-right" theme="dark" />
    </AuthProvider>
  );
}

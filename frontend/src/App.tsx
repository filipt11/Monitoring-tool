import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";

import { AdminRoute } from "@/components/AdminRoute";
import { GuestRoute, ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout, AuthLayout } from "@/components/layout/AppLayout";
import { AuthProvider } from "@/contexts/AuthContext";
import { AdminAppConfigPage } from "@/pages/admin/AdminAppConfigPage";
import { AdminManageDevicesPage } from "@/pages/admin/AdminManageDevicesPage";
import { AdminUsersPage } from "@/pages/admin/AdminUsersPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { DeviceDetailsPage } from "@/pages/DeviceDetailsPage";
import { DevicesPage } from "@/pages/DevicesPage";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<GuestRoute />}>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/dashboard/devices" element={<DevicesPage />} />
            <Route path="/dashboard/devices/:deviceId" element={<DeviceDetailsPage />} />

            <Route element={<AdminRoute />}>
              <Route path="/dashboard/admin/users" element={<AdminUsersPage />} />
              <Route
                path="/dashboard/admin/devices"
                element={<AdminManageDevicesPage />}
              />
              <Route
                path="/dashboard/admin/configuration"
                element={<AdminAppConfigPage />}
              />
            </Route>
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>

      <Toaster richColors closeButton position="top-right" theme="dark" />
    </AuthProvider>
  );
}

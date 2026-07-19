import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";

import { GuestRoute, ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout, AuthLayout } from "@/components/layout/AppLayout";
import { AuthProvider } from "@/contexts/AuthContext";
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
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>

      <Toaster richColors closeButton position="top-right" theme="dark" />
    </AuthProvider>
  );
}

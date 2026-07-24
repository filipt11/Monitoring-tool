import {
  Activity,
  FolderTree,
  LayoutDashboard,
  LayoutPanelTop,
  Network,
  Server,
  ServerCog,
  Settings,
  Shield,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";
import { isAdmin } from "@/lib/auth";
import { routes } from "@/lib/routes";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, getInitials } from "@/lib/utils";

type NavSubItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

type MainNavItem =
  | {
      kind: "link";
      to: string;
      label: string;
      icon: LucideIcon;
      end?: boolean;
    }
  | {
      kind: "section";
      label: string;
      icon: LucideIcon;
      subItems: NavSubItem[];
    };

const mainNavItems: MainNavItem[] = [
  { kind: "link", to: routes.mainPage, label: "Main Page", icon: LayoutDashboard, end: true },
  { kind: "link", to: routes.devices, label: "Devices", icon: Server, end: true },
  { kind: "link", to: routes.interfaces, label: "Interfaces", icon: Network, end: true },
  {
    kind: "section",
    label: "Groups",
    icon: FolderTree,
    subItems: [
      { to: routes.deviceGroups, label: "Device Groups", icon: FolderTree },
      { to: routes.interfaceGroups, label: "Interface Groups", icon: FolderTree },
    ],
  },
  { kind: "link", to: routes.dashboards, label: "Dashboards", icon: LayoutPanelTop, end: true },
];

const adminNavItems = [
  { to: routes.admin.users, label: "Users", icon: Users },
  {
    to: routes.admin.devices,
    label: "Manage Devices",
    icon: ServerCog,
  },
  {
    to: routes.admin.configuration,
    label: "Application configuration",
    icon: Settings,
  },
];

function getPageHeader(pathname: string): { title: string; description: string } {
  if (pathname === routes.mainPage) {
    return {
      title: "Main Page",
      description: "Overview of your most utilized devices and system status",
    };
  }

  if (pathname === routes.devices) {
    return {
      title: "Devices",
      description: "Browse and monitor all registered devices",
    };
  }

  if (pathname === routes.deviceGroups) {
    return {
      title: "Device Groups",
      description: "Create and manage device groups",
    };
  }

  if (pathname === routes.interfaces) {
    return {
      title: "Interfaces",
      description: "Browse and monitor all discovered interfaces",
    };
  }

  if (pathname === routes.interfaceGroups) {
    return {
      title: "Interface Groups",
      description: "Create and manage interface groups",
    };
  }

  if (pathname === routes.dashboards) {
    return {
      title: "Dashboards",
      description: "Create and view custom monitoring dashboards",
    };
  }

  if (/^\/dashboards\/\d+\/sections(\/new|\/\d+\/edit)?$/.test(pathname)) {
    return {
      title: "Edit sections",
      description: "Configure dashboard chart sections",
    };
  }

  if (/^\/dashboards\/\d+$/.test(pathname)) {
    return {
      title: "Dashboard",
      description: "Live metrics and charts",
    };
  }

  if (pathname.startsWith(`${routes.devices}/`)) {
    return {
      title: "Device details",
      description: "Live metrics and availability for this device",
    };
  }

  if (pathname.startsWith(`${routes.interfaces}/`)) {
    return {
      title: "Interface details",
      description: "Utilization and throughput for this interface",
    };
  }

  if (pathname === routes.admin.users) {
    return {
      title: "Users",
      description: "Manage user accounts and access",
    };
  }

  if (pathname === routes.admin.devices) {
    return {
      title: "Manage Devices",
      description: "Register and configure monitored devices",
    };
  }

  if (pathname === routes.admin.configuration) {
    return {
      title: "Application configuration",
      description: "Adjust global monitoring settings",
    };
  }

  return {
    title: "Monitoring Tool",
    description: "Monitor devices, metrics, and dashboards",
  };
}

function NavItem({
  to,
  label,
  icon: Icon,
  end,
  nested,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  nested?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
          nested && "pl-9",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
        )
      }
    >
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

function NavSection({
  label,
  icon: Icon,
  subItems,
}: {
  label: string;
  icon: LucideIcon;
  subItems: NavSubItem[];
}) {
  const { pathname } = useLocation();
  const isActiveSection = subItems.some(
    (item) => pathname === item.to || pathname.startsWith(`${item.to}/`),
  );

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
          isActiveSection
            ? "text-sidebar-accent-foreground"
            : "text-muted-foreground",
        )}
      >
        <Icon className="size-4 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      {subItems.map((item) => (
        <NavItem
          key={item.to}
          to={item.to}
          label={item.label}
          icon={item.icon}
          nested
        />
      ))}
    </div>
  );
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const pageHeader = getPageHeader(pathname);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
          <div className="bg-sidebar-primary text-sidebar-primary-foreground flex size-8 items-center justify-center rounded-lg">
            <Activity className="size-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">Monitoring Tool</p>
            <p className="text-muted-foreground text-xs">Network observability</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-4">
          {mainNavItems.map((item) =>
            item.kind === "link" ? (
              <NavItem
                key={item.to}
                to={item.to}
                label={item.label}
                icon={item.icon}
                end={item.end}
              />
            ) : (
              <NavSection
                key={item.label}
                label={item.label}
                icon={item.icon}
                subItems={item.subItems}
              />
            ),
          )}

          {isAdmin(user) && (
            <>
              <div className="my-2 border-t border-sidebar-border" />
              <div className="flex items-center gap-2 px-3 py-2">
                <Shield className="text-muted-foreground size-4 shrink-0" />
                <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  Administration
                </span>
              </div>
              {adminNavItems.map(({ to, label, icon }) => (
                <NavItem
                  key={to}
                  to={to}
                  label={label}
                  icon={icon}
                  nested
                />
              ))}
            </>
          )}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <p className="text-muted-foreground text-xs">
            Signed in as{" "}
            <span className="text-sidebar-foreground font-medium">
              {user?.username}
            </span>
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b px-4 md:px-6">
          <div className="md:hidden">
            <Link to={routes.mainPage} className="flex items-center gap-2">
              <Activity className="size-5" />
              <span className="font-semibold">Monitoring Tool</span>
            </Link>
          </div>

          <div className="hidden md:block">
            <h1 className="text-lg font-semibold">{pageHeader.title}</h1>
            <p className="text-muted-foreground text-sm">{pageHeader.description}</p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative size-9 rounded-full">
                <Avatar className="size-9">
                  <AvatarFallback>
                    {getInitials(user?.username ?? "U")}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm leading-none font-medium">
                    {user?.username}
                  </p>
                  <p className="text-muted-foreground text-xs leading-none">
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} variant="destructive">
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function AuthLayout() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-chart-1/10 blur-3xl" />
        <div className="absolute right-0 bottom-0 h-[320px] w-[420px] rounded-full bg-chart-2/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="bg-primary text-primary-foreground mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl shadow-lg">
            <Activity className="size-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Monitoring Tool
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Sign in to manage devices and visualize network metrics
          </p>
        </div>

        <Outlet />
      </div>
    </div>
  );
}

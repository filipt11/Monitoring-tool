import type { User } from "@/types/auth";

export const ROLE_ADMIN = "ROLE_ADMIN";

export function hasRole(user: User | null, role: string): boolean {
  if (!user) return false;
  return (
    user.role === role ||
    user.authorities.some((authority) => authority.authority === role)
  );
}

export function isAdmin(user: User | null): boolean {
  return hasRole(user, ROLE_ADMIN);
}

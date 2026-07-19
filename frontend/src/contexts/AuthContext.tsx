import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  ApiRequestError,
  clearTokens,
  fetchCurrentUser,
  getAccessToken,
  loginRequest,
  registerRequest,
  setTokens,
} from "@/api/client";
import type { RegisterFormValues } from "@/lib/validations/auth";
import type { User } from "@/types/auth";

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (values: RegisterFormValues) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const currentUser = await fetchCurrentUser();
      setUser(currentUser);
    } catch {
      clearTokens();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  const login = useCallback(async (username: string, password: string) => {
    const tokens = await loginRequest(username, password);
    setTokens(tokens.accessToken, tokens.refreshToken);
    const currentUser = await fetchCurrentUser();
    setUser(currentUser);
  }, []);

  const register = useCallback(async (values: RegisterFormValues) => {
    const response = await registerRequest(values);
    setTokens(response.accessToken, response.refreshToken);
    setUser({
      id: response.myUserResponseDto.id,
      username: response.myUserResponseDto.username,
      email: response.myUserResponseDto.email,
      role: response.myUserResponseDto.role,
      authorities: [{ authority: response.myUserResponseDto.role }],
      isBanned: response.myUserResponseDto.isBanned,
    });
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      register,
      logout,
    }),
    [user, isLoading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}

export function getAuthErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    if (error.validationErrors) {
      return Object.values(error.validationErrors)[0] ?? error.message;
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

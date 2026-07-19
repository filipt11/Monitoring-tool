import type {
  ApiError,
  JwtResponse,
  RegistrationResponse,
  User,
  ValidationErrors,
} from "@/types/auth";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export class ApiRequestError extends Error {
  status: number;
  validationErrors?: ValidationErrors;

  constructor(
    message: string,
    status: number,
    validationErrors?: ValidationErrors,
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.validationErrors = validationErrors;
  }
}

async function parseErrorResponse(response: Response): Promise<ApiRequestError> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const data = (await response.json()) as unknown;

    if (
      typeof data === "object" &&
      data !== null &&
      "message" in data &&
      typeof (data as ApiError).message === "string"
    ) {
      return new ApiRequestError(
        (data as ApiError).message ?? "Request failed",
        response.status,
      );
    }

    if (typeof data === "object" && data !== null) {
      return new ApiRequestError(
        "Validation failed",
        response.status,
        data as ValidationErrors,
      );
    }

    return new ApiRequestError("Request failed", response.status);
  }

  return new ApiRequestError(response.statusText || "Request failed", response.status);
}

let refreshPromise: Promise<JwtResponse> | null = null;

async function refreshAccessToken(): Promise<JwtResponse> {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    throw new ApiRequestError("Session expired", 401);
  }

  const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    clearTokens();
    throw await parseErrorResponse(response);
  }

  const tokens = (await response.json()) as JwtResponse;
  setTokens(tokens.accessToken, tokens.refreshToken);
  return tokens;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  const accessToken = getAccessToken();
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && retry && getRefreshToken()) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }

    try {
      await refreshPromise;
      return apiFetch<T>(path, options, false);
    } catch {
      throw new ApiRequestError("Session expired", 401);
    }
  }

  if (!response.ok) {
    throw await parseErrorResponse(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function loginRequest(username: string, password: string) {
  return apiFetch<JwtResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  }, false);
}

export async function registerRequest(payload: {
  username: string;
  email: string;
  password: string;
  password2: string;
}) {
  return apiFetch<RegistrationResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  }, false);
}

export async function fetchCurrentUser() {
  return apiFetch<User>("/api/me");
}

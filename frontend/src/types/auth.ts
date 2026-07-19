export interface Authority {
  authority: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  role?: string;
  authorities: Authority[];
  isBanned: boolean;
}

export interface JwtResponse {
  accessToken: string;
  refreshToken: string;
}

export interface RegistrationResponse extends JwtResponse {
  myUserResponseDto: {
    id: number;
    username: string;
    email: string;
    role: string;
    isBanned: boolean;
  };
}

export interface ApiError {
  message?: string;
  path?: string;
  timestamp?: string;
}

export type ValidationErrors = Record<string, string>;

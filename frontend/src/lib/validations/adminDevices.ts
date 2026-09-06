export interface CreateDeviceFormValues {
  ip: string;
  vendor: string;
  username: string;
  password: string;
  port: string;
  https: boolean;
}

export interface UpdateDeviceFormValues {
  port: string;
  https: boolean;
  username: string;
  password: string;
}

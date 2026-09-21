export interface ApiResponse<T> {
  userdata: T;
  message?: string;
}

export function response<T>(userdata: T, message?: string): ApiResponse<T> {
  return { userdata, message };
}

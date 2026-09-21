/**
 * users.ts — frontend client for user profiles.
 *
 * Thin wrapper over the shared `api` axios instance (which injects the JWT).
 * Unwraps the backend's `{ userdata }` envelope. Used by the Profile page.
 */
import api from "./api";
import type { UserProfileResponse } from "../types";

// Aggregate profile for any user by username (JWT-guarded on the backend).
export async function getUserProfile(
  username: string,
): Promise<UserProfileResponse> {
  const res = await api.get(`/users/${encodeURIComponent(username)}/profile`);
  return res.data.userdata as UserProfileResponse;
}

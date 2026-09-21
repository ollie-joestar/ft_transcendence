import { useContext } from "react";
import { AuthContext } from "../../auth/AuthContext";
import type { User } from "../../auth/AuthContext";

export function useAuthOptional(): { user: User | null } {
  const ctx = useContext(AuthContext);
  return { user: ctx?.user ?? null };
}

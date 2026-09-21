import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import api from "../lib/api";
import { AuthContext } from "./AuthContext";
import type { User } from "./AuthContext";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // When we load the app, we can check if the user is already logged in
  // by checking for a token in localStorage and fetching the user data
  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    // If there's no token, we can stop loading and show the login page instead
    if (!token) {
      setLoading(false);
      return;
    }

    api
      .get("/users/profile")
      .then((res) => setUser(res.data.userdata))
      .catch(() => {
        if (token) {
          console.warn("Token is invalid or expired, clearing tokens");
        }
        // If token is invalid or expired, clean it
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post("/auth/login", { email, password });
    localStorage.setItem("accessToken", res.data.accessToken);
    localStorage.setItem("refreshToken", res.data.refreshToken);

    // Fetch user after storing token
    const profile = await api.get("/users/profile");
    setUser(profile.data.userdata);
  };

  const register = async (
    email: string,
    username: string,
    password: string,
  ) => {
    const res = await api.post("/auth/register", { email, username, password });
    localStorage.setItem("accessToken", res.data.accessToken);
    localStorage.setItem("refreshToken", res.data.refreshToken);
  };

  const logout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    setUser(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

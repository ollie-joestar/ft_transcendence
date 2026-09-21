import { createContext } from "react";

export interface User {
  id: string;
  username: string;
  email: string;
  eloRating: number;
  avatarUrl: string | null;
  Wins: number;
  Losses: number;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    username: string,
    password: string,
  ) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);

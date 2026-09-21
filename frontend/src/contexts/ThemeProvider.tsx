import { useEffect, useState, type ReactNode } from "react";
import { ThemeContext } from "./DarkMode";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDarkMode, setDarkMode] = useState(
    () => localStorage.getItem("theme") === "dark",
  );
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
    localStorage.setItem("theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);
  const toggleDarkMode = () => setDarkMode((prev) => !prev);
  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

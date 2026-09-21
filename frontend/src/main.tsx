import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import { ThemeProvider } from "./contexts/ThemeProvider";
import { LocaleProvider } from "./contexts/LocaleProvider";
import ProtectedRoute from "./components/routing/ProtectedRoute";
import { SettingsMenu } from "./components/ui/SettingsMenu";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import LeaderboardPage from "./pages/LeaderboardPage";
import LobbiesPage from "./pages/LobbiesPage";
import RacesPage from "./pages/RacesPage";
import NotFound from "./pages/404Page";
import AboutGamePage from "./pages/AboutGamePage";
import AboutUsPage from "./pages/AboutUsPage";
import ProfilePage from "./pages/ProfilePage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import TermsOfServicePage from "./pages/TermsOfServicePage";
import ProfileRedirect from "./components/routing/ProfileRedirect";
import App from "./game/src/App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <LocaleProvider>
          <AuthProvider>
            <SettingsMenu />
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
              <Route
                path="/terms-of-service"
                element={<TermsOfServicePage />}
              />
              <Route
                path="/game"
                element={
                  <ProtectedRoute>
                    <App />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/leaderboard" element={<LeaderboardPage />} />
              <Route
                path="/lobby"
                element={
                  <ProtectedRoute>
                    <LobbiesPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/races" element={<RacesPage />} />
              <Route path="/about-game" element={<AboutGamePage />} />
              <Route path="/about-us" element={<AboutUsPage />} />
              <Route path="/profile" element={<ProfileRedirect />} />
              <Route path="/u/:username" element={<ProfilePage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </LocaleProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);

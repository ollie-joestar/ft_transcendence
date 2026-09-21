import { useState, type FormEvent } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { Logo, GhostNumber, SakuraPetals } from "../components/layout";
import { Button, Input } from "../components/ui";
import { useTranslation } from "../hooks/useTranslation";
import bgLight from "../assets/images/sign_in_light.png";
import bgDark from "../assets/images/sign_in_dark.png";
import { useDarkMode } from "../contexts/DarkMode";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const t = useTranslation("loginpage");
  const notice = (location.state as { message?: string } | null)?.message ?? "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { isDarkMode } = useDarkMode();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("loginFailed"));
    } finally {
      setLoading(false);
    }
  };

  const leftPanel = (
    <>
      <SakuraPetals />
      <div style={{ position: "relative", zIndex: 2 }}>
        <p
          className="animate-fade-up"
          style={{
            fontFamily: "var(--font-condensed)",
            fontSize: 11,
            color: "var(--accent)",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          {t("eyebrow")}
        </p>
        <h2
          className="animate-fade-up"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 58,
            lineHeight: 0.9,
            marginBottom: 20,
          }}
        >
          {t("headline")}
        </h2>
        <p
          className="animate-fade-up"
          style={{
            fontSize: 14,
            color: "var(--text-strong)",
            lineHeight: 1.65,
            marginBottom: 44,
            maxWidth: 260,
            fontWeight: 300,
          }}
        >
          {t("subtitle")}
        </p>
      </div>
    </>
  );

  const rightPanel = (
    <div>
      <div style={{ marginBottom: 32 }}>
        <div style={{ marginBottom: 48 }}>
          <Logo />
        </div>
        <h3
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 34,
            margin: "0 0 8px",
            letterSpacing: "0.04em",
          }}
        >
          {t("signIn")}
        </h3>
        <p style={{ fontSize: 13, color: "var(--text-strong)", margin: 0 }}>
          {t("noAccount")}{" "}
          <Link
            to="/register"
            style={{ color: "var(--accent)", textDecoration: "none" }}
          >
            {t("registerFree")}
          </Link>
        </p>
      </div>
      {notice && (
        <p
          style={{
            color: "var(--accent)",
            fontSize: 12,
            marginBottom: 16,
            lineHeight: 1.5,
          }}
        >
          {notice}
        </p>
      )}
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          marginBottom: 20,
        }}
        noValidate
      >
        <Input
          label={t("emailAddress")}
          type="email"
          placeholder="driver@sakuradrift.gg"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        <Input
          label={t("password")}
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          rightLabel={
            <button
              type="button"
              style={{
                background: "none",
                border: "none",
                color: "var(--muted)",
                cursor: "pointer",
                fontSize: 11,
              }}
            >
              {t("forgotPassword")}
            </button>
          }
        />
        {error && (
          <p style={{ color: "var(--danger)", fontSize: 12 }}>⚠ {error}</p>
        )}
        <Button
          type="submit"
          fullWidth
          disabled={loading}
          style={{ marginTop: 4 }}
        >
          {loading ? t("loading") : t("startEngine")}
        </Button>
      </form>
    </div>
  );

  return (
    <div className="relative h-screen overflow-hidden">
      <img
        src={isDarkMode ? bgDark : bgLight}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        style={{ objectPosition: "center 80%" }}
      />
      <div className="absolute inset-0 z-10 px-12 py-10 flex flex-col justify-center">
        {leftPanel}
      </div>

      <div
        className="absolute top-0 right-0 h-full w-[460px] bg-[var(--bg)] z-20
				flex flex-col justify-center px-12 border-l-2 border-[var(--accent)] overflow-hidden"
      >
        <GhostNumber
          value="疾"
          bottom={-50}
          right={-30}
          left="auto"
          size={260}
        />
        <div className="relative z-[1]">{rightPanel}</div>
      </div>
    </div>
  );
}

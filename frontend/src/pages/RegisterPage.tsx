import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { Logo, GhostNumber, SakuraPetals } from "../components/layout";
import { Button, Input } from "../components/ui";
import { useTranslation } from "../hooks/useTranslation";
import { getApiErrorMessage, getApiStatus } from "../lib/apiError";
import bgLight from "../assets/images/register_light.png";
import bgDark from "../assets/images/register_dark.png";
import { useDarkMode } from "../contexts/DarkMode";

// Local rules (the form sets noValidate, so native HTML validation is off —
// these are the source of truth). EMAIL_RE requires text@text.tld, so a value
// ending in just "@" (or with no dot) is rejected. USERNAME_RE blocks spaces
// and punctuation the backend wouldn't accept.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[A-Za-z0-9_-]+$/;

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const t = useTranslation("registerpage");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { isDarkMode } = useDarkMode();

  const emailInvalid = email.trim().length > 0 && !EMAIL_RE.test(email.trim());

  // First failing rule wins; returns a localized message or null when valid.
  const validate = (): string | null => {
    const e = email.trim();
    const u = username.trim();
    if (!e) return t("emailRequired");
    if (!EMAIL_RE.test(e)) return t("emailInvalid");
    if (!u) return t("usernameRequired");
    if (u.length < 3 || u.length > 15) return t("usernameLength");
    if (!USERNAME_RE.test(u)) return t("usernameChars");
    if (password.length < 8) return t("passwordTooShort");
    if (password !== confirm) return t("passwordsDoNotMatch");
    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setLoading(true);

    try {
      await register(email.trim(), username.trim(), password);
      navigate("/dashboard");
    } catch (err: unknown) {
      const status = getApiStatus(err);
      const apiMsg = getApiErrorMessage(err);
      // Username-taken and email-in-use both come back as 409 — disambiguate
      // on the backend's (English) message text.
      if (status === 409 && apiMsg && /user\s?name/i.test(apiMsg)) {
        setError(t("usernameTaken"));
      } else if (status === 409 && apiMsg && /email/i.test(apiMsg)) {
        setError(t("emailInUse"));
      } else {
        setError(apiMsg ?? t("registrationFailed"));
      }
    } finally {
      setLoading(false);
    }
  };

  const formPanel = (
    <>
      <GhostNumber value="疾" bottom={30} right={210} left="auto" size={260} />
      <div className="relative z-[2]">
        <div className="mb-12">
          <Logo />
        </div>
        <div className="mb-8">
          <h3 className="mb-2 [font-family:var(--font-display)] text-[34px] tracking-[0.04em]">
            {t("createAccount")}
          </h3>
          <p className="m-0 text-[13px] text-[var(--text-strong)]">
            {t("alreadyRacing")}{" "}
            <Link to="/login" className="text-[var(--accent)] no-underline">
              {t("signInLink")}
            </Link>
          </p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3.5"
          noValidate
        >
          <Input
            label={t("emailAddress")}
            type="email"
            placeholder="driver@sakuradrift.gg"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            error={emailInvalid}
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />

          <Input
            label={t("username")}
            type="text"
            placeholder="speedDemon69"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            maxLength={20}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />

          <div className="flex gap-2.5">
            <Input
              label={t("password")}
              type="password"
              placeholder="Min. 8 chars"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Input
              label={t("confirm")}
              type="password"
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              error={!!confirm && confirm !== password}
            />
          </div>

          {error && (
            <p className="text-[12px] text-[var(--danger)]">⚠ {error}</p>
          )}

          <Button type="submit" fullWidth disabled={loading} className="mt-1.5">
            {loading ? t("creatingAccount") : t("enterTheRace")}
          </Button>
        </form>
        <p className="mt-5 text-[11px] leading-[1.6] text-[var(--muted)]">
          {t("agreePrefix")}{" "}
          <Link
            to="/terms-of-service"
            className="cursor-pointer text-[var(--accent)]"
          >
            {t("termsOfService")}
          </Link>{" "}
          {t("agreeJoin")}{" "}
          <Link
            to="/privacy-policy"
            className="cursor-pointer text-[var(--accent)]"
          >
            {t("privacyPolicy")}
          </Link>
          .
        </p>
      </div>
    </>
  );

  const copyPanel = (
    <div className="animate-fade-up relative z-[2] max-w-[380px]">
      <p className="mb-2.5 [font-family:var(--font-condensed)] text-[11px] uppercase tracking-[0.22em] text-[var(--accent)]">
        {t("joinTheStartingGrid")}
      </p>
      <h2 className="mb-5 [font-family:var(--font-display)] text-[58px] leading-[0.9]">
        {t("raceYourWayToTheTop")}
      </h2>
      <p className="mb-10 [font-family:var(--font-body)] text-[14px] font-light leading-[1.65] text-[var(--text-strong)]">
        {t("competeWorldwide")}
      </p>
    </div>
  );

  return (
    <div className="relative h-screen overflow-hidden">
      <img
        src={isDarkMode ? bgDark : bgLight}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: "center 40%" }}
      />

      <div className="absolute inset-y-0 left-0 z-20 flex w-full flex-col justify-center overflow-y-auto border-r border-[var(--border)] bg-[var(--bg)] px-8 py-16 sm:w-[460px] sm:px-[60px]">
        {formPanel}
      </div>

      <div className="absolute inset-y-0 right-0 z-10 hidden w-[calc(100%-460px)] flex-col justify-center overflow-hidden px-[72px] py-16 lg:flex">
        <SakuraPetals />
        {copyPanel}
      </div>
    </div>
  );
}

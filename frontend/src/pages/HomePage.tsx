import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { Logo, SakuraPetals } from "../components/layout";
import { Button } from "../components/ui";
import { useFadeUp } from "../hooks/fadeAnimation";
import { useBackgroundMusic } from "../hooks/bgMusic";
import { useDarkMode } from "../contexts/DarkMode";
import { useTranslation } from "../hooks/useTranslation";
import bgMusic from "../assets/music/bgm.mp3";
import bgLight from "../assets/images/homepage_light.png";
import bgDark from "../assets/images/homepage_dark.png";

export default function HomePage() {
  const { user } = useAuth();
  const { playing, toggle } = useBackgroundMusic(bgMusic);
  const fadeUp = useFadeUp();
  const { isDarkMode } = useDarkMode();
  const t = useTranslation("homepage");

  return (
    // Fixed viewport height + overflow-hidden: the page itself can never scroll.
    // nav (shrink-0) / hero (flex-1, centered) / footer (shrink-0) split the height.
    <div className="relative flex h-screen flex-col overflow-hidden">
      <SakuraPetals />
      <img
        src={isDarkMode ? bgDark : bgLight}
        alt=""
        className="absolute inset-0 -z-10 h-full w-full object-cover"
      />

      {/* Nav */}
      <nav className="relative z-10 flex shrink-0 items-center gap-3 px-6 py-5 sm:px-12 lg:px-16">
        <Logo />
        <button
          onClick={toggle}
          title={playing ? t("muteMusic") : t("playMusic")}
          className={`ml-auto cursor-pointer border-none bg-transparent text-[18px] transition-opacity ${playing ? "opacity-100" : "opacity-45"}`}
        >
          {playing ? "🔊" : "🔇"}
        </button>

        <div
          {...fadeUp}
          className="flex items-center gap-3"
          style={{ marginRight: 39 }}
        >
          {user ? (
            <Link to="/dashboard">
              <Button variant="primary">{t("dashboard")}</Button>
            </Link>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost_blur" className="px-5 py-2 text-[13px]">
                  {t("signIn")}
                </Button>
              </Link>
              <Link to="/register">
                <Button variant="primary" className="px-5 py-2 text-[13px]">
                  {t("register")}
                </Button>
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero — vertically centered in whatever height is left over */}
      <div className="relative z-10 flex flex-1 flex-col justify-center px-6 sm:px-12 lg:px-16">
        <h1
          className="animate-fade-up [font-family:var(--font-display)] leading-[0.86]"
          style={{ fontSize: "clamp(72px, 12vw, 132px)" }}
        >
          SAKURA
          <br />
          <span className="text-[var(--accent)]">DRIFT</span>
        </h1>

        <div {...fadeUp} className="mb-9 mt-3 flex items-center gap-3">
          <div className="h-[2px] w-11 bg-[var(--accent)]" />
          <p className="[font-family:var(--font-body)] text-[12px] font-light uppercase tracking-[0.06em] text-[var(--accent)]">
            これは読まないでね
          </p>
        </div>

        <div {...fadeUp} className="flex flex-wrap gap-3">
          <Link to={user ? "/dashboard" : "/game"}>
            <Button variant="primary">⚡ {t("startDrifting")}</Button>
          </Link>
        </div>
      </div>

      {/* Footer links */}
      <div className="relative z-10 flex shrink-0 items-center justify-center gap-3 pb-3">
        <Link
          to="/privacy-policy"
          className="[font-family:var(--font-condensed)] text-[12px] uppercase tracking-[0.12em] text-[var(--accent)] transition-colors hover:text-[var(--accent)]"
        >
          {t("privacyPolicy")}
        </Link>
        <span className="text-[12px] text-[var(--accent)]">·</span>
        <Link
          to="/terms-of-service"
          className="[font-family:var(--font-condensed)] text-[12px] uppercase tracking-[0.12em] text-[var(--accent)] transition-colors hover:text-[var(--accent)]"
        >
          {t("termsOfService")}
        </Link>
      </div>

      {/* Bottom gradient line */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[linear-gradient(90deg,transparent,var(--accent),transparent)]" />
    </div>
  );
}

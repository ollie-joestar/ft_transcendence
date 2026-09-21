import { Link } from "react-router-dom";
import sakuraBgLight from "../assets/images/404_light.png";
import sakuraBgDark from "../assets/images/404_dark.png";
import { useDarkMode } from "../contexts/DarkMode";
import { useTranslation } from "../hooks/useTranslation";

export default function NotFound() {
  const { isDarkMode } = useDarkMode();
  const t = useTranslation("notfound");

  return (
    <main className="relative isolate min-h-screen overflow-hidden">
      <img
        src={isDarkMode ? sakuraBgDark : sakuraBgLight}
        alt=""
        className="absolute inset-0 -z-10 h-full w-full object-cover object-top"
      />

      <div className="flex min-h-screen items-end px-6 pb-16 sm:px-16 sm:pb-24 lg:px-24">
        <div className="max-w-md animate-fade-up">
          <div className="pointer-events-none mb-[-16px] select-none leading-none [font-family:var(--font-kanji)] text-[clamp(96px,14vw,160px)] text-[rgba(129,1,0,0.12)]">
            迷
          </div>

          <p className="mb-2.5 [font-family:var(--font-condensed)] text-[11px] uppercase tracking-[0.22em] text-[var(--accent)]">
            {t("errorLabel")}
          </p>

          <h1 className="mb-6 [font-family:var(--font-display)] text-[clamp(64px,9vw,108px)] leading-[0.88] tracking-[0.01em] text-[var(--text)]">
            {t("title")}
          </h1>

          {/* Divider */}
          <div className="mb-5 flex items-center gap-3.5">
            <div className="h-[1.5px] w-9 bg-[var(--accent)]" />
            <span className="[font-family:var(--font-kanji)] text-[11px] tracking-[0.1em] text-[var(--muted)]">
              ページが見つかりません
            </span>
          </div>

          {/* Body */}
          <p className="mb-10 max-w-[320px] [font-family:var(--font-body)] text-[14px] font-light leading-[1.7] text-[var(--text-strong)]">
            {t("body")}
          </p>

          {/* Back link — hover handled by Tailwind instead of JS handlers */}
          <Link
            to="/"
            className="inline-flex items-center gap-2.5 border-b border-[var(--accent)] pb-[3px] [font-family:var(--font-condensed)] text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--text)] transition-colors hover:text-[var(--accent)]"
          >
            {t("returnHome")}
          </Link>
        </div>
      </div>
    </main>
  );
}

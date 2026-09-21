import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useDarkMode } from "../../contexts/DarkMode";
import { useLocale, type Lang } from "../../contexts/Locale";
import { useAuth } from "../../auth/useAuth";
import { useTranslation } from "../../hooks/useTranslation";

const LANGS: { code: Lang; native: string; label: string }[] = [
  { code: "en", native: "EN", label: "English" },
  { code: "de", native: "DE", label: "Deutsch" },
  { code: "ja", native: "JP", label: "日本語" },
];

// labelKey resolves against the 'settings' namespace; path/icon are static.
const LINKS = [
  { labelKey: "home", path: "/", icon: "🏠" },
  { labelKey: "aboutUs", path: "/about-us", icon: "ℹ️" },
  { labelKey: "aboutGame", path: "/about-game", icon: "🎮" },
] as const;

const HIDDEN = ["/game"];

export function SettingsMenu() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const { lang, setLang } = useLocale();
  const { user, logout } = useAuth();
  const t = useTranslation("settings");

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node))
        setOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const handleNavigate = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const hidden = HIDDEN.some(
    (path) => pathname === path || pathname.startsWith(path + "/"),
  );
  if (hidden) return null;

  const handleLogout = () => {
    setOpen(false);
    logout();
  };

  return (
    <div ref={menuRef} className="fixed top-5 right-6 z-50">
      <button
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Menu"
        aria-expanded={open}
        className="flex flex-col items-center justify-center gap-[5px] w-11 h-11
				border border-[var(--border)] rounded bg-white/10 backdrop-blur-md
				hover:border-[var(--accent)] transition-colors"
        style={{ marginTop: 1 }}
      >
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className={`block h-[2px] w-5 bg-[var(--text)] transition-all duration-300
						${open && index === 0 ? "translate-y-[7px] rotate-45" : ""}
						${open && index === 1 ? "opacity-0" : ""}
						${open && index === 2 ? "-translate-y-[7px] -rotate-45" : ""}`}
          />
        ))}
      </button>

      <div
        className={`absolute right-0 mt-3 w-[230px] origin-top-right p-3
							flex flex-col gap-3 rounded-lg border border-[var(--border)]
							bg-[var(--bg)]/95 backdrop-blur-md shadow-xl
							transition-all duration-200
							${
                open
                  ? "opacity-100 scale-100 pointer-events-auto"
                  : "opacity-0 scale-95 pointer-events-none"
              }`}
      >
        {/* Theme switch */}
        <div className="flex items-center justify-between px-2 py-1">
          <span className="[font-family:var(--font-condensed)] text-[11px] tracking-[0.14em] uppercase text-[var(--text)]">
            {isDarkMode ? t("dark") : t("light")}
          </span>
          <button
            onClick={toggleDarkMode}
            role="switch"
            aria-checked={isDarkMode}
            className={`relative w-[46px] h-[24px] rounded-full transition-colors duration-300
									${isDarkMode ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`}
          >
            <span
              className={`absolute top-[3px] left-[3px] w-[18px] h-[18px] rounded-full
										bg-[var(--bg)] shadow flex items-center justify-center text-[10px]
										transition-transform duration-300
										${isDarkMode ? "translate-x-[22px]" : "translate-x-0"}`}
            >
              {isDarkMode ? "🌙" : "☀️"}
            </span>
          </button>
        </div>

        <div className="h-px bg-[var(--border)]" />

        {/* Language */}
        <div className="flex flex-col gap-1">
          <span className="px-2 [font-family:var(--font-condensed)] text-[9px] tracking-[0.18em] uppercase text-[var(--muted)]">
            {t("language")}
          </span>
          <div className="grid grid-cols-3 gap-1">
            {LANGS.map((language) => (
              <button
                key={language.code}
                onClick={() => setLang(language.code)}
                title={language.label}
                className={`py-1.5 rounded text-[11px] [font-family:var(--font-condensed)] tracking-[0.1em] transition-colors
											${
                        lang === language.code
                          ? "bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/40"
                          : "text-[var(--muted)] border border-transparent hover:text-[var(--text)]"
                      }`}
              >
                {language.native}
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-[var(--border)]" />

        {/* Page links */}
        <div className="flex flex-col gap-0.5">
          {LINKS.map(({ labelKey, path, icon }) => (
            <button
              key={path}
              onClick={() => handleNavigate(path)}
              className="flex items-center gap-3 px-2 py-2 rounded text-left
							[font-family:var(--font-condensed)] text-[11px] tracking-[0.12em] uppercase
							text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/5
							transition-colors"
            >
              <span className="w-4 text-center text-[13px]">{icon}</span>
              {t(labelKey)}
            </button>
          ))}
          {user ? (
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-2 py-2 rounded text-left
						[font-family:var(--font-condensed)] text-[11px] tracking-[0.12em] uppercase
						text-[var(--muted)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/5 transition-colors"
            >
              <span className="w-4 text-center text-[13px]">⏻</span>
              {t("logOut")}
            </button>
          ) : (
            <button
              onClick={() => handleNavigate("/login")}
              className="flex items-center gap-3 px-2 py-2 rounded text-left
							[font-family:var(--font-condensed)] text-[11px] tracking-[0.12em] uppercase
							text-[var(--muted)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/5 transition-colors"
            >
              <span className="w-4 text-center text-[13px]">↪</span>
              {t("logIn")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

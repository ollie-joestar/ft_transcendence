import { Link } from "react-router-dom";
import { useLocale } from "../contexts/Locale";
import legal from "../locales/legal.json";

const KANJI = "守"; // mamoru — to guard / protect

type Section = { h: string; body?: string[]; list?: string[] };
type LegalContent = {
  eyebrow: string;
  title: string;
  subtitle: string;
  updated: string;
  backToHome: string;
  footer: string;
  sections: Section[];
};

export default function PrivacyPolicyPage() {
  const { lang } = useLocale();
  const byLang = legal.privacy as Record<string, LegalContent>;
  const page = byLang[lang] ?? byLang.en;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--bg)] text-[var(--text)]">
      <span
        aria-hidden
        className="pointer-events-none select-none absolute top-[20px] right-[-30px] z-0 leading-none opacity-[0.04] [font-family:var(--font-display)]"
        style={{ fontSize: "clamp(220px,32vw,460px)" }}
      >
        {KANJI}
      </span>

      <div className="relative z-10 mx-auto max-w-[760px] px-6 sm:px-10 py-16 sm:py-24">
        <Link
          to="/"
          className="inline-block mb-12 [font-family:var(--font-condensed)] text-[11px] tracking-[0.15em] uppercase text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
        >
          {page.backToHome}
        </Link>

        <p className="[font-family:var(--font-condensed)] text-[12px] tracking-[0.22em] uppercase text-[var(--accent)]">
          {page.eyebrow}
        </p>
        <h1
          className="[font-family:var(--font-display)] leading-none tracking-[0.02em] mt-1"
          style={{ fontSize: "clamp(52px,9vw,92px)" }}
        >
          {page.title}
        </h1>
        <div className="mt-4 h-[2px] w-[60px] bg-[var(--accent)]" />
        <p className="[font-family:var(--font-body)] text-[14px] leading-relaxed text-[var(--muted)] mt-5 max-w-[560px]">
          {page.subtitle}
        </p>
        <p className="[font-family:var(--font-mono)] text-[11px] text-[var(--muted)] mt-3">
          {page.updated}
        </p>

        <div className="mt-14 flex flex-col gap-10">
          {page.sections.map((s, i) => (
            <section key={s.h}>
              <h2 className="flex items-baseline gap-3 [font-family:var(--font-display)] text-[22px] tracking-[0.03em] text-[var(--text)]">
                <span className="[font-family:var(--font-mono)] text-[12px] text-[var(--accent)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {s.h}
              </h2>
              {s.body?.map((p, j) => (
                <p
                  key={j}
                  className="[font-family:var(--font-body)] text-[14px] leading-relaxed text-[var(--muted)] mt-3"
                >
                  {p}
                </p>
              ))}
              {s.list && (
                <ul className="mt-3 flex flex-col gap-2">
                  {s.list.map((item, j) => (
                    <li
                      key={j}
                      className="flex gap-3 [font-family:var(--font-body)] text-[14px] leading-relaxed text-[var(--muted)]"
                    >
                      <span className="text-[var(--accent)] shrink-0 mt-[2px]">
                        ▪
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <div className="mt-16 [font-family:var(--font-condensed)] text-[11px] tracking-[0.12em] uppercase text-[var(--muted)]">
          {page.footer}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[linear-gradient(90deg,transparent,var(--accent),transparent)]" />
    </div>
  );
}

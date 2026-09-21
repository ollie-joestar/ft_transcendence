import { type ReactNode } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Logo } from "../components/layout";
import { Button } from "../components/ui";
import { useTranslation } from "../hooks/useTranslation";

const KANJI = "走";

// Kanji stay; title/body resolve against the 'aboutgame' namespace.
const FEATURES = [
  { kanji: "走", titleKey: "feature1Title", bodyKey: "feature1Body" },
  { kanji: "山", titleKey: "feature2Title", bodyKey: "feature2Body" },
  { kanji: "煙", titleKey: "feature3Title", bodyKey: "feature3Body" },
  { kanji: "桜", titleKey: "feature4Title", bodyKey: "feature4Body" },
] as const;

const MODES = [
  { tagKey: "mode1Tag", titleKey: "mode1Title", bodyKey: "mode1Body" },
  { tagKey: "mode2Tag", titleKey: "mode2Title", bodyKey: "mode2Body" },
  { tagKey: "mode3Tag", titleKey: "mode3Title", bodyKey: "mode3Body" },
] as const;

function Section({
  label,
  title,
  children,
}: {
  label?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-16">
      {label && (
        <p className="[font-family:var(--font-condensed)] text-[11px] tracking-[0.22em] uppercase text-[var(--muted)] mb-2">
          {label}
        </p>
      )}
      <h2 className="[font-family:var(--font-display)] text-[28px] tracking-[0.02em] mb-5">
        {title}
      </h2>
      <div className="[font-family:var(--font-body)] text-[15px] leading-relaxed text-[var(--text-strong)]">
        {children}
      </div>
    </section>
  );
}

export default function AboutGamePage() {
  const navigate = useNavigate();
  const t = useTranslation("aboutgame");

  return (
    <div className="animate-fade-up relative min-h-screen overflow-x-hidden bg-[var(--bg)] text-[var(--text)]">
      {/* Faint kanji watermark */}
      <span
        aria-hidden
        className="pointer-events-none select-none absolute -top-10 right-[-30px] z-0
					[font-family:var(--font-display)] text-[var(--text)] opacity-[0.04]
					text-[clamp(220px,32vw,460px)] leading-none"
      >
        {KANJI}
      </span>

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-6 sm:px-12 py-6">
        <Logo />
        <Link
          to="/"
          className="[font-family:var(--font-condensed)] text-[11px] tracking-[0.16em] uppercase
						text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
          style={{ marginRight: 30 }}
        >
          {t("back")}
        </Link>
      </header>

      {/* Page header */}
      <div className="relative z-10 max-w-[920px] mx-auto px-6 pt-10 pb-2">
        <p className="animate-fade-up [font-family:var(--font-condensed)] text-[12px] tracking-[0.22em] uppercase text-[var(--accent)] mb-3">
          {t("eyebrow")}
        </p>
        <h1 className="[font-family:var(--font-display)] leading-[0.9] tracking-[-0.01em] text-[clamp(48px,7vw,84px)]">
          SAKURA
          <br />
          DRIFT
        </h1>
        <div className="flex items-center gap-3 mt-6">
          <div className="w-11 h-[2px] bg-[var(--accent)] shrink-0" />
          <p className="[font-family:var(--font-body)] text-[14px] text-[var(--text-strong)] max-w-[560px] leading-relaxed font-light">
            {t("subtitle")}
          </p>
        </div>
      </div>

      {/* Content */}
      <main className="relative z-10 max-w-[920px] mx-auto px-6 pb-24">
        <Section label={`01 — ${t("premiseLabel")}`} title={t("premiseTitle")}>
          <p className="max-w-[640px]">{t("premiseBody")}</p>
        </Section>

        <Section
          label={`02 — ${t("featuresLabel")}`}
          title={t("featuresTitle")}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            {FEATURES.map((feature) => (
              <div
                key={feature.titleKey}
                className="relative overflow-hidden border border-[var(--border)] rounded-lg bg-white/25 p-5"
              >
                <span
                  aria-hidden
                  className="absolute -right-2 -bottom-4 select-none [font-family:var(--font-display)]
										text-[80px] leading-none text-[var(--accent)] opacity-[0.08]"
                >
                  {feature.kanji}
                </span>
                <h3 className="relative [font-family:var(--font-display)] text-[19px] tracking-[0.03em] text-[var(--text)] mb-2">
                  {t(feature.titleKey)}
                </h3>
                <p className="relative text-[13.5px] text-[var(--text-strong)] leading-relaxed max-w-[260px]">
                  {t(feature.bodyKey)}
                </p>
              </div>
            ))}
          </div>
        </Section>

        <Section label={`03 — ${t("modesLabel")}`} title={t("modesTitle")}>
          <div className="flex flex-col gap-3 mt-2">
            {MODES.map((mode, index) => (
              <div
                key={mode.tagKey}
                className="flex items-start gap-5 border-l-2 border-[var(--accent)] pl-5 py-2"
              >
                <span className="[font-family:var(--font-mono)] text-[11px] text-[var(--muted)] pt-1 w-7 shrink-0">
                  0{index + 1}
                </span>
                <div>
                  <p className="[font-family:var(--font-condensed)] text-[10px] tracking-[0.2em] uppercase text-[var(--accent)] mb-1">
                    {t(mode.tagKey)}
                  </p>
                  <h3 className="[font-family:var(--font-display)] text-[18px] mb-1">
                    {t(mode.titleKey)}
                  </h3>
                  <p className="text-[13.5px] text-[var(--text-strong)] leading-relaxed max-w-[420px]">
                    {t(mode.bodyKey)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* CTA */}
        <div className="mt-16 flex flex-col items-start gap-4 border-t border-[var(--border)] pt-10">
          <h2 className="[font-family:var(--font-display)] text-[32px] tracking-[0.02em]">
            {t("ctaTitle")}
          </h2>
          <div className="flex gap-3 flex-wrap">
            <Button variant="primary" onClick={() => navigate("/game")}>
              ⚡ {t("ctaStart")}
            </Button>
          </div>
        </div>
      </main>

      {/* Bottom accent */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[linear-gradient(90deg,transparent,var(--accent),transparent)]" />
    </div>
  );
}

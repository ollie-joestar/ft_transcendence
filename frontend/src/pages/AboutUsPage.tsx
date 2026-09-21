import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../components/layout";
import dVavryn from "../assets/images/team/dvavryn.png";
import dPlotzl from "../assets/images/team/dplotzl.png";
import oOhnivch from "../assets/images/team/oohnivch.png";
import hanjKim from "../assets/images/team/hanjkim.png";
import { useTranslation } from "../hooks/useTranslation";

const KANJI = "仲";

const TEAM = [
  {
    name: "Hanju Kim",
    roleKey: "roleFullstack",
    kanji: "地球",
    avatar: hanjKim,
  },
  {
    name: "Oleh Ohnivchuk",
    roleKey: "roleGame",
    kanji: "空気",
    avatar: oOhnivch,
  },
  { name: "Dominic Vavryn", roleKey: "roleAI", kanji: "水", avatar: dVavryn },
  { name: "Daniel Plötzl", roleKey: "roleCyber", kanji: "火", avatar: dPlotzl },
] as const;

const STACK = [
  {
    layer: "FRONTEND",
    items: [
      "React",
      "TypeScript",
      "Tailwind v4",
      "Three.js",
      "React Three Fiber",
      "@dimforge/rapier3d-compat",
    ],
  },
  {
    layer: "BACKEND",
    items: ["NestJS", "TypeScript", "PostgreSQL", "Prisma", "BCrypt"],
  },
  { layer: "CYBERSECURITY", items: ["NGINX + ModSecurity", "HashiCorp Vault"] },
  { layer: "AI", items: ["JavaScript"] },
  { layer: "INFRASTRUCTURE", items: ["Docker Compose"] },
];

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

export default function AboutUsPage() {
  const t = useTranslation("aboutus");

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
          ← Back
        </Link>
      </header>

      {/* Page header */}
      <div className="relative z-10 max-w-[920px] mx-auto px-6 pt-10 pb-2">
        <p className="[font-family:var(--font-condensed)] text-[12px] tracking-[0.22em] uppercase text-[var(--accent)] mb-3">
          {t("eyebrow")}
        </p>
        <h1 className="[font-family:var(--font-display)] leading-[0.9] tracking-[-0.01em] text-[clamp(48px,7vw,84px)]">
          {t("title")}
        </h1>
        <div className="flex items-center gap-3 mt-6">
          <div className="w-11 h-[2px] bg-[var(--accent)] shrink-0" />
          <p className="[font-family:var(--font-body)] text-[14px] text-[var(--text-strong)] max-w-[560px] leading-relaxed font-light">
            {t("subtitle")}
          </p>
        </div>
      </div>

      {/* Content */}
      <main className="animate-fade-up relative z-10 max-w-[920px] mx-auto px-6 pb-24">
        <Section label={`01 — ${t("projectLabel")}`} title={t("projectTitle")}>
          <p className="max-w-[640px]">{t("projectBody")}</p>
        </Section>

        <Section label={`02 — ${t("teamLabel")}`} title={t("teamTitle")}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
            {TEAM.map((member) => (
              <div
                key={member.name}
                className="relative overflow-hidden border border-[var(--border)] rounded-lg bg-white/25 p-5"
              >
                <span
                  aria-hidden
                  className="absolute -right-1 -bottom-3 select-none [font-family:var(--font-display)]
										text-[72px] leading-none text-[var(--accent)] opacity-[0.08]"
                >
                  {member.kanji}
                </span>
                <div className="relative">
                  <div className="w-39 h-39 rounded-full overflow-hidden border border-[var(--accent)]/40 mb-4">
                    <img
                      src={member.avatar}
                      alt={member.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="[font-family:var(--font-display)] text-[18px] tracking-[0.04em]">
                    {member.name}
                  </p>
                  <p className="[font-family:var(--font-condensed)] text-[11px] tracking-[0.14em] uppercase text-[var(--muted)] mt-1">
                    {t(member.roleKey)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section label={`03 — ${t("stackLabel")}`} title={t("stackTitle")}>
          <div className="flex flex-col gap-5 mt-2">
            {STACK.map((group) => (
              <div key={group.layer}>
                <p className="[font-family:var(--font-condensed)] text-[10px] tracking-[0.2em] uppercase text-[var(--accent)] mb-2">
                  {group.layer}
                </p>
                <div className="flex flex-wrap gap-2">
                  {group.items.map((item) => (
                    <span
                      key={item}
                      className="[font-family:var(--font-mono)] text-[12px] text-[var(--text-strong)] border border-[var(--border)] rounded px-3 py-1.5"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>
      </main>

      {/* Bottom accent */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[linear-gradient(90deg,transparent,var(--accent),transparent)]" />
    </div>
  );
}

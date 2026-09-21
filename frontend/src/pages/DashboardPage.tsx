import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { Logo } from "../components/layout";
import { ChatBox, FriendsPanel } from "../components/ui";
import { getMyStats, getMyPercentile } from "../lib/races";
import { getLobbies } from "../lib/lobbies";
import type { UserStats, UserPercentile } from "../types";
import { useDarkMode } from "../contexts/DarkMode";
import { useTranslation } from "../hooks/useTranslation";
import heroBgLight from "../assets/images/homepage_light.png";
import heroBgDark from "../assets/images/homepage_dark.png";
import racesCardLight from "../assets/images/races_card_light.png";
import racesCardDark from "../assets/images/races_card_dark.png";
import lobbyCardLight from "../assets/images/lobby_card_light.png";
import lobbyCardDark from "../assets/images/lobby_card_dark.png";
import leaderboardCardLight from "../assets/images/leaderboard_card_light.png";
import leaderboardCardDark from "../assets/images/leaderboard_card_dark.png";


import { type Friend } from "../hooks/useFriends";

const NAV_ITEMS = [
  { id: "dashboard", labelKey: "dashboard", path: "/dashboard" },
  { id: "user_profile", labelKey: "profile", path: "/profile" },
  { id: "leaderboards", labelKey: "leaderboards", path: "/leaderboard" },
] as const;

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const t = useTranslation("dashboard");
  const [stats, setStats] = useState<UserStats | null>(null);
  const [percentile, setPercentile] = useState<UserPercentile | null>(null);
  const [lobbyCount, setLobbyCount] = useState<number | null>(null);
  const { isDarkMode } = useDarkMode();

  const [isOpenChat, setOpenChat] = useState(false);
  const [friendForChat, setFriendForChat] = useState<Friend | null>(null);

  const messageFriend = (friend: Friend) => {
    if (!isOpenChat) setOpenChat(true);
    setFriendForChat(friend);
  };

  useEffect(() => {
    getMyStats()
      .then(setStats)
      .catch(() => {});
    getMyPercentile()
      .then(setPercentile)
      .catch(() => {});
    getLobbies()
      .then((l) => setLobbyCount(l.length))
      .catch(() => {});
  }, []);

  // Total time driven, stored in seconds (imprecise by design — meant to grow
  // big). Format as a compact h/m/s duration rather than a lap clock.
  const formatDuration = (totalSec: number): string => {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  // Total drift distance: metres under 1 km, kilometres at/above 1 km.
  const formatDrift = (meters: number): string =>
    meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${meters} m`;

  // Leaderboard percentile headline. Precision scales with magnitude so elite
  // ranks stay meaningful: ≥10 → whole (Top 33%), ≥1 → 1 dp (Top 5%), <1 →
  // 2 dp (Top 0.4% / Top 0.86%). Trailing zeros are trimmed.
  const trimZeros = (s: string): string => s.replace(/\.?0+$/, "");
  const formatPercentile = (p: number): string => {
    if (p >= 10) return `Top ${p.toFixed(0)}%`;
    if (p >= 1) return `Top ${trimZeros(p.toFixed(1))}%`;
    return `Top ${trimZeros(p.toFixed(2))}%`;
  };

  const cards = [
    {
      title: t("startARace"),
      desc: t("racesHistoryDesc"),
      cta: t("startARace"),
      img: isDarkMode ? racesCardDark: racesCardLight,
      onClick: () => navigate("/game"),
    },
    {
      title:
        lobbyCount && lobbyCount > 0
          ? lobbyCount === 1
            ? t("oneLobbyOpen", { count: lobbyCount })
            : t("multipleLobbiesOpen", { count: lobbyCount })
          : t("noLobbiesOpen"),
      desc: t("lobbiesDesc"),
      cta: t("browseLobbies"),
      img: isDarkMode ? lobbyCardDark: lobbyCardLight,
      onClick: () => navigate("/lobby"),
    },
    {
      title: t("leaderboards"),
      desc: t("leaderboardsDesc"),
      cta: t("viewLeaderboards"),
      img: isDarkMode ? leaderboardCardDark: leaderboardCardLight,
      onClick: () => navigate("/leaderboard"),
    },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      {/* ── Sidebar ──────────────────────────────────────────────
				Fixed-height flex column. Three zones:
				  • logo + nav  → shrink-0 (its height aligns the divider with the
				                  main-panel hero border; see note below)
				  • friends     → flex-1 min-h-0 overflow-y-auto = the ONLY scroll
				                  box, so the list scrolls in place instead of the
				                  whole sidebar growing past the viewport
				  • back button → shrink-0, sits flush at the bottom (lines up with
				                  the ChatBox), no magic margin needed
			*/}
      <aside className="flex h-full w-[220px] shrink-0 flex-col border-r border-[var(--border)] py-6">
        {/* Logo + nav. The 253px height makes this divider land on the
					hero/overview border in <main> (hero is 278px; 278 − 24 aside
					pt-6 ≈ 254, but 253 is what actually aligns — keep as-is). */}
        <div className="h-[253px] shrink-0">
          <div className="mb-8 px-1" style={{ marginLeft: "4px" }}>
            <Logo />
          </div>
          {/* Nav */}
          <nav className="flex flex-col gap-1 pt-6">
            {NAV_ITEMS.map((item) => {
              const active = item.id === "dashboard";
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.path)}
                  className={`flex items-center gap-3 border-l-2 px-10 py-2 [font-family:var(--font-condensed)] text-[11px] uppercase tracking-[0.15em] transition-colors
${
  active
    ? "border-[var(--accent)] bg-[var(--accent)]/5 text-[var(--accent)]"
    : "border-transparent text-[var(--muted)] hover:text-[var(--text)]"
}`}
                >
                  <span className="w-4 text-center text-[13px]">▪</span>
                  {t(item.labelKey)}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-[var(--border)]" />

        {/* Friends region: bounded height, no scroll here — FriendsPanel
					owns its own scroll so only the friend LIST scrolls while the
					"Friends" header + request/search controls stay pinned. */}
        <div className="flex min-h-0 flex-1 flex-col">
          <FriendsPanel messageFriend={messageFriend} />
        </div>

        <button
          onClick={() => navigate("/")}
          className="flex w-full shrink-0 items-center justify-center gap-3 border-t border-[var(--border)] px-6 pt-4 [font-family:var(--font-condensed)] text-[11px] uppercase tracking-[0.15em] text-[var(--accent)] transition-colors hover:text-[var(--text)]"
        >
          Back to Homepage
        </button>
      </aside>

      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <section className="relative h-[278px] shrink-0 overflow-hidden border-b border-[var(--border)]">
          <img
            src={isDarkMode ? heroBgDark : heroBgLight}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-60"
            style={{ objectPosition: "center 75%" }}
          />

          <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg)] via-[var(--bg)]/60 to-transparent" />

          <div className="relative z-10 flex h-full flex-col justify-center px-9">
            <p className="[font-family:var(--font-condensed)] text-[19px] uppercase tracking-[0.22em] text-[var(--accent)] mb-1">
              {t("welcomeBack")}
            </p>
            <h1 className="[font-family:var(--font-display)] text-[48px] leading-none tracking-[0.02em] text-[var(--text)]">
              {user?.username ?? "RACER"}
            </h1>
            <p className="[font-family:var(--font-body)] text-[13px] text-[var(--muted)] mt-2 max-w-[280px] leading-snug">
              {t("getBackOnTrack")}
            </p>
          </div>
        </section>

        {/* ─────── Overview ─────── */}
        <div className="flex flex-1 flex-col gap-7 px-6 py-7 sm:px-10 lg:px-12">
          <p className="[font-family:var(--font-condensed)] text-[12px] uppercase tracking-[0.22em] text-[var(--muted)]">
            {t("overview")}
          </p>

          {/* Three empty-state cards */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <div
                key={card.title}
                className="flex flex-col items-center gap-3 rounded-lg border border-[var(--border)] bg-surface px-6 py-7 text-center"
              >
                <div className="flex w-full flex-1 items-center justify-center">
                  <img
                    src={card.img}
                    alt=""
                    className="w-full max-w-[250px] object-contain"
                    style={{
                      maskImage:
                        "radial-gradient(ellipse farthest-side at center, #000 50%, transparent 78%)",
                      WebkitMaskImage:
                        "radial-gradient(ellipse farthest-side at center, #000 50%, transparent 78%)",
                    }}
                  />
                </div>
                <h3 className="[font-family:var(--font-display)] text-[18px] tracking-[0.04em] text-[var(--text)]">
                  {card.title}
                </h3>
                <p className="[font-family:var(--font-body)] text-[12px] leading-relaxed text-[var(--muted)] max-w-[200px]">
                  {card.desc}
                </p>
                <button
                  onClick={card.onClick}
                  className="mt-1 rounded border border-[var(--accent)]/40 px-5 py-2 [font-family:var(--font-condensed)] text-[11px] uppercase tracking-[0.15em] text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/5"
                >
                  {card.cta}
                </button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--border)] xl:grid-cols-4">
            {/* Laps completed */}
            <div className="flex items-center gap-3 bg-surface px-6 py-5">
              <span className="text-[18px] text-[var(--accent)]">◷</span>
              <div>
                <p className="[font-family:var(--font-condensed)] text-[9px] uppercase tracking-[0.18em] text-[var(--muted)]">
                  {t("lapsCompleted")}
                </p>
                <p className="[font-family:var(--font-display)] text-[22px] text-[var(--text)]">
                  {stats?.lapsCompleted ?? 0}
                </p>
              </div>
            </div>

            {/* Total time driven */}
            <div className="flex items-center gap-3 bg-surface px-6 py-5">
              <span className="text-[18px] text-[var(--accent)]">▲</span>
              <div>
                <p className="[font-family:var(--font-condensed)] text-[9px] uppercase tracking-[0.18em] text-[var(--muted)]">
                  {t("totalTimeDriven")}
                </p>
                <p className="[font-family:var(--font-display)] text-[22px] text-[var(--text)]">
                  {formatDuration(stats?.totalTimeSec ?? 0)}
                </p>
              </div>
            </div>

            {/* Total drift */}
            <div className="flex items-center gap-3 bg-surface px-6 py-5">
              <span className="text-[18px] text-[var(--accent)]">≈</span>
              <div>
                <p className="[font-family:var(--font-condensed)] text-[9px] uppercase tracking-[0.18em] text-[var(--muted)]">
                  {t("totalDrift")}
                </p>
                <p className="[font-family:var(--font-display)] text-[22px] text-[var(--text)]">
                  {formatDrift(stats?.totalDriftM ?? 0)}
                </p>
              </div>
            </div>

            {/* Leaderboard rank (percentile, averaged across tracks raced) */}
            <div className="flex items-center gap-3 bg-surface px-6 py-5">
              <span className="text-[18px] text-[var(--accent)]">★</span>
              <div className="min-w-0 flex-1">
                <p className="[font-family:var(--font-condensed)] text-[9px] uppercase tracking-[0.18em] text-[var(--muted)]">
                  {t("leaderboardRank")}
                </p>
                <p className="[font-family:var(--font-display)] text-[22px] text-[var(--text)]">
                  {(percentile?.ranks?.length ?? 0) > 0 &&
                  percentile!.ranks.every((r) => r === 1)
                    ? t("driftKing")
                    : percentile?.topPercent != null
                      ? formatPercentile(percentile.topPercent)
                      : t("unranked")}
                </p>
                {percentile?.topPercent != null && (
                  <p className="[font-family:var(--font-mono)] text-[8px] text-[var(--muted)] mt-1">
                    {percentile.trackCount === 1
                      ? t("averagedOverTrack", { count: percentile.trackCount })
                      : t("averagedOverTracks", {
                          count: percentile.trackCount,
                        })}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
        {isOpenChat ? (
          <ChatBox setOpenChat={setOpenChat} friend={friendForChat} />
        ) : null}
      </main>
    </div>
  );
}

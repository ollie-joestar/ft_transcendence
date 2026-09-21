import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { useFriends } from "../hooks/useFriends";
import { Logo } from "../components/layout";
import { Button } from "../components/ui";
import { useTranslation } from "../hooks/useTranslation";
import { getUserProfile } from "../lib/users";

interface ProfileStats {
  totalRaces: number;
  wins: number;
  totalTimeSec: number;
  lapsCompleted: number;
  totalDriftM: number;
  topPercent: number | null;
  trackCount: number;
}

interface TrackBest {
  track: string;
  timeMs: number;
  rank: number;
}

const ALL_TRACKS = ["Tengu", "Kirin", "Orochi", "Raijin"] as const;

interface CareerHighlights {
  podiums: number;
  longestWinStreak: number;
  favoriteTrack: string | null;
}

interface UserProfile {
  id: string;
  username: string;
  joinedAt: string;
  avatarUrl?: string | null;
  stats: ProfileStats;
  bestsByTrack: TrackBest[];
  career: CareerHighlights;
  relationship?:
    | "self"
    | "friends"
    | "request_sent"
    | "request_received"
    | "none";
}

function useProfile(username?: string) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!username) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    getUserProfile(username)
      .then((r) => {
        if (cancelled) return;
        setProfile({
          id: r.id,
          username: r.username,
          joinedAt: r.joinedAt,
          avatarUrl: null,
          stats: {
            totalRaces: r.stats.totalRaces,
            wins: r.stats.wins,
            totalTimeSec: r.stats.totalTimeSec,
            lapsCompleted: r.stats.lapsCompleted,
            totalDriftM: r.stats.totalDriftM,
            topPercent: r.percentile.topPercent,
            trackCount: r.percentile.trackCount,
          },
          bestsByTrack: r.bestsByTrack.map((b) => ({
            track: b.track,
            timeMs: b.lapTimeMs,
            rank: b.rank,
          })),
          career: r.career,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.response?.status === 404) setNotFound(true);
        else setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [username]);

  return { profile, loading, notFound };
}

function formatTime(ms: number | null): string {
  if (ms == null) return "--:--.---";
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${millis.toString().padStart(3, "0")}`;
}

function formatDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDrift(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${meters} m`;
}

// Returns null when unranked so the caller can localize that label.
function formatPercentile(p: number | null): string | null {
  if (p == null) return null;
  const trim = (s: string) => s.replace(/\.?0+$/, "");
  if (p >= 10) return `Top ${p.toFixed(0)}%`;
  if (p >= 1) return `Top ${trim(p.toFixed(1))}%`;
  return `Top ${trim(p.toFixed(2))}%`;
}

function Stat({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | number;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 px-6 py-5 bg-surface">
      <p className="[font-family:var(--font-condensed)] text-[9px] tracking-[0.18em] uppercase text-[var(--muted)]">
        {label}
      </p>
      <p
        className={`text-[var(--text)] ${mono ? "[font-family:var(--font-mono)] text-[20px]" : "[font-family:var(--font-display)] text-[22px]"}`}
      >
        {value}
      </p>
    </div>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="[font-family:var(--font-condensed)] text-[12px] tracking-[0.22em] uppercase text-[var(--muted)] mb-4">
        {label}
      </h2>
      {children}
    </section>
  );
}

export default function UserProfilePage() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { addFriend, friends } = useFriends();
  const t = useTranslation("profile");
  const { profile, loading, notFound } = useProfile(username);
  const [relationship, setRelationship] = useState<
    UserProfile["relationship"] | null
  >(null);

  useEffect(() => {
    setRelationship(null);
  }, [username]);

  useEffect(() => {
    if (!authLoading && !user)
      navigate("/login", {
        replace: true,
        state: { message: t("loginRequired") },
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, navigate]);

  if (authLoading || !user)
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <p className="[font-family:var(--font-condensed)] text-[12px] tracking-[0.2em] uppercase text-[var(--muted)]">
          {t("redirectingLogin")}
        </p>
      </div>
    );

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <p className="[font-family:var(--font-condensed)] text-[12px] tracking-[0.2em] uppercase text-[var(--muted)]">
          {t("loadingProfile")}
        </p>
      </div>
    );

  if (notFound || !profile)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[var(--bg)]">
        <p className="[font-family:var(--font-display)] text-[64px] text-[var(--text)] opacity-60">
          迷
        </p>
        <p className="[font-family:var(--font-body)] text-[14px] text-[var(--muted)]">
          {t("noDriverNamed", { username: username ?? "" })}
        </p>
        <Button variant="ghost_blur" onClick={() => navigate(-1)}>
          {t("goBack")}
        </Button>
      </div>
    );

  const isSelf = user?.username === profile.username;
  const { stats } = profile;
  const isDriftKing =
    profile.bestsByTrack.length > 0 &&
    profile.bestsByTrack.every((b) => b.rank === 1);
  const isFriend = friends.some((f) => f.id === profile.id);
  const relationshipStatus =
    relationship ?? profile.relationship ?? (isFriend ? "friends" : "none");

  const handleAddFriend = async () => {
    setRelationship(
      relationshipStatus === "request_received" ? "friends" : "request_sent",
    );
    try {
      await addFriend(profile.id);
    } catch {
      setRelationship("none");
    }
  };

  const rankValue = isDriftKing
    ? t("driftKing")
    : stats.topPercent == null
      ? t("unranked")
      : formatPercentile(stats.topPercent)!;

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[var(--bg)] text-[var(--text)]">
      <span
        aria-hidden
        className="pointer-events-none select-none absolute -top-10 right-[-30px] z-0
					[font-family:var(--font-display)] text-[var(--text)] opacity-[0.04]
					text-[clamp(220px,32vw,460px)] leading-none"
      >
        {profile.username}
      </span>

      <header className="relative z-10 flex items-center justify-between px-6 sm:px-12 py-6">
        <Logo />
        <Link
          to="/dashboard"
          className="[font-family:var(--font-condensed)] text-[11px] tracking-[0.16em] uppercase text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
          style={{ marginRight: 30 }}
        >
          {t("back")}
        </Link>
      </header>

      <main className="relative z-10 max-w-[920px] mx-auto px-6 pb-24">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 border-b border-[var(--border)] pb-8">
          <div className="w-20 h-20 rounded-full border-2 border-[var(--accent)]/50 bg-[var(--accent)]/15 flex items-center justify-center shrink-0 overflow-hidden">
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="[font-family:var(--font-display)] text-[32px] text-[var(--accent)]">
                {profile.username.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="[font-family:var(--font-display)] text-[44px] leading-none tracking-[0.02em]">
                {profile.username}
              </h1>
            </div>
            <p className="[font-family:var(--font-condensed)] text-[11px] tracking-[0.16em] uppercase text-[var(--muted)] mt-1">
              {t("since")}{" "}
              {new Date(profile.joinedAt).toLocaleDateString(undefined, {
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>

          <div className="flex gap-2 shrink-0">
            {isSelf ? null : relationshipStatus === "friends" ? (
              <span className="[font-family:var(--font-condensed)] text-[11px] tracking-[0.14em] uppercase text-[var(--success)] self-center px-2">
                {t("friends")}
              </span>
            ) : relationshipStatus === "request_sent" ? (
              <Button variant="ghost_blur" disabled>
                {t("requestSent")}
              </Button>
            ) : relationshipStatus === "request_received" ? (
              <Button variant="primary" onClick={() => void handleAddFriend()}>
                {t("acceptRequest")}
              </Button>
            ) : (
              <Button variant="primary" onClick={() => void handleAddFriend()}>
                {t("addFriend")}
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-[var(--border)] border border-[var(--border)] rounded-lg overflow-hidden mt-8">
          <Stat label={t("statRaces")} value={stats.totalRaces} />
          <Stat label={t("statWins")} value={stats.wins} />
          <Stat
            label={t("statTotalTime")}
            value={formatDuration(stats.totalTimeSec)}
          />
          <Stat label={t("statTotalLaps")} value={stats.lapsCompleted} />
          <Stat
            label={t("statTotalDrift")}
            value={formatDrift(stats.totalDriftM)}
          />
          <Stat label={t("statLeaderboardRank")} value={rankValue} />
        </div>

        <Section label={t("personalBests")}>
          <div className="flex flex-col divide-y divide-[var(--border)] border border-[var(--border)] rounded-lg overflow-hidden">
            {ALL_TRACKS.map((track) => {
              const best = profile.bestsByTrack.find((b) => b.track === track);
              return (
                <div
                  key={track}
                  className="flex items-center justify-between px-5 py-3 bg-surface"
                >
                  <div className="flex items-center gap-4">
                    <span
                      className={`[font-family:var(--font-display)] text-[16px] w-8 ${best?.rank === 1 ? "text-[var(--accent)]" : "text-[var(--muted)]"}`}
                    >
                      {best ? `#${best.rank}` : "—"}
                    </span>
                    <span className="[font-family:var(--font-body)] text-[13px] text-[var(--text)]">
                      {track}
                    </span>
                  </div>
                  {best ? (
                    <span className="[font-family:var(--font-mono)] text-[14px] text-[var(--text)]">
                      {formatTime(best.timeMs)}
                    </span>
                  ) : (
                    <span className="[font-family:var(--font-mono)] text-[12px] tracking-[0.1em] uppercase text-[var(--muted)]">
                      {t("noTimeSet")}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </Section>

        <Section label={t("careerHighlights")}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[var(--border)] border border-[var(--border)] rounded-lg overflow-hidden">
            <Stat
              label={t("winRate")}
              value={
                stats.totalRaces > 0
                  ? `${Math.round((stats.wins / stats.totalRaces) * 100)}%`
                  : "—"
              }
            />
            <Stat label={t("podiums")} value={profile.career.podiums} />
            <Stat
              label={t("longestWinStreak")}
              value={profile.career.longestWinStreak}
            />
            <Stat
              label={t("favoriteTrack")}
              value={profile.career.favoriteTrack ?? "—"}
            />
          </div>
        </Section>
      </main>

      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[linear-gradient(90deg,transparent,var(--accent),transparent)]" />
    </div>
  );
}

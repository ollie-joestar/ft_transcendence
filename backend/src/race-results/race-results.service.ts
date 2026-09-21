/**
 * RaceResultsService — data layer for the race-history / leaderboard feature.
 *
 * Every finished race is stored as one append-only `race_results` row. Personal
 * bests, per-track leaderboards, and profile stats are all *derived* from that
 * history with Prisma queries (nothing is pre-aggregated), so a profile can show
 * a full race history rather than a single "best" row.
 */
import { Injectable } from '@nestjs/common';
import { MatchMode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RaceResultsService {
  constructor(private prisma: PrismaService) {}

  // Record one finished race. mode is forced to NORMAL for now (see plan):
  // every race is NORMAL until other modes are wired up.
  //
  // `trial` marks a single time-trial lap (e.g. a new personal best set during
  // a solo / infinite-laps run). Trial rows still count toward personal bests
  // and the leaderboard, but are excluded from race history and the
  // totalRaces / wins stats (they aren't a completed race).
  async create(data: {
    userId: string;
    track: string;
    lapTimeMs: number;
    raceTimeMs?: number | null;
    position?: number | null;
    trial?: boolean;
  }) {
    return this.prisma.raceResult.create({
      data: {
        userId: data.userId,
        track: data.track,
        lapTimeMs: data.lapTimeMs,
        raceTimeMs: data.raceTimeMs ?? null,
        position: data.position ?? null,
        mode: MatchMode.NORMAL,
        trial: data.trial ?? false,
      },
    });
  }

  // Record one completed lap (every mode: bot / multiplayer / time-trial /
  // free-roam). Bumps the user's running counters atomically — laps +1, total
  // time by the lap's seconds, and total drift by the metres slid during it.
  // Time is stored in *seconds* (lap ms / 1000) and drift in whole metres: the
  // headline totals want to be big, not finely precise.
  async recordLap(userId: string, lapTimeMs: number, driftMeters = 0) {
    const lapSeconds = Math.round(lapTimeMs / 1000);
    const drift = Math.max(0, Math.round(driftMeters));
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        lapsCompleted: { increment: 1 },
        totalTimeSec: { increment: lapSeconds },
        totalDriftM: { increment: drift },
      },
      select: { lapsCompleted: true, totalTimeSec: true, totalDriftM: true },
    });
  }

  // Recent-first race history for a user — feeds the profile page.
  // Trial laps are excluded (they aren't actual completed races).
  async findHistoryByUser(userId: string, limit = 20) {
    return this.prisma.raceResult.findMany({
      where: { userId, trial: false },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // A user's single fastest lap on a given track (null if they never raced it).
  async personalBest(userId: string, track: string) {
    return this.prisma.raceResult.findFirst({
      where: { userId, track },
      orderBy: { lapTimeMs: 'asc' },
    });
  }

  // Aggregate block for the profile header: total races, wins (1st place),
  // and the best lap on each track the user has driven.
  async userStats(userId: string) {
    // totalRaces / wins count completed races only (trial laps excluded);
    // best-lap-per-track includes trial laps so a time-trial PB shows up.
    // lapsCompleted / totalTimeSec are running counters on the user row
    // (every-mode lap totals — see recordLap).
    const [totalRaces, wins, bestPerTrack, driving] = await Promise.all([
      this.prisma.raceResult.count({ where: { userId, trial: false } }),
      this.prisma.raceResult.count({
        where: { userId, trial: false, position: 1 },
      }),
      this.prisma.raceResult.groupBy({
        by: ['track'],
        where: { userId },
        _min: { lapTimeMs: true },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { lapsCompleted: true, totalTimeSec: true, totalDriftM: true },
      }),
    ]);

    return {
      totalRaces,
      wins,
      lapsCompleted: driving?.lapsCompleted ?? 0,
      totalTimeSec: driving?.totalTimeSec ?? 0,
      totalDriftM: driving?.totalDriftM ?? 0,
      bestLapPerTrack: bestPerTrack.map((row) => ({
        track: row.track,
        lapTimeMs: row._min.lapTimeMs,
      })),
    };
  }

  // Leaderboard percentile for the dashboard headline.
  //
  // Leaderboards are per-track, so we compute the user's percentile on each
  // track they've raced and average those fractions into one number. The
  // denominator is "ranked drivers" — users who have a recorded lap on that
  // track (not the whole user base). A smaller percentile is better:
  // rank 20 of 60 → 33.3%, rank 1 of 400 → 0.25%.
  //
  // Returns topPercent as a precise float (e.g. 0.4, 0.86) so the UI can show
  // fine-grained ranks; null when the user has no recorded laps anywhere.
  async userPercentile(userId: string) {
    // Tracks the user has at least one best lap on.
    const userTracks = await this.prisma.raceResult.groupBy({
      by: ['track'],
      where: { userId },
      _min: { lapTimeMs: true },
    });

    let sum = 0;
    let counted = 0;
    // The user's leaderboard position on each counted track, so the UI can
    // spot a clean sweep (1st everywhere → "Drift King") without re-querying.
    const ranks: number[] = [];
    for (const t of userTracks) {
      const userBest = t._min.lapTimeMs;
      if (userBest === null) continue;
      // Every ranked driver's best lap on this track.
      const grouped = await this.prisma.raceResult.groupBy({
        by: ['userId'],
        where: { track: t.track },
        _min: { lapTimeMs: true },
      });
      const total = grouped.length;
      if (total === 0) continue;
      // Rank = number of drivers strictly faster, +1 (ties share a rank).
      const faster = grouped.filter(
        (g) => g._min.lapTimeMs !== null && g._min.lapTimeMs < userBest,
      ).length;
      const rank = faster + 1;
      ranks.push(rank);
      sum += rank / total;
      counted++;
    }

    if (counted === 0) return { topPercent: null, trackCount: 0, ranks };
    return { topPercent: (sum / counted) * 100, trackCount: counted, ranks };
  }

  // Best lap on each track the user has driven, with the user's leaderboard
  // rank on that track (1 = fastest). Rank = drivers strictly faster + 1, so
  // ties share a rank — same convention as userPercentile / leaderboard.
  // Feeds the profile's "Personal bests" list.
  async userBestsRanked(userId: string) {
    const userTracks = await this.prisma.raceResult.groupBy({
      by: ['track'],
      where: { userId },
      _min: { lapTimeMs: true },
    });

    const bests: { track: string; lapTimeMs: number; rank: number }[] = [];
    for (const t of userTracks) {
      const userBest = t._min.lapTimeMs;
      if (userBest === null) continue;
      // Every ranked driver's best lap on this track.
      const grouped = await this.prisma.raceResult.groupBy({
        by: ['userId'],
        where: { track: t.track },
        _min: { lapTimeMs: true },
      });
      const faster = grouped.filter(
        (g) => g._min.lapTimeMs !== null && g._min.lapTimeMs < userBest,
      ).length;
      bests.push({ track: t.track, lapTimeMs: userBest, rank: faster + 1 });
    }
    // Best (lowest) rank first, then fastest lap.
    bests.sort((a, b) => a.rank - b.rank || a.lapTimeMs - b.lapTimeMs);
    return bests;
  }

  // Career highlights derived from the user's race history: podium finishes,
  // longest consecutive-win streak (completed races only — trial laps excluded),
  // and the favorite track. Cheap to compute over a single ordered scan.
  async userCareer(userId: string) {
    // Includes trial laps so Time Trial time counts toward the favorite track.
    const races = await this.prisma.raceResult.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: {
        position: true,
        track: true,
        raceTimeMs: true,
        lapTimeMs: true,
        trial: true,
      },
    });

    let podiums = 0;
    let longestWinStreak = 0;
    let currentStreak = 0;
    // Favorite track = the track with the most *time* driven on it. A completed
    // race contributes its full raceTimeMs; a Time Trial lap contributes its
    // lapTimeMs (Time Trial never produces a finish row, so the per-lap trial
    // rows are its only time record — no overlap with raceTimeMs). trackCounts
    // is a fallback for the unlikely case where no row carries any time.
    const trackTime = new Map<string, number>();
    const trackCounts = new Map<string, number>();

    for (const r of races) {
      if (r.trial) {
        // Time-trial lap: contributes its lap time to time-on-track only
        // (no position / streak / race count).
        trackTime.set(r.track, (trackTime.get(r.track) ?? 0) + r.lapTimeMs);
        continue;
      }
      if (r.position !== null && r.position <= 3) podiums++;
      if (r.position === 1) {
        currentStreak++;
        if (currentStreak > longestWinStreak) longestWinStreak = currentStreak;
      } else {
        currentStreak = 0;
      }
      if (r.raceTimeMs !== null) {
        trackTime.set(r.track, (trackTime.get(r.track) ?? 0) + r.raceTimeMs);
      }
      trackCounts.set(r.track, (trackCounts.get(r.track) ?? 0) + 1);
    }

    // Prefer the track with the most time driven; if no row carried a time,
    // fall back to the most-raced track.
    let favoriteTrack: string | null = null;
    let mostTime = 0;
    for (const [track, ms] of trackTime) {
      if (ms > mostTime) {
        mostTime = ms;
        favoriteTrack = track;
      }
    }
    if (favoriteTrack === null) {
      let mostRaces = 0;
      for (const [track, count] of trackCounts) {
        if (count > mostRaces) {
          mostRaces = count;
          favoriteTrack = track;
        }
      }
    }

    return { podiums, longestWinStreak, favoriteTrack };
  }

  // Per-track leaderboard: each user's best lap, ranked ascending.
  // groupBy collapses every user's history to their fastest lap, then we
  // attach usernames in a second query (keyed by id).
  async leaderboard(track: string, limit = 20) {
    const grouped = await this.prisma.raceResult.groupBy({
      by: ['userId'],
      where: { track },
      _min: { lapTimeMs: true },
      orderBy: { _min: { lapTimeMs: 'asc' } },
      take: limit,
    });

    const users = await this.prisma.user.findMany({
      where: { id: { in: grouped.map((g) => g.userId) } },
      select: { id: true, username: true },
    });
    const usernameById = new Map(users.map((u) => [u.id, u.username]));

    return grouped.map((g, index) => ({
      rank: index + 1,
      userId: g.userId,
      username: usernameById.get(g.userId) ?? null,
      lapTimeMs: g._min.lapTimeMs,
    }));
  }
}

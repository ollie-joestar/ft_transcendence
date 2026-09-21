/**
 * RaceResultsController — HTTP surface for the race-history / leaderboard feature.
 *
 * Routes (all responses wrapped by `response()` → `{ userdata }`):
 *   POST /races              (JWT)  record a finished race for the current user
 *   GET  /races/me           (JWT)  caller's recent history
 *   GET  /races/me/stats     (JWT)  caller's aggregate stats (profile header)
 *   GET  /races/leaderboard  public per-track ranking by best lap
 *   GET  /races/user/:id     public any user's history (friend/profile views)
 *
 * Times are client-reported (there is no server-side race simulation), so the
 * write path validates ranges to keep obviously-bogus values out of the board.
 */
import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { response } from '../common/response';
import { RaceResultsService } from './race-results.service';

interface AuthenticatedRequest extends Request {
  user: User;
}

class CreateRaceResultDto {
  track: string;
  lapTimeMs: number;
  raceTimeMs?: number;
  position?: number;
  trial?: boolean;
}

class RecordLapDto {
  lapTimeMs: number;
  driftMeters?: number;
}

// Sanity bounds so a spoofed/garbage client can't poison the leaderboard.
// (Times are client-reported — there is no server-side simulation.)
const MAX_TIME_MS = 60 * 60 * 1000; // 1 hour
const MAX_TRACK_LEN = 64;
const MAX_DRIFT_M = 1_000_000; // 1000 km of drift in a single lap — generous garbage bound

function requireTime(value: number, field: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value <= 0 ||
    value > MAX_TIME_MS
  ) {
    throw new BadRequestException(`Invalid ${field}`);
  }
  return value;
}

function clampLimit(raw?: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 20;
  return Math.min(Math.floor(n), 100);
}

@Controller('races')
export class RaceResultsController {
  constructor(private races: RaceResultsService) {}

  // Record a finished race for the authenticated user.
  // userId always comes from the verified JWT, never the request body.
  @UseGuards(JwtAuthGuard)
  @Post()
  async submit(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateRaceResultDto,
  ) {
    if (
      !body.track ||
      typeof body.track !== 'string' ||
      body.track.length > MAX_TRACK_LEN
    ) {
      throw new BadRequestException('Invalid track');
    }
    const lapTimeMs = requireTime(body.lapTimeMs, 'lapTimeMs');

    let raceTimeMs: number | null = null;
    if (body.raceTimeMs !== undefined && body.raceTimeMs !== null) {
      raceTimeMs = requireTime(body.raceTimeMs, 'raceTimeMs');
    }

    let position: number | null = null;
    if (body.position !== undefined && body.position !== null) {
      if (!Number.isInteger(body.position) || body.position <= 0) {
        throw new BadRequestException('Invalid position');
      }
      position = body.position;
    }

    const result = await this.races.create({
      userId: req.user.id,
      track: body.track,
      lapTimeMs,
      raceTimeMs,
      position,
      trial: body.trial === true,
    });
    return response(result);
  }

  // Record one completed lap for the authenticated user (every mode). Bumps the
  // running laps-completed + total-time-driven counters. userId from the JWT.
  @UseGuards(JwtAuthGuard)
  @Post('lap')
  async recordLap(
    @Req() req: AuthenticatedRequest,
    @Body() body: RecordLapDto,
  ) {
    const lapTimeMs = requireTime(body.lapTimeMs, 'lapTimeMs');

    let driftMeters = 0;
    if (body.driftMeters !== undefined && body.driftMeters !== null) {
      if (
        !Number.isInteger(body.driftMeters) ||
        body.driftMeters < 0 ||
        body.driftMeters > MAX_DRIFT_M
      ) {
        throw new BadRequestException('Invalid driftMeters');
      }
      driftMeters = body.driftMeters;
    }

    return response(
      await this.races.recordLap(req.user.id, lapTimeMs, driftMeters),
    );
  }

  // The authenticated user's own recent race history.
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async myHistory(
    @Req() req: AuthenticatedRequest,
    @Query('limit') limit?: string,
  ) {
    return response(
      await this.races.findHistoryByUser(req.user.id, clampLimit(limit)),
    );
  }

  // The authenticated user's aggregate stats (profile header).
  @UseGuards(JwtAuthGuard)
  @Get('me/stats')
  async myStats(@Req() req: AuthenticatedRequest) {
    return response(await this.races.userStats(req.user.id));
  }

  // The authenticated user's leaderboard percentile (averaged across tracks).
  @UseGuards(JwtAuthGuard)
  @Get('me/percentile')
  async myPercentile(@Req() req: AuthenticatedRequest) {
    return response(await this.races.userPercentile(req.user.id));
  }

  // Public per-track leaderboard, ranked by best lap.
  @Get('leaderboard')
  async leaderboard(
    @Query('track') track: string,
    @Query('limit') limit?: string,
  ) {
    if (!track) throw new BadRequestException('track query param is required');
    return response(await this.races.leaderboard(track, clampLimit(limit)));
  }

  // Public race history for any user (needed once friends/profiles land).
  @Get('user/:id')
  async userHistory(@Param('id') id: string, @Query('limit') limit?: string) {
    return response(await this.races.findHistoryByUser(id, clampLimit(limit)));
  }
}

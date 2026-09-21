/**
 * LobbiesController — HTTP surface for the live lobby browser.
 *
 * Routes (all responses wrapped by `response()` → `{ userdata }`):
 *   POST   /lobbies/heartbeat  (JWT)  host announces/refreshes its lobby
 *   GET    /lobbies            (JWT)  list currently-active lobbies
 *   DELETE /lobbies/:roomCode  (JWT)  host removes its lobby on leave
 *
 * The lobby is a discovery record only — the actual race runs peer-to-peer over
 * PlayroomKit. hostUserId / hostName always come from the verified JWT, never
 * the body, so a client can't announce a lobby as someone else.
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Param,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { response } from '../common/response';
import { LobbiesService } from './lobbies.service';

interface AuthenticatedRequest extends Request {
  user: User;
}

class HeartbeatDto {
  roomCode: string;
  track: string;
  phase?: string;
  playerCount?: number;
  racerCount?: number;
  maxRacers?: number;
}

const MAX_CODE_LEN = 64;
const MAX_TRACK_LEN = 64;
const MAX_PLAYERS = 64; // generous upper bound to reject garbage counts

function requireString(value: unknown, field: string, maxLen: number): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > maxLen
  ) {
    throw new BadRequestException(`Invalid ${field}`);
  }
  return value;
}

// Coerce an optional count into a sane non-negative integer (defaults applied).
function count(value: unknown, fallback: number): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > MAX_PLAYERS
  ) {
    return fallback;
  }
  return value;
}

@Controller('lobbies')
export class LobbiesController {
  constructor(private lobbies: LobbiesService) {}

  // Announce or refresh the caller's lobby. Only the room host calls this.
  @UseGuards(JwtAuthGuard)
  @Post('heartbeat')
  async heartbeat(
    @Req() req: AuthenticatedRequest,
    @Body() body: HeartbeatDto,
  ) {
    const roomCode = requireString(body.roomCode, 'roomCode', MAX_CODE_LEN);
    const track = requireString(body.track, 'track', MAX_TRACK_LEN);
    const phase = body.phase === 'racing' ? 'racing' : 'lobby';

    const result = await this.lobbies.heartbeat({
      roomCode,
      hostUserId: req.user.id,
      hostName: req.user.username,
      track,
      phase,
      playerCount: count(body.playerCount, 1),
      racerCount: count(body.racerCount, 1),
      maxRacers: count(body.maxRacers, 8),
    });
    return response(result);
  }

  // Currently-active lobbies for the dashboard browser.
  @UseGuards(JwtAuthGuard)
  @Get()
  async list() {
    return response(await this.lobbies.findActive());
  }

  // Remove the caller's lobby (best-effort; stale rows are reaped anyway).
  @UseGuards(JwtAuthGuard)
  @Delete(':roomCode')
  async remove(
    @Req() req: AuthenticatedRequest,
    @Param('roomCode') roomCode: string,
  ) {
    await this.lobbies.remove(roomCode, req.user.id);
    return response({ ok: true });
  }
}

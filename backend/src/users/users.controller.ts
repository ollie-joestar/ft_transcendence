/**
 * UsersController — HTTP surface for user profiles.
 *
 * Routes (responses wrapped by `response()` → `{ userdata }`):
 *   GET /users/:username/profile  (JWT)  public-ish profile of any user
 *
 * The profile is JWT-guarded: the guard proves the *requester* is a logged-in
 * user, while the `:username` param still allows viewing anyone's profile
 * (logged-in users can view each other's profiles). Only whitelisted profile
 * fields are returned — never email or passwordHash.
 */
import {
  Controller,
  Get,
  Param,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { response } from '../common/response';
import { UsersService } from './users.service';
import { RaceResultsService } from '../race-results/race-results.service';

@Controller('users')
export class UsersController {
  constructor(
    private users: UsersService,
    private races: RaceResultsService,
  ) {}

  // Aggregate profile for any user, by username. Assembled from the race-history
  // derived queries (stats / percentile / per-track bests / career highlights).
  @UseGuards(JwtAuthGuard)
  @Get(':username/profile')
  async profile(@Param('username') username: string) {
    const user = await this.users.findByUsername(username);
    if (!user) throw new NotFoundException('User not found');

    const [stats, percentile, bestsByTrack, career] = await Promise.all([
      this.races.userStats(user.id),
      this.races.userPercentile(user.id),
      this.races.userBestsRanked(user.id),
      this.races.userCareer(user.id),
    ]);

    // Whitelist the exposed fields — never leak email / passwordHash.
    return response({
      id: user.id,
      username: user.username,
      joinedAt: user.createdAt,
      stats,
      percentile,
      bestsByTrack,
      career,
    });
  }
}

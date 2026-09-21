/**
 * RaceResultsModule — wires the race-history / leaderboard feature into the app.
 * Imported by AppModule. Exports the service so future modules (profile,
 * friends) can reuse the history queries.
 */
import { Module } from '@nestjs/common';
import { RaceResultsController } from './race-results.controller';
import { RaceResultsService } from './race-results.service';

@Module({
  controllers: [RaceResultsController],
  providers: [RaceResultsService],
  exports: [RaceResultsService],
})
export class RaceResultsModule {}

/**
 * LobbiesModule — wires the live lobby browser into the app. Imported by
 * AppModule. The service owns the staleness reaper.
 */
import { Module } from '@nestjs/common';
import { LobbiesController } from './lobbies.controller';
import { LobbiesService } from './lobbies.service';

@Module({
  controllers: [LobbiesController],
  providers: [LobbiesService],
  exports: [LobbiesService],
})
export class LobbiesModule {}

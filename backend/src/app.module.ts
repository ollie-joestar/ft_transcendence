import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RaceResultsModule } from './race-results/race-results.module';
import { LobbiesModule } from './lobbies/lobbies.module';
import { FriendsModule } from './friends/friends.module';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    RaceResultsModule,
    LobbiesModule,
    FriendsModule,
    ChatModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

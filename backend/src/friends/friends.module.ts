import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { FriendsService } from './friends.service';
import { FriendsController } from './friends.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [FriendsController],
  providers: [FriendsService],
})
export class FriendsModule {}

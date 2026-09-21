import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { FriendsService } from './friends.service';

interface AuthedRequest extends Request {
  user: { id: string };
}

@UseGuards(JwtAuthGuard)
@Controller()
export class FriendsController {
  constructor(private readonly friends: FriendsService) {}

  @Get('users/search') search(@Req() r: AuthedRequest, @Query('q') q = '') {
    return this.friends.searchUsers(r.user.id, q);
  }

  @Get('friends') list(@Req() r: AuthedRequest) {
    return this.friends.listFriends(r.user.id);
  }

  @Get('friends/requests') incoming(@Req() r: AuthedRequest) {
    return this.friends.listIncomingRequests(r.user.id);
  }

  @Post('friends/requests')
  send(@Req() r: AuthedRequest, @Body() dto: { toUserId?: string }) {
    if (!dto.toUserId) throw new BadRequestException('toUserId required');
    return this.friends.sendRequest(r.user.id, dto.toUserId);
  }

  @Post('friends/requests/:id/accept')
  accept(@Req() r: AuthedRequest, @Param('id') id: string) {
    return this.friends.acceptRequest(r.user.id, id);
  }

  @Post('friends/requests/:id/deny')
  deny(@Req() r: AuthedRequest, @Param('id') id: string) {
    return this.friends.denyRequest(r.user.id, id);
  }

  @Delete('friends/:userId')
  remove(@Req() r: AuthedRequest, @Param('userId') userId: string) {
    return this.friends.remove(r.user.id, userId);
  }
}

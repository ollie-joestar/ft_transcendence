import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ChatService } from './chat.service';

interface AuthedRequest extends Request {
  user: { id: string };
}

@UseGuards(JwtAuthGuard)
@Controller('messages')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get()
  history(
    @Req() req: AuthedRequest,
    @Query('with') withUserId: string,
    @Query('before') before?: string,
    @Query('limit') limit?: string,
  ) {
    const take = Math.min(Number(limit) || 50, 100);
    return this.chat.getHistory(req.user.id, withUserId, take, before);
  }

  @Post()
  send(
    @Req() req: AuthedRequest,
    @Body() dto: { toUserId?: string; body?: string },
  ) {
    const text = dto.body?.trim();
    if (!dto.toUserId || !text)
      throw new BadRequestException('toUserId and body are required');
    // condition below maybe optional
    // if (text.length > 2000)
    // 	throw new BadRequestException('message too long');
    return this.chat.createMessage(req.user.id, dto.toUserId, text);
  }
}

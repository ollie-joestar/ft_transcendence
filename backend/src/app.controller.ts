import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { response } from './common/response';
import { serializeUser } from './common/serializers/user.serializer';
import { AppService } from './app.service';
import { Request } from 'express';
import { User } from '@prisma/client';

interface AuthenticatedRequest extends Request {
  user: User;
}

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  // eslint-disable-next-line @typescript-eslint/require-await
  async health() {
    return this.appService.getHealth();
  }

  @UseGuards(JwtAuthGuard)
  @Get('users/profile')
  getUsersTest(@Req() req: AuthenticatedRequest) {
    return response(serializeUser(req.user));
  }
}

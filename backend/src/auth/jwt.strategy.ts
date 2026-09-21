import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private users: UsersService) {
    super({
      // Extract JWT from Authorization header as Bearer token
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET as string,
    });
  }

  // Called after verifying the JWT
  // Whatever you return here is attached to the request object as req.user
  async validate(payload: { sub: string; email: string }) {
    const user = await this.users.findById(payload.sub);
    if (!user) throw new UnauthorizedException();
    return user;
  }
}

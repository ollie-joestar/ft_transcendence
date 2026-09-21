import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private jwt: JwtService,
  ) {}

  // -------------------REGISTRATION-------------------
  async register(email: string, username: string, password: string) {
    const existUser = await this.users.findByEmail(email);
    if (existUser) {
      throw new ConflictException('Email already in use.');
    }

    const existUsername = await this.users.findByUsername(username);
    if (existUsername) {
      throw new ConflictException('Username already taken.');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const newUser = await this.users.create({
      email,
      username,
      passwordHash,
    });
    return this.signTokens(newUser.id, newUser.email);
  }

  // -------------------LOGIN-------------------
  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials.');
    }
    // Compare the provided password with the stored hashed password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid credentials.');
    }
    return this.signTokens(user.id, user.email);
  }

  // -------------------JWT TOKEN GENERATION-------------------
  private signTokens(userId: string, email: string) {
    const payload = { sub: userId, email };
    return {
      accessToken: this.jwt.sign(payload, {
        secret: process.env.JWT_SECRET,
        expiresIn: '1h',
      }),
      refreshToken: this.jwt.sign(payload, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: '1d',
      }),
    };
  }
}

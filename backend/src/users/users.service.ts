import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username: username.toLowerCase() },
    });
  }

  async create(data: {
    email: string;
    username: string;
    passwordHash: string;
  }) {
    return this.prisma.user.create({
      data: { ...data, username: data.username.toLowerCase() },
    });
  }
}

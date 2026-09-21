import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Same two ids always collapse to the same key — this is the whole thread.
export function conversationKey(a: string, b: string): string {
  return [a, b].sort().join(':');
}

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  // Newest `limit` messages of a thread, newest-first.
  async getHistory(meId: string, otherId: string, limit = 50, before?: string) {
    return this.prisma.message.findMany({
      where: {
        conversationKey: conversationKey(meId, otherId),
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, senderId: true, body: true, createdAt: true },
    });
  }

  // Persist a message. senderId comes from the authed connection, never the body
  async createMessage(senderId: string, receiverId: string, body: string) {
    return this.prisma.message.create({
      data: {
        conversationKey: conversationKey(senderId, receiverId),
        senderId,
        receiverId,
        body,
      },
      select: {
        id: true,
        conversationKey: true,
        senderId: true,
        receiverId: true,
        body: true,
        createdAt: true,
      },
    });
  }
}

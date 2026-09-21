import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FriendsService {
  constructor(private prisma: PrismaService) {}

  async listFriends(meId: string) {
    const rows = await this.prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ requesterId: meId }, { addresseeId: meId }],
      },
      select: {
        requesterId: true,
        requester: { select: { id: true, username: true } },
        addressee: { select: { id: true, username: true } },
      },
    });
    return rows.map((r) => {
      const other = r.requesterId === meId ? r.addressee : r.requester;
      return { id: other.id, username: other.username };
    });
  }

  async listIncomingRequests(meId: string) {
    const rows = await this.prisma.friendship.findMany({
      where: { addresseeId: meId, status: 'PENDING' },
      select: {
        id: true,
        createdAt: true,
        requester: { select: { id: true, username: true } },
      },
    });
    return rows.map((r) => ({
      requestId: r.id,
      id: r.requester.id,
      username: r.requester.username,
    }));
  }

  async sendRequest(meId: string, targetId: string) {
    if (meId === targetId)
      throw new BadRequestException("can't friend yourself");
    const existing = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: meId, addresseeId: targetId },
          { requesterId: targetId, addresseeId: meId },
        ],
      },
    });
    if (existing) {
      // they already requested me = accept instead of duplicating
      if (existing.addresseeId === meId && existing.status === 'PENDING')
        return this.prisma.friendship.update({
          where: { id: existing.id },
          data: { status: 'ACCEPTED' },
        });
      throw new ConflictException('already friends or request pending');
    }
    return this.prisma.friendship.create({
      data: { requesterId: meId, addresseeId: targetId },
    });
  }

  async acceptRequest(meId: string, requestId: string) {
    const fr = await this.prisma.friendship.findUnique({
      where: { id: requestId },
    });
    if (!fr || fr.addresseeId !== meId || fr.status !== 'PENDING')
      throw new NotFoundException('no such pending request');
    return this.prisma.friendship.update({
      where: { id: requestId },
      data: { status: 'ACCEPTED' },
    });
  }

  // Decline an incoming request
  async denyRequest(meId: string, requestId: string) {
    const fr = await this.prisma.friendship.findUnique({
      where: { id: requestId },
    });
    if (!fr || fr.addresseeId !== meId || fr.status !== 'PENDING')
      throw new NotFoundException('no such pending request');
    await this.prisma.friendship.delete({ where: { id: requestId } });
    return { ok: true };
  }

  async remove(meId: string, otherId: string) {
    await this.prisma.friendship.deleteMany({
      where: {
        OR: [
          { requesterId: meId, addresseeId: otherId },
          { requesterId: otherId, addresseeId: meId },
        ],
      },
    });
    return { ok: true };
  }

  async searchUsers(meId: string, q: string) {
    if (!q.trim()) return [];
    const users = await this.prisma.user.findMany({
      where: {
        username: { contains: q, mode: 'insensitive' },
        NOT: { id: meId },
      },
      select: { id: true, username: true },
      take: 10,
    });
    const ids = users.map((u) => u.id);
    const rels = await this.prisma.friendship.findMany({
      where: {
        OR: [
          { requesterId: meId, addresseeId: { in: ids } },
          { addresseeId: meId, requesterId: { in: ids } },
        ],
      },
      select: { requesterId: true, addresseeId: true, status: true },
    });
    return users.map((u) => {
      const rel = rels.find(
        (r) =>
          (r.requesterId === meId && r.addresseeId === u.id) ||
          (r.addresseeId === meId && r.requesterId === u.id),
      );
      return {
        id: u.id,
        username: u.username,
        isFriend: rel?.status === 'ACCEPTED',
        isPending: rel?.status === 'PENDING',
      };
    });
  }
}

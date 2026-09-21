import { User } from '@prisma/client';

export type SafeUser = Omit<User, 'passwordHash'>;

export function serializeUser(user: User): SafeUser {
  const { passwordHash, ...safe } = user;
  void passwordHash; // This line is just to avoid the unused variable warning
  return safe;
}

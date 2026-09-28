import { Role } from '@prisma/client';

export interface AuthenticatedUser {
  userId: string;
  merchantId: string;
  email: string;
  role: Role;
}

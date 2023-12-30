import { UserRole } from './UsageManager';

export interface UserRoleRequest {
  time: number;
  type: UserRole;
  actorId: string;
  entryType: 'request' | 'set' | 'reject';
}

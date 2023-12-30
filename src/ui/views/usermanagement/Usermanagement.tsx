/* eslint-disable jsx-a11y/alt-text */
import * as React from 'react';
import { useEffect, useState } from 'react';
import UserManagerUI from '../../../lib/usage/UsageManagerUI';
import { PluginUser } from '../../../lib/usage/UsageManager';

type UserManagementProps = {
  userManager: UserManagerUI;
};

export default function UserManagement({ userManager }: UserManagementProps) {
  const [users, setUsers] = useState(undefined as PluginUser[] | undefined);
  const [currentUserId, setCurrentUserId] = useState(undefined as string | undefined);

  const reloadUsers = async () => {
    const updatedUsers = await userManager.getUsers();
    setUsers(updatedUsers);
  };

  const onUsersUpdated = (event: any) => {
    reloadUsers();
  };

  reloadUsers();
  useEffect(() => {
    userManager.addEventListener('usersUpdated', onUsersUpdated);

    return () => {
      userManager.removeEventListener('usersUpdated', onUsersUpdated);
    };
  }, []);

  return (
    <div>
      {users !== undefined &&
        users.map((user) => (
          <div key={user.userId}>
            <div>
              <img src={user.photoUrl ?? 'nope'} />
            </div>
            <div>
              <div>
                <b>Martin Lysk</b> {currentUserId === user.userId && <span> (you)</span>}
              </div>
              <span>{user.userRole}</span>
            </div>
          </div>
        ))}
    </div>
  );
}

import UserManager, { PluginUser, UserRole } from './UsageManager';

export default class UserManagerUI extends EventTarget {
  userManagerSandbox: UserManager;

  private currentUser: PluginUser | undefined;

  constructor(userManagerSandbox: UserManager) {
    super();
    this.userManagerSandbox = userManagerSandbox;

    window.addEventListener('message', (event : MessageEvent) => {
      if (event.data.pluginMessage.target === 'UserManager') {
        this.loadUserState();
        const usersUpdatedEvent = new CustomEvent('usersUpdated', { });
        this.dispatchEvent(usersUpdatedEvent);
        // TODO emmit update event
      }
    });
  }

  async loadUserState() {
    const freshUserState = await this.userManagerSandbox.getCurrentUser();
    if (this.currentUser !== undefined) {
      if (freshUserState.userRole !== this.currentUser.userRole
        || freshUserState.openUserRoleRequest !== this.currentUser.openUserRoleRequest) {
        this.currentUser = freshUserState;
        console.log(`user updated:${JSON.stringify(this.currentUser)}`);
        const currentUserUpdatedEvent = new CustomEvent('currentUserUpdated', { });
        this.dispatchEvent(currentUserUpdatedEvent);
      }
    }
    this.currentUser = freshUserState;
  }

  getCurrentUser() {
    if (this.currentUser === undefined) {
      throw Error('getCurrentUserRole called before loading initail finished - call await initialLoad() before');
    }
    return this.currentUser!;
  }

  async requestUserRole(userRole: UserRole): Promise<PluginUser> {
    const updatedUser = await this.userManagerSandbox.requestUserRoleForCurrentUser(userRole);
    return updatedUser;
  }

  async getUsers() {
    const users = await this.userManagerSandbox.getUsers();
    return users;
  }

  async requestFeature(feature: string) {
    console.log(`requestFeature: ${feature}`);
    /*const atLeastOneUserHasLike = await this.userManagerSandbox.didAtLeastOneLike();
    if (atLeastOneUserHasLike) {
      return true;
    }*/

    setTimeout(() => {
      // eslint-disable-next-line object-shorthand
      const currentUserUpdatedEvent = new CustomEvent<any>('planUpgradeNeeded', { detail: feature });
      this.dispatchEvent(currentUserUpdatedEvent);
    }, 1);

    return false;
  }
}

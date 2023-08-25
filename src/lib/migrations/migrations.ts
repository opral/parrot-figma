export default class Mirgations {
  private lastMigrationKey = 'parrot_migration_executed';

  constructor() {
    const lastMigration = figma.root.getPluginData(this.lastMigrationKey);
    for (const migration of this.migrations) {
      if (this.isMigrationNeeded(lastMigration, migration.version)) {
        migration.migrate(migration.version);
      }
    }
  }

  private migrations = [
    {
      version: '0.9.55',
      migrate: (version: string) => {
        // go through all messages - add the message name

        // add message name to first history entry

        // replace messages with new id

        // go through all textnodes with references to messages and update to slot 0

        // TODO #10 implement migration

        figma.root.setPluginData(this.lastMigrationKey, version);
      },
    },
  ]

  // eslint-disable-next-line class-methods-use-this, consistent-return
  private isMigrationNeeded(lastMigrationVersion: string, migrationVersion: string) {
    if (lastMigrationVersion === '') {
      return true;
    }

    const [majorMigrated, minorMigrated, figmaMigrated] = lastMigrationVersion.split('.');
    const [majorMigration, minorMigration, figmaMigration] = migrationVersion.split('.');

    if (parseInt(majorMigrated, 10) < parseInt(majorMigration, 10)) {
      return true;
    }

    if (parseInt(majorMigrated, 10) > parseInt(majorMigration, 10)) {
      return false;
    }

    if (parseInt(majorMigrated, 10) === parseInt(majorMigration, 10)) {
      if (parseInt(minorMigrated, 10) < parseInt(minorMigration, 10)) {
        return true;
      }

      if (parseInt(minorMigrated, 10) > parseInt(minorMigration, 10)) {
        return false;
      }

      if (parseInt(minorMigrated, 10) === parseInt(minorMigration, 10)) {
        if (parseInt(figmaMigrated, 10) < parseInt(figmaMigration, 10)) {
          return true;
        }

        return false;
      }
    }
  }
}

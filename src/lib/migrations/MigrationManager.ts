// import { MessageStoreFigmaRoot } from '../message/store/MessageStoreFigmaRoot';
import { Gender } from '../message/variants/Gender';

export default class MigrationManager {
  private lastMigrationKey = 'parrot_migration_executed';

  public migrate() {
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
        const configDataKeyOld = 'aar_c';
        const keyPrefixOld = 'aar_k__';
        const keyHistoryPrefixOld = 'aar_h__';

        const configDataKey = 'prt_c';
        const messagePrefix = 'prt_m__';
        const messageHistoryPrefix = 'prt_mh__';
        // go through all messages - add the message name
        const oldDataKeys = figma.root.getPluginDataKeys();
        for (const oldDataKey of oldDataKeys) {
          if (oldDataKey.startsWith(keyPrefixOld)) {
            const messageName = oldDataKey.substring(keyPrefixOld.length, oldDataKey.length);
            const oldMessage = JSON.parse(figma.root.getPluginData(oldDataKey)) as any;
            if (!oldMessage.translations) {
              figma.root.setPluginData(oldDataKey, '');
            } else {
              oldMessage.variants = {};
              for (const [language, plurals] of Object.entries(oldMessage.translations)) {
                for (const [plural, variant] of Object.entries(plurals as Object)) {
                  if (oldMessage.variants[language] === undefined) {
                    oldMessage.variants[language] = {
                      [Gender.NEUTRAL]: {},
                    };
                  }
                  if (oldMessage.variants[language][Gender.NEUTRAL][plural] === undefined) {
                    oldMessage.variants[language][Gender.NEUTRAL][plural] = {};
                  }
                  oldMessage.variants[language][Gender.NEUTRAL][plural] = variant;
                }
              }
            }
            delete oldMessage.keyName;
            oldMessage.name = messageName;
            oldMessage.gender = false;
            const messageId = 'TODO' // TODO #14 migration MessageStoreFigmaRoot.createMessageId(messageName, 0);
            figma.root.setPluginData(messagePrefix + messageId, JSON.stringify(oldMessage));

            console.log(`migrating ${keyHistoryPrefixOld}${messageName}`);
            const oldMessageHistory = JSON.parse(figma.root.getPluginData(keyHistoryPrefixOld + messageName)) as any;
            // add message name to first history entry
            oldMessageHistory[0].name = messageName;
            // process history to fix translation entries
            for (const oldHistoryEntry of oldMessageHistory) {
              if (!oldHistoryEntry.translations) {
                console.log(`empty oldHistory found for ${messageName} + ${JSON.stringify(oldHistoryEntry)}`);
              } else {
                oldHistoryEntry.variants = {};
                for (const [language, plurals] of Object.entries(oldHistoryEntry.translations)) {
                  for (const [plural, variant] of Object.entries(plurals as Object)) {
                    if (oldHistoryEntry.variants[language] === undefined) {
                      oldHistoryEntry.variants[language] = {
                        [Gender.NEUTRAL]: {},
                      };
                    }
                    if (oldHistoryEntry.variants[language][Gender.NEUTRAL][plural] === undefined) {
                      oldHistoryEntry.variants[language][Gender.NEUTRAL][plural] = {};
                    }
                    oldHistoryEntry.variants[language][Gender.NEUTRAL][plural] = variant;
                  }
                }
                delete oldHistoryEntry.transalations;
              }
            }

            delete oldMessage.keyName;
            oldMessage.name = messageName;
            oldMessage.gender = false;

            // use new storage key
            figma.root.setPluginData(messageHistoryPrefix + messageId, JSON.stringify(oldMessageHistory));

            // remove old keys
            figma.root.setPluginData(keyHistoryPrefixOld + messageName, '');
            figma.root.setPluginData(oldDataKey, '');
          }
        }

        const configOld = figma.root.getPluginData(configDataKeyOld);
        if (figma.root.getPluginData(configDataKey) === '') {
          console.log(`Migration of config;${configOld}`);
          figma.root.setPluginData(configDataKey, configOld);
        }

        // go through all textnodes with references to messages and update to slot 0
        const textNodesToMigrate = (figma.root as any).findAllWithCriteria({
          pluginData: {
            keys: ['kt', 'ut'],
          },
        }) as TextNode[];
        for (const textNodeToMigrate of textNodesToMigrate) {
          // message link state - migrate kt to mt
          textNodeToMigrate.setPluginData('mt', textNodeToMigrate.getPluginData('kt'));
          textNodeToMigrate.setPluginData('kt', '');

          // message version - migrate kv to mv
          textNodeToMigrate.setPluginData('mv', textNodeToMigrate.getPluginData('kv'));
          textNodeToMigrate.setPluginData('kv', '');

          // message plural - migrate kp to mp
          textNodeToMigrate.setPluginData('mp', textNodeToMigrate.getPluginData('kp'));
          textNodeToMigrate.setPluginData('kp', '');

          // message gender - add mg
          textNodeToMigrate.setPluginData('mg', Gender.NEUTRAL);

          // migrate unlinged message (ut -> am)
          const unlinkedMessageRaw = textNodeToMigrate.getPluginData('ut');
          if (unlinkedMessageRaw !== '') {
            // process history to fix translation entries
            const unlinkedMessage = JSON.parse(unlinkedMessageRaw) as any;
            unlinkedMessage.variants = {};
            for (const [language, plurals] of Object.entries(unlinkedMessage.translations)) {
              for (const [plural, variant] of Object.entries(plurals as Object)) {
                if (unlinkedMessage.variants[language] === undefined) {
                  unlinkedMessage.variants[language] = {
                    [Gender.NEUTRAL]: {},
                  };
                }
                if (unlinkedMessage.variants[language][Gender.NEUTRAL][plural] === undefined) {
                  unlinkedMessage.variants[language][Gender.NEUTRAL][plural] = {};
                }
                unlinkedMessage.variants[language][Gender.NEUTRAL][plural] = variant;
              }
            }
            delete unlinkedMessage.translations;
            unlinkedMessage.gender = false;
            textNodeToMigrate.setPluginData('am', JSON.stringify(unlinkedMessage));
            textNodeToMigrate.setPluginData('ut', '');
          }

          // migrate key (messageName) to message id
          const messageName = textNodeToMigrate.getPluginData('key');
          if (messageName !== '') {
            // TODO #14 migration - we skip the old format for new versions
            textNodeToMigrate.setPluginData('mi', 'i' /* MessageStoreFigmaRoot.createMessageId(messageName, 0) */);
            textNodeToMigrate.setPluginData('key', '');
          }
        }

        // TODO #14 implement migration

        figma.root.setPluginData(this.lastMigrationKey, version);
      },
    },
  ];

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

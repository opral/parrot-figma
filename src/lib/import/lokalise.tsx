/* async importFromLocalise(): Promise<void> {
    const result = await fetch('http://localhost:3333/api/v1/lokalise', {
      method: 'GET',
      /* headers: {
            'Authorization': 'DeepL-Auth-Key 391733de-67e0-be65-a8b7-4298511dd564:fx'
          },
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },

    });
    const lokaliseKeys = await result.json();

    // const start = Date.now();

    const translationKeys = [] as TranslationKey[];

    for (const key of lokaliseKeys.keys) {
      const keyName = key.key_name.other;
      const keyPlurals = [Plural.OTHER];

      const translations = {} as {
        [language in Language]? : {
          [plural in Plural]? : {
            version: number,
            text?: string,
            skip: boolean
          }
        }
      };
      for (const transalation of key.translations) {
        const lokaliseLanguage = transalation.language_iso as Language;

        const plurals = {} as {
          [plural in Plural]? : {
            version: number,
            text?: string,
            skip: boolean

          }
        };

        if (key.is_plural) {
          const pluralsLokalise = JSON.parse(transalation.translation);

          for (const plural of Object.keys(pluralsLokalise)) {
            plurals[plural as Plural] = {
              version: -1,
              text: pluralsLokalise[plural],
              skip: false,
            };

            if (keyPlurals.indexOf(plural as Plural) === -1) {
              keyPlurals.push(plural as Plural);
            }
          }
        } else {
          // console.log(transalation);
          plurals[Plural.OTHER] = {
            version: -1,
            text: transalation.translation,
            skip: false,
          };
        }

        translations[lokaliseLanguage] = plurals;
      }

      translationKeys.push({
        keyName,
        latestVersion: 0,
        plural: keyPlurals.length > 1,
        translations,
        history: [],
        tags: [], // TODO add tags
      });
    }

    // console.log(`Execution time: Response processing: ${Date.now() - start} ms`);

    // console.log(`${translationKeys.length} keys found `);

    for (const tanslationKey of translationKeys) {
      this.persistKey(tanslationKey);
    }

    figma.commitUndo();
    // console.log(`Execution time: persisting keys: ${Date.now() - start} ms`);
  } */

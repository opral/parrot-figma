const fs = require('fs');
async function main() {
    const result = await fetch('https://api.figma.com/v1/files/Tbs7VmbiQk7k72ztMklHub?plugin_data=1205803482754362456&depth=1', {
      headers: {
        'X-Figma-Token': 'figd_Gicn2cpthFX7BryHB-mQO08L56TdRK-IJ9PaLVaY',
      },
    });
    const json = await result.json();
    
    const keyPrefix = 'aar_k__';
  
    const entries = json.document.pluginData['1205803482754362456'];
  
    const keys = {};
  
    const configKey = 'aar_c';
    const configRaw = entries[configKey];
    const config = JSON.parse(configRaw);
  
    for (const entryKey of Object.keys(entries)) {
      if (!entryKey.startsWith(keyPrefix)) {
        continue;
      }
  
      const key = entryKey.substring(keyPrefix.length);
      const keyRaw = entries[entryKey];
  
      if (keyRaw === '') {
        continue;
      }
  
      try {
        keys[key] = JSON.parse(keyRaw);
      } catch (e) {
        console.warn(`Couldnt parse entry for key ${key} ${keyRaw}`);
      }
    }
  
    console.log(`${Object.keys(keys).length} Keys found:`);

    const languages = {};
  
    for (const key of Object.keys(keys)) {
        
      for (const language of config.enabledLanguages) {
        if (languages[language] === undefined) {
          languages[language] = { translation: {} };
        }
        
        if (keys[key].translations[language] === undefined) {
          console.warn('No translation of key ' + key +' for Language ' + language + ' found.');
        } else {
          if (keys[key].plural) {
            for (let plural of Object.keys(keys[key].translations[language])) {
              languages[language].translation[key+ '_' + plural] = keys[key].translations[language][plural].text.replace('[%i:count]', '{{count}}') ?? '';
            }
          } else {
            languages[language].translation[key] = keys[key].translations[language].other?.text.replace('[%i:count]', '{{count}}') ?? '';
          }
        }
      }
      
    }
    console.log('const Strings = ' + JSON.stringify(languages, null, 4));

    let translationFileContent = '/* eslint-disable @typescript-eslint/comma-dangle */\n';
    translationFileContent += '/* eslint-disable @typescript-eslint/quotes */\n';
    translationFileContent += '/* eslint-disable quote-props */\n';
    translationFileContent += '/* eslint-disable @typescript-eslint/indent */\n';
    translationFileContent += 'const Strings = ';
    translationFileContent += JSON.stringify(languages, null, 4) + ';';
    translationFileContent += '\n\nexport default Strings;\n'
    fs.writeFileSync("./src/ui/localization/strings.ts", translationFileContent);
    // console.log(json.document.pluginData['1205803482754362456']);
  }
  
  main();
  
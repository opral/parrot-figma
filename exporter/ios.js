
(async function test () {

    let result = await fetch('https://api.figma.com/v1/files/Tbs7VmbiQk7k72ztMklHub?plugin_data=1205803482754362456&depth=1', {headers: {
  
            'X-Figma-Token': 'figd_Gicn2cpthFX7BryHB-mQO08L56TdRK-IJ9PaLVaY'
    }})
    let json = await result.json();
    
    let prefix = 'aar_k__1';

    let entries = json.document.pluginData['1205803482754362456'];

    let keys = {};

    console.log(entries);

    for (let entryKey of Object.keys(entries)) {
        if (!entryKey.startsWith(prefix)) {
            continue;
        }

        let key = entryKey.substring(prefix.length);
        let keyRaw = entries[entryKey];

        if (keyRaw === '') {
            continue;
        }

        try {
            keys[key] = JSON.parse(keyRaw);
        } catch (e) {
            console.warn('Couldnt parse entry for key ' + key  + ' ' + keyRaw);
        }
        
    }

    console.log(Object.keys(keys).length + ' Keys found:');

    for (let key of Object.keys(keys)) {
        console.log('Key: ' + key);
        console.log(JSON.stringify(keys[key], null, 4));
    }
    //console.log(json.document.pluginData['1205803482754362456']);
})()


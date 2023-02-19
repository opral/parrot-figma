
(async function test () {

    let result = await fetch('https://api.figma.com/v1/files/2Rr0ykTl8bEwFDKW6w8G0y?plugin_data=shared&depth=1', {headers: {
  
            'X-Figma-Token': 'figd_Gicn2cpthFX7BryHB-mQO08L56TdRK-IJ9PaLVaY'
    }})
    let json = await result.json();
    console.log(json.document.sharedPluginData.aar);
})()


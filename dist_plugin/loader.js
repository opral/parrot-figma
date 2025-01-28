const loadPlugin = async () => {
    const result = await fetch("https://lix.opral.com/figma"+ "plugin.js")
	console.log('Result', result)
    const plugin_code = await result.text()

    // inject the url into the code 
	eval('const url = "https://lix.opral.com/figma" + "ui/index.html"; \n' + plugin_code)
}
loadPlugin()

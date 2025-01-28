console.log('Loader executed 4')
console.log(document);
const loadPlugin = async () => {
    const result = await fetch("[[PLUGIN_CODE_BASE_URL]]"+ "plugin.js")
	console.log('Result', result)
    const plugin_code = await result.text()

    // inject the url into thecode 
	eval('const url = "[[PLUGIN_CODE_BASE_URL]]" + "ui/index.html"; \n' + plugin_code)
}
// asdass
loadPlugin()

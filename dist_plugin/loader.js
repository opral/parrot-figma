console.log('Loader executed 4')
console.log(document);
const loadPlugin = async () => {
    const result = await fetch("http://localhost:5182/"+ "plugin.js")
	console.log('Result', result)
    const plugin_code = await result.text()

    // inject the url into thecode 
	eval('const url = "http://localhost:5182/" + "ui/index.html"; \n' + plugin_code)
}
// asdass
loadPlugin()

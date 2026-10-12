/** The plugin iframe may not use the async clipboard API - a selected textarea + copy works everywhere. */
export function copyToClipboard(text: string) {
	const area = document.createElement("textarea");
	area.value = text;
	area.setAttribute("readonly", "");
	area.style.position = "fixed";
	area.style.opacity = "0";
	document.body.appendChild(area);
	area.select();
	const copied = document.execCommand("copy");
	area.remove();
	return copied;
}

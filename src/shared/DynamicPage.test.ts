import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const banned = new Set([
	"getNodeById",
	"getStyleById",
	"getLocalTextStyles",
	"getLocalPaintStyles",
	"getLocalGridStyles",
	"getLocalEffectStyles",
	"getFileThumbnailNode",
	"getVariableById",
	"getVariableCollectionById",
	"getLocalVariableCollections",
	"getLocalVariables",
	"setRangeTextStyleId",
	"setRangeFillStyleId",
]);
const setters = new Set([
	"currentPage",
	"fillStyleId",
	"strokeStyleId",
	"textStyleId",
	"effectStyleId",
	"gridStyleId",
	"backgroundStyleId",
	"reactions",
	"vectorNetwork",
]);
function files(directory: string): string[] {
	return fs
		.readdirSync(directory, { withFileTypes: true })
		.flatMap((entry) =>
			entry.isDirectory()
				? files(path.join(directory, entry.name))
				: /\.tsx?$/.test(entry.name) && !entry.name.endsWith(".test.ts")
					? [path.join(directory, entry.name)]
					: [],
		);
}
describe("Figma dynamic page compatibility", () => {
	it("ships dynamic page access in both manifests", () => {
		expect(JSON.parse(fs.readFileSync("manifest.json", "utf8")).documentAccess).toBe(
			"dynamic-page",
		);
		expect(fs.readFileSync("manifest.figma.ts", "utf8")).toContain(
			"documentAccess: 'dynamic-page'",
		);
	});
	it("has no synchronous deprecated API calls, properties, or root traversals", () => {
		const violations: string[] = [];
		for (const file of files("src")) {
			const source = ts.createSourceFile(
				file,
				fs.readFileSync(file, "utf8"),
				ts.ScriptTarget.Latest,
				true,
			);
			function visit(node: ts.Node) {
				if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
					const access = node.expression;
					if (
						banned.has(access.name.text) ||
						(access.expression.getText(source) === "figma.root" && /^find/.test(access.name.text))
					)
						violations.push(`${file}: ${access.getText(source)}`);
					if (
						access.getText(source) === "figma.on" &&
						node.arguments[0]?.getText(source) === '"documentchange"' &&
						!file.endsWith("DocumentChanges.ts")
					)
						violations.push(`${file}: eager documentchange listener`);
				}
				if (
					ts.isPropertyAccessExpression(node) &&
					["mainComponent", "instances", "consumers"].includes(node.name.text)
				)
					violations.push(`${file}: ${node.getText(source)}`);
				if (
					ts.isBinaryExpression(node) &&
					node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
					ts.isPropertyAccessExpression(node.left) &&
					setters.has(node.left.name.text)
				)
					violations.push(`${file}: ${node.left.getText(source)}`);
				ts.forEachChild(node, visit);
			}
			visit(source);
		}
		expect(violations).toEqual([]);
	});
});

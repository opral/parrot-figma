export type FakeFontName = { family: string; style: string };

export type FakeTextRange = {
	start: number;
	end: number;
	fontName: FakeFontName;
	fontSize: number;
	fills: readonly unknown[];
	textDecoration: "NONE" | "UNDERLINE" | "STRIKETHROUGH";
	hyperlink: { type: "URL"; value: string } | null;
	listOptions: { type: "NONE" | "ORDERED" | "UNORDERED" };
	indentation: number;
	lineHeight: unknown;
	paragraphSpacing: number;
};

export type FakeMutation = {
	nodeId: string;
	property: string;
	value: unknown;
};

let nextNodeId = 1;

export class FakeNode {
	readonly id: string;
	parent: FakeChildrenNode | null = null;
	name: string;
	readonly pluginData = new Map<string, string>();

	constructor(
		readonly type: string,
		name = type,
		id = `${nextNodeId++}:0`,
	) {
		this.id = id;
		this.name = name;
	}

	getPluginData(key: string) {
		const document = this.document;
		if (document) document.counters.pluginDataReads++;
		return this.pluginData.get(key) ?? "";
	}

	getPluginDataKeys() {
		const keys = [...this.pluginData.entries()]
			.filter(([, value]) => value !== "")
			.map(([key]) => key);
		if (this.document) this.document.counters.pluginDataKeysEnumerated += keys.length;
		return keys;
	}

	setPluginData(key: string, value: string) {
		this.document?.beforeMutation(this, `pluginData:${key}`);
		if (value === "") this.pluginData.delete(key);
		else this.pluginData.set(key, value);
		this.document?.recordMutation(this, `pluginData:${key}`, value);
	}

	get document(): FakeFigmaDocument | undefined {
		// eslint-disable-next-line @typescript-eslint/no-this-alias -- walk from this node to its document root
		let current: FakeNode | null = this;
		while (current?.parent) current = current.parent;
		return current instanceof FakeDocumentNode ? current.document : undefined;
	}
}

export class FakeChildrenNode extends FakeNode {
	readonly children: FakeNode[] = [];

	appendChild(node: FakeNode) {
		this.document?.validateSubtree(node);
		node.parent = this;
		this.children.push(node);
		this.document?.register(node);
		return node;
	}

	findAllWithCriteria(criteria: { types: string[] }) {
		const matches: FakeNode[] = [];
		const visit = (node: FakeNode) => {
			if (this.document) this.document.counters.traversedNodes++;
			if (criteria.types.includes(node.type)) matches.push(node);
			if (node instanceof FakeChildrenNode) node.children.forEach(visit);
		};
		this.children.forEach(visit);
		return matches;
	}

	async exportAsync() {
		const document = this.document;
		if (document) document.counters.exports++;
		return { document: structuredClone({ id: this.id, name: this.name, type: this.type }) };
	}
}

export class FakeTextNode extends FakeNode {
	autoRename = true;
	private value: string;
	readonly ranges: FakeTextRange[];

	constructor(characters: string, name = characters, id?: string, ranges?: FakeTextRange[]) {
		super("TEXT", name, id);
		this.value = characters;
		this.ranges = ranges ?? [createTextRange(0, characters.length)];
	}

	get characters() {
		return this.value;
	}

	set characters(value: string) {
		this.document?.beforeMutation(this, "characters");
		const baseRange = structuredClone(this.ranges[0] ?? createTextRange(0, value.length));
		this.value = value;
		baseRange.start = 0;
		baseRange.end = value.length;
		this.ranges.splice(0, this.ranges.length, baseRange);
		this.document?.recordMutation(this, "characters", value);
	}

	get fontName(): FakeFontName | "mixed" {
		const first = this.ranges[0]?.fontName ?? { family: "Inter", style: "Regular" };
		return this.ranges.every(
			(range) => range.fontName.family === first.family && range.fontName.style === first.style,
		)
			? first
			: "mixed";
	}

	getRangeFontName(start: number) {
		return this.rangeAt(start).fontName;
	}

	getRangeAllFontNames(start: number, end: number) {
		return this.ranges
			.filter((range) => range.end > start && range.start < end)
			.map((range) => range.fontName);
	}

	getStyledTextSegments() {
		return this.ranges.map((range) => ({
			...range,
			characters: this.value.slice(range.start, range.end),
		}));
	}

	setRangeListOptions(start: number, end: number, value: FakeTextRange["listOptions"]) {
		this.updateRanges(start, end, "listOptions", value);
	}

	setRangeHyperlink(start: number, end: number, value: FakeTextRange["hyperlink"]) {
		this.updateRanges(start, end, "hyperlink", value);
	}

	setRangeTextDecoration(start: number, end: number, value: FakeTextRange["textDecoration"]) {
		this.updateRanges(start, end, "textDecoration", value);
	}

	setRangeFontName(start: number, end: number, value: FakeFontName) {
		this.updateRanges(start, end, "fontName", value);
	}

	setRangeFills(start: number, end: number, value: readonly unknown[]) {
		this.updateRanges(start, end, "fills", value);
	}

	setRangeFontSize(start: number, end: number, value: number) {
		this.updateRanges(start, end, "fontSize", value);
	}

	setRangeIndentation(start: number, end: number, value: number) {
		this.updateRanges(start, end, "indentation", value);
	}

	setRangeLineHeight(start: number, end: number, value: unknown) {
		this.updateRanges(start, end, "lineHeight", value);
	}

	setRangeParagraphSpacing(start: number, end: number, value: number) {
		this.updateRanges(start, end, "paragraphSpacing", value);
	}

	restoreText(characters: string, ranges: FakeTextRange[], autoRename: boolean) {
		this.value = characters;
		this.ranges.splice(0, this.ranges.length, ...structuredClone(ranges));
		this.autoRename = autoRename;
	}

	private rangeAt(offset: number) {
		return (
			this.ranges.find((range) => range.start <= offset && offset < range.end) ??
			this.ranges.at(-1)!
		);
	}

	private updateRanges<K extends keyof FakeTextRange>(
		start: number,
		end: number,
		property: K,
		value: FakeTextRange[K],
	) {
		this.document?.beforeMutation(this, `range:${property}`);
		this.splitAt(start);
		this.splitAt(end);
		for (const range of this.ranges) {
			if (range.start >= start && range.end <= end) range[property] = value;
		}
		this.document?.recordMutation(this, `range:${property}`, { start, end, value });
	}

	private splitAt(offset: number) {
		const index = this.ranges.findIndex((range) => range.start < offset && offset < range.end);
		if (index === -1) return;
		const range = this.ranges[index]!;
		this.ranges.splice(
			index,
			1,
			{ ...structuredClone(range), end: offset },
			{ ...structuredClone(range), start: offset },
		);
	}
}

class FakeDocumentNode extends FakeChildrenNode {
	constructor(readonly ownerDocument: FakeFigmaDocument) {
		super("DOCUMENT", "Document", "0:0");
	}

	override get document() {
		return this.ownerDocument;
	}
}

export class FakePageNode extends FakeChildrenNode {
	selection: FakeNode[] = [];

	constructor(name: string, id?: string) {
		super("PAGE", name, id);
	}
}

export class FakeFrameNode extends FakeChildrenNode {
	constructor(name: string, id?: string) {
		super("FRAME", name, id);
	}
}

export class FakeGroupNode extends FakeChildrenNode {
	constructor(name: string, id?: string) {
		super("GROUP", name, id);
	}
}

export class FakeComponentNode extends FakeChildrenNode {
	constructor(name: string, id?: string) {
		super("COMPONENT", name, id);
	}
}

export class FakeInstanceNode extends FakeChildrenNode {
	constructor(name: string, id?: string) {
		super("INSTANCE", name, id);
	}
}

export type FakeDocumentChange =
	| {
			origin: "LOCAL" | "REMOTE";
			type: "CREATE";
			id: string;
			node: FakeNode;
	  }
	| {
			origin: "LOCAL" | "REMOTE";
			type: "DELETE";
			id: string;
	  }
	| {
			origin: "LOCAL" | "REMOTE";
			type: "PROPERTY_CHANGE";
			id: string;
			node: FakeNode;
			properties: string[];
	  };

export class FakeFigmaDocument {
	readonly root = new FakeDocumentNode(this);
	currentPage!: FakePageNode;
	readonly nodes = new Map<string, FakeNode>();
	readonly mutations: FakeMutation[] = [];
	readonly loadedFonts: FakeFontName[] = [];
	readonly availableFonts: FakeFontName[] = [{ family: "Inter", style: "Regular" }];
	readonly counters = {
		nodeLookups: 0,
		pluginDataReads: 0,
		pluginDataKeysEnumerated: 0,
		fontLoads: 0,
		fontLists: 0,
		mutations: 0,
		undoCommits: 0,
		traversedNodes: 0,
		exports: 0,
	};
	private readonly listeners = new Map<string, Set<(event: any) => void>>();
	failOnMutation?: { nodeId: string; property: string };
	failOnFont?: FakeFontName;

	constructor() {
		this.nodes.set(this.root.id, this.root);
	}

	addPage(name: string, id?: string) {
		const page = new FakePageNode(name, id);
		this.root.appendChild(page);
		this.currentPage ??= page;
		return page;
	}

	moveNode(node: FakeNode, newParent: FakeChildrenNode) {
		const oldParent = node.parent;
		if (!oldParent) throw new Error(`Cannot move detached fake Figma node ${node.id}`);
		const oldIndex = oldParent.children.indexOf(node);
		if (oldIndex === -1) throw new Error(`Fake Figma node ${node.id} is missing from its parent`);
		oldParent.children.splice(oldIndex, 1);
		newParent.children.push(node);
		node.parent = newParent;
	}

	register(node: FakeNode) {
		this.nodes.set(node.id, node);
		if (node instanceof FakeChildrenNode) node.children.forEach((child) => this.register(child));
	}

	validateSubtree(node: FakeNode) {
		const ids = new Set<string>();
		const validate = (candidate: FakeNode) => {
			if (ids.has(candidate.id) || this.nodes.has(candidate.id)) {
				throw new Error(`Duplicate fake Figma node id ${candidate.id}`);
			}
			ids.add(candidate.id);
			if (candidate instanceof FakeChildrenNode) candidate.children.forEach(validate);
		};
		validate(node);
	}

	on(type: "documentchange", listener: (event: { documentChanges: FakeDocumentChange[] }) => void) {
		const listeners = this.listeners.get(type) ?? new Set();
		listeners.add(listener);
		this.listeners.set(type, listeners);
	}

	off(
		type: "documentchange",
		listener: (event: { documentChanges: FakeDocumentChange[] }) => void,
	) {
		this.listeners.get(type)?.delete(listener);
	}

	emitDocumentChanges(documentChanges: FakeDocumentChange[]) {
		for (const listener of this.listeners.get("documentchange") ?? []) {
			listener({ documentChanges });
		}
	}

	traverse(node: FakeNode, visitor: (node: FakeNode) => void) {
		this.counters.traversedNodes++;
		visitor(node);
		if (node instanceof FakeChildrenNode) {
			for (const child of node.children) this.traverse(child, visitor);
		}
	}

	getNodeById(id: string) {
		this.counters.nodeLookups++;
		return this.nodes.get(id) ?? null;
	}

	async loadFontAsync(font: FakeFontName) {
		this.counters.fontLoads++;
		if (this.failOnFont?.family === font.family && this.failOnFont.style === font.style) {
			throw new Error(`Missing font ${font.family} ${font.style}`);
		}
		this.loadedFonts.push(font);
	}

	async listAvailableFontsAsync() {
		this.counters.fontLists++;
		return this.availableFonts.map((fontName) => ({ fontName }));
	}

	commitUndo() {
		this.counters.undoCommits++;
	}

	beforeMutation(node: FakeNode, property: string) {
		if (this.failOnMutation?.nodeId === node.id && this.failOnMutation.property === property) {
			this.failOnMutation = undefined;
			throw new Error(`Injected failure for ${node.id}.${property}`);
		}
	}

	recordMutation(node: FakeNode, property: string, value: unknown) {
		this.counters.mutations++;
		this.mutations.push({ nodeId: node.id, property, value });
	}

	snapshot() {
		return [...this.nodes.values()]
			.map((node) => ({
				id: node.id,
				type: node.type,
				name: node.name,
				pluginData: Object.fromEntries([...node.pluginData.entries()].sort()),
				...(node instanceof FakeTextNode
					? {
							characters: node.characters,
							ranges: structuredClone(node.ranges),
							autoRename: node.autoRename,
						}
					: {}),
			}))
			.sort((a, b) => a.id.localeCompare(b.id));
	}

	restore(snapshot: ReturnType<FakeFigmaDocument["snapshot"]>) {
		for (const saved of snapshot) {
			const node = this.nodes.get(saved.id);
			if (!node) continue;
			node.name = saved.name;
			node.pluginData.clear();
			for (const [key, value] of Object.entries(saved.pluginData)) {
				if (value !== undefined) node.pluginData.set(key, value);
			}
			if (
				node instanceof FakeTextNode &&
				typeof saved.characters === "string" &&
				Array.isArray(saved.ranges) &&
				typeof saved.autoRename === "boolean"
			) {
				node.restoreText(saved.characters, saved.ranges, saved.autoRename);
			}
		}
	}
}

export function createTextRange(
	start: number,
	end: number,
	overrides: Partial<FakeTextRange> = {},
): FakeTextRange {
	return {
		start,
		end,
		fontName: { family: "Inter", style: "Regular" },
		fontSize: 16,
		fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }],
		textDecoration: "NONE",
		hyperlink: null,
		listOptions: { type: "NONE" },
		indentation: 0,
		lineHeight: { unit: "AUTO" },
		paragraphSpacing: 0,
		...overrides,
	};
}

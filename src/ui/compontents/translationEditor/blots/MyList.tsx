import Quill from "quill";
import ListItem, { ListContainer } from "quill/formats/list";

export class MyListContainer extends ListContainer {
	static tagName = ["OL", "UL"];

	static defaultTag = "OL";

	static create(value: any) {
		return document.createElement(this.getTag(value));
	}

	static getTag(val: string) {
		// Our "ql-list" values are "bullet" and "ordered"
		const map = {
			bullet: "UL",
			ordered: "OL",
		};
		return (map as any)[val] || this.defaultTag;
	}

	checkMerge() {
		// Only merge if the next list is the same type as this one
		return super.checkMerge() && this.domNode.tagName === this.next?.domNode.tagName;
	}
}

ListContainer.allowedChildren = [ListItem];
ListItem.requiredContainer = ListContainer;

export class MyListItem extends ListItem {
	static requiredContainer = MyListContainer;

	static register() {
		Quill.register(MyListContainer, true);
	}

	optimize(context: any) {
		if (
			this.statics.requiredContainer &&
			!(this.parent instanceof this.statics.requiredContainer)
		) {
			// Insert the format value (bullet, ordered) into wrap arguments
			this.wrap(this.statics.requiredContainer.blotName, MyListItem.formats(this.domNode));
		}
		super.optimize(context);
	}

	format(name: string, value: string) {
		// If the list type is different, wrap this list item in a new MyListContainer of that type
		if (name === ListItem.blotName && value !== MyListItem.formats(this.domNode)) {
			this.wrap(this.statics.requiredContainer.blotName, value);
		}
		super.format(name, value);
	}
}

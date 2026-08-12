import Quill from "quill";
import Inline from "quill/blots/inline";

export default class ItalicBlot extends Inline {}
ItalicBlot.blotName = "italic";
ItalicBlot.tagName = "em";
Quill.register(ItalicBlot, true);

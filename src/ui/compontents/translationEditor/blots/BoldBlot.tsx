import Quill from "quill";
import Inline from "quill/blots/inline";

export default class BoldBlot extends Inline {}
BoldBlot.blotName = "bold";
BoldBlot.tagName = "strong";
Quill.register(BoldBlot, true);

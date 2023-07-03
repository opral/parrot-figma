/* eslint-disable @typescript-eslint/no-use-before-define */
/*
  
  type Selector = string | Node['TEXT_NODE'] | Node['ELEMENT_NODE'];
  type Matcher = (node: Node, delta: Delta, scroll: ScrollBlot) => Delta;
  
  const CLIPBOARD_CONFIG: [Selector, Matcher][] = [
    [Node.TEXT_NODE, matchText],
    [Node.TEXT_NODE, matchNewline],
    ['br', matchBreak],
    [Node.ELEMENT_NODE, matchNewline],
    [Node.ELEMENT_NODE, matchBlot],
    [Node.ELEMENT_NODE, matchAttributor],
    [Node.ELEMENT_NODE, matchStyles],
    ['li', matchIndent],
    ['ol, ul', matchList],
    ['pre', matchCodeBlock],
    ['tr', matchTable],
    ['b', matchAlias.bind(matchAlias, 'bold')],
    ['i', matchAlias.bind(matchAlias, 'italic')],
    ['strike', matchAlias.bind(matchAlias, 'strike')],
    ['style', matchIgnore],
  ];
  
  const ATTRIBUTE_ATTRIBUTORS = [AlignAttribute, DirectionAttribute].reduce(
    (memo, attr) => {
      memo[attr.keyName] = attr;
      return memo;
    },
    {},
  );
  
  const STYLE_ATTRIBUTORS = [
    AlignStyle,
    BackgroundStyle,
    ColorStyle,
    DirectionStyle,
    FontStyle,
    SizeStyle,
  ].reduce((memo, attr) => {
    memo[attr.keyName] = attr;
    return memo;
  }, {});
  
  interface ClipboardOptions {
    matchers: [Selector, Matcher][];
  }
  */
  class Clipboard extends Module<ClipboardOptions> {
    static matchAttributor: ClipboardOptions;
  
    matchers: [Selector, Matcher][];
  
    constructor(quill: Quill, options: Partial<ClipboardOptions>) {
      super(quill, options);
      this.quill.root.addEventListener('copy', e => this.onCaptureCopy(e, false));
      this.quill.root.addEventListener('cut', e => this.onCaptureCopy(e, true));
      this.quill.root.addEventListener('paste', this.onCapturePaste.bind(this));
      this.matchers = [];
      // @ts-expect-error Fix me later
      CLIPBOARD_CONFIG.concat(this.options.matchers).forEach(
        ([selector, matcher]) => {
          this.addMatcher(selector, matcher);
        },
      );
    }
  
    addMatcher(selector: Selector, matcher: Matcher) {
      this.matchers.push([selector, matcher]);
    }
  
    convertHTML(html: string) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const container = doc.body;
      const nodeMatches = new WeakMap();
      const [elementMatchers, textMatchers] = this.prepareMatching(
        container,
        nodeMatches,
      );
      return traverse(
        this.quill.scroll,
        container,
        elementMatchers,
        textMatchers,
        nodeMatches,
      );
    }
  
    prepareMatching(container: Element, nodeMatches: WeakMap<Node, Matcher[]>) {
      const elementMatchers: Matcher[] = [];
      const textMatchers: Matcher[] = [];
      this.matchers.forEach(pair => {
        const [selector, matcher] = pair;
        switch (selector) {
          case Node.TEXT_NODE:
            textMatchers.push(matcher);
            break;
          case Node.ELEMENT_NODE:
            elementMatchers.push(matcher);
            break;
          default:
            Array.from(container.querySelectorAll(selector)).forEach(node => {
              if (nodeMatches.has(node)) {
                const matches = nodeMatches.get(node);
                matches?.push(matcher);
              } else {
                nodeMatches.set(node, [matcher]);
              }
            });
            break;
        }
      });
      return [elementMatchers, textMatchers];
    }
  }
  Clipboard.DEFAULTS = {
    matchers: [],
  };
  
  const preNodes = new WeakMap();
  function isPre(node: Node | null) {
    if (node == null) return false;
    if (!preNodes.has(node)) {
      // @ts-expect-error
      if (node.tagName === 'PRE') {
        preNodes.set(node, true);
      } else {
        preNodes.set(node, isPre(node.parentNode));
      }
    }
    return preNodes.get(node);
  }
  
  function traverse(
    scroll: ScrollBlot,
    node: ChildNode,
    elementMatchers: Matcher[],
    textMatchers: Matcher[],
    nodeMatches: WeakMap<Node, Matcher[]>,
  ) {
    // Post-order
    if (node.nodeType === node.TEXT_NODE) {
      return textMatchers.reduce((delta: Delta, matcher) => {
        return matcher(node, delta, scroll);
      }, new Delta());
    }
    if (node.nodeType === node.ELEMENT_NODE) {
      return Array.from(node.childNodes || []).reduce((delta, childNode) => {
        let childrenDelta = traverse(
          scroll,
          childNode,
          elementMatchers,
          textMatchers,
          nodeMatches,
        );
        if (childNode.nodeType === node.ELEMENT_NODE) {
          childrenDelta = elementMatchers.reduce((reducedDelta, matcher) => {
            return matcher(childNode as HTMLElement, reducedDelta, scroll);
          }, childrenDelta);
          childrenDelta = (nodeMatches.get(childNode) || []).reduce(
            (reducedDelta, matcher) => {
              return matcher(childNode, reducedDelta, scroll);
            },
            childrenDelta,
          );
        }
        return delta.concat(childrenDelta);
      }, new Delta());
    }
    return new Delta();
  }
  
  function matchAlias(format: string, node: Element, delta: Delta) {
    return applyFormat(delta, format, true);
  }
  
  function matchAttributor(node: HTMLElement, delta: Delta, scroll: ScrollBlot) {
    const attributes = Attributor.keys(node);
    const classes = ClassAttributor.keys(node);
    const styles = StyleAttributor.keys(node);
    const formats = {};
    attributes
      .concat(classes)
      .concat(styles)
      .forEach(name => {
        let attr = scroll.query(name, Scope.ATTRIBUTE) as Attributor;
        if (attr != null) {
          formats[attr.attrName] = attr.value(node);
          if (formats[attr.attrName]) return;
        }
        attr = ATTRIBUTE_ATTRIBUTORS[name];
        if (attr != null && (attr.attrName === name || attr.keyName === name)) {
          formats[attr.attrName] = attr.value(node) || undefined;
        }
        attr = STYLE_ATTRIBUTORS[name];
        if (attr != null && (attr.attrName === name || attr.keyName === name)) {
          attr = STYLE_ATTRIBUTORS[name];
          formats[attr.attrName] = attr.value(node) || undefined;
        }
      });
    if (Object.keys(formats).length > 0) {
      return applyFormat(delta, formats);
    }
    return delta;
  }
  
  function matchBlot(node: Node, delta: Delta, scroll: ScrollBlot) {
    const match = scroll.query(node);
    if (match == null) return delta;
    // @ts-expect-error
    if (match.prototype instanceof EmbedBlot) {
      const embed = {};
      // @ts-expect-error
      const value = match.value(node);
      if (value != null) {
        // @ts-expect-error
        embed[match.blotName] = value;
        // @ts-expect-error
        return new Delta().insert(embed, match.formats(node, scroll));
      }
    } else {
      // @ts-expect-error
      if (match.prototype instanceof BlockBlot && !deltaEndsWith(delta, '\n')) {
        delta.insert('\n');
      }
      // @ts-expect-error
      if (typeof match.formats === 'function') {
        // @ts-expect-error
        return applyFormat(delta, match.blotName, match.formats(node, scroll));
      }
    }
    return delta;
  }
  
  function matchBreak(node: Node, delta: Delta) {
    if (!deltaEndsWith(delta, '\n')) {
      delta.insert('\n');
    }
    return delta;
  }
  
  function matchCodeBlock(node, delta, scroll) {
    const match = scroll.query('code-block');
    const language = match ? match.formats(node, scroll) : true;
    return applyFormat(delta, 'code-block', language);
  }
  
  function matchIgnore() {
    return new Delta();
  }
  
  function matchIndent(node: Node, delta: Delta, scroll: ScrollBlot) {
    const match = scroll.query(node);
    if (
      match == null ||
      // @ts-expect-error
      match.blotName !== 'list' ||
      !deltaEndsWith(delta, '\n')
    ) {
      return delta;
    }
    let indent = -1;
    let parent = node.parentNode;
    while (parent != null) {
      // @ts-expect-error
      if (['OL', 'UL'].includes(parent.tagName)) {
        indent += 1;
      }
      parent = parent.parentNode;
    }
    if (indent <= 0) return delta;
    return delta.reduce((composed, op) => {
      if (op.attributes && typeof op.attributes.indent === 'number') {
        return composed.push(op);
      }
      // @ts-expect-error Fix me later
      return composed.insert(op.insert, { indent, ...(op.attributes || {}) });
    }, new Delta());
  }
  
  function matchList(node: Node, delta: Delta) {
    // @ts-expect-error
    const list = node.tagName === 'OL' ? 'ordered' : 'bullet';
    return applyFormat(delta, 'list', list);
  }
  
  function matchNewline(node: Node, delta: Delta, scroll: ScrollBlot) {
    if (!deltaEndsWith(delta, '\n')) {
      // @ts-expect-error
      if (isLine(node)) {
        return delta.insert('\n');
      }
      if (delta.length() > 0 && node.nextSibling) {
        let nextSibling: Node | null = node.nextSibling;
        while (nextSibling != null) {
          // @ts-expect-error
          if (isLine(nextSibling)) {
            return delta.insert('\n');
          }
          const match = scroll.query(nextSibling);
          // @ts-expect-error
          if (match && match.prototype instanceof BlockEmbed) {
            return delta.insert('\n');
          }
          nextSibling = nextSibling.firstChild;
        }
      }
    }
    return delta;
  }
  
  function matchStyles(node: HTMLElement, delta: Delta) {
    const formats: Record<string, unknown> = {};
    const style: Partial<CSSStyleDeclaration> = node.style || {};
    if (style.fontStyle === 'italic') {
      formats.italic = true;
    }
    if (style.textDecoration === 'underline') {
      formats.underline = true;
    }
    if (style.textDecoration === 'line-through') {
      formats.strike = true;
    }
    if (
      style.fontWeight?.startsWith('bold') ||
      // @ts-expect-error Fix me later
      parseInt(style.fontWeight, 10) >= 700
    ) {
      formats.bold = true;
    }
    if (Object.keys(formats).length > 0) {
      delta = applyFormat(delta, formats);
    }
    // @ts-expect-error
    if (parseFloat(style.textIndent || 0) > 0) {
      // Could be 0.5in
      return new Delta().insert('\t').concat(delta);
    }
    return delta;
  }
  
  function matchTable(node, delta) {
    const table =
      node.parentNode.tagName === 'TABLE'
        ? node.parentNode
        : node.parentNode.parentNode;
    const rows = Array.from(table.querySelectorAll('tr'));
    const row = rows.indexOf(node) + 1;
    return applyFormat(delta, 'table', row);
  }
  
  function matchText(node, delta) {
    let text = node.data;
    // Word represents empty line with <o:p>&nbsp;</o:p>
    if (node.parentNode.tagName === 'O:P') {
      return delta.insert(text.trim());
    }
    if (!isPre(node)) {
      if (text.trim().length === 0 && text.includes('\n')) {
        return delta;
      }
      const replacer = (collapse, match) => {
        const replaced = match.replace(/[^\u00a0]/g, ''); // \u00a0 is nbsp;
        return replaced.length < 1 && collapse ? ' ' : replaced;
      };
      text = text.replace(/\r\n/g, ' ').replace(/\n/g, ' ');
      text = text.replace(/\s\s+/g, replacer.bind(replacer, true)); // collapse whitespace
      if (
        (node.previousSibling == null && isLine(node.parentNode)) ||
        (node.previousSibling != null && isLine(node.previousSibling))
      ) {
        text = text.replace(/^\s+/, replacer.bind(replacer, false));
      }
      if (
        (node.nextSibling == null && isLine(node.parentNode)) ||
        (node.nextSibling != null && isLine(node.nextSibling))
      ) {
        text = text.replace(/\s+$/, replacer.bind(replacer, false));
      }
    }
    return delta.insert(text);
  }
  
  export {
    Clipboard as default,
    matchAttributor,
    matchBlot,
    matchNewline,
    matchText,
    traverse,
  };
/**
 * Minimal hand-rolled DOM shim — just enough of `document`/`Element` for `h()` (src/ui/App.js) to
 * build a real tree and for layout tests to walk it. No jsdom/happy-dom dependency, matching this
 * codebase's zero-dependency-per-module precedent; Node's native FormData/File/URLSearchParams
 * cover everything else a view module needs.
 */

const BOOLEAN_ATTRS = new Set(['required', 'hidden', 'disabled', 'checked', 'readonly', 'autoplay', 'muted', 'playsinline', 'open']);

class FakeClassList {
  constructor(el) {
    this.el = el;
  }
  add(name) {
    this.el._classes.add(name);
  }
  remove(name) {
    this.el._classes.delete(name);
  }
  toggle(name, force) {
    const has = this.el._classes.has(name);
    const want = force === undefined ? !has : force;
    if (want) this.el._classes.add(name);
    else this.el._classes.delete(name);
  }
  contains(name) {
    return this.el._classes.has(name);
  }
}

class FakeTextNode {
  constructor(text) {
    this.nodeType = 3;
    this.textContent = String(text);
  }
}

class FakeElement {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.nodeType = 1;
    this._classes = new Set();
    this._attributes = {};
    this._listeners = {};
    this.children = [];
    this.parentNode = null;
    this.value = '';
    this.files = undefined;
    for (const name of BOOLEAN_ATTRS) {
      this[name] = false;
    }
  }

  get className() {
    return [...this._classes].join(' ');
  }

  set className(value) {
    this._classes = new Set(String(value).split(/\s+/).filter(Boolean));
  }

  get classList() {
    return new FakeClassList(this);
  }

  get textContent() {
    return this.children.map((child) => child.textContent ?? '').join('');
  }

  set textContent(value) {
    this.children = [];
    if (value !== '' && value !== undefined && value !== null) {
      this.children.push(new FakeTextNode(value));
    }
  }

  setAttribute(key, value) {
    this._attributes[key] = value;
    if (BOOLEAN_ATTRS.has(key)) {
      this[key] = true;
    }
  }

  getAttribute(key) {
    return key in this._attributes ? this._attributes[key] : null;
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  addEventListener(type, handler) {
    (this._listeners[type] ??= []).push(handler);
  }

  dispatchEvent(event) {
    for (const handler of this._listeners[event.type] ?? []) {
      handler(event);
    }
    return true;
  }

  focus() {}
}

export function createFakeDocument() {
  return {
    createElement: (tag) => new FakeElement(tag),
    createTextNode: (text) => new FakeTextNode(text),
    // No-ops: App.js registers a top-level DOMContentLoaded listener on import (guarded by
    // `typeof document !== 'undefined'`) that this shim satisfies but never fires.
    addEventListener: () => {},
    removeEventListener: () => {},
    getElementById: () => null,
  };
}

/** Depth-first walk of every element (not text node) in the tree, root included. */
export function* walk(root) {
  if (root.nodeType !== 1) return;
  yield root;
  for (const child of root.children) {
    yield* walk(child);
  }
}

export function findAll(root, predicate) {
  return [...walk(root)].filter(predicate);
}

export function findOne(root, predicate) {
  return findAll(root, predicate)[0] ?? null;
}

export function byName(name) {
  return (el) => el.getAttribute('name') === name;
}

export function byTag(tag) {
  const upper = tag.toUpperCase();
  return (el) => el.tagName === upper;
}

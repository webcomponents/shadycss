/**
@license
Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/

import {documentWait} from './document-wait.js';

/**
 * @typedef {HTMLStyleElement | {getStyle: function():HTMLStyleElement}}
 */
export let CustomStyleProvider;

const SEEN_MARKER = '__seenByShadyCSS';
const CACHED_STYLE = '__shadyCSSCachedStyle';

const UNSCOPED_SELECTOR = 'style:not([scope])';

/** @type {?function(!HTMLStyleElement)} */
let transformFn = null;

/** @type {?function()} */
let validateFn = null;

const NODELIST_FOREACH = Boolean(NodeList.prototype.forEach);

/**
 * @param {!NodeList} nodeList
 * @param {function(this:CustomStyleInterface, !HTMLStyleElement)} callback
 * @param {!CustomStyleInterface} context
 */
function forEach(nodeList, callback, context) {
  if (NODELIST_FOREACH) {
    nodeList.forEach(callback, context);
  } else {
    Array.from(nodeList).forEach(callback, context);
  }
}

/**
This interface is provided to add document-level <style> elements to ShadyCSS for processing.
These styles must be processed by ShadyCSS to simulate ShadowRoot upper-bound encapsulation from outside styles
In addition, these styles may also need to be processed for @apply rules and CSS Custom Properties

To add document-level styles to ShadyCSS, one can call `ShadyCSS.addDocumentStyle(styleElement)` or `ShadyCSS.addDocumentStyle({getStyle: () => styleElement})`

In addition, if the process used to discover document-level styles can be synchronously flushed, one should set `ShadyCSS.documentStyleFlush`.
This function will be called when calculating styles.

An example usage of the document-level styling api can be found in `examples/document-style-lib.js`

@unrestricted
*/
export class CustomStyleInterface {
  constructor() {
    /** @type {!Array<!CustomStyleProvider>} */
    this['customStyles'] = [];
    this['enqueued'] = false;
    /** @type {MutationObserver} */
    this.observer = null;
  }
  /**
   * Queue a validation for new custom styles to batch style recalculations
   */
  enqueueDocumentValidation() {
    if (this['enqueued'] || !validateFn) {
      return;
    }
    this['enqueued'] = true;
    documentWait(validateFn);
  }
  /**
   * Add styleseet to the `customStyles` array.
   * Styles are only added if they have not been seen before.
   * @param {!HTMLStyleElement} style
   */
  addCustomStyle(style) {
    if (!style[SEEN_MARKER]) {
      style[SEEN_MARKER] = true;
      this['customStyles'].push(style);
      this.enqueueDocumentValidation();
    }
  }
  /**
   * @param {!CustomStyleProvider} customStyle
   * @return {HTMLStyleElement}
   */
  getStyleForCustomStyle(customStyle) {
    if (customStyle[CACHED_STYLE]) {
      return customStyle[CACHED_STYLE];
    }
    let style;
    if (customStyle['getStyle']) {
      style = customStyle['getStyle']();
    } else {
      style = customStyle;
    }
    return style;
  }
  /**
   * @return {!Array<!CustomStyleProvider>}
   */
  processStyles() {
    if (this.observer) {
      this._mutationHandler(this.observer.takeRecords());
    }
    const cs = this['customStyles'];
    for (let i = 0; i < cs.length; i++) {
      const customStyle = cs[i];
      if (customStyle[CACHED_STYLE]) {
        continue;
      }
      const style = this.getStyleForCustomStyle(customStyle);
      if (style) {
        // HTMLImports polyfill may have cloned the style into the main document,
        // which is referenced with __appliedElement.
        const styleToTransform = /** @type {!HTMLStyleElement} */(style['__appliedElement'] || style);
        if (transformFn) {
          transformFn(styleToTransform);
        }
        customStyle[CACHED_STYLE] = styleToTransform;
      }
    }
    return cs;
  }
  gatherMainDocumentStyles() {
    const styles = document.querySelectorAll(UNSCOPED_SELECTOR);
    for (let i = 0; i < styles.length; i++) {
      const s = /** @type {!HTMLStyleElement} */(styles[i]);
      this.addCustomStyle(s);
    }
  }
  watchMainDocumentStyles() {
    if (this.observer) {
      return;
    }
    this.gatherMainDocumentStyles();
    this.observer = new MutationObserver((mxns) => this._mutationHandler(mxns));
    this.observer.observe(document, {childList: true, subtree: true});
  }
  /**
   * @param {Array<MutationRecord>} mxns
   */
  _mutationHandler(mxns) {
    for (let i = 0; i < mxns.length; i++) {
      let mxn = mxns[i];
      for (let j = 0; j < mxn.addedNodes.length; j++) {
        let n = mxn.addedNodes[j];
        if (n.nodeType === Node.ELEMENT_NODE) {
          const el = /** @type {!HTMLElement} */(n);
          if (el.localName === 'style' && !el.hasAttribute('scope')) {
            this.addCustomStyle(/** @type {!HTMLStyleElement} */(el));
          } else {
            forEach(n.querySelectorAll(UNSCOPED_SELECTOR), this.addCustomStyle, this);
          }
        }
      }
    }
  }
  _resetCachedStyles() {
    this['customStyles'].forEach((cs) => {
      cs[CACHED_STYLE] = null;
    });
  }
}

CustomStyleInterface.prototype['addCustomStyle'] = CustomStyleInterface.prototype.addCustomStyle;
CustomStyleInterface.prototype['getStyleForCustomStyle'] = CustomStyleInterface.prototype.getStyleForCustomStyle;
CustomStyleInterface.prototype['processStyles'] = CustomStyleInterface.prototype.processStyles;
CustomStyleInterface.prototype['watchMainDocumentStyles'] = CustomStyleInterface.prototype.watchMainDocumentStyles;
CustomStyleInterface.prototype['_resetCachedStyles'] = CustomStyleInterface.prototype._resetCachedStyles;

Object.defineProperties(CustomStyleInterface.prototype, {
  'transformCallback': {
    /** @return {?function(!HTMLStyleElement)} */
    get() {
      return transformFn;
    },
    /** @param {?function(!HTMLStyleElement)} fn */
    set(fn) {
      transformFn = fn;
    }
  },
  'validateCallback': {
    /** @return {?function()} */
    get() {
      return validateFn;
    },
    /**
     * @param {?function()} fn
     * @this {CustomStyleInterface}
     */
    set(fn) {
      let needsEnqueue = false;
      if (!validateFn) {
        needsEnqueue = true;
      }
      validateFn = fn;
      if (needsEnqueue) {
        this.enqueueDocumentValidation();
      }
    },
  }
});
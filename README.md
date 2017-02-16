# ShadyCSS

ShadyCSS provides a shim for CSS Custom Properties and ShadowDOM V1 style encapsulation with the ShadyDOM library.

## Requirements
ShadyCSS requires support for the `<template>` element, CustomElements, ShadowDOM, MutationObserver, Promise, Object.assign

## Usage

The shim will transparently no-op if some or all native support is available.

If native ShadowDOM is not available, stylesheet selectors will be modified to simulate scoping.

if CSS Custom Properties are not available, stylesheets will be generated with realized values for custom properties.

To use ShadyCSS:

1. First, call `ShadyCSS.prepareTemplate(template, name)` on a
`<template>` element that will be imported into a `shadowRoot`.

2. When the element instance is connected, call `ShadyCSS.applyStyle(element)`

3. Create and stamp the element's shadowRoot

4. Whenever dynamic updates are required, call `ShadyCSS.applyStyle(element)`.

5. If a styling change is made that may affect the whole document, call
`ShadyCSS.updateStyles()`.

### Example

The following example uses ShadyCSS and ShadyDOM to define a custom element.

```html
<template id="myElementTemplate">
  <style>
    :host {
      display: block;
      padding: 8px;
    }

    #content {
      background-color: var(--content-color);
    }

    .slot-container ::slotted(*) {
      border: 1px solid steelblue;
      margin: 4px;
    }
  </style>
  <div id="content">Content</div>
  <div class="slot-container">
    <slot></slot>
  </div>
</template>
<script>
  ShadyCSS.prepareTemplate(myElementTemplate, 'my-element');
  class MyElement extends HTMLElement {
    connectedCallback() {
      ShadyCSS.applyStyle(this);
      if (!this.shadowRoot) {
        this.attachShadow({mode: 'open'});
        this.shadowRoot.appendChild(
          document.importNode(myElementTemplate.content, true));
      }
    }
  }

  customElements.define('my-element', MyElement);
</script>
```

## Type Extension elements

ShadyCSS can also be used with type extension elements by supplying the base
element name to `prepareTemplate` as a third argument.

### Example

```html
<template id="myElementTemplate">
  <style>
    :host {
      display: block;
      padding: 8px;
    }

    #content {
      background-color: var(--content-color);
    }

    .slot-container ::slotted(*) {
      border: 1px solid steelblue;
      margin: 4px;
    }
  </style>
  <div id="content">Content</div>
  <div class="slot-container">
    <slot></slot>
  </div>
</template>
<script>
  ShadyCSS.prepareTemplate(myElementTemplate, 'my-element', 'div');
  class MyElement extends HTMLDivElement {
    connectedCallback() {
      ShadyCSS.applyStyle(this);
      if (!this.shadowRoot) {
        this.attachShadow({mode: 'open'});
        this.shadowRoot.appendChild(
          document.importNode(myElementTemplate.content, true));
      }
    }
  }

  customElements.define('my-element', MyElement, {extends: 'div'});
</script>
```

## Document level styles

ShadyCSS provides API to process `<style>` elements that are not inside of
Custom Elements, and simulate upper-boundary style scoping for ShadyDOM.

To add document-level styles to ShadyCSS, one can call `ShadyCSS.addDocumentStyle(styleElement)` or `ShadyCSS.addDocumentStyle({getStyle: () => styleElement})`

In addition, if the process used to discover document-level styles can be synchronously flushed, one should set `ShadyCSS.documentStyleFlush`.
This function will be called when calculating styles.

An example usage of the document-level styling api can be found in `examples/document-style-lib.js`

### Example

```html
<style class="document-style">
html {
  --content-color: brown;
}
</style>
<my-element>This text will be brown!</my-element>
<script>
ShadyCSS.addDocumentStyle(document.querySelector('style.document-style'));
</script>
```

Another example with a wrapper `<custom-style>` element

```html
<custom-style>
  <style>
  html {
    --content-color: brown;
  }
  </style>
</custom-style>
<my-element>This this text will be brown!</my-element>
<script>
ShadyCSS.addDocumentStyle(document.querySelectorAll('custom-style > style'));
</script>
```

Another example with a function that produces style elements

```html
<my-element>This this text will be brown!</my-element>
<script>
ShadyCSS.addDocumentStyle({
  getStyle() {
    const s = document.createElement('style');
    s.textContent = 'html{ --content-color: brown }';
    return s;
  }
});
</script>
```

## Imperative values for Custom properties

To set the value of a CSS Custom Property imperatively, `ShadyCSS.applyStyle`
and `ShadyCSS.updateStyles` support an additional argument of an object mapping
variable name to value.

Defining new mixins or new values for current mixins imperatively is not
supported.

### Example
```html
<my-element id="a">Text</my-element>
<my-element>Text</my-element>
<script>
let el = document.querySelector('my-element#a');
// Set the color of all my-element instances to 'green'
ShadyCSS.updateStyles({'--content-color' : 'green'});
// Set the color my-element#a's text to 'red'
ShadyCSS.applyStyle(el, {'--content-color' : 'red'});
</script>
```

## Limitations

### Selector scoping

You must have a selector to the left of the `::slotted`
pseudo-element.

### Custom properties and `@apply`

Dynamic changes are not automatically applied. If elements change such that they
conditionally match selectors they did not previously, `ShadyCSS.updateStyles()`
must be called.

For a given element's shadowRoot, only 1 value is allowed per custom properties.
Properties cannot change from parent to child as they can under native custom
properties; they can only change when a shadowRoot boundary is crossed.

To receive a custom property, an element must directly match a selector that
defines the property in its host's stylesheet.

### `<custom-style>` Flash of unstyled content

If `ShadyCss.applyStyle` is never called, `<custom-style>` elements will process
after HTML Imports have loaded, after the document loads, or after the next paint.
This means that there may be a flash of unstyled content on the first load.

### Mixins do not cascade throught `<slot>`

Crawling the DOM and updating styles is very expensive, and we found that trying to
update mixins through `<slot>` insertion points to be too expensive to justify for both
polyfilled CSS Mixins and polyfilled CSS Custom Properties.

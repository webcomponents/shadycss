/**
@license
Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/

/*
A simple webcomponents helper
*/
'use strict';

const ShadyCSS = window.ShadyCSS;

window.makeElement = (name, connectedCallback) => {
  let template = document.querySelector(`template#${name}`);
  if (template) {
    ShadyCSS.prepareTemplate(template, name);
  }
  window.customElements.define(name, class extends window.HTMLElement {
    connectedCallback() {
      ShadyCSS.styleElement(this);
      if (template && !this.shadowRoot) {
        this.attachShadow({mode: 'open'});
        this.shadowRoot.appendChild(document.importNode(template.content, true));
      }
      if (connectedCallback) {
        connectedCallback.call(this);
      }
    }
  });
};
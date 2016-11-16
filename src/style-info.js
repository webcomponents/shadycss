/**
@license
Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/

'use strict';

import templateMap from './template-map'
import {nativeShadow} from './style-settings'

let instanceMap = {};

function addInstance(instance) {
  let elementName = instance.elementName;
  if (!instanceMap[elementName]) {
    instanceMap[elementName] = [];
  }
  instanceMap[elementName].push(instance);
}

export default class StyleInfo {
  static get(node) {
    return node.__styleInfo;
  }
  static set(node, styleInfo) {
    node.__styleInfo = styleInfo;
    return styleInfo;
  }
  static invalidate(elementName) {
    if (templateMap[elementName]) {
      templateMap[elementName]._applyShimInvalid = true;
      if (nativeShadow) {
        const instances = instanceMap[elementName];
        if (!instances) {
          return;
        }
        for (let i = 0; i < instances.length; i++) {
          instances[i].applyShimInvalid = true;
        }
      }
    }
  }
  static validate(elementName) {
    templateMap[elementName]._applyShimInvalid = false;
  }
  constructor(ast, placeholder, ownStylePropertyNames, elementName, typeExtension, cssBuild, applyShimInvalid) {
    this.styleRules = ast || null;
    this.placeholder = placeholder || null;
    this.ownStylePropertyNames = ownStylePropertyNames || [];
    this.overrideStyleProperties = {};
    this.elementName = elementName || '';
    this.cssBuild = cssBuild || '';
    this.typeExtension = typeExtension || '';
    this.styleProperties = null;
    this.scopeSelector = null;
    this.customStyle = null;
    this.applyShimInvalid = applyShimInvalid || false;
    if (nativeShadow) {
      addInstance(this);
    }
  }
}

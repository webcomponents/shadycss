/**
@license
Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/

'use strict';

import {applyStylePlaceHolder} from './style-util'
import {nativeShadow} from './style-settings'

let placeholderMap = {};

/**
 * @const {CustomElementRegistry}
 */
const ce = window['customElements'];
if (ce && !nativeShadow) {
  /**
   * @const {function(this:CustomElementRegistry, string,function(new:HTMLElement),{extends: string}=)}
   */
  const origDefine = ce['define'];
  ce['define'] = function(name, clazz, options) {
    placeholderMap[name] = applyStylePlaceHolder(name);
    return origDefine.call(/** @type {!CustomElementRegistry} */(ce), name, clazz, options);
  };
}

export default placeholderMap;

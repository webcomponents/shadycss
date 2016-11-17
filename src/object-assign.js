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
function assign(target, ...srcs) {
  const output = Object(target);
  for (let i = 0; i < srcs.length; i++) {
    let source = srcs[i];
    if (source) {
      for (let key in source) {
        if (source.hasOwnProperty(key)) {
          output[key] = source[key];
        }
      }
    }
  }
  return output;
}

let use = Object.assign || assign;
export default use;
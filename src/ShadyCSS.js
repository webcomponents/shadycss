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

import {parse} from './css-parse'
import {nativeShadow, nativeCssVariables, nativeCssApply} from './style-settings'
import {StyleTransformer} from './style-transformer'
import * as StyleUtil from './style-util'
import {StyleProperties} from './style-properties'
import templateMap from './template-map'
import placeholderMap from './style-placeholder'
import StyleInfo from './style-info'
import StyleCache from './style-cache'

// TODO(dfreedm): consider spliting into separate global
import ApplyShim from './apply-shim'

let styleCache = new StyleCache();

export let ShadyCSS = {
  scopeCounter: {},
  nativeShadow: nativeShadow,
  nativeCss: nativeCssVariables,
  nativeCssApply: nativeCssApply,
  _documentOwner: document.documentElement,
  _documentOwnerStyleInfo: StyleInfo.set(document.documentElement, new StyleInfo({rules: []})),
  _generateScopeSelector(name) {
    let id = this.scopeCounter[name] = (this.scopeCounter[name] || 0) + 1;
    return name + '-' + id;
  },
  getStyleAst(style) {
    return StyleUtil.rulesForStyle(style);
  },
  styleAstToString(ast) {
    return StyleUtil.toCssText(ast);
  },
  _gatherStyles(template) {
    let styles = template.content.querySelectorAll('style');
    let cssText = [];
    for (let i = 0; i < styles.length; i++) {
      let s = styles[i];
      cssText.push(s.textContent);
      s.parentNode.removeChild(s);
    }
    return cssText.join('').trim();
  },
  _getCssBuild(template) {
    let style = template.content.querySelector('style');
    if (!style) {
      return '';
    }
    return style.getAttribute('css-build') || '';
  },
  prepareTemplate(template, elementName, typeExtension) {
    if (template._prepared) {
      return;
    }
    template._prepared = true;
    template.name = elementName;
    templateMap[elementName] = template;
    let cssText = this._gatherStyles(template);
    if (!this.nativeShadow) {
      StyleTransformer.dom(template.content, elementName);
    }
    let ast = parse(cssText);
    if (this.nativeCss && !this.nativeCssApply) {
      ApplyShim.transformRules(ast, elementName);
    }
    template._styleAst = ast;

    let ownPropertyNames = [];
    if (!this.nativeCss) {
      ownPropertyNames = StyleProperties.decorateStyles(template._styleAst);
    }
    if (!ownPropertyNames.length || this.nativeCss) {
      let style = StyleTransformer.elementStyles(elementName, typeExtension, this._getCssBuild(template), template._styleAst);
      if (style.length) {
        let root = this.nativeShadow ? template.content : null;
        let placeholder = placeholderMap[elementName];
        style = StyleUtil.applyCss(style, elementName, root, placeholder);
      }
      template._style = style;
    }
    template._ownPropertyNames = ownPropertyNames;
  },
  _prepareHost(hostElement) {
    let { elementName, typeExtension } = StyleUtil.getElementNames(hostElement);
    let placeholder = placeholderMap[elementName];
    let template = templateMap[elementName];
    let ast;
    let ownPropertyNames;
    let cssBuild;
    if (template) {
      ast = template._styleAst;
      ownPropertyNames = template._ownPropertyNames;
      cssBuild = template._cssBuild;
    }
    return StyleInfo.set(hostElement,
      new StyleInfo(
        ast,
        placeholder,
        ownPropertyNames,
        elementName,
        typeExtension,
        cssBuild
      )
    );
  },
  applyStyle(hostElement, overrideProps) {    
    let { elementName, typeExtension } = StyleUtil.getElementNames(hostElement);
    if (window.CustomStyle) {
      let CS = window.CustomStyle;
      if (CS._documentDirty) {
        CS.findStyles();
        if (!this.nativeCss) {
          this._updateProperties(this._documentOwner, this._documentOwnerStyleInfo);
        } else if (!this.nativeCssApply) {
          CS._revalidateApplyShim();
        }
        CS.applyStyles();
        CS._documentDirty = false;
      }
    }
    let styleInfo = StyleInfo.get(hostElement);
    if (!styleInfo) {
      styleInfo = this._prepareHost(hostElement);
    }
    Object.assign(styleInfo.overrideStyleProperties, overrideProps);
    if (this.nativeCss) {
      let template = templateMap[elementName];
      if (template && template.__applyShimInvalid && template._style) {
        // update template
        ApplyShim.transformRules(template._styleAst, elementName);
        template._style.textContent = StyleTransformer.elementStyles(elementName, typeExtension, null, styleInfo.styleRules);
        // update instance if native shadowdom
        if (this.nativeShadow) {
          let style = hostElement.shadowRoot.querySelector('style');
          style.textContent = StyleTransformer.elementStyles(elementName, typeExtension, null, styleInfo.styleRules);
        }
        styleInfo.styleRules = template._styleAst;
      }
      this._updateNativeProperties(hostElement, styleInfo.overrideStyleProperties);
    } else {
      this._updateProperties(hostElement, styleInfo);
      if (styleInfo.ownPropertyNames && styleInfo.ownPropertyNames.length) {
        // TODO: use caching
        this._applyStyleProperties(hostElement, styleInfo);
      }
    }
    let rootNode = this._isRootOwner(hostElement) ? hostElement : hostElement.shadowRoot;
    // note: some elements may not have a root!
    if (rootNode) {
      this._applyToDescendants(rootNode);
    }
  },
  _applyToDescendants(root) {
    let c$ = root.children;
    for (let i = 0, c; i < c$.length; i++) {
      c = c$[i];
      if (c.shadowRoot) {
        this.applyStyle(c);
      }
      this._applyToDescendants(c);
    }
  },
  _styleOwnerForNode(node) {
    let root = node.getRootNode();
    let host = root.host;
    if (host) {
      if (StyleInfo.get(host)) {
        return host;
      } else {
        return this._styleOwnerForNode(host);
      }
    }
    return this._documentOwner;
  },
  _isRootOwner(node) {
    return (node === this._documentOwner);
  },
  _applyStyleProperties(hostElement, styleInfo) {    
    let { elementName } = StyleUtil.getElementNames(hostElement);
    let cacheEntry = styleCache.fetch(elementName, styleInfo.styleProperties, styleInfo.ownPropertyNames);
    let cachedScopeSelector = cacheEntry && cacheEntry.scopeSelector;
    let cachedStyle = cacheEntry ? cacheEntry.styleElement : null;
    let oldScopeSelector = styleInfo.scopeSelector;
    // only generate new scope if cached style is not found
    styleInfo.scopeSelector = cachedScopeSelector || this._generateScopeSelector(elementName);
    let style = StyleProperties.applyElementStyle(hostElement, styleInfo.styleProperties, styleInfo.scopeSelector, cachedStyle);
    if (!this.nativeShadow) {
      StyleProperties.applyElementScopeSelector(hostElement, styleInfo.scopeSelector, oldScopeSelector);
    }
    if (!cacheEntry) {
      styleCache.store(elementName, styleInfo.styleProperties, style, styleInfo.scopeSelector);
    }
    return style;
  },
  _updateProperties(hostElement, styleInfo) {
    let owner = this._styleOwnerForNode(hostElement);
    let ownerStyleInfo = StyleInfo.get(owner);
    let ownerProperties = ownerStyleInfo.styleProperties;
    let props = Object.create(ownerProperties || null);
    let hostAndRootProps = StyleProperties.hostAndRootPropertiesForElement(hostElement, styleInfo.styleRules);
    let propertyData = StyleProperties.propertyDataFromStyles(ownerStyleInfo.styleRules, hostElement);
    let propertiesMatchingHost = propertyData.properties
    Object.assign(
      props,
      hostAndRootProps.hostProps,
      propertiesMatchingHost,
      hostAndRootProps.rootProps
    );
    this._mixinOverrideStyles(props, styleInfo.overrideStyleProperties);
    StyleProperties.reify(props);
    styleInfo.styleProperties = props;
  },
  _mixinOverrideStyles(props, overrides) {
    for (let p in overrides) {
      let v = overrides[p];
      // skip override props if they are not truthy or 0
      // in order to fall back to inherited values
      if (v || v === 0) {
        props[p] = v;
      }
    }
  },
  _updateNativeProperties(element, properties) {
    // remove previous properties
    for (let p in properties) {
      // NOTE: for bc with shim, don't apply null values.
      if (p === null) {
        element.style.removeProperty(p);
      } else {
        element.style.setProperty(p, properties[p]);
      }
    }
  },
  updateStyles(properties) {
    if (window.CustomStyle) {
      window.CustomStyle._documentDirty = true;
    }
    this.applyStyle(this._documentOwner, properties);
  },
  /* Custom Style operations */
  _transformCustomStyleForDocument(style) {
    let ast = StyleUtil.rulesForStyle(style);
    StyleUtil.forEachRule(ast, (rule) => {
      if (nativeShadow) {
        StyleTransformer.normalizeRootSelector(rule);
      } else {
        StyleTransformer.documentRule(rule);
      }
      if (this.nativeCss && !this.nativeCssApply) {
        ApplyShim.transformRule(rule);
      }
    });
    if (this.nativeCss) {
      style.textContent = StyleUtil.toCssText(ast);
    } else {
      this._documentOwnerStyleInfo.styleRules.rules.push(ast);
    }
  },
  _revalidateApplyShim(style) {
    if (this.nativeCss && !this.nativeCssApply) {
      let ast = StyleUtil.rulesForStyle(style);
      ApplyShim.transformRules(ast);
      style.textContent = StyleUtil.toCssText(ast);
    }
  },
  _applyCustomStyleToDocument(style) {
    if (!this.nativeCss) {
      StyleProperties.applyCustomStyle(style, this._documentOwnerStyleInfo.styleProperties);
    }
  },
  getComputedStyleValue(element, property) {
    let value;
    if (!this.nativeCss) {
      // element is either a style host, or an ancestor of a style host
      let styleInfo = StyleInfo.get(element) || StyleInfo.get(this._styleOwnerForNode(element));
      value = styleInfo.styleProperties[property];
    }
    // fall back to the property value from the computed styling
    value = value || window.getComputedStyle(element).getPropertyValue(property);
    // trim whitespace that can come after the `:` in css
    // example: padding: 2px -> " 2px"
    return value.trim();
  }
}

window['ShadyCSS'] = ShadyCSS;

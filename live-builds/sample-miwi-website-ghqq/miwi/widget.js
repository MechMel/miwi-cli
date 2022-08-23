"use strict";
const isContent = function(possibleContent) {
  let isActuallyContent = false;
  if (Array.isArray(possibleContent)) {
    isActuallyContent = true;
    for (const i in possibleContent) {
      isActuallyContent = isActuallyContent && isContent(possibleContent[i]);
    }
  } else {
    isActuallyContent = typeof possibleContent === `string` || typeof possibleContent === `boolean` || typeof possibleContent === `number` || _isIcon(possibleContent) || isWidget(possibleContent);
  }
  return isActuallyContent;
};
const _contentCompilers = [];
const _addNewContentCompiler = (newCompiler) => _contentCompilers.push(newCompiler);
const compileContentsToHtml = function(params) {
  for (const i in _contentCompilers) {
    if (_contentCompilers[i].isThisType(params.contents)) {
      return _contentCompilers[i].compile({
        contents: params.contents,
        parent: params.parent,
        startZIndex: params.startZIndex
      });
    }
  }
  throw `Encountered an error in "miwi/widget.tsx.compileContentsToHtml". Could not find a content compiler for ${JSON.stringify(
    params.contents,
    null,
    2
  )}`;
};
_addNewContentCompiler({
  isThisType: (contents) => Array.isArray(contents),
  compile: function(params) {
    const myInfo = {
      htmlElements: [],
      widthGrows: false,
      heightGrows: false,
      greatestZIndex: params.startZIndex
    };
    for (let i in params.contents) {
      const thisWidgetInfo = compileContentsToHtml({
        contents: params.contents[i],
        parent: params.parent,
        startZIndex: params.parent.contentAxis === axis.z ? myInfo.greatestZIndex + 1 : params.startZIndex
      });
      for (const j in thisWidgetInfo.htmlElements) {
        myInfo.htmlElements.push(thisWidgetInfo.htmlElements[j]);
      }
      myInfo.widthGrows = thisWidgetInfo.widthGrows || myInfo.widthGrows;
      myInfo.heightGrows = thisWidgetInfo.heightGrows || myInfo.heightGrows;
      myInfo.greatestZIndex = Math.max(
        myInfo.greatestZIndex,
        thisWidgetInfo.greatestZIndex
      );
    }
    return myInfo;
  }
});
const isWidget = (possibleWidget) => exists(possibleWidget == null ? void 0 : possibleWidget.htmlTag);
function widgetTemplate(defaultWidget) {
  const build = function(invocationOptions, ...invocationContents) {
    var _a;
    if (isContent(invocationOptions)) {
      invocationContents.unshift(invocationOptions);
      invocationOptions = {};
    }
    const newWidget = {};
    for (const key in defaultWidget) {
      newWidget[key] = (_a = invocationOptions == null ? void 0 : invocationOptions[key]) != null ? _a : defaultWidget[key];
    }
    if (invocationContents.length > 0) {
      newWidget.contents = invocationContents;
    }
    newWidget.toString = function() {
      return `$$#@%${JSON.stringify(newWidget)}%@#$$`;
    };
    return newWidget;
  };
  for (const key in defaultWidget) {
    build[key] = defaultWidget[key];
  }
  return build;
}
const widgetStyleBuilders = [];
_addNewContentCompiler({
  isThisType: (contents) => exists(contents == null ? void 0 : contents.htmlTag),
  compile: function(params) {
    const childrenInfo = compileContentsToHtml({
      contents: params.contents.contents,
      parent: params.contents,
      startZIndex: params.startZIndex
    });
    const shouldUseTwoElements = params.contents.contentAxis === axis.z;
    const parentStyle = {};
    const childStyle = {
      flexGrow: 1,
      alignSelf: `stretch`,
      backgroundColor: `green`
    };
    for (const i in widgetStyleBuilders) {
      const newProps = widgetStyleBuilders[i]({
        widget: params.contents,
        parent: params.parent,
        childrenInfo,
        startZIndex: params.startZIndex
      });
      for (const key in newProps.preferParent) {
        parentStyle[key] = newProps.preferParent[key];
      }
      for (const key in newProps.preferChild) {
        if (shouldUseTwoElements) {
          childStyle[key] = newProps.preferChild[key];
        } else {
          parentStyle[key] = newProps.preferChild[key];
        }
      }
    }
    return {
      widthGrows: _getSizeGrows(params.contents.width, childrenInfo.widthGrows),
      heightGrows: _getSizeGrows(
        params.contents.height,
        childrenInfo.heightGrows
      ),
      greatestZIndex: childrenInfo.greatestZIndex,
      htmlElements: [
        createHtmlElement({
          tag: params.contents.htmlTag,
          style: parentStyle,
          content: shouldUseTwoElements ? [
            createHtmlElement({
              tag: `div`,
              style: childStyle,
              content: childrenInfo.htmlElements
            })
          ] : childrenInfo.htmlElements
        })
      ]
    };
  }
});
const _getSizeGrows = (givenSize, childGrows) => _isSizeGrowConfig(givenSize) || givenSize == size.basedOnContents && childGrows;
function _isSizeGrowConfig(possibleGrowth) {
  return exists(possibleGrowth.flex);
}
const size = readonlyObj({
  exactly: function(num) {
    return num;
  },
  basedOnContents: -1,
  grow: function() {
    const buildGrowth = function(flex) {
      return { flex };
    };
    buildGrowth.flex = 1;
    return buildGrowth;
  }()
});
widgetStyleBuilders.push(function(params) {
  const computeSizeInfo = (givenSize, childGrows) => {
    const sizeGrows = _getSizeGrows(givenSize, childGrows);
    const exactSize = isString(givenSize) ? givenSize : givenSize !== size.basedOnContents && !sizeGrows ? numToStandardHtmlUnit(givenSize) : void 0;
    return [exactSize, sizeGrows];
  };
  const [exactWidth, widthGrows] = computeSizeInfo(
    params.widget.width,
    params.childrenInfo.widthGrows
  );
  const [exactHeight, heightGrows] = computeSizeInfo(
    params.widget.height,
    params.childrenInfo.heightGrows
  );
  return {
    preferParent: {
      display: `flex`,
      boxSizing: `border-box`,
      width: exactWidth,
      minWidth: exactWidth,
      maxWidth: exactWidth,
      height: exactHeight,
      minHeight: exactHeight,
      maxHeight: exactHeight,
      flexGrow: params.parent.contentAxis === axis.vertical ? _isSizeGrowConfig(params.widget.height) ? params.widget.height.flex : heightGrows ? 1 : void 0 : _isSizeGrowConfig(params.widget.width) ? params.widget.width.flex : widthGrows ? 1 : void 0,
      alignSelf: params.parent.contentAxis === axis.horizontal && heightGrows || params.parent.contentAxis === axis.vertical && widthGrows ? `stretch` : void 0
    },
    preferChild: {
      display: `flex`,
      boxSizing: `border-box`
    }
  };
});
function numToStandardHtmlUnit(num) {
  return `${num * (_pageWidthVmin / 24)}vmin`;
}
const colors = readonlyObj({
  white: `#ffffffff`,
  almostWhite: `#f9fafdff`,
  pink: `#e91e63ff`,
  red: `#f44336ff`,
  orange: `#ff9800ff`,
  yellow: `#ffea00ff`,
  green: `#4caf50ff`,
  teal: `#009688ff`,
  blue: `#2196f3ff`,
  purple: `#9c27b0ff`,
  brown: `#795548ff`,
  grey: `#9e9e9eff`,
  black: `#000000ff`,
  transparent: `#ffffff00`
});
widgetStyleBuilders.push((params) => {
  const _isMaterialImage = (material) => material[0] !== `#`;
  return {
    preferParent: {
      borderRadius: numToStandardHtmlUnit(params.widget.cornerRadius),
      border: `none`,
      outline: `${numToStandardHtmlUnit(params.widget.outlineSize)} solid ${params.widget.outlineColor}`,
      outlineOffset: `-` + numToStandardHtmlUnit(params.widget.outlineSize),
      backgroundColor: _isMaterialImage(params.widget.background) ? void 0 : params.widget.background,
      backgroundImage: _isMaterialImage(params.widget.background) ? `url(${params.widget.background})` : void 0,
      backgroundPosition: _isMaterialImage(params.widget.background) ? `center` : void 0,
      backgroundSize: _isMaterialImage(params.widget.background) ? `cover` : void 0,
      backgroundRepeat: `no-repeat`,
      backgroundAttachment: `local`,
      boxShadow: `${numToStandardHtmlUnit(
        0.12 * params.widget.shadowSize * params.widget.shadowDirection.x
      )} ${numToStandardHtmlUnit(
        -0.12 * params.widget.shadowSize * params.widget.shadowDirection.y
      )} ${numToStandardHtmlUnit(
        0.225 * params.widget.shadowSize
      )} ${numToStandardHtmlUnit(0)} ${colors.grey}`
    }
  };
});
widgetStyleBuilders.push((params) => {
  return {
    preferParent: {
      padding: numToStandardHtmlUnit(params.widget.padding)
    }
  };
});
const align = readonlyObj({
  topLeft: { x: -1, y: 1 },
  topCenter: { x: 0, y: 1 },
  topRight: { x: 1, y: 1 },
  centerLeft: { x: -1, y: 0 },
  center: { x: 0, y: 0 },
  centerRight: { x: 1, y: 0 },
  bottomLeft: { x: -1, y: -1 },
  bottomCenter: { x: 0, y: -1 },
  bottomRight: { x: 1, y: -1 }
});
widgetStyleBuilders.push(
  (params) => {
    const myPosition = params.parent.contentAxis === axis.z ? `absolute` : `relative`;
    return {
      preferParent: {
        position: myPosition,
        margin: params.parent.contentAxis === axis.z ? `${params.parent.contentAlign.x === 0 ? `auto` : 0} ${params.parent.contentAlign.y === 0 ? `auto` : 0}` : 0,
        left: params.parent.contentAxis === axis.z && params.parent.contentAlign.x === -1 ? 0 : void 0,
        top: params.parent.contentAxis === axis.z && params.parent.contentAlign.y === 1 ? 0 : void 0,
        right: params.parent.contentAxis === axis.z && params.parent.contentAlign.x === 1 ? 0 : void 0,
        bottom: params.parent.contentAxis === axis.z && params.parent.contentAlign.y === -1 ? 0 : void 0,
        justifyContent: typeof params.widget.contentSpacing === `number` ? params.widget.contentAxis === axis.vertical ? params.widget.contentAlign.y === 1 ? `flex-start` : params.widget.contentAlign.y === 0 ? `safe center` : `flex-end` : params.widget.contentAlign.x === -1 ? `flex-start` : params.widget.contentAlign.x === 0 ? `safe center` : `flex-end` : params.widget.contentSpacing === spacing.spaceBetween && params.childrenInfo.htmlElements.length === 1 ? spacing.spaceAround : params.widget.contentSpacing,
        alignItems: params.widget.contentAxis === axis.vertical ? params.widget.contentAlign.x === -1 ? `flex-start` : params.widget.contentAlign.x === 0 ? `safe center` : `flex-end` : params.widget.contentAlign.y === 1 ? `flex-start` : params.widget.contentAlign.y === 0 ? `safe center` : `flex-end`,
        textAlign: params.widget.contentAlign.x === -1 ? `left` : params.widget.contentAlign.x === 0 ? `center` : `right`
      },
      preferChild: {
        position: params.widget.contentAxis === axis.z ? `relative` : myPosition
      }
    };
  }
);
const axis = readonlyObj({
  horizontal: `horizontal`,
  vertical: `vertical`,
  z: `z`
});
widgetStyleBuilders.push((params) => {
  return {
    preferParent: {
      flexDirection: params.widget.contentAxis === axis.vertical ? `column` : `row`,
      zIndex: params.startZIndex
    }
  };
});
widgetStyleBuilders.push((params) => {
  return {
    preferParent: {
      overflowX: params.widget.contentIsScrollableX ? `overlay` : void 0,
      overflowY: params.widget.contentIsScrollableY ? `auto` : void 0,
      scrollbarWidth: `thin`,
      scrollbarColor: `#e3e3e3 transparent`
    }
  };
});
const spacing = readonlyObj({
  spaceBetween: `space-between`,
  spaceAround: `space-around`,
  spaceEvenly: `space-evenly`,
  exactly: (num) => num
});
widgetStyleBuilders.push((params) => {
  return {
    preferChild: {
      rowGap: params.widget.contentAxis === axis.vertical && typeof params.widget.contentSpacing === `number` ? numToStandardHtmlUnit(params.widget.contentSpacing) : void 0,
      columnGap: params.widget.contentAxis === axis.horizontal && typeof params.widget.contentSpacing === `number` ? numToStandardHtmlUnit(params.widget.contentSpacing) : void 0
    }
  };
});
widgetStyleBuilders.push((params) => {
  return {
    preferParent: {
      fontFamily: `Roboto`
    },
    preferChild: {
      fontFamily: `Roboto`,
      fontSize: numToFontSize(params.widget.textSize),
      fontWeight: params.widget.textIsBold ? `bold` : void 0,
      fontStyle: params.widget.textIsItalic ? `italic` : void 0,
      color: params.widget.textColor
    }
  };
});
function numToFontSize(num) {
  return numToStandardHtmlUnit(0.825 * num);
}
const icons = _iconsObj;
const _inlineContentOpenTag = `$$#@%`;
const _inlineContentCloseTag = `%@#$$`;
_addNewContentCompiler({
  isThisType: (contents) => exists(contents == null ? void 0 : contents.icon),
  compile: function(params) {
    return {
      htmlElements: [
        createHtmlElement({
          tag: `span`,
          class: `material-symbols-outlined`,
          style: {
            width: numToIconSize(params.parent.textSize),
            height: numToIconSize(params.parent.textSize),
            color: params.parent.textColor,
            display: `inline-block`,
            verticalAlign: `middle`,
            textAlign: `center`,
            fontSize: numToIconSize(params.parent.textSize)
          },
          content: [
            document.createTextNode(
              params.contents.icon.startsWith(_numIconTag) ? params.contents.icon.substring(_numIconTag.length) : params.contents.icon
            )
          ]
        })
      ],
      widthGrows: false,
      heightGrows: false,
      greatestZIndex: params.startZIndex
    };
  }
});
function numToIconSize(num) {
  return numToStandardHtmlUnit(0.9 * num);
}
_addNewContentCompiler({
  isThisType: (contents) => typeof contents === `string` || typeof contents === `number` || typeof contents === `boolean`,
  compile: function(params) {
    const paragraphParts = [];
    let greatestZIndex = params.startZIndex;
    if (typeof params.contents === `string`) {
      const contentsAsString = params.contents;
      let openTagIndex = contentsAsString.indexOf(_inlineContentOpenTag);
      let closeTagIndex = 0 - _inlineContentCloseTag.length;
      while (openTagIndex >= 0) {
        if (openTagIndex - closeTagIndex + _inlineContentCloseTag.length > 0) {
          paragraphParts.push(
            document.createTextNode(
              contentsAsString.substring(
                closeTagIndex + _inlineContentCloseTag.length,
                openTagIndex
              )
            )
          );
        }
        closeTagIndex = openTagIndex + contentsAsString.substring(openTagIndex).indexOf(_inlineContentCloseTag);
        const embededContentInfo = compileContentsToHtml({
          contents: JSON.parse(
            contentsAsString.substring(
              openTagIndex + _inlineContentOpenTag.length,
              closeTagIndex
            )
          ),
          parent: params.parent,
          startZIndex: params.startZIndex
        });
        greatestZIndex = Math.max(
          greatestZIndex,
          embededContentInfo.greatestZIndex
        );
        for (const i in embededContentInfo.htmlElements) {
          paragraphParts.push(embededContentInfo.htmlElements[i]);
        }
        openTagIndex = contentsAsString.substring(closeTagIndex).indexOf(_inlineContentOpenTag);
        if (openTagIndex >= 0) {
          openTagIndex += closeTagIndex;
        }
      }
      if (closeTagIndex + _inlineContentCloseTag.length < contentsAsString.length) {
        paragraphParts.push(
          document.createTextNode(
            contentsAsString.substring(
              closeTagIndex + _inlineContentCloseTag.length,
              contentsAsString.length
            )
          )
        );
      }
    } else {
      paragraphParts.push(document.createTextNode(params.contents.toString()));
    }
    return {
      widthGrows: false,
      heightGrows: false,
      greatestZIndex: params.startZIndex,
      htmlElements: [
        createHtmlElement({
          tag: `p`,
          style: {
            color: params.parent.textColor,
            fontFamily: `Roboto`,
            fontSize: numToFontSize(params.parent.textSize),
            fontWeight: params.parent.textIsBold ? `bold` : void 0,
            fontStyle: params.parent.textIsItalic ? `italic` : void 0,
            textAlign: params.parent.contentAlign.x === -1 ? `left` : params.parent.contentAlign.x === 0 ? `center` : `right`,
            margin: 0,
            padding: 0,
            zIndex: params.startZIndex
          },
          content: paragraphParts
        })
      ]
    };
  }
});
const rootProjectPath = `./`;
const rootOutputPath = `./website`;
const _pageWidthVmin = 40;
const _pageWidget = widgetTemplate({
  width: `100%`,
  height: `100%`,
  textSize: 2,
  textIsBold: true,
  textIsItalic: false,
  textColor: colors.black,
  cornerRadius: 0,
  outlineColor: colors.transparent,
  outlineSize: 0,
  background: colors.almostWhite,
  shadowSize: 0,
  shadowDirection: align.center,
  padding: 0,
  contentAlign: align.topCenter,
  contentAxis: axis.vertical,
  contentIsScrollableX: false,
  contentIsScrollableY: false,
  contentSpacing: 0,
  contents: [],
  htmlTag: `div`
});
function _defaultPageParams() {
  const params = {};
  params.name = `Untitled`;
  const defaultPageWidget = _pageWidget();
  for (const key in defaultPageWidget) {
    if (key !== `htmlTag` && key !== `contents`) {
      params[key] = defaultPageWidget[key];
    }
  }
  return params;
}
const page = function(options = _defaultPageParams(), ...contents) {
  var _a;
  const currentPage = document.getElementById(`currentPage`);
  if (!exists(currentPage)) {
    if (isContent(options)) {
      contents.unshift(options);
      options = _defaultPageParams();
    }
    (_a = document.getElementById(`pageParent`)) == null ? void 0 : _a.appendChild(
      compileContentsToHtml({
        contents: _pageWidget(options, contents),
        parent: {
          width: size.basedOnContents,
          height: size.basedOnContents,
          cornerRadius: 0,
          outlineColor: colors.transparent,
          outlineSize: 0,
          background: colors.transparent,
          shadowSize: 0,
          shadowDirection: align.center,
          padding: 0,
          contentAlign: align.center,
          contentAxis: axis.vertical,
          contentIsScrollableX: false,
          contentIsScrollableY: false,
          contentSpacing: 0,
          textSize: 1,
          textIsBold: false,
          textIsItalic: false,
          textColor: colors.black,
          contents: [],
          htmlTag: `div`
        },
        startZIndex: 0
      }).htmlElements[0]
    );
    document.title = options.name;
  }
};

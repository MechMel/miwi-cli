//
//
//
//
//

// SECTION: Contents
type Contents = _SingleContentTypes | Contents[]; //Text | Bool | Num | Widget | Contents[];
type _SingleContentTypes =
  | string
  | boolean
  | number
  | Required<Icon>
  | Required<Widget>;
const isContent = function (possibleContent: any): possibleContent is Contents {
  let isActuallyContent = false;
  if (Array.isArray(possibleContent)) {
    isActuallyContent = true;
    for (const i in possibleContent) {
      isActuallyContent = isActuallyContent && isContent(possibleContent[i]);
    }
  } else {
    isActuallyContent =
      typeof possibleContent === `string` ||
      typeof possibleContent === `boolean` ||
      typeof possibleContent === `number` ||
      _isIcon(possibleContent) ||
      isWidget(possibleContent);
  }
  return isActuallyContent;
};
type _contentCompiler = {
  isThisType: (contents: Contents) => boolean;
  compile: (params: {
    contents: any;
    parent: Widget;
    startZIndex: number;
  }) => _ContentCompilationResults;
};
type _ContentCompilationResults = {
  htmlElements: Node[];
  widthGrows: boolean;
  heightGrows: boolean;
  greatestZIndex: number;
};
const _contentCompilers: _contentCompiler[] = [];
const _addNewContentCompiler = (newCompiler: _contentCompiler) =>
  _contentCompilers.push(newCompiler);
const compileContentsToHtml = function (params: {
  contents: Contents;
  parent: Widget;
  startZIndex: number;
}): _ContentCompilationResults {
  for (const i in _contentCompilers) {
    if (_contentCompilers[i].isThisType(params.contents)) {
      return _contentCompilers[i].compile({
        contents: params.contents,
        parent: params.parent,
        startZIndex: params.startZIndex,
      });
    }
  }
  throw `Encountered an error in "miwi/widget.tsx.compileContentsToHtml". Could not find a content compiler for ${JSON.stringify(
    params.contents,
    null,
    2,
  )}`;
};
_addNewContentCompiler({
  isThisType: (contents: Contents) => Array.isArray(contents),
  compile: function (params: {
    contents: _SingleContentTypes[];
    parent: Widget;
    startZIndex: number;
  }): _ContentCompilationResults {
    // We'll split arrays into their individual elements and recurssively convert them to html.
    const myInfo: _ContentCompilationResults = {
      htmlElements: [],
      widthGrows: false,
      heightGrows: false,
      greatestZIndex: params.startZIndex,
    };
    for (let i in params.contents) {
      const thisWidgetInfo = compileContentsToHtml({
        contents: params.contents[i],
        parent: params.parent,
        startZIndex:
          params.parent.contentAxis === axis.z
            ? myInfo.greatestZIndex + 1
            : params.startZIndex,
      });
      for (const j in thisWidgetInfo.htmlElements) {
        myInfo.htmlElements.push(thisWidgetInfo.htmlElements[j]);
      }
      myInfo.widthGrows = thisWidgetInfo.widthGrows || myInfo.widthGrows;
      myInfo.heightGrows = thisWidgetInfo.heightGrows || myInfo.heightGrows;
      myInfo.greatestZIndex = Math.max(
        myInfo.greatestZIndex,
        thisWidgetInfo.greatestZIndex,
      );
    }
    return myInfo;
  },
});

//
//
//
//
//

// SECTION: Widget
/** @About Widgets are the building blocks of UIs. */
interface Widget {
  width: Size;
  height: Size;
  cornerRadius: number;
  outlineColor: ColorLiteralRGB;
  outlineSize: number;
  background: Material;
  shadowSize: number;
  shadowDirection: Align;
  //interaction: { onTap: function() {}, onDoubleTap: function() {}, onLongPress: function() {}, }
  padding: Padding;
  contentAlign: Align;
  contentAxis: Axis;
  contentIsScrollableX: boolean;
  contentIsScrollableY: boolean;
  contentSpacing: Spacing;
  // contentStyle: style.deferToParent,
  textSize: number;
  textIsBold: boolean;
  textIsItalic: boolean;
  textColor: ColorLiteralRGB;
  contents: Contents;
  htmlTag: string;
  toString: () => string;
}

const isWidget = (possibleWidget: any): possibleWidget is Widget =>
  exists(possibleWidget?.htmlTag);

type _WidgetTemplate = Required<Widget> & {
  (
    options?: _WidgetConstructorOptions,
    ...contents: Contents[]
  ): Required<Widget>;
};
type _WidgetConstructorOptions =
  | Partial<OmitToNever<Widget, `htmlTag` | `contents`>>
  | Contents;
type OmitToNever<T, Keys extends string | symbol | number> = Omit<T, Keys> & {
  [key in Keys]: never;
};

/** @About This is a shorthand for creating custom widgets */
function widgetTemplate<T extends Required<Omit<Widget, `toString`>>>(
  defaultWidget: T,
): _WidgetTemplate {
  const build: any = function (
    invocationOptions?: _WidgetConstructorOptions,
    ...invocationContents: Contents[]
  ): Required<Widget> {
    if (isContent(invocationOptions)) {
      invocationContents.unshift(invocationOptions);
      invocationOptions = {};
    }
    const newWidget: any = {};
    for (const key in defaultWidget) {
      newWidget[key] =
        (invocationOptions as any)?.[key] ?? (defaultWidget as any)[key];
    }
    // If no invocation contents are provided then we should use the default contents instead.
    if (invocationContents.length > 0) {
      newWidget.contents = invocationContents;
    }
    newWidget.toString = function (): string {
      return `$$#@%${JSON.stringify(newWidget)}%@#$$`;
    };
    return newWidget;
  };
  for (const key in defaultWidget) {
    build[key] = defaultWidget[key];
  }
  return build as _WidgetTemplate;
}

/** @About Used to put all widget styling in one spot. */
const widgetStyleBuilders: ((params: {
  widget: Widget;
  parent: Widget;
  childrenInfo: _ContentCompilationResults;
  startZIndex: number;
}) => _WidgetStylePart)[] = [];
type _WidgetStylePart = {
  preferParent?: { [key: string]: string | number | boolean | undefined };
  preferChild?: { [key: string]: string | number | boolean | undefined };
};

/** @About Converts a widget to an html element along with some other stats. */
_addNewContentCompiler({
  isThisType: (contents: Contents) => exists((contents as any)?.htmlTag),
  compile: function (params: {
    contents: Widget;
    parent: Widget;
    startZIndex: number;
  }): _ContentCompilationResults {
    // Compile the children
    const childrenInfo = compileContentsToHtml({
      contents: params.contents.contents,
      parent: params.contents,
      startZIndex: params.startZIndex,
    });

    // Compile the styles
    const shouldUseTwoElements = params.contents.contentAxis === axis.z;
    const parentStyle: any = {};
    const childStyle: any = {
      flexGrow: 1,
      alignSelf: `stretch`,
      backgroundColor: `green`,
    };
    for (const i in widgetStyleBuilders) {
      const newProps = widgetStyleBuilders[i]({
        widget: params.contents,
        parent: params.parent,
        childrenInfo: childrenInfo,
        startZIndex: params.startZIndex,
      });
      for (const key in newProps.preferParent) {
        (parentStyle as any)[key] = (newProps.preferParent as any)[key];
      }
      for (const key in newProps.preferChild) {
        if (shouldUseTwoElements) {
          (childStyle as any)[key] = (newProps.preferChild as any)[key];
        } else {
          (parentStyle as any)[key] = (newProps.preferChild as any)[key];
        }
      }
    }

    // Compile the widget
    return {
      widthGrows: _getSizeGrows(params.contents.width, childrenInfo.widthGrows),
      heightGrows: _getSizeGrows(
        params.contents.height,
        childrenInfo.heightGrows,
      ),
      greatestZIndex: childrenInfo.greatestZIndex,
      htmlElements: [
        createHtmlElement({
          tag: params.contents.htmlTag,
          style: parentStyle,
          content: shouldUseTwoElements
            ? [
                createHtmlElement({
                  tag: `div`,
                  style: childStyle,
                  content: childrenInfo.htmlElements,
                }),
              ]
            : childrenInfo.htmlElements,
        }),
      ],
    };
  },
});

//
//
//
//
//

// SECTION: Width & Height
type Size = number | string | _SizeGrowConfig;
type _SizeGrowConfig = {
  flex: number;
};
const _getSizeGrows = (givenSize: Size, childGrows: boolean) =>
  _isSizeGrowConfig(givenSize) ||
  (givenSize == size.basedOnContents && childGrows);
function _isSizeGrowConfig(
  possibleGrowth: any,
): possibleGrowth is _SizeGrowConfig {
  return exists(possibleGrowth.flex);
}
const size = readonlyObj({
  exactly: function (num: number): Size {
    return num;
  },
  basedOnContents: -1 as Size,
  grow: (function () {
    const buildGrowth = function (flex: number) {
      return { flex: flex };
    };
    buildGrowth.flex = 1;
    return buildGrowth;
  })(),
});
widgetStyleBuilders.push(function (params: {
  widget: Widget;
  parent: Widget;
  childrenInfo: _ContentCompilationResults;
}) {
  const computeSizeInfo = (givenSize: Size, childGrows: boolean) => {
    const sizeGrows = _getSizeGrows(givenSize, childGrows);
    const exactSize = isString(givenSize)
      ? givenSize
      : givenSize !== size.basedOnContents && !sizeGrows
      ? numToStandardHtmlUnit(givenSize as number)
      : undefined;
    return [exactSize, sizeGrows];
  };
  const [exactWidth, widthGrows] = computeSizeInfo(
    params.widget.width,
    params.childrenInfo.widthGrows,
  );
  const [exactHeight, heightGrows] = computeSizeInfo(
    params.widget.height,
    params.childrenInfo.heightGrows,
  );
  return {
    preferParent: {
      display: `flex`,
      boxSizing: `border-box`,
      // Using minWidth and maxWidth tells css to not override the size of this element
      width: exactWidth,
      minWidth: exactWidth,
      maxWidth: exactWidth,
      height: exactHeight,
      minHeight: exactHeight,
      maxHeight: exactHeight,
      flexGrow:
        params.parent.contentAxis === axis.vertical
          ? _isSizeGrowConfig(params.widget.height)
            ? params.widget.height.flex
            : heightGrows
            ? 1
            : undefined
          : _isSizeGrowConfig(params.widget.width)
          ? params.widget.width.flex
          : widthGrows
          ? 1
          : undefined,
      alignSelf:
        (params.parent.contentAxis === axis.horizontal && heightGrows) ||
        (params.parent.contentAxis === axis.vertical && widthGrows)
          ? `stretch`
          : undefined,
    },
    preferChild: {
      display: `flex`,
      boxSizing: `border-box`,
    },
  };
});

function numToStandardHtmlUnit(num: number) {
  return `${num * (_pageWidthVmin / 24)}vmin`;
}

//
//
//
//
//

// SECTION: Box Decoration
/** @Note Describes the styling of the background of a widget. */
type Material = /*Color | */ ColorLiteralRGB | ImageRef;
// type HSV = `${number} ${number} ${number}`;
/* type Color = ReturnType<typeof Color>;
 const Color = Var.variant(function (v: any): v is ColorLiteralRGB {
  return typeof v === `string` && v.startsWith(`#`);
});*/
/*const someColor = Color(`#ff00ff`);
const isColor = Color.isThisType(someColor);*/
type ColorLiteralRGB = `#${string}`;
const colors = readonlyObj({
  white: `#ffffffff` as ColorLiteralRGB,
  almostWhite: `#f9fafdff` as ColorLiteralRGB,
  pink: `#e91e63ff` as ColorLiteralRGB,
  red: `#f44336ff` as ColorLiteralRGB,
  orange: `#ff9800ff` as ColorLiteralRGB,
  yellow: `#ffea00ff` as ColorLiteralRGB,
  green: `#4caf50ff` as ColorLiteralRGB,
  teal: `#009688ff` as ColorLiteralRGB,
  blue: `#2196f3ff` as ColorLiteralRGB,
  purple: `#9c27b0ff` as ColorLiteralRGB,
  brown: `#795548ff` as ColorLiteralRGB,
  grey: `#9e9e9eff` as ColorLiteralRGB,
  black: `#000000ff` as ColorLiteralRGB,
  transparent: `#ffffff00` as ColorLiteralRGB,
});
type ImageRef = string;
widgetStyleBuilders.push((params: { widget: Widget }) => {
  const _isMaterialImage = (material: Material): material is ImageRef =>
    /*!Color.isThisType(material) && */ material[0] !== `#`;
  return {
    preferParent: {
      // Corner Radius
      borderRadius: numToStandardHtmlUnit(params.widget.cornerRadius),

      // Border
      border: `none`,
      outline: `${numToStandardHtmlUnit(params.widget.outlineSize)} solid ${
        params.widget.outlineColor
      }`,
      outlineOffset: `-` + numToStandardHtmlUnit(params.widget.outlineSize),

      // Background
      backgroundColor: _isMaterialImage(params.widget.background)
        ? undefined
        : /*: Color.isThisType(params.widget.background)
        ? params.widget.background.value*/
          params.widget.background,
      backgroundImage: _isMaterialImage(params.widget.background)
        ? `url(${params.widget.background})`
        : undefined,
      backgroundPosition: _isMaterialImage(params.widget.background)
        ? `center`
        : undefined,
      backgroundSize: _isMaterialImage(params.widget.background)
        ? `cover`
        : undefined,
      backgroundRepeat: `no-repeat`,
      backgroundAttachment: `local`,

      // Shadow
      boxShadow: `${numToStandardHtmlUnit(
        0.12 * params.widget.shadowSize * params.widget.shadowDirection.x,
      )} ${numToStandardHtmlUnit(
        -0.12 * params.widget.shadowSize * params.widget.shadowDirection.y,
      )} ${numToStandardHtmlUnit(
        0.225 * params.widget.shadowSize,
      )} ${numToStandardHtmlUnit(0)} ${colors.grey}`,
    },
  };
});

//
//
//
//
//

// SECTION: Padding
type Padding = number; //Num | [Num, Num] | [Num, Num, Num, Num];
widgetStyleBuilders.push((params: { widget: Widget }) => {
  return {
    preferParent: {
      padding: numToStandardHtmlUnit(params.widget.padding),
    },
  };
});

//
//
//
//
//

// SECTION: Content Align
type Align = { x: number; y: number };
const align = readonlyObj({
  topLeft: { x: -1, y: 1 } as Align,
  topCenter: { x: 0, y: 1 } as Align,
  topRight: { x: 1, y: 1 } as Align,
  centerLeft: { x: -1, y: 0 } as Align,
  center: { x: 0, y: 0 } as Align,
  centerRight: { x: 1, y: 0 } as Align,
  bottomLeft: { x: -1, y: -1 } as Align,
  bottomCenter: { x: 0, y: -1 } as Align,
  bottomRight: { x: 1, y: -1 } as Align,
});
widgetStyleBuilders.push(
  (params: {
    widget: Widget;
    parent: Widget;
    childrenInfo: _ContentCompilationResults;
  }) => {
    const myPosition =
      params.parent.contentAxis === axis.z ? `absolute` : `relative`;
    return {
      preferParent: {
        // Algin self when in a stack
        position: myPosition,
        margin:
          params.parent.contentAxis === axis.z
            ? `${params.parent.contentAlign.x === 0 ? `auto` : 0} ${
                params.parent.contentAlign.y === 0 ? `auto` : 0
              }`
            : 0,
        left:
          params.parent.contentAxis === axis.z &&
          params.parent.contentAlign.x === -1
            ? 0
            : undefined,
        top:
          params.parent.contentAxis === axis.z &&
          params.parent.contentAlign.y === 1
            ? 0
            : undefined,
        right:
          params.parent.contentAxis === axis.z &&
          params.parent.contentAlign.x === 1
            ? 0
            : undefined,
        bottom:
          params.parent.contentAxis === axis.z &&
          params.parent.contentAlign.y === -1
            ? 0
            : undefined,

        // Content Alignment: https://css-tricks.com/snippets/css/a-guide-to-flexbox/
        justifyContent:
          // Exact spacing is handled through grid gap
          typeof params.widget.contentSpacing === `number`
            ? params.widget.contentAxis === axis.vertical
              ? params.widget.contentAlign.y === 1
                ? `flex-start`
                : params.widget.contentAlign.y === 0
                ? `safe center`
                : `flex-end`
              : params.widget.contentAlign.x === -1
              ? `flex-start`
              : params.widget.contentAlign.x === 0
              ? `safe center`
              : `flex-end`
            : params.widget.contentSpacing === spacing.spaceBetween &&
              params.childrenInfo.htmlElements.length === 1
            ? // For whatever reason, space-between with one item puts it at the start instead of centering it.
              spacing.spaceAround
            : params.widget.contentSpacing,
        alignItems:
          params.widget.contentAxis === axis.vertical
            ? params.widget.contentAlign.x === -1
              ? `flex-start`
              : params.widget.contentAlign.x === 0
              ? `safe center`
              : `flex-end`
            : params.widget.contentAlign.y === 1
            ? `flex-start`
            : params.widget.contentAlign.y === 0
            ? `safe center`
            : `flex-end`,
        textAlign:
          params.widget.contentAlign.x === -1
            ? `left`
            : params.widget.contentAlign.x === 0
            ? `center`
            : `right`,
      },
      preferChild: {
        position:
          params.widget.contentAxis === axis.z ? `relative` : myPosition,
      },
    };
  },
);

//
//
//
//
//

// SECTION: Content Axis
type Axis = `horizontal` | `vertical` | `z`;
const axis = readonlyObj({
  horizontal: `horizontal` as Axis,
  vertical: `vertical` as Axis,
  z: `z` as Axis,
});
widgetStyleBuilders.push((params: { widget: Widget; startZIndex: number }) => {
  return {
    preferParent: {
      flexDirection:
        params.widget.contentAxis === axis.vertical ? `column` : `row`,
      zIndex: params.startZIndex,
    },
  };
});

//
//
//
//
//

// SECTION: Content Is Scrollable
widgetStyleBuilders.push((params: { widget: Widget }) => {
  return {
    preferParent: {
      overflowX: params.widget.contentIsScrollableX
        ? `overlay` // Scroll when nesscary, and float above contents
        : undefined, //`hidden`,
      overflowY: params.widget.contentIsScrollableY
        ? `auto` // Scroll when nesscary, and float above contents
        : undefined, //`hidden`,
      scrollbarWidth: `thin`,
      scrollbarColor: `#e3e3e3 transparent`,
    },
  };
});

//
//
//
//
//

// SECTION: Content Spacing
type Spacing = `space-between` | `space-around` | `space-evenly` | number;
const spacing = readonlyObj({
  spaceBetween: `space-between` as Spacing,
  spaceAround: `space-around` as Spacing,
  spaceEvenly: `space-evenly` as Spacing,
  exactly: (num: number) => num as Spacing,
});
widgetStyleBuilders.push((params: { widget: Widget }) => {
  return {
    preferChild: {
      rowGap:
        params.widget.contentAxis === axis.vertical &&
        typeof params.widget.contentSpacing === `number`
          ? numToStandardHtmlUnit(params.widget.contentSpacing)
          : undefined,
      columnGap:
        params.widget.contentAxis === axis.horizontal &&
        typeof params.widget.contentSpacing === `number`
          ? numToStandardHtmlUnit(params.widget.contentSpacing)
          : undefined,
    },
  };
});

//
//
//
//
//

// SECTION: Text Style
widgetStyleBuilders.push((params: { widget: Widget }) => {
  return {
    preferParent: {
      fontFamily: `Roboto`,
    },
    preferChild: {
      fontFamily: `Roboto`,
      fontSize: numToFontSize(params.widget.textSize),
      fontWeight: params.widget.textIsBold ? `bold` : undefined,
      fontStyle: params.widget.textIsItalic ? `italic` : undefined,
      color: params.widget.textColor,
    },
  };
});

function numToFontSize(num: number) {
  return numToStandardHtmlUnit(0.825 * num);
}

//
//
//
//
//

// SECTION: Icons
const icons = _iconsObj;
const _inlineContentOpenTag = `$$#@%`;
const _inlineContentCloseTag = `%@#$$`;
_addNewContentCompiler({
  isThisType: (contents: Contents) => exists((contents as any)?.icon),
  compile: function (params: {
    contents: Icon;
    parent: Widget;
    startZIndex: number;
  }): _ContentCompilationResults {
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
            fontSize: numToIconSize(params.parent.textSize),
          },
          content: [
            document.createTextNode(
              params.contents.icon.startsWith(_numIconTag)
                ? params.contents.icon.substring(_numIconTag.length)
                : params.contents.icon,
            ),
          ],
        }),
      ],
      widthGrows: false,
      heightGrows: false,
      greatestZIndex: params.startZIndex,
    };
  },
});

function numToIconSize(num: number) {
  return numToStandardHtmlUnit(0.9 * num);
}

//
//
//
//
//

// SECTION: Content Literals
_addNewContentCompiler({
  isThisType: (contents: Contents) =>
    typeof contents === `string` ||
    typeof contents === `number` ||
    typeof contents === `boolean`,
  compile: function (params: {
    contents: string | number | boolean;
    parent: Widget;
    startZIndex: number;
  }): _ContentCompilationResults {
    const paragraphParts: Node[] = [];
    let greatestZIndex = params.startZIndex;
    if (typeof params.contents === `string`) {
      const contentsAsString = params.contents;
      let openTagIndex = contentsAsString.indexOf(_inlineContentOpenTag);
      let closeTagIndex = 0 - _inlineContentCloseTag.length;
      while (openTagIndex >= 0) {
        // Read in any trailing text
        if (openTagIndex - closeTagIndex + _inlineContentCloseTag.length > 0) {
          paragraphParts.push(
            document.createTextNode(
              contentsAsString.substring(
                closeTagIndex + _inlineContentCloseTag.length,
                openTagIndex,
              ),
            ),
          );
        }
        closeTagIndex =
          openTagIndex +
          contentsAsString
            .substring(openTagIndex)
            .indexOf(_inlineContentCloseTag);
        const embededContentInfo = compileContentsToHtml({
          contents: JSON.parse(
            contentsAsString.substring(
              openTagIndex + _inlineContentOpenTag.length,
              closeTagIndex,
            ),
          ) as Widget,
          parent: params.parent,
          startZIndex: params.startZIndex,
        });
        greatestZIndex = Math.max(
          greatestZIndex,
          embededContentInfo.greatestZIndex,
        );
        for (const i in embededContentInfo.htmlElements) {
          paragraphParts.push(embededContentInfo.htmlElements[i]);
        }
        openTagIndex = contentsAsString
          .substring(closeTagIndex)
          .indexOf(_inlineContentOpenTag);
        if (openTagIndex >= 0) {
          openTagIndex += closeTagIndex;
        }
      }
      if (
        closeTagIndex + _inlineContentCloseTag.length <
        contentsAsString.length
      ) {
        paragraphParts.push(
          document.createTextNode(
            contentsAsString.substring(
              closeTagIndex + _inlineContentCloseTag.length,
              contentsAsString.length,
            ),
          ),
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
            fontWeight: params.parent.textIsBold ? `bold` : undefined,
            fontStyle: params.parent.textIsItalic ? `italic` : undefined,
            textAlign:
              params.parent.contentAlign.x === -1
                ? `left`
                : params.parent.contentAlign.x === 0
                ? `center`
                : `right`,
            margin: 0,
            padding: 0,
            zIndex: params.startZIndex,
          },
          content: paragraphParts,
        }),
      ],
    };
  },
});

//
//
//
//
//

// SECTION: Compile Page
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
  htmlTag: `div`,
});
function _defaultPageParams() {
  const params: any = {};
  params.name = `Untitled`;
  const defaultPageWidget = _pageWidget();
  for (const key in defaultPageWidget) {
    if (key !== `htmlTag` && key !== `contents`) {
      params[key] = (defaultPageWidget as any)[key];
    }
  }
  return params as Partial<
    Omit<Widget, `htmlTag` | `width` | `height` | `contents`> & { name: string }
  >;
}

/** @Note Describes a web page. */
const page = function (
  options = _defaultPageParams() as ReturnType<typeof _defaultPageParams>,
  ...contents: Contents[]
) {
  const currentPage = document.getElementById(`currentPage`);
  if (!exists(currentPage)) {
    // Normalize Params
    if (isContent(options)) {
      contents.unshift(options);
      options = _defaultPageParams();
    }

    // Render page
    document.getElementById(`pageParent`)?.appendChild(
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
          htmlTag: `div`,
        },
        startZIndex: 0,
      }).htmlElements[0],
    );
    document.title = options.name!;
  }
};

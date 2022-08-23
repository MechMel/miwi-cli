"use strict";
const page = () => {
  var _a;
  const oldPageUi = document.getElementById(`currentPage`);
  if (!exists(oldPageUi)) {
    (_a = document.getElementById(`pageParent`)) == null ? void 0 : _a.appendChild(
      createHtmlElement({
        tag: "div",
        content: ["Hello World!"],
        style: {}
      })
    );
  }
};

"use strict";
function readonlyObj(obj) {
  return obj;
}
function exists(obj) {
  return obj !== void 0 && obj !== null;
}
function isString(possibleString) {
  return typeof possibleString === `string`;
}
function createHtmlElement(params) {
  const element = document.createElement(params.tag);
  let styleString = ``;
  for (const key in params.style) {
    let adjustedKey = ``;
    for (let i = 0; i < key.length; i++) {
      adjustedKey += key[i] === key[i].toLowerCase() ? key[i] : `-${key[i].toLowerCase()}`;
    }
    styleString += `${adjustedKey}: ${params.style[key]}; `;
  }
  element.setAttribute(`style`, styleString);
  if (exists(params.id))
    element.setAttribute(`id`, params.id);
  if (exists(params.class))
    element.setAttribute(`class`, params.class);
  for (const child of params.content) {
    element.appendChild(child);
  }
  return element;
}

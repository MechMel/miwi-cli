function readonlyObj<T>(obj: T): Readonly<T> {
  return obj;
}

function exists(obj: any) {
  return obj !== undefined && obj !== null;
}

function isString(possibleString: any): possibleString is string {
  return typeof possibleString === `string`;
}

function createHtmlElement(params: {
  tag: string;
  content: any[];
  style: { [key: string]: string | number | boolean | undefined };
  id?: string;
  class?: string;
}) {
  const element = document.createElement(params.tag);

  // Set style
  let styleString = ``;
  for (const key in params.style) {
    let adjustedKey = ``;
    for (let i = 0; i < key.length; i++) {
      adjustedKey +=
        key[i] === key[i].toLowerCase() ? key[i] : `-${key[i].toLowerCase()}`;
    }
    styleString += `${adjustedKey} = ${params.style[key]};`;
  }
  element.setAttribute(`style`, styleString);

  // Set Id and Class
  if (exists(params.id)) element.setAttribute(`id`, params.id as any);
  if (exists(params.class)) element.setAttribute(`class`, params.class as any);

  // Add children
  for (const i in params.content) {
    if (exists(params.content[i]?.attributes)) {
      element.appendChild(params.content[i]);
    } else {
      element.appendChild(document.createTextNode(params.content[i]));
    }
  }

  return element;
}

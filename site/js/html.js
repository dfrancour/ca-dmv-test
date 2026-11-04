// Tiny tagged template for building HTML strings safely.
// Interpolated values are escaped unless they are themselves html`` results.

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

class SafeHTML {
  constructor(value) {
    this.value = value;
  }
  toString() {
    return this.value;
  }
}

export const escape = (text) => String(text).replace(/[&<>"']/g, (c) => ESCAPES[c]);

function renderValue(value) {
  if (value == null || value === false) return "";
  if (value instanceof SafeHTML) return value.value;
  if (Array.isArray(value)) return value.map(renderValue).join("");
  return escape(value);
}

export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += renderValue(values[i]) + strings[i + 1];
  return new SafeHTML(out);
}

/** Markup that is already safe (the handbook's imported text), inserted as it is. */
export const raw = (markup) => new SafeHTML(String(markup));

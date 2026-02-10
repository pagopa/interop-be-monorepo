/* eslint-disable functional/immutable-data */
/* eslint-disable fp/no-delete */

import h2j from "html2json";
import isEmpty from "lodash.isempty";

export function parseAndSanitizeHtml(html: string): h2j.Node {
  const jsonHtlmNodes = h2j.html2json(html);
  removeUselessAttributesFromHtmlNodes(jsonHtlmNodes);
  removeDangerousAttributesFromHtmlNodes(jsonHtlmNodes);
  return jsonHtlmNodes;
}

/**
 * Remove useless attributes from the given HTML nodes object, such as
 * attributes that are used for styling.
 *
 * Mutates the given object.
 */
function removeUselessAttributesFromHtmlNodes(node: h2j.Node): void {
  if (node.attr?.class) {
    delete node.attr.class;
  }
  if (node.attr?.style) {
    delete node.attr.style;
  }
  if (node.attr?.id === "isPasted") {
    delete node.attr.id;
  }
  if (isEmpty(node.attr)) {
    delete node.attr;
  }
  if (!node.child) {
    return;
  }

  if (Array.isArray(node.child)) {
    node.child.forEach(removeUselessAttributesFromHtmlNodes);
  } else {
    removeUselessAttributesFromHtmlNodes(node.child);
  }
}

/**
 *
 * Remove dangerous attributes from the given HTML nodes object, such as
 * attributes that could be used to execute JavaScript code.
 *
 * Mutates the given object.
 */
function removeDangerousAttributesFromHtmlNodes(node: h2j.Node): void {
  if (node.tag === "script") {
    delete node.attr;
    node.child = [];
  }
  if (node.attr?.href?.includes("javascript")) {
    delete node.attr?.href;
  }

  if (!node.child) {
    return;
  }

  if (Array.isArray(node.child)) {
    node.child.forEach(removeDangerousAttributesFromHtmlNodes);
  } else {
    removeDangerousAttributesFromHtmlNodes(node.child);
  }
}

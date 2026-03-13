import { parseDocument } from "htmlparser2";
import { type ChildNode, Element, Text, Comment } from "domhandler";

export interface HtmlJsonNode {
  node: "root" | "element" | "text" | "comment";
  tag?: string;
  child?: HtmlJsonNode[];
  text?: string;
  attr?: Record<string, string | string[]>;
}

export function parseAndSanitizeHtml(html: string): HtmlJsonNode {
  const document = parseDocument(html);
  const children = document.childNodes.map(convertNode);
  return { node: "root", child: children };
}

function convertNode(domNode: ChildNode): HtmlJsonNode {
  if (domNode instanceof Text) {
    return { node: "text", text: domNode.data };
  }

  if (domNode instanceof Comment) {
    return { node: "comment", text: domNode.data };
  }

  if (domNode instanceof Element) {
    return convertElement(domNode);
  }

  return { node: "text", text: "" };
}

function convertElement(el: Element): HtmlJsonNode {
  if (el.name === "script") {
    return { node: "element", tag: el.name, child: [] };
  }

  const attr = sanitizeAttributes(el.attribs);
  const children = el.childNodes.map(convertNode);

  return {
    node: "element",
    tag: el.name,
    ...(attr !== undefined ? { attr } : {}),
    ...(children.length > 0 ? { child: children } : {}),
  };
}

function isAllowedAttribute(key: string, value: string): boolean {
  if (key === "class" || key === "style") {
    return false;
  }
  if (key === "id" && value === "isPasted") {
    return false;
  }
  return !(key === "href" && value.includes("javascript"));
}

function sanitizeAttributes(
  attribs: Record<string, string>
): Record<string, string | string[]> | undefined {
  const entries = Object.entries(attribs).filter(([key, value]) =>
    isAllowedAttribute(key, value)
  );
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

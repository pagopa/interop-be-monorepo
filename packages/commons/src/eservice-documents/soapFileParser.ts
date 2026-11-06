import { Attr, Document, DOMParser, Element, Node } from "@xmldom/xmldom";
import {
  buildingSoapFileError,
  interfaceExtractingSoapFiledError,
  parsingSoapFileError,
} from "pagopa-interop-models";

const wsdlNamespace = "http://schemas.xmlsoap.org/wsdl/";
const soapNamespaces = new Set([
  "http://schemas.xmlsoap.org/wsdl/soap/",
  "http://schemas.xmlsoap.org/wsdl/soap12/",
]);

const childElements = (node: Node): Element[] =>
  Array.from(node.childNodes).filter(
    (child): child is Element => child.nodeType === 1
  );

const wsdlChildren = (node: Node, name: string): Element[] =>
  childElements(node).filter(
    (child) => child.namespaceURI === wsdlNamespace && child.localName === name
  );

const isSoapElement = (element: Element, name: string): boolean =>
  element.localName === name &&
  element.namespaceURI !== null &&
  soapNamespaces.has(element.namespaceURI);

export const soapParse = (file: string): Document => {
  try {
    return new DOMParser({
      locator: true,
      onError: () => {
        // Warnings can indicate parser recovery, which must not alter the selection.
        throw parsingSoapFileError();
      },
    }).parseFromString(file.replace(/^\uFEFF/, ""), "application/xml");
  } catch {
    throw parsingSoapFileError();
  }
};

const soapLocationAttributes = (document: Document): Attr[] => {
  const locations = wsdlChildren(document, "definitions")
    .flatMap((definitions) => wsdlChildren(definitions, "service"))
    .flatMap((service) => wsdlChildren(service, "port"))
    .flatMap((port) =>
      childElements(port).filter((element) => isSoapElement(element, "address"))
    )
    .map((address) => {
      const location = address.getAttributeNodeNS(null, "location");
      if (!location) {
        throw interfaceExtractingSoapFiledError("soap:address");
      }
      return location;
    });

  if (locations.length === 0) {
    throw interfaceExtractingSoapFiledError("soap:address");
  }
  return locations;
};

export const retrieveServerUrlsSoapAPI = (file: string): string[] => {
  const document = soapParse(file);
  const locations = soapLocationAttributes(document);
  const operations = wsdlChildren(document, "definitions")
    .flatMap((definitions) => wsdlChildren(definitions, "binding"))
    .flatMap((binding) => wsdlChildren(binding, "operation"));

  if (
    operations.length === 0 ||
    operations.some(
      (operation) =>
        !childElements(operation).some(
          (element) =>
            isSoapElement(element, "operation") &&
            element.hasAttributeNS(null, "soapAction")
        )
    )
  ) {
    throw interfaceExtractingSoapFiledError("soap:operation");
  }

  return locations.map((location) => location.value);
};

const originalLineStarts = (file: string): number[] => [
  file.startsWith("\uFEFF") ? 1 : 0,
  // Match xmldom's line-ending normalization, retaining offsets in the original text.
  ...Array.from(file.matchAll(/\r[\n\u0085]?|[\n\u0085\u2028\u2029]/g)).map(
    (newline) => newline.index + newline[0].length
  ),
];

const originalOffset = (node: Node, lineStarts: number[]): number => {
  const { lineNumber, columnNumber } = node;
  if (
    lineNumber === undefined ||
    columnNumber === undefined ||
    !Number.isInteger(lineNumber) ||
    !Number.isInteger(columnNumber) ||
    lineNumber < 1 ||
    lineNumber > lineStarts.length ||
    columnNumber < 1
  ) {
    throw buildingSoapFileError();
  }
  return lineStarts[lineNumber - 1] + columnNumber - 1;
};

const locationValueRange = (
  file: string,
  location: Attr,
  lineStarts: number[]
): { start: number; end: number } => {
  const quoteOffset = originalOffset(location, lineStarts);
  const quote = file[quoteOffset];
  const address = location.ownerElement;
  if (!address || (quote !== '"' && quote !== "'")) {
    throw buildingSoapFileError();
  }
  const addressOffset = originalOffset(address, lineStarts);
  if (
    addressOffset >= quoteOffset ||
    !file.startsWith(`<${address.tagName}`, addressOffset) ||
    !/[\t\n\r \u0085\u2028\u2029]location[\t\n\r \u0085\u2028\u2029]*=[\t\n\r \u0085\u2028\u2029]*$/.test(
      file.slice(addressOffset, quoteOffset)
    )
  ) {
    throw buildingSoapFileError();
  }

  // The DOM locator identifies this attribute's opening quote. Search only its value.
  const end = file.indexOf(quote, quoteOffset + 1);
  if (end === -1) {
    throw buildingSoapFileError();
  }
  return { start: quoteOffset + 1, end };
};

const escapeAttributeValue = (value: string): string => {
  if (/[^\t\n\r\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/u.test(value)) {
    throw buildingSoapFileError();
  }
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/\t/g, "&#9;")
    .replace(/\n/g, "&#10;")
    .replace(/\r/g, "&#13;")
    .replace(/\u0085/g, "&#133;")
    .replace(/\u2028/g, "&#8232;")
    .replace(/\u2029/g, "&#8233;");
};

export const updateSoapApiFileServerUrls = (
  file: string,
  serverUrls: string[]
): Buffer => {
  const locations = soapLocationAttributes(soapParse(file));
  if (locations.length !== serverUrls.length) {
    throw buildingSoapFileError();
  }
  const lineStarts = originalLineStarts(file);
  let offset = 0;
  const parts = locations.flatMap((location, index) => {
    const range = locationValueRange(file, location, lineStarts);
    if (range.start < offset) {
      throw buildingSoapFileError();
    }
    const prefix = file.slice(offset, range.start);
    offset = range.end;
    return [prefix, escapeAttributeValue(serverUrls[index])];
  });

  return Buffer.from(parts.join("") + file.slice(offset));
};

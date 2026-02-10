import { describe, it, expect } from "vitest";
import { parseAndSanitizeHtml } from "../src/services/htmlParser.js";

describe("parseAndSanitizeHtml", () => {
  it("should parse a simple element into the expected JSON shape", () => {
    const result = parseAndSanitizeHtml("<p>hello</p>");

    expect(result).toEqual({
      node: "root",
      child: [
        {
          node: "element",
          tag: "p",
          child: [{ node: "text", text: "hello" }],
        },
      ],
    });
  });

  it("should parse nested elements", () => {
    const result = parseAndSanitizeHtml("<div><p>text</p></div>");

    expect(result).toEqual({
      node: "root",
      child: [
        {
          node: "element",
          tag: "div",
          child: [
            {
              node: "element",
              tag: "p",
              child: [{ node: "text", text: "text" }],
            },
          ],
        },
      ],
    });
  });

  it("should preserve non-dangerous attributes like href", () => {
    const result = parseAndSanitizeHtml(
      '<a href="https://example.com">link</a>'
    );

    expect(result).toEqual({
      node: "root",
      child: [
        {
          node: "element",
          tag: "a",
          attr: { href: "https://example.com" },
          child: [{ node: "text", text: "link" }],
        },
      ],
    });
  });

  it("should handle multiple sibling elements", () => {
    const result = parseAndSanitizeHtml("<p>one</p><p>two</p>");

    expect(result).toEqual({
      node: "root",
      child: [
        {
          node: "element",
          tag: "p",
          child: [{ node: "text", text: "one" }],
        },
        {
          node: "element",
          tag: "p",
          child: [{ node: "text", text: "two" }],
        },
      ],
    });
  });

  it("should handle self-closing tags", () => {
    const result = parseAndSanitizeHtml("<br/>");

    expect(result).toEqual({
      node: "root",
      child: [{ node: "element", tag: "br" }],
    });
  });

  it("should handle empty input", () => {
    const result = parseAndSanitizeHtml("");

    expect(result).toEqual({ node: "root", child: [] });
  });

  it("should handle plain text without tags", () => {
    const result = parseAndSanitizeHtml("just text");

    expect(result).toEqual({
      node: "root",
      child: [{ node: "text", text: "just text" }],
    });
  });

  describe("useless attributes removal", () => {
    it("should remove class attribute", () => {
      const result = parseAndSanitizeHtml('<p class="my-class">text</p>');

      expect(result).toEqual({
        node: "root",
        child: [
          {
            node: "element",
            tag: "p",
            child: [{ node: "text", text: "text" }],
          },
        ],
      });
    });

    it("should remove style attribute", () => {
      const result = parseAndSanitizeHtml('<p style="color: red">text</p>');

      expect(result).toEqual({
        node: "root",
        child: [
          {
            node: "element",
            tag: "p",
            child: [{ node: "text", text: "text" }],
          },
        ],
      });
    });

    it('should remove id attribute when value is "isPasted"', () => {
      const result = parseAndSanitizeHtml('<p id="isPasted">text</p>');

      expect(result).toEqual({
        node: "root",
        child: [
          {
            node: "element",
            tag: "p",
            child: [{ node: "text", text: "text" }],
          },
        ],
      });
    });

    it("should keep id attribute when value is not isPasted", () => {
      const result = parseAndSanitizeHtml('<p id="my-id">text</p>');

      expect(result).toEqual({
        node: "root",
        child: [
          {
            node: "element",
            tag: "p",
            attr: { id: "my-id" },
            child: [{ node: "text", text: "text" }],
          },
        ],
      });
    });

    it("should remove class and style but keep other attributes", () => {
      const result = parseAndSanitizeHtml(
        '<a class="link" style="color:blue" href="https://example.com">link</a>'
      );

      expect(result).toEqual({
        node: "root",
        child: [
          {
            node: "element",
            tag: "a",
            attr: { href: "https://example.com" },
            child: [{ node: "text", text: "link" }],
          },
        ],
      });
    });

    it("should remove attr object entirely when all attributes are removed", () => {
      const result = parseAndSanitizeHtml(
        '<p class="a" style="b" id="isPasted">text</p>'
      );

      // attr should be completely removed, not just empty
      expect(result).toEqual({
        node: "root",
        child: [
          {
            node: "element",
            tag: "p",
            child: [{ node: "text", text: "text" }],
          },
        ],
      });
    });

    it("should remove useless attributes in deeply nested elements", () => {
      const result = parseAndSanitizeHtml(
        '<div class="outer"><p style="color:red"><a class="inner" href="https://test.com">link</a></p></div>'
      );

      expect(result).toEqual({
        node: "root",
        child: [
          {
            node: "element",
            tag: "div",
            child: [
              {
                node: "element",
                tag: "p",
                child: [
                  {
                    node: "element",
                    tag: "a",
                    attr: { href: "https://test.com" },
                    child: [{ node: "text", text: "link" }],
                  },
                ],
              },
            ],
          },
        ],
      });
    });
  });

  describe("dangerous attributes removal", () => {
    it("should remove script tag content and attributes", () => {
      const result = parseAndSanitizeHtml(
        '<script type="text/javascript">alert("xss")</script>'
      );

      expect(result).toEqual({
        node: "root",
        child: [
          {
            node: "element",
            tag: "script",
            child: [],
          },
        ],
      });
    });

    it("should remove javascript: hrefs", () => {
      const result = parseAndSanitizeHtml(
        '<a href="javascript:alert(1)">click me</a>'
      );

      expect(result).toEqual({
        node: "root",
        child: [
          {
            node: "element",
            tag: "a",
            child: [{ node: "text", text: "click me" }],
          },
        ],
      });
    });

    it("should keep safe hrefs", () => {
      const result = parseAndSanitizeHtml(
        '<a href="https://example.com">safe link</a>'
      );

      expect(result).toEqual({
        node: "root",
        child: [
          {
            node: "element",
            tag: "a",
            attr: { href: "https://example.com" },
            child: [{ node: "text", text: "safe link" }],
          },
        ],
      });
    });

    it("should sanitize script tags nested inside other elements", () => {
      const result = parseAndSanitizeHtml(
        '<div><script>alert("xss")</script><p>safe</p></div>'
      );

      expect(result).toEqual({
        node: "root",
        child: [
          {
            node: "element",
            tag: "div",
            child: [
              {
                node: "element",
                tag: "script",
                child: [],
              },
              {
                node: "element",
                tag: "p",
                child: [{ node: "text", text: "safe" }],
              },
            ],
          },
        ],
      });
    });

    it("should remove javascript: href in nested elements", () => {
      const result = parseAndSanitizeHtml(
        '<div><p><a href="javascript:void(0)">click</a></p></div>'
      );

      expect(result).toEqual({
        node: "root",
        child: [
          {
            node: "element",
            tag: "div",
            child: [
              {
                node: "element",
                tag: "p",
                child: [
                  {
                    node: "element",
                    tag: "a",
                    child: [{ node: "text", text: "click" }],
                  },
                ],
              },
            ],
          },
        ],
      });
    });
  });

  describe("combined sanitization", () => {
    it("should apply both useless and dangerous attribute removal", () => {
      const result = parseAndSanitizeHtml(
        '<div class="container" style="padding:10px"><a class="link" href="javascript:alert(1)">xss</a><p class="text">safe</p></div>'
      );

      expect(result).toEqual({
        node: "root",
        child: [
          {
            node: "element",
            tag: "div",
            child: [
              {
                node: "element",
                tag: "a",
                child: [{ node: "text", text: "xss" }],
              },
              {
                node: "element",
                tag: "p",
                child: [{ node: "text", text: "safe" }],
              },
            ],
          },
        ],
      });
    });

    it("should produce valid JSON-serializable output", () => {
      const html =
        '<div class="main"><h1 style="color:red">Title</h1><p>Paragraph with <a href="https://link.com">a link</a></p><script>malicious()</script></div>';
      const result = parseAndSanitizeHtml(html);

      // Must be serializable to JSON (this is what gets uploaded to S3)
      const serialized = JSON.stringify(result);
      const deserialized = JSON.parse(serialized);
      expect(deserialized).toEqual(result);
    });

    it("should handle a realistic OneTrust-like HTML snippet", () => {
      const html = [
        '<div class="otnotice-content">',
        '<h2 class="otnotice-title" style="font-size:18px">Privacy Policy</h2>',
        '<p class="otnotice-section" id="isPasted">',
        'Per ulteriori informazioni visita <a class="otnotice-link" href="https://pagopa.it/privacy" style="color:blue">il nostro sito</a>.',
        "</p>",
        "</div>",
      ].join("");

      const result = parseAndSanitizeHtml(html);

      expect(result).toEqual({
        node: "root",
        child: [
          {
            node: "element",
            tag: "div",
            child: [
              {
                node: "element",
                tag: "h2",
                child: [{ node: "text", text: "Privacy Policy" }],
              },
              {
                node: "element",
                tag: "p",
                child: [
                  {
                    node: "text",
                    text: "Per ulteriori informazioni visita ",
                  },
                  {
                    node: "element",
                    tag: "a",
                    attr: { href: "https://pagopa.it/privacy" },
                    child: [{ node: "text", text: "il nostro sito" }],
                  },
                  { node: "text", text: "." },
                ],
              },
            ],
          },
        ],
      });
    });
  });
});

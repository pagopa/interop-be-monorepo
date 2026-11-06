import {
  buildingSoapFileError,
  interfaceExtractingSoapFiledError,
  parsingSoapFileError,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

import {
  retrieveServerUrlsSoapAPI,
  soapParse,
  updateSoapApiFileServerUrls,
} from "../../commons/src/eservice-documents/soapFileParser.js";

const wsdlNamespace = "http://schemas.xmlsoap.org/wsdl/";
const soapNamespace = "http://schemas.xmlsoap.org/wsdl/soap/";
const soap12Namespace = "http://schemas.xmlsoap.org/wsdl/soap12/";

const wsdl = (content: string): string =>
  `<wsdl:definitions xmlns:wsdl="${wsdlNamespace}" xmlns:soap="${soapNamespace}" xmlns:soap12="${soap12Namespace}">${content}</wsdl:definitions>`;

const port = (address: string): string =>
  `<wsdl:service><wsdl:port>${address}</wsdl:port></wsdl:service>`;

describe("updateSoapApiFileServerUrls", () => {
  it("changes only location values while preserving the original bytes", () => {
    const file = [
      '\uFEFF<?xml version="1.0" encoding="UTF-8"?>',
      `<wsdl:definitions xmlns:wsdl="${wsdlNamespace}" xmlns:soap="${soapNamespace}" xmlns:soap12="${soap12Namespace}">`,
      "  <!-- <soap:address location='comment'/> -->",
      "  <wsdl:documentation><![CDATA[<soap:address location='cdata'/>]]></wsdl:documentation>",
      '  <wsdl:service name="città 🧭">',
      '    <wsdl:documentation><soap:address location="documentation"/></wsdl:documentation>',
      '    <wsdl:port name="one">',
      "      <soap:address note=\"a > b and 'quoted'\"",
      '          location = "https://old.example/one?a=1&amp;b=2" extra=\'"other"\' />',
      "    </wsdl:port>",
      '    <wsdl:port name="two">',
      "      <soap12:address note='a > b and \"quoted\"' location='https://old.example/two'></soap12:address>",
      "    </wsdl:port>",
      "  </wsdl:service>",
      "</wsdl:definitions>",
      "",
    ].join("\r\n");
    const expected = file
      .replace("https://old.example/one?a=1&amp;b=2", "https://new.example/one")
      .replace("https://old.example/two", "https://new.example/two");

    expect(
      updateSoapApiFileServerUrls(file, [
        "https://new.example/one",
        "https://new.example/two",
      ])
    ).toEqual(Buffer.from(expected));
  });

  it("selects namespace aliases and default namespaces in document order", () => {
    const file = `<definitions xmlns="${wsdlNamespace}" xmlns:s="${soapNamespace}" xmlns:v2="${soap12Namespace}"><service><port><s:address location="first"/></port><port><v2:address location='second'/></port></service><service><port><address xmlns="${soapNamespace}" location="third"/></port></service></definitions>`;

    expect(updateSoapApiFileServerUrls(file, ["one", "two", "three"])).toEqual(
      Buffer.from(
        file
          .replace('location="first"', 'location="one"')
          .replace("location='second'", "location='two'")
          .replace('location="third"', 'location="three"')
      )
    );
  });

  it("ignores addresses with the wrong namespace or ancestry", () => {
    const file = wsdl(
      '<wsdl:documentation><wsdl:service><wsdl:port><soap:address location="nested"/></wsdl:port></wsdl:service></wsdl:documentation>' +
        '<wsdl:service><wsdl:port><soap:address xmlns:soap="urn:wrong" location="wrong-address"/><address location="no-namespace"/><wrapper><soap:address location="wrapped"/></wrapper><soap:address location="selected"/></wsdl:port><port><soap:address location="wrong-port"/></port><wsdl:port xmlns:wsdl="urn:wrong"><soap:address location="wrong-wsdl"/></wsdl:port></wsdl:service>'
    );

    expect(updateSoapApiFileServerUrls(file, ["replacement"])).toEqual(
      Buffer.from(file.replace('location="selected"', 'location="replacement"'))
    );
  });

  it.each(["\n", "\r", "\r\n", "\u0085", "\r\u0085", "\u2028", "\u2029"])(
    "maps DOM locations back to original %j line endings",
    (newline) => {
      const file = wsdl(
        `${newline}<wsdl:service>${newline}<wsdl:port>${newline}<soap:address${newline}location = 'old'/>${newline}</wsdl:port></wsdl:service>`
      );

      expect(updateSoapApiFileServerUrls(file, ["new"])).toEqual(
        Buffer.from(file.replace("'old'", "'new'"))
      );
    }
  );

  it("escapes XML characters and attribute whitespace without changing URL values", () => {
    const file = wsdl(
      port("<soap:address location=\"old\"/><soap12:address location='old'/>")
    );
    const url =
      "https://new.example/?a=1&b=<tag>&q=\"double\"&s='single'\t\n\r";
    const escaped =
      "https://new.example/?a=1&amp;b=&lt;tag&gt;&amp;q=&quot;double&quot;&amp;s=&apos;single&apos;&#9;&#10;&#13;";

    expect(updateSoapApiFileServerUrls(file, [url, url])).toEqual(
      Buffer.from(
        file
          .replace('location="old"', `location="${escaped}"`)
          .replace("location='old'", `location='${escaped}'`)
      )
    );
    const binding =
      '<wsdl:binding><wsdl:operation><soap:operation soapAction="action"/></wsdl:operation></wsdl:binding>';
    expect(
      retrieveServerUrlsSoapAPI(
        updateSoapApiFileServerUrls(
          wsdl(port('<soap:address location="old"/>') + binding),
          [url]
        ).toString()
      )
    ).toEqual([url]);
  });

  it.each(["\u0085", "\u2028", "\u2029"])(
    "preserves Unicode line endings in replacement values (%j)",
    (newline) => {
      const url = `https://new.example/${newline}`;
      const file = wsdl(
        port('<soap:address location="old"/>') +
          '<wsdl:binding><wsdl:operation><soap:operation soapAction="action"/></wsdl:operation></wsdl:binding>'
      );

      expect(
        retrieveServerUrlsSoapAPI(
          updateSoapApiFileServerUrls(file, [url]).toString()
        )
      ).toEqual([url]);
    }
  );

  it.each([{ urls: [] }, { urls: ["one", "two"] }])(
    "rejects a URL count different from the selected addresses ($urls)",
    ({ urls }) => {
      const file = wsdl(port('<soap:address location="old"/>'));

      expect(() => updateSoapApiFileServerUrls(file, urls)).toThrow(
        buildingSoapFileError()
      );
    }
  );

  it.each(["\u0000", "\u0001", "\uFFFE", "\uD800"])(
    "rejects replacement values containing invalid XML characters (%j)",
    (character) => {
      expect(() =>
        updateSoapApiFileServerUrls(
          wsdl(port('<soap:address location="old"/>')),
          [`https://new.example/${character}`]
        )
      ).toThrow(buildingSoapFileError());
    }
  );

  it.each([
    wsdl(port("<soap:address/>")),
    wsdl(port('<soap:address xmlns:x="urn:x" x:location="old"/>')),
    '<definitions xmlns="urn:wrong"><service><port><address location="old"/></port></service></definitions>',
  ])("rejects missing SOAP location attributes (%j)", (file) => {
    expect(() => updateSoapApiFileServerUrls(file, ["new"])).toThrow(
      interfaceExtractingSoapFiledError("soap:address")
    );
  });

  it.each([
    wsdl(port("<soap:address location=old/>")),
    wsdl(port('<soap:address location="old" location="duplicate"/>')),
    wsdl(port('<soap:address location="old&unknown;"/>')),
    wsdl(port('<soap:address location="old"/>')).replace(
      "</wsdl:port>",
      "</wsdl:service>"
    ),
    wsdl(port('<soap:address location="old"/>')) + "<extra/>",
    wsdl(port('<unbound:address location="old"/>')),
    "not XML",
  ])(
    "rejects malformed XML instead of accepting parser recovery (%j)",
    (file) => {
      expect(() => updateSoapApiFileServerUrls(file, ["new"])).toThrow(
        parsingSoapFileError()
      );
      expect(() => soapParse(file)).toThrow(parsingSoapFileError());
    }
  );
});

describe("retrieveServerUrlsSoapAPI", () => {
  it("uses the same namespace-aware selection and order as replacement", () => {
    const file = `<d:definitions xmlns:d="${wsdlNamespace}" xmlns:s="${soapNamespace}" xmlns:t="${soap12Namespace}"><d:documentation><s:address location="ignored"/></d:documentation><d:service><d:port><s:address location="https://one.example/?a=1&amp;b=2"/></d:port><d:port><t:address location="https://two.example/"/></d:port></d:service><d:binding><d:operation><t:operation soapAction="action"/></d:operation></d:binding></d:definitions>`;

    expect(retrieveServerUrlsSoapAPI(file)).toEqual([
      "https://one.example/?a=1&b=2",
      "https://two.example/",
    ]);
    expect(
      retrieveServerUrlsSoapAPI(
        updateSoapApiFileServerUrls(file, [
          "https://new-one.example/",
          "https://new-two.example/",
        ]).toString()
      )
    ).toEqual(["https://new-one.example/", "https://new-two.example/"]);
  });

  it("preserves the missing-operation error for well-formed WSDL", () => {
    expect(() =>
      retrieveServerUrlsSoapAPI(
        wsdl(port('<soap:address location="https://old.example/"/>'))
      )
    ).toThrow(interfaceExtractingSoapFiledError("soap:operation"));
  });
});

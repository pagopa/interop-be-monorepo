import { OctetString } from "asn1js";
import * as pkijs from "pkijs";
import { beforeAll, describe, expect, it } from "vitest";
import { inspectSignedCms } from "../src/utils/signedCmsUtils.js";
import { createCorruptedP7m, createValidP7m } from "./p7mTestHelper.js";

const PAYLOAD = Buffer.from("%PDF-1.4 signed cms utils payload");

let validP7m: Buffer;

describe("signedCmsUtils", () => {
  beforeAll(async () => {
    validP7m = await createValidP7m(PAYLOAD);
  });

  it("should extract the payload and signer count from a valid CMS", async () => {
    const result = await inspectSignedCms(validP7m);

    expect(Buffer.from(result.payload)).toEqual(PAYLOAD);
    expect(result.signerCount).toBe(1);
  });

  it("should throw when content type is not SignedData", async () => {
    const plainContentInfo = new pkijs.ContentInfo({
      contentType: pkijs.ContentInfo.DATA,
      content: new OctetString({ valueHex: Buffer.from("plain-content") }),
    });
    const serializedContentInfo = Buffer.from(
      plainContentInfo.toSchema().toBER(false)
    );

    await expect(inspectSignedCms(serializedContentInfo)).rejects.toThrow(
      "CMS content type is not SignedData"
    );
  });

  it("should throw when given bytes that are not parseable as ASN.1/BER", async () => {
    await expect(inspectSignedCms(createCorruptedP7m())).rejects.toThrow();
  });

  it("should throw when SignedData has no signer infos", async () => {
    const unsignedSignedData = new pkijs.SignedData({
      version: 1,
      encapContentInfo: new pkijs.EncapsulatedContentInfo({
        eContentType: pkijs.ContentInfo.DATA,
        eContent: new OctetString({ valueHex: Buffer.from("plain-content") }),
      }),
      signerInfos: [],
    });
    const serializedSignedData = Buffer.from(
      new pkijs.ContentInfo({
        contentType: pkijs.ContentInfo.SIGNED_DATA,
        content: unsignedSignedData.toSchema(true),
      })
        .toSchema()
        .toBER(false)
    );

    await expect(inspectSignedCms(serializedSignedData)).rejects.toThrow(
      "CMS SignedData has no signers"
    );
  });

  it("should throw when the encapsulated content has been tampered with and signature verification fails", async () => {
    const contentInfo = pkijs.ContentInfo.fromBER(validP7m);
    const tamperedSignedData = new pkijs.SignedData({
      schema: contentInfo.content,
    });
    tamperedSignedData.encapContentInfo.eContent = new OctetString({
      valueHex: Buffer.from("tampered-content"),
    });
    const serializedSignedData = Buffer.from(
      new pkijs.ContentInfo({
        contentType: pkijs.ContentInfo.SIGNED_DATA,
        content: tamperedSignedData.toSchema(true),
      })
        .toSchema()
        .toBER(false)
    );

    await expect(inspectSignedCms(serializedSignedData)).rejects.toThrow(
      "CMS signature verification failed"
    );
  });
});

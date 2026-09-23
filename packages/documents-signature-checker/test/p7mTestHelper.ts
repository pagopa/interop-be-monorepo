/**
 * Test helper for creating CMS/P7M envelopes via pkijs.
 *
 * - {@link createValidP7m}: valid signed envelope wrapping arbitrary content
 * - {@link createP7mWithEmptyContent}: valid envelope with a zero byte payload
 * - {@link createDetachedP7m}: valid envelope signing content it does not carry
 * - {@link createCorruptedP7m}: random bytes, not valid ASN.1
 *
 * All crypto operations use `node:crypto` WebCrypto via `webcrypto.subtle`. The
 * key pair and its self signed certificate are generated once per test run.
 */
import { Integer, OctetString, Utf8String } from "asn1js";
import { webcrypto } from "node:crypto";
import * as pkijs from "pkijs";

const ID_DATA = "1.2.840.113549.1.7.1";
const ID_SIGNED_DATA = "1.2.840.113549.1.7.2";

const SIGNING_ALGORITHM = {
  name: "RSASSA-PKCS1-v1_5",
  hash: "SHA-256",
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
};

interface KeyPairWithCert {
  privateKey: webcrypto.CryptoKey;
  certificate: pkijs.Certificate;
}

pkijs.setEngine(
  "test-p7m-helper",
  new pkijs.CryptoEngine({ crypto: webcrypto })
);

let cachedKeyPair: KeyPairWithCert | undefined;

async function getOrCreateKeyPair(): Promise<KeyPairWithCert> {
  if (cachedKeyPair) {
    return cachedKeyPair;
  }

  const keyPair = await webcrypto.subtle.generateKey(SIGNING_ALGORITHM, true, [
    "sign",
    "verify",
  ]);

  const certificate = new pkijs.Certificate();
  certificate.version = 2;
  certificate.serialNumber = new Integer({ value: 1 });

  // Issuer = subject: self signed
  [certificate.subject, certificate.issuer].forEach((name) =>
    name.typesAndValues.push(
      new pkijs.AttributeTypeAndValue({
        type: "2.5.4.3", // CN
        value: new Utf8String({ value: "Test Signer" }),
      })
    )
  );

  certificate.notBefore.value = new Date();
  const notAfter = new Date();
  notAfter.setFullYear(notAfter.getFullYear() + 1);
  certificate.notAfter.value = notAfter;

  await certificate.subjectPublicKeyInfo.importKey(keyPair.publicKey);
  await certificate.sign(keyPair.privateKey, "SHA-256");

  cachedKeyPair = { privateKey: keyPair.privateKey, certificate };
  return cachedKeyPair;
}

async function createP7m(
  encapsulatedContent: Buffer | undefined,
  detachedContent?: Buffer
): Promise<Buffer> {
  const { privateKey, certificate } = await getOrCreateKeyPair();

  const cmsSignedData = new pkijs.SignedData({
    version: 1,
    encapContentInfo: new pkijs.EncapsulatedContentInfo({
      eContentType: ID_DATA,
      ...(encapsulatedContent !== undefined && {
        eContent: new OctetString({ valueHex: encapsulatedContent }),
      }),
    }),
    signerInfos: [
      new pkijs.SignerInfo({
        version: 1,
        sid: new pkijs.IssuerAndSerialNumber({
          issuer: certificate.issuer,
          serialNumber: certificate.serialNumber,
        }),
      }),
    ],
    certificates: [certificate],
  });

  await cmsSignedData.sign(privateKey, 0, "SHA-256", detachedContent);

  const contentInfo = new pkijs.ContentInfo({
    contentType: ID_SIGNED_DATA,
    content: cmsSignedData.toSchema(true),
  });

  return Buffer.from(contentInfo.toSchema().toBER(false));
}

/**
 * Valid CMS SignedData (p7m) envelope wrapping the given content: the binary
 * SafeStorage produces.
 */
export async function createValidP7m(content: Buffer): Promise<Buffer> {
  return createP7m(content);
}

/** Valid CMS SignedData envelope wrapping an empty payload. */
export async function createP7mWithEmptyContent(): Promise<Buffer> {
  return createP7m(Buffer.alloc(0));
}

/**
 * Valid CMS SignedData envelope that signs the given content without carrying
 * it: the signature cannot be checked against the unsigned document.
 */
export async function createDetachedP7m(content: Buffer): Promise<Buffer> {
  return createP7m(undefined, content);
}

/** Corrupted p7m: bytes that are not valid ASN.1. */
export function createCorruptedP7m(): Buffer {
  return Buffer.from("this-is-not-a-valid-p7m-file-just-garbage-bytes");
}

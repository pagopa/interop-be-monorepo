/* eslint-disable functional/no-let */
/**
 * Test helper for creating CMS/P7M envelopes via pkijs.
 *
 * Provides three factory functions:
 * - {@link createValidP7m} — valid signed envelope wrapping arbitrary content
 * - {@link createP7mWithEmptyContent} — valid envelope with a zero-byte payload
 * - {@link createCorruptedP7m} — random bytes, not valid ASN.1
 *
 * All crypto operations use `node:crypto` WebCrypto via `webcrypto.subtle`.
 * pkijs is initialized once with a Node.js CryptoEngine; the key pair and
 * self-signed certificate are generated once and cached for the whole test run.
 */
import * as pkijs from "pkijs";
import { Integer, OctetString, Utf8String } from "asn1js";
import { webcrypto } from "node:crypto";

// Initialize pkijs crypto engine with Node.js WebCrypto
const cryptoEngine = new pkijs.CryptoEngine({
  crypto: webcrypto,
});
pkijs.setEngine("NodeJS", cryptoEngine);

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

/**
 * Generates a self-signed X.509 certificate + private key.
 * Cached per test run to avoid regenerating for every scenario.
 */
let cachedKeyPair: KeyPairWithCert | undefined;

async function getOrCreateKeyPair(): Promise<KeyPairWithCert> {
  if (cachedKeyPair) return cachedKeyPair;

  const keyPair = await webcrypto.subtle.generateKey(SIGNING_ALGORITHM, true, [
    "sign",
    "verify",
  ]);

  const certificate = new pkijs.Certificate();
  certificate.version = 2;
  certificate.serialNumber = new Integer({ value: 1 });

  // Subject: CN=Test Signer
  certificate.subject.typesAndValues.push(
    new pkijs.AttributeTypeAndValue({
      type: "2.5.4.3", // CN
      value: new Utf8String({ value: "Test Signer" }),
    })
  );

  // Issuer = Subject (self-signed)
  certificate.issuer.typesAndValues.push(
    new pkijs.AttributeTypeAndValue({
      type: "2.5.4.3",
      value: new Utf8String({ value: "Test Signer" }),
    })
  );

  // Validity: now → 1 year
  certificate.notBefore.value = new Date();
  const notAfter = new Date();
  notAfter.setFullYear(notAfter.getFullYear() + 1);
  certificate.notAfter.value = notAfter;

  await certificate.subjectPublicKeyInfo.importKey(keyPair.publicKey);
  await certificate.sign(keyPair.privateKey, "SHA-256");

  cachedKeyPair = {
    privateKey: keyPair.privateKey,
    certificate,
  };
  return cachedKeyPair;
}

/**
 * Creates a valid CMS SignedData (p7m) envelope wrapping the given content.
 * This is the DER-encoded binary that SafeStorage would produce.
 */
export async function createValidP7m(content: Buffer): Promise<Buffer> {
  const { privateKey, certificate } = await getOrCreateKeyPair();

  const cmsSignedData = new pkijs.SignedData({
    version: 1,
    encapContentInfo: new pkijs.EncapsulatedContentInfo({
      eContentType: "1.2.840.113549.1.7.1", // id-data
      eContent: new OctetString({ valueHex: content }),
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

  // Sign the CMS structure
  await cmsSignedData.sign(privateKey, 0, "SHA-256");

  // Wrap in ContentInfo
  const contentInfo = new pkijs.ContentInfo({
    contentType: "1.2.840.113549.1.7.2", // id-signedData
    content: cmsSignedData.toSchema(true),
  });

  // Encode to DER
  const derBytes = contentInfo.toSchema().toBER(false);
  return Buffer.from(derBytes);
}

/**
 * Creates a valid CMS SignedData but with an EMPTY content payload.
 * This simulates the 2024 bug where SafeStorage signed empty buffers.
 */
export async function createP7mWithEmptyContent(): Promise<Buffer> {
  return createValidP7m(Buffer.alloc(0));
}

/**
 * Creates a corrupted p7m: random bytes that are NOT valid ASN.1.
 */
export function createCorruptedP7m(): Buffer {
  return Buffer.from("this-is-not-a-valid-p7m-file-just-garbage-bytes");
}

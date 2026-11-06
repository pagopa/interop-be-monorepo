import { webcrypto } from "node:crypto";
import * as pkijs from "pkijs";

export type SignedCmsCheckResult = {
  /** Bytes wrapped by the envelope, empty when it encapsulates zero bytes. */
  payload: Uint8Array;
};

pkijs.setEngine(
  "documents-signature-checker",
  new pkijs.CryptoEngine({
    crypto: webcrypto as ConstructorParameters<
      typeof pkijs.CryptoEngine
    >[0]["crypto"],
  })
);

async function verifyAllSigners(signedData: pkijs.SignedData): Promise<void> {
  const results = await Promise.all(
    signedData.signerInfos.map((_, index) =>
      signedData.verify({ signer: index, checkChain: false })
    )
  );

  if (results.some((valid) => !valid)) {
    throw new Error("CMS signature verification failed");
  }
}

/**
 * Parses a P7M/CMS envelope, verifies that every signature matches the content
 * it wraps, and returns the encapsulated payload.
 *
 * Signature verification is cryptographic only (`checkChain: false`): it proves
 * that the content was not altered after signing, and deliberately does not
 * validate the certificate chain, its revocation status, or the signing
 * timestamp, which would require a trusted certificate list this job does not own.
 *
 * @throws when the bytes are not a parseable CMS SignedData envelope, when the
 * envelope carries no signer, when the signature is detached from the document
 * it signs, or when any signature does not verify.
 */
export async function inspectSignedCms(
  content: Uint8Array
): Promise<SignedCmsCheckResult> {
  const contentInfo = pkijs.ContentInfo.fromBER(content);
  if (contentInfo.contentType !== pkijs.ContentInfo.SIGNED_DATA) {
    throw new Error("CMS content type is not SignedData");
  }

  const signedData = new pkijs.SignedData({ schema: contentInfo.content });
  if (signedData.signerInfos.length === 0) {
    throw new Error("CMS SignedData has no signers");
  }

  const eContent = signedData.encapContentInfo.eContent;
  if (eContent === undefined) {
    throw new Error("CMS SignedData has no encapsulated content");
  }

  await verifyAllSigners(signedData);

  return { payload: new Uint8Array(eContent.getValue()) };
}

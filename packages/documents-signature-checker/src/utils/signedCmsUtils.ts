import * as pkijs from "pkijs";
import { webcrypto } from "node:crypto";

export type SignedCmsCheckResult = {
  payload: Uint8Array;
  signerCount: number;
};

let cryptoEngineInitialized = false;

function initCryptoEngine(): void {
  if (cryptoEngineInitialized) {
    return;
  }

  const engine = new pkijs.CryptoEngine({
    crypto: webcrypto as ConstructorParameters<
      typeof pkijs.CryptoEngine
    >[0]["crypto"],
  });

  pkijs.setEngine("documents-signature-checker", engine);
  cryptoEngineInitialized = true;
}

function extractPayload(signedData: pkijs.SignedData): Uint8Array {
  const content = signedData.encapContentInfo.eContent;
  return content ? new Uint8Array(content.getValue()) : new Uint8Array();
}

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
 * Parses a P7M/CMS file, verifies every signer signature,
 * and returns the encapsulated payload.
 */
export async function inspectSignedCms(
  content: Uint8Array
): Promise<SignedCmsCheckResult> {
  initCryptoEngine();

  const contentInfo = pkijs.ContentInfo.fromBER(content);
  if (contentInfo.contentType !== pkijs.ContentInfo.SIGNED_DATA) {
    throw new Error("CMS content type is not SignedData");
  }

  const signedData = new pkijs.SignedData({ schema: contentInfo.content });
  if (signedData.signerInfos.length === 0) {
    throw new Error("CMS SignedData has no signers");
  }

  await verifyAllSigners(signedData);

  return {
    payload: extractPayload(signedData),
    signerCount: signedData.signerInfos.length,
  };
}

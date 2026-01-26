import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { JWTConfig, DPoPConfig, Logger } from "pagopa-interop-commons";
import {
  verifyDPoPProof,
  verifyDPoPProofSignature,
  checkDPoPCache,
  verifyDPoPThumbprintMatch,
} from "pagopa-interop-dpop-validation";
import { DPoPProof, unauthorizedError } from "pagopa-interop-models";
import {
  dpopProofValidationFailed,
  dpopProofSignatureValidationFailed,
  dpopProofJtiAlreadyUsed,
} from "../model/errors.js";

export const verifyDPoPFlow = async ({
  config,
  dpopProofJWS,
  accessTokenClientId,
  accessTokenThumbprint,
  dynamoDBClient,
  logger,
}: {
  config: JWTConfig & DPoPConfig;
  dpopProofJWS: string | undefined;
  accessTokenClientId: string;
  accessTokenThumbprint: string;
  dynamoDBClient: DynamoDBClient;
  logger: Logger;
}): Promise<DPoPProof> => {
  // ----------------------------------------------------------------------
  // Step 1: Parsing e Validazione Firma (Static & Crypto)
  // ----------------------------------------------------------------------
  const { dpopProofJWT } = await validateDPoPProof(
    config,
    dpopProofJWS,
    accessTokenClientId,
    logger
  );

  if (!dpopProofJWT) {
    throw unauthorizedError("Invalid DPoP Proof structure");
  }

  // ----------------------------------------------------------------------
  // Step 2: Controllo Replay Attack (JTI Cache)
  // ----------------------------------------------------------------------
  const { errors: dpopCacheErrors } = await checkDPoPCache({
    dynamoDBClient,
    dpopProofJti: dpopProofJWT.payload.jti,
    dpopProofIat: dpopProofJWT.payload.iat,
    dpopCacheTable: config.dpopCacheTable,
    dpopProofDurationSeconds: config.dpopDurationSeconds,
  });

  if (dpopCacheErrors) {
    throw dpopProofJtiAlreadyUsed(dpopProofJWT.payload.jti);
  }

  // ----------------------------------------------------------------------
  // Step 3: Verifica Binding (Thumbprint Match)
  // ----------------------------------------------------------------------
  const { errors: bindingErrors } = verifyDPoPThumbprintMatch(
    dpopProofJWT,
    accessTokenThumbprint
  );

  if (bindingErrors) {
    logger.warn(
      `DPoP Key Binding failed: ${bindingErrors
        .map((e) => e.detail)
        .join(", ")}`
    );
    throw unauthorizedError(
      "DPoP proof public key hash does not match token binding"
    );
  }

  return dpopProofJWT;
};
const validateDPoPProof = async (
  config: JWTConfig & DPoPConfig,
  dpopProofHeader: string | undefined,
  clientId: string | undefined,
  logger: Logger
): Promise<{
  dpopProofJWS: string | undefined;
  dpopProofJWT: DPoPProof | undefined;
}> => {
  const { data, errors: dpopProofErrors } = dpopProofHeader
    ? verifyDPoPProof({
        dpopProofJWS: dpopProofHeader,
        expectedDPoPProofHtu: config.dpopHtu,
        dpopProofIatToleranceSeconds: config.dpopIatToleranceSeconds,
        dpopProofDurationSeconds: config.dpopDurationSeconds,
      })
    : { data: undefined, errors: undefined };

  if (dpopProofErrors) {
    throw dpopProofValidationFailed(
      clientId,
      dpopProofErrors.map((error) => error.detail).join(", ")
    );
  }

  const dpopProofJWT = data?.dpopProofJWT;
  const dpopProofJWS = data?.dpopProofJWS;

  if (dpopProofJWT && dpopProofJWS) {
    const { errors: dpopProofSignatureErrors } = await verifyDPoPProofSignature(
      dpopProofJWS,
      dpopProofJWT.header.jwk
    );

    if (dpopProofSignatureErrors) {
      throw dpopProofSignatureValidationFailed(
        clientId,
        dpopProofSignatureErrors.map((error) => error.detail).join(", ")
      );
    }

    logger.info(`[JTI=${dpopProofJWT.payload.jti}] - DPoP proof validated`);
  }

  return { dpopProofJWS, dpopProofJWT };
};

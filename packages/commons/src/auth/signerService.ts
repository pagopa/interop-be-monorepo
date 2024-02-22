import {
  KMSClient,
  SignCommand,
  SignCommandInput,
  SigningAlgorithmSpec,
} from "@aws-sdk/client-kms";
import { thirdPartyCallError } from "pagopa-interop-models";
import { logger, signerConfig } from "../index.js";

/**
 * Service to sign data using AWS KMS
 * [https://docs.aws.amazon.com/kms/latest/APIReference/API_Sign.html]
 *
 * Requirements: the caller must have kms:Sign permission on the KMS key.
 * Note: When used with the supported RSA signing algorithms, the encoding of this value is defined by PKCS #1 in RFC 8017.
 *
 * @param keyId
 *     Identifies the asymmetric KMS key to use for signing.
 * @param data
 *   The message or message digest to sign.
 * @return
 *  The cryptographic signature that was generated for the message.
 *
 * @throws KMSInvalidStateException
 */
export type SignerService = {
  signWithRSA256: (keyId: string, data: string) => Promise<string>;
};

export const buildSignerService = (): SignerService => {
  const config = signerConfig();
  const client = new KMSClient([
    {
      requestTimeout: config.maxAcquisitionTimeoutSeconds,
    },
  ]);

  return {
    signWithRSA256: async (keyId: string, data: string): Promise<string> => {
      const input: SignCommandInput = {
        KeyId: keyId,
        Message: new TextEncoder().encode(data),
        MessageType: "RAW",
        SigningAlgorithm: SigningAlgorithmSpec.RSASSA_PKCS1_V1_5_SHA_256,
      };

      try {
        const command = new SignCommand(input);
        const res = await client.send(command);

        return new TextDecoder().decode(res.Signature);
      } catch (err) {
        const internalError = thirdPartyCallError("KMS", JSON.stringify(err));
        logger.error(internalError);
        throw internalError;
      }
    },
  };
};

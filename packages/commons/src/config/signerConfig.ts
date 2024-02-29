import { z } from "zod";
import { KID } from "../auth/keys/keys.js";

export const SignerConfig = z
  .object({
    KMS_MAX_ACQUISITION_TIMEOUT_SECONDS: z.coerce.number(),
    RSA_KEYS_IDENTIFIERS: z
      .string()
      .transform((val) => val?.split(","))
      .pipe(z.array(KID)),
  })
  .transform((c) => ({
    maxAcquisitionTimeoutSeconds: c.KMS_MAX_ACQUISITION_TIMEOUT_SECONDS,
    rsaKeysIdentifiers: c.RSA_KEYS_IDENTIFIERS,
  }));

export type SignerConfig = z.infer<typeof SignerConfig>;

export const signerConfig: () => SignerConfig = () =>
  SignerConfig.parse(process.env);

/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { match } from "ts-pattern";
import { Algorithm } from "jsonwebtoken";
import { signerConfig } from "../../index.js";
import { KID } from "./keys.js";

export const buildPrivateKeysKidHolder = () => {
  const { ecKeysIdentifiers, rsaKeysIdentifiers } = signerConfig();

  /* Private keyset for RSA signatures */
  const RSAPrivateKeyset: KID[] = rsaKeysIdentifiers;

  /** Private keyset for EC signatures */
  const ECPrivateKeyset: KID[] = ecKeysIdentifiers;
  return {
    getPrivateKeyKidByAlgorithm: (algorithm: Algorithm): KID => {
      const keySet: KID[] = match(algorithm)
        .with(
          "RS256",
          "RS384",
          "RS512",
          "PS256",
          "PS384",
          () => RSAPrivateKeyset
        )
        .with("ES256", "ES384", "ES512", () => ECPrivateKeyset)
        .otherwise(() => {
          // Unrecognized algorithm include "ES256K", "EdDSA"
          throw new Error(`Unrecognized algorithm: ${algorithm}`);
        });

      if (!keySet.length) {
        throw new Error("Interop private key not found");
      }

      return keySet[Math.floor(Math.random() * keySet.length)];
    },
  };
};

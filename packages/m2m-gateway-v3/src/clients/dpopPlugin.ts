import crypto from "crypto";
import { ZodiosPlugin } from "@zodios/core";
import * as jose from "jose";
/**
 * Plugin per Zodios che implementa DPoP per le chiamate in uscita verso i backend.
 */
export function zodiosDPoPPlugin(
  privateKey: jose.KeyLike | Uint8Array,
  publicJwk: jose.JWK
): ZodiosPlugin {
  return {
    name: "dpopPlugin",
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    request: async (_api, config) => {
      // 1. Recuperiamo il token già presente (settato dagli interceptor standard)
      // Se non c'è un token, non possiamo firmare nulla.
      const authHeader = config.headers?.Authorization;

      if (!authHeader?.startsWith("Bearer ")) {
        return config;
      }

      const token = authHeader.replace("Bearer ", "");
      const method = config.method?.toUpperCase() || "GET";

      // 2. Costruiamo l'URL di destinazione (fondamentale per il claim 'htu')
      const url = `${config.baseURL}${config.url}`;

      // 3. Generiamo il DPoP Proof
      const dpopProof = await new jose.SignJWT({
        htm: method,
        htu: url,
        jti: crypto.randomUUID(), // Necessario per evitare replay attacks
      })
        .setProtectedHeader({
          typ: "dpop+jwt",
          alg: "ES256",
          jwk: publicJwk, // La chiave pubblica deve essere nell'header
        })
        .setIssuedAt()
        .sign(privateKey);

      // 4. Trasformiamo l'header Authorization da Bearer a DPoP
      // e aggiungiamo l'header DPoP con il proof.
      return {
        ...config,
        headers: {
          ...config.headers,
          Authorization: `DPoP ${token}`,
          DPoP: dpopProof,
        },
      };
    },
  };
}

import crypto from "crypto";
import { KMSClient, SignCommand, SignCommandInput } from "@aws-sdk/client-kms";
import {
  IntegrityJWSHeader,
  IntegrityJWSPayload,
  IntegrityJWSToken,
  IntegrityRestConfig,
  SignedHeader,
} from "./models.js";
import { dateToSeconds } from "../utils/date.js";
import { b64ByteUrlEncode, b64UrlEncode } from "../interop-token/utils.js";

/**
 * Service for creating and signing JWS tokens for the INTEGRITY_REST_02 pattern.
 * Uses AWS KMS for cryptographic signing operations.
 */
export class IntegrityJWSService {
  private kmsClient: KMSClient;

  constructor(
    private config: IntegrityRestConfig,
    kmsClient?: KMSClient
  ) {
    this.kmsClient = kmsClient || new KMSClient();
  }

  /**
   * Creates an Agid-JWT-Signature for protecting HTTP response headers.
   *
   * The JWS includes:
   * - JOSE Header: Contains algorithm, type (JWT), and key ID
   * - JWT Payload: Contains issuer, audience, timestamps, and signed headers
   * - Signature: Cryptographic signature generated using AWS KMS
   *
   * @param digestValue - The Digest header value (e.g., "SHA-256=abc123...")
   * @param contentType - The Content-Type header value (e.g., "application/json")
   * @param algorithm - The signing algorithm (default: RS256)
   * @returns Complete JWS token structure with serialized form
   *
   * @example
   * const service = new IntegrityJWSService(config);
   * const jws = await service.createAgidJwtSignature(
   *   "SHA-256=cFfTOCesrWTLVzxn8fmHl4AcrUs40Lv5D275FmAZ96E=",
   *   "application/json"
   * );
   * // Use jws.serialized in the Agid-JWT-Signature header
   */
  async createAgidJwtSignature(
    digestValue: string,
    contentType: string,
    algorithm: "RS256" | "ES256" = "RS256"
  ): Promise<IntegrityJWSToken> {
    const currentTimestamp = dateToSeconds(new Date());

    // Step 1: Construct JOSE Header
    const header: IntegrityJWSHeader = {
      alg: algorithm,
      typ: "JWT",
      kid: this.config.kid,
    };

    // Step 2: Construct signed_headers array
    // Each header is represented as an object with a single key-value pair
    const signedHeaders: SignedHeader[] = [
      { digest: digestValue },
      { "content-type": contentType },
    ];

    // Step 3: Construct JWT Payload
    const payload: IntegrityJWSPayload = {
      iss: this.config.issuer,
      aud: this.config.audience,
      iat: currentTimestamp,
      exp: currentTimestamp + this.config.signatureDurationSeconds,
      signed_headers: signedHeaders,
    };

    // Step 4: Add optional jti claim for replay protection
    if (this.config.enableReplayProtection) {
      payload.jti = crypto.randomUUID();
    }

    // Step 5: Sign the JWS using KMS
    const serialized = await this.signJWS(header, payload, algorithm);

    return {
      header,
      payload,
      serialized,
    };
  }

  /**
   * Signs a JWS token using AWS KMS.
   *
   * Process:
   * 1. Serialize header and payload to Base64Url
   * 2. Create the signing input: Base64Url(Header).Base64Url(Payload)
   * 3. Sign with KMS using the configured key
   * 4. Append signature to create JWS Compact Serialization
   *
   * @param header - The JOSE header
   * @param payload - The JWT payload
   * @param algorithm - The signing algorithm
   * @returns JWS Compact Serialization string
   */
  private async signJWS(
    header: IntegrityJWSHeader,
    payload: IntegrityJWSPayload,
    algorithm: "RS256" | "ES256"
  ): Promise<string> {
    // Step 1: Create the signing input (Base64Url encoding)
    const headerEncoded = b64UrlEncode(JSON.stringify(header));
    const payloadEncoded = b64UrlEncode(JSON.stringify(payload));
    const signingInput = `${headerEncoded}.${payloadEncoded}`;

    // Step 2: Determine KMS signing algorithm
    const kmsAlgorithm = this.getKMSSigningAlgorithm(algorithm);

    // Step 3: Sign with KMS
    const commandParams: SignCommandInput = {
      KeyId: this.config.kid,
      Message: new TextEncoder().encode(signingInput),
      SigningAlgorithm: kmsAlgorithm,
    };

    const command = new SignCommand(commandParams);
    const response = await this.kmsClient.send(command);

    if (!response.Signature) {
      throw new Error(
        "Agid-JWT-Signature generation failed. Empty signature returned from KMS"
      );
    }

    // Step 4: Encode signature and create JWS Compact Serialization
    const signatureEncoded = b64ByteUrlEncode(response.Signature);

    return `${signingInput}.${signatureEncoded}`;
  }

  /**
   * Maps JWT algorithm to AWS KMS signing algorithm.
   */
  private getKMSSigningAlgorithm(
    algorithm: "RS256" | "ES256"
  ): "RSASSA_PKCS1_V1_5_SHA_256" | "ECDSA_SHA_256" {
    switch (algorithm) {
      case "RS256":
        return "RSASSA_PKCS1_V1_5_SHA_256";
      case "ES256":
        return "ECDSA_SHA_256";
      default:
        throw new Error(`Unsupported signing algorithm: ${algorithm}`);
    }
  }
}

import crypto from "crypto";
import { KMSClient, SignCommand, SignCommandInput } from "@aws-sdk/client-kms";
import { TokenGenerationConfig } from "../config/tokenGenerationConfig.js";
import { b64ByteUrlEncode, b64UrlEncode } from "./utils.js";
import {
  CustomClaims,
  SessionClaims,
  SessionJwtHeader,
  SessionJwtPayload,
  SessionToken,
} from "./models.js";

const JWT_HEADER_ALG = "RS256";
const KMS_SIGNING_ALG = "RSASSA_PKCS1_V1_5_SHA_256";

export class SessionTokenGenerator {
  private kmsClient: KMSClient;

  constructor(private config: TokenGenerationConfig) {
    this.kmsClient = new KMSClient();
  }

  public async generate(
    claims: SessionClaims & CustomClaims
  ): Promise<SessionToken> {
    const currentTimestamp = Math.floor(Date.now() / 1000);

    const header: SessionJwtHeader = {
      alg: JWT_HEADER_ALG,
      use: "sig",
      typ: "at+jwt",
      kid: this.config.generatedKid,
    };

    const payload: SessionJwtPayload = {
      jti: crypto.randomUUID(),
      iss: this.config.generatedIssuer,
      aud: this.config.generatedAudience,
      sub: this.config.generatedSubject,
      iat: currentTimestamp,
      nbf: currentTimestamp,
      exp: currentTimestamp + this.config.generatedSecondsDuration,
      ...claims,
    };

    const serializedToken = `${b64UrlEncode(
      JSON.stringify(header)
    )}.${b64UrlEncode(JSON.stringify(payload))}`;

    const commandParams: SignCommandInput = {
      KeyId: this.config.generatedKid,
      Message: new TextEncoder().encode(serializedToken),
      SigningAlgorithm: KMS_SIGNING_ALG,
    };

    const command = new SignCommand(commandParams);
    const response = await this.kmsClient.send(command);

    if (!response.Signature) {
      throw Error("JWT Signature failed. Empty signature returned");
    }

    const jwtSignature = b64ByteUrlEncode(response.Signature);

    return {
      header,
      payload,
      serialized: `${serializedToken}.${jwtSignature}`,
    };
  }
}

import crypto from "crypto";
import { KMSClient, SignCommand, SignCommandInput } from "@aws-sdk/client-kms";
import { SessionTokenGenerationConfig } from "../config/sessionTokenGenerationConfig.js";
import { TokenGenerationConfig } from "../config/tokenGenerationConfig.js";
import {
  CustomClaims,
  InteropJwtHeader,
  InteropJwtPayload,
  InteropToken,
  SessionClaims,
  SessionJwtPayload,
  SessionToken,
} from "./models.js";
import { b64ByteUrlEncode, b64UrlEncode } from "./utils.js";

const JWT_HEADER_ALG = "RS256";
const KMS_SIGNING_ALG = "RSASSA_PKCS1_V1_5_SHA_256";
const JWT_INTERNAL_ROLE = "internal";
const JWT_ROLE_CLAIM = "role";

export class InteropTokenGenerator {
  private kmsClient: KMSClient;

  constructor(
    private config: TokenGenerationConfig &
      Partial<SessionTokenGenerationConfig>
  ) {
    this.kmsClient = new KMSClient();
  }

  public async generateInternalToken(): Promise<InteropToken> {
    const currentTimestamp = Math.floor(Date.now() / 1000);

    const header: InteropJwtHeader = {
      alg: JWT_HEADER_ALG,
      use: "sig",
      typ: "at+jwt",
      kid: this.config.internalKid,
    };

    const payload: InteropJwtPayload = {
      jti: crypto.randomUUID(),
      iss: this.config.internalIssuer,
      aud: this.config.internalAudience,
      sub: this.config.internalSubject,
      iat: currentTimestamp,
      nbf: currentTimestamp,
      exp: currentTimestamp + this.config.internalSecondsDuration,
      [JWT_ROLE_CLAIM]: JWT_INTERNAL_ROLE,
    };

    const serializedToken = await this.createAndSignToken(
      header,
      payload,
      this.config.internalKid
    );

    return {
      header,
      payload,
      serialized: serializedToken,
    };
  }

  public async generateSessionToken(
    claims: SessionClaims & CustomClaims,
    jwtDuration?: number
  ): Promise<SessionToken> {
    if (
      !this.config.sessionKid ||
      !this.config.sessionIssuer ||
      !this.config.sessionAudience ||
      !this.config.sessionSecondsDuration
    ) {
      throw Error("SessionTokenGenerationConfig not provided or incomplete");
    }

    const currentTimestamp = Math.floor(Date.now() / 1000);

    const header: InteropJwtHeader = {
      alg: JWT_HEADER_ALG,
      use: "sig",
      typ: "at+jwt",
      kid: this.config.sessionKid,
    };

    const duration = jwtDuration ?? this.config.sessionSecondsDuration;

    const payload: SessionJwtPayload = {
      jti: crypto.randomUUID(),
      iss: this.config.sessionIssuer,
      aud: this.config.sessionAudience,
      iat: currentTimestamp,
      nbf: currentTimestamp,
      exp: currentTimestamp + duration,
      ...claims,
    };

    const serializedToken = await this.createAndSignToken(
      header,
      payload,
      this.config.sessionKid
    );

    return {
      header,
      payload,
      serialized: serializedToken,
    };
  }

  private async createAndSignToken(
    header: InteropJwtHeader,
    payload: InteropJwtPayload | SessionJwtPayload,
    keyId: string
  ): Promise<string> {
    const serializedToken = `${b64UrlEncode(
      JSON.stringify(header)
    )}.${b64UrlEncode(JSON.stringify(payload))}`;

    const commandParams: SignCommandInput = {
      KeyId: keyId,
      Message: new TextEncoder().encode(serializedToken),
      SigningAlgorithm: KMS_SIGNING_ALG,
    };

    const command = new SignCommand(commandParams);
    const response = await this.kmsClient.send(command);

    if (!response.Signature) {
      throw Error("JWT Signature failed. Empty signature returned");
    }

    const jwtSignature = b64ByteUrlEncode(response.Signature);

    return `${serializedToken}.${jwtSignature}`;
  }
}

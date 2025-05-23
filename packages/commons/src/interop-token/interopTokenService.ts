import crypto from "crypto";
import { KMSClient, SignCommand, SignCommandInput } from "@aws-sdk/client-kms";
import {
  ClientAssertionDigest,
  ClientId,
  DescriptorId,
  EServiceId,
  generateId,
  PurposeId,
  TenantId,
  UserId,
} from "pagopa-interop-models";
import { systemRole } from "../auth/authData.js";
import { AuthorizationServerTokenGenerationConfig } from "../config/authorizationServerTokenGenerationConfig.js";
import { SessionTokenGenerationConfig } from "../config/sessionTokenGenerationConfig.js";
import { TokenGenerationConfig } from "../config/tokenGenerationConfig.js";
import { dateToSeconds } from "../utils/date.js";
import {
  CustomClaims,
  InteropApiToken,
  InteropConsumerToken,
  InteropInternalToken,
  InteropJwtApiCommonPayload,
  InteropJwtApiPayload,
  InteropJwtConsumerPayload,
  InteropJwtHeader,
  InteropJwtInternalPayload,
  ORGANIZATION_ID_CLAIM,
  ROLE_CLAIM,
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
    private config: Partial<AuthorizationServerTokenGenerationConfig> &
      Partial<TokenGenerationConfig> &
      Partial<SessionTokenGenerationConfig>,
    kmsClient?: KMSClient
  ) {
    this.kmsClient = kmsClient || new KMSClient();
  }

  public async generateInternalToken(): Promise<InteropInternalToken> {
    const currentTimestamp = dateToSeconds(new Date());

    if (
      !this.config.kid ||
      !this.config.issuer ||
      !this.config.audience ||
      !this.config.subject ||
      !this.config.secondsDuration
    ) {
      throw Error("TokenGenerationConfig not provided or incomplete");
    }

    const header: InteropJwtHeader = {
      alg: JWT_HEADER_ALG,
      use: "sig",
      typ: "at+jwt",
      kid: this.config.kid,
    };

    const payload: InteropJwtInternalPayload = {
      jti: crypto.randomUUID(),
      iss: this.config.issuer,
      aud: this.config.audience,
      sub: this.config.subject,
      iat: currentTimestamp,
      nbf: currentTimestamp,
      exp: currentTimestamp + this.config.secondsDuration,
      [JWT_ROLE_CLAIM]: JWT_INTERNAL_ROLE,
    };

    const serializedToken = await this.createAndSignToken({
      header,
      payload,
      keyId: this.config.kid,
    });

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
      !this.config.generatedKid ||
      !this.config.generatedIssuer ||
      !this.config.generatedAudience ||
      !this.config.generatedSecondsDuration
    ) {
      throw Error("SessionTokenGenerationConfig not provided or incomplete");
    }

    const currentTimestamp = dateToSeconds(new Date());

    const header: InteropJwtHeader = {
      alg: JWT_HEADER_ALG,
      use: "sig",
      typ: "at+jwt",
      kid: this.config.generatedKid,
    };

    const duration = jwtDuration ?? this.config.generatedSecondsDuration;

    const payload: SessionJwtPayload = {
      jti: crypto.randomUUID(),
      iss: this.config.generatedIssuer,
      aud: this.config.generatedAudience,
      iat: currentTimestamp,
      nbf: currentTimestamp,
      exp: currentTimestamp + duration,
      ...claims,
    };

    const serializedToken = await this.createAndSignToken({
      header,
      payload,
      keyId: this.config.generatedKid,
    });

    return {
      header,
      payload,
      serialized: serializedToken,
    };
  }

  public async generateInteropApiToken({
    sub,
    consumerId,
    clientAdminId,
  }: {
    sub: ClientId;
    consumerId: TenantId;
    clientAdminId: UserId | undefined;
  }): Promise<InteropApiToken> {
    if (
      !this.config.generatedInteropTokenKid ||
      !this.config.generatedInteropTokenIssuer ||
      !this.config.generatedInteropTokenM2MAudience ||
      !this.config.generatedInteropTokenM2MDurationSeconds
    ) {
      throw Error(
        "AuthorizationServerTokenGenerationConfig not provided or incomplete"
      );
    }

    const currentTimestamp = dateToSeconds(new Date());

    const header: InteropJwtHeader = {
      alg: "RS256",
      use: "sig",
      typ: "at+jwt",
      kid: this.config.generatedInteropTokenKid,
    };

    const userDataPayload: InteropJwtApiCommonPayload = {
      jti: generateId(),
      iss: this.config.generatedInteropTokenIssuer,
      aud: this.toJwtAudience(this.config.generatedInteropTokenM2MAudience),
      client_id: sub,
      sub,
      iat: currentTimestamp,
      nbf: currentTimestamp,
      exp:
        currentTimestamp + this.config.generatedInteropTokenM2MDurationSeconds,
      [ORGANIZATION_ID_CLAIM]: consumerId,
    };

    const systemRolePayload = clientAdminId
      ? {
          [ROLE_CLAIM]: systemRole.M2M_ADMIN_ROLE,
          adminId: clientAdminId,
        }
      : {
          [ROLE_CLAIM]: systemRole.M2M_ROLE,
        };

    const payload: InteropJwtApiPayload = {
      ...userDataPayload,
      ...systemRolePayload,
    };

    const serializedToken = await this.createAndSignToken({
      header,
      payload,
      keyId: this.config.generatedInteropTokenKid,
    });

    return {
      header,
      payload,
      serialized: serializedToken,
    };
  }

  public async generateInteropConsumerToken({
    sub,
    audience,
    purposeId,
    tokenDurationInSeconds,
    digest,
    producerId,
    consumerId,
    eserviceId,
    descriptorId,
    featureFlagImprovedProducerVerificationClaims = false,
  }: {
    sub: ClientId;
    audience: string[];
    purposeId: PurposeId;
    tokenDurationInSeconds: number;
    digest: ClientAssertionDigest | undefined;
    producerId: TenantId;
    consumerId: TenantId;
    eserviceId: EServiceId;
    descriptorId: DescriptorId;
    featureFlagImprovedProducerVerificationClaims: boolean;
  }): Promise<InteropConsumerToken> {
    if (
      !this.config.generatedInteropTokenKid ||
      !this.config.generatedInteropTokenIssuer ||
      !this.config.generatedInteropTokenM2MAudience
    ) {
      throw Error(
        "AuthorizationServerTokenGenerationConfig not provided or incomplete"
      );
    }

    const currentTimestamp = dateToSeconds(new Date());

    const header: InteropJwtHeader = {
      alg: "RS256",
      use: "sig",
      typ: "at+jwt",
      kid: this.config.generatedInteropTokenKid,
    };

    const payload: InteropJwtConsumerPayload = {
      jti: generateId(),
      iss: this.config.generatedInteropTokenIssuer,
      aud: this.toJwtAudience(audience),
      client_id: sub,
      sub,
      iat: currentTimestamp,
      nbf: currentTimestamp,
      exp: currentTimestamp + tokenDurationInSeconds,
      purposeId,
      ...(digest ? { digest } : {}),
      // TODO: remove featureFlagImprovedProducerVerificationClaims after the feature flag disappears
      ...(featureFlagImprovedProducerVerificationClaims
        ? {
            producerId,
            consumerId,
            eserviceId,
            descriptorId,
          }
        : {}),
    };

    const serializedToken = await this.createAndSignToken({
      header,
      payload,
      keyId: this.config.generatedInteropTokenKid,
    });

    return {
      header,
      payload,
      serialized: serializedToken,
    };
  }

  private async createAndSignToken({
    header,
    payload,
    keyId,
  }: {
    header: InteropJwtHeader;
    payload:
      | InteropJwtInternalPayload
      | SessionJwtPayload
      | InteropJwtConsumerPayload
      | InteropJwtApiPayload;
    keyId: string;
  }): Promise<string> {
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

  private toJwtAudience = (input: string | string[]): string | string[] =>
    Array.isArray(input) && input.length === 1 ? input[0] : input;
}

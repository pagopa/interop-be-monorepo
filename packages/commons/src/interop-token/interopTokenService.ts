import crypto from "crypto";
import { KMSClient, SignCommand, SignCommandInput } from "@aws-sdk/client-kms";
import {
  ClientAssertionDigest,
  ClientId,
  DescriptorId,
  EServiceId,
  generateId,
  JWKKeyRS256,
  JWKKeyES256,
  PurposeId,
  TenantId,
  UserId,
  algorithm,
} from "pagopa-interop-models";
import { systemRole } from "../auth/roles.js";
import { AuthorizationServerTokenGenerationConfig } from "../config/authorizationServerTokenGenerationConfig.js";
import { SessionTokenGenerationConfig } from "../config/sessionTokenGenerationConfig.js";
import { TokenGenerationConfig } from "../config/tokenGenerationConfig.js";
import { dateToSeconds } from "../utils/date.js";
import { calculateKid } from "../auth/jwk.js";
import {
  InteropApiToken,
  InteropConsumerToken,
  InteropInternalToken,
  InteropJwtApiCommonPayload,
  InteropJwtApiPayload,
  InteropJwtConsumerPayload,
  InteropJwtHeader,
  InteropJwtUIPayload,
  InteropUIToken,
  UIClaims,
  InteropJwtInternalPayload,
  InteropJwtApiDPoPPayload,
  AgidIntegrityRest02TokenPayload,
  IntegrityRest02SignedHeader,
} from "./models.js";
import { b64ByteUrlEncode, b64UrlEncode } from "./utils.js";
import {
  SerializedAuthTokenPayload,
  toSerializedInteropJwtPayload,
  toSerializedJwtUIPayload,
} from "./jwtEncoder.js";

const JWT_HEADER_ALG = algorithm.RS256;
const JWT_HEADER_USE = "sig";
const JWT_HEADER_TYP = "at+jwt";
const KMS_SIGNING_ALG = "RSASSA_PKCS1_V1_5_SHA_256";

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
      use: JWT_HEADER_USE,
      typ: JWT_HEADER_TYP,
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
      role: systemRole.INTERNAL_ROLE,
    };

    const serializedToken = await this.createAndSignToken({
      header,
      payload: toSerializedInteropJwtPayload(payload),
      keyId: this.config.kid,
    });

    return {
      header,
      payload,
      serialized: serializedToken,
    };
  }

  public async generateSessionToken(
    claims: UIClaims,
    jwtDuration?: number
  ): Promise<InteropUIToken> {
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
      use: JWT_HEADER_USE,
      typ: JWT_HEADER_TYP,
      kid: this.config.generatedKid,
    };

    const duration = jwtDuration ?? this.config.generatedSecondsDuration;

    const payload: InteropJwtUIPayload = {
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
      payload: toSerializedJwtUIPayload(payload),
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
    dpopJWK,
  }: {
    sub: ClientId;
    consumerId: TenantId;
    clientAdminId: UserId | undefined;
    dpopJWK?: JWKKeyRS256 | JWKKeyES256;
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
      alg: JWT_HEADER_ALG,
      use: JWT_HEADER_USE,
      typ: JWT_HEADER_TYP,
      kid: this.config.generatedInteropTokenKid,
    };

    const userDataPayload: InteropJwtApiCommonPayload = {
      jti: generateId(),
      iss: this.config.generatedInteropTokenIssuer,
      aud: this.config.generatedInteropTokenM2MAudience,
      client_id: sub,
      sub,
      iat: currentTimestamp,
      nbf: currentTimestamp,
      exp:
        currentTimestamp + this.config.generatedInteropTokenM2MDurationSeconds,
      organizationId: consumerId,
    };

    const systemRolePayload = clientAdminId
      ? {
          role: systemRole.M2M_ADMIN_ROLE,
          adminId: clientAdminId,
        }
      : {
          role: systemRole.M2M_ROLE,
        };

    // CORE LOGIC: Strongly-typed payload construction.
    // Uses InteropJwtApiDPoPPayload (req. cnf) if dpopJWK exists, otherwise standard InteropJwtApiPayload.
    // The serializer handles the resulting Union type.
    const payload: InteropJwtApiPayload | InteropJwtApiDPoPPayload = dpopJWK
      ? {
          ...userDataPayload,
          ...systemRolePayload,
          cnf: {
            jkt: calculateKid(dpopJWK),
          },
        }
      : {
          ...userDataPayload,
          ...systemRolePayload,
        };

    const serializedToken = await this.createAndSignToken({
      header,
      payload: toSerializedInteropJwtPayload(payload),
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
    dpopJWK,
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
    dpopJWK?: JWKKeyRS256 | JWKKeyES256;
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
      alg: JWT_HEADER_ALG,
      use: JWT_HEADER_USE,
      typ: JWT_HEADER_TYP,
      kid: this.config.generatedInteropTokenKid,
    };

    const payload: InteropJwtConsumerPayload = {
      jti: generateId(),
      iss: this.config.generatedInteropTokenIssuer,
      aud: audience,
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
      ...(dpopJWK
        ? {
            cnf: {
              jkt: calculateKid(dpopJWK),
            },
          }
        : {}),
    };

    const serializedToken = await this.createAndSignToken({
      header,
      payload: toSerializedInteropJwtPayload(payload),
      keyId: this.config.generatedInteropTokenKid,
    });

    return {
      header,
      payload,
      serialized: serializedToken,
    };
  }

  public async generateAgidIntegrityRest02Token({
    signedHeaders,
  }: {
    signedHeaders: IntegrityRest02SignedHeader;
  }): Promise<string> {
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
      alg: JWT_HEADER_ALG,
      use: JWT_HEADER_USE,
      typ: JWT_HEADER_TYP,
      kid: this.config.generatedInteropTokenKid,
    };

    const payload: AgidIntegrityRest02TokenPayload = {
      jti: generateId(),
      iss: this.config.generatedInteropTokenIssuer,
      aud: this.config.generatedInteropTokenM2MAudience,
      iat: currentTimestamp,
      nbf: currentTimestamp,
      exp:
        currentTimestamp +
        (this.config.generatedInteropTokenM2MDurationSeconds ?? 100), // TODO: Check default to set
      signed_headers: signedHeaders,
    };
    return await this.createAndSignToken({
      header,
      payload,
      keyId: this.config.generatedInteropTokenKid,
    });
  }

  private async createAndSignToken({
    header,
    payload,
    keyId,
  }: {
    header: InteropJwtHeader;
    payload: SerializedAuthTokenPayload | AgidIntegrityRest02TokenPayload;
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
}

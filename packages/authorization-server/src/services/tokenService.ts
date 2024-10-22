import {
  ApiKey,
  ClientAssertion,
  ConsumerKey,
  validateClientKindAndPlatformState,
  validateRequestParameters,
  verifyClientAssertion,
  verifyClientAssertionSignature,
} from "pagopa-interop-client-assertion-validation";
import { authorizationServerApi } from "pagopa-interop-api-clients";
import {
  clientKidPrefix,
  clientKidPurposePrefix,
  clientKindTokenStates,
  DescriptorId,
  EServiceId,
  generateId,
  genericInternalError,
  makeTokenGenerationStatesClientKidPK,
  makeTokenGenerationStatesClientKidPurposePK,
  TenantId,
  TokenGenerationStatesClientEntry,
  TokenGenerationStatesClientKidPK,
  TokenGenerationStatesClientKidPurposePK,
  TokenGenerationStatesClientPurposeEntry,
  TokenGenerationStatesGenericEntry,
  unsafeBrandId,
  GeneratedTokenAuditDetails,
} from "pagopa-interop-models";
import {
  DynamoDBClient,
  GetItemCommand,
  GetItemCommandOutput,
  GetItemInput,
} from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { match } from "ts-pattern";
import {
  b64ByteUrlEncode,
  b64UrlEncode,
  FileManager,
  formatDateyyyyMMdd,
  formatTimehhmmss,
  Logger,
  RateLimiter,
  RateLimiterStatus,
} from "pagopa-interop-commons";
import { KMSClient, SignCommand, SignCommandInput } from "@aws-sdk/client-kms";
import { initProducer } from "kafka-iam-auth";
import {
  InteropJwtHeader,
  InteropJwtPayload,
  InteropToken,
} from "../model/domain/models.js";
import { config } from "../config/config.js";
import {
  clientAssertionRequestValidationFailed,
  clientAssertionSignatureValidationFailed,
  clientAssertionValidationFailed,
  fallbackAuditFailed,
  invalidTokenClientKidPurposeEntry,
  kafkaAuditingFailed,
  tokenGenerationStatesEntryNotFound,
  // keyRetrievalFailed,
  keyTypeMismatch,
  unexpectedTokenGenerationError,
  tokenSigningFailed,
  unexpectedTokenGenerationStatesEntry,
  platformStateValidationFailed,
} from "../model/domain/errors.js";

// TODO: copied
export type GenerateTokenReturnType =
  | {
      limitReached: true;
      token: undefined;
      rateLimitedTenantId: TenantId;
      rateLimiterStatus: Omit<RateLimiterStatus, "limitReached">;
    }
  | {
      limitReached: false;
      token: InteropToken;
      rateLimiterStatus: Omit<RateLimiterStatus, "limitReached">;
    };

const PURPOSE_ID_CLAIM = "purposeId";
const ORGANIZATION_ID_CLAIM = "organizationId";
const GENERATED_INTEROP_TOKEN_M2M_ROLE = "m2m";
const ROLE_CLAIM = "role";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tokenServiceBuilder({
  dynamoDBClient,
  kmsClient,
  redisRateLimiter,
  producer,
  fileManager,
}: {
  dynamoDBClient: DynamoDBClient;
  kmsClient: KMSClient;
  redisRateLimiter: RateLimiter;
  producer: Awaited<ReturnType<typeof initProducer>>;
  fileManager: FileManager;
}) {
  return {
    async generateToken(
      request: authorizationServerApi.AccessTokenRequest,
      correlationId: string,
      logger: Logger
    ): Promise<GenerateTokenReturnType> {
      const { errors: parametersErrors } = validateRequestParameters({
        client_assertion: request.client_assertion,
        client_assertion_type: request.client_assertion_type,
        grant_type: request.grant_type,
        client_id: request.client_id,
      });

      if (parametersErrors) {
        throw clientAssertionRequestValidationFailed(request);
      }

      const { data: jwt, errors: clientAssertionErrors } =
        verifyClientAssertion(request.client_assertion, request.client_id);

      if (clientAssertionErrors) {
        throw clientAssertionValidationFailed(
          request.client_assertion,
          request.client_id
        );
      }

      const clientId = jwt.payload.sub;
      const kid = jwt.header.kid;
      const purposeId = jwt.payload.purposeId;

      const pk = purposeId
        ? makeTokenGenerationStatesClientKidPurposePK({
            clientId,
            kid,
            purposeId,
          })
        : makeTokenGenerationStatesClientKidPK({ clientId, kid });

      const key = await retrieveKey(dynamoDBClient, pk);

      const { errors: clientAssertionSignatureErrors } =
        await verifyClientAssertionSignature(request.client_assertion, key);

      if (clientAssertionSignatureErrors) {
        throw clientAssertionSignatureValidationFailed(
          request.client_assertion
        );
      }

      const { errors: platformStateErrors } =
        validateClientKindAndPlatformState(key, jwt);
      if (platformStateErrors) {
        throw platformStateValidationFailed();
      }

      const { limitReached, ...rateLimiterStatus } =
        await redisRateLimiter.rateLimitByOrganization(key.consumerId, logger);

      if (limitReached) {
        return {
          limitReached: true,
          token: undefined,
          rateLimitedTenantId: key.consumerId,
          rateLimiterStatus,
        };
      }

      // TODO: match otherwise doesn't work somehow
      if (key.clientKind === clientKindTokenStates.consumer) {
        const customClaims = { [PURPOSE_ID_CLAIM]: key.purposeId };
        const token = await generateInteropToken(
          kmsClient,
          jwt,
          key.eServiceState.audience,
          key.eServiceState.voucherLifespan,
          customClaims
        );

        await publishAudit({
          producer,
          generatedToken: token,
          key,
          clientAssertion: jwt,
          correlationId,
          fileManager,
          logger,
        });

        return {
          limitReached: false,
          token,
          rateLimiterStatus,
        };
      } else if (key.clientKind === clientKindTokenStates.api) {
        const customClaims = {
          [ORGANIZATION_ID_CLAIM]: key.consumerId,
          [ROLE_CLAIM]: GENERATED_INTEROP_TOKEN_M2M_ROLE,
        };

        const token = await generateInteropToken(
          kmsClient,
          jwt,
          [config.generatedInteropTokenM2MAudience],
          config.generatedInteropTokenM2MDurationSeconds,
          customClaims
        );

        return {
          limitReached: false,
          token,
          rateLimiterStatus,
        };
      } else {
        throw unexpectedTokenGenerationError();
      }
    },
  };
}

export type TokenService = ReturnType<typeof tokenServiceBuilder>;

export const retrieveKey = async (
  dynamoDBClient: DynamoDBClient,
  pk: TokenGenerationStatesClientKidPurposePK | TokenGenerationStatesClientKidPK
  // clientAssertion: ClientAssertion
): Promise<ConsumerKey | ApiKey> => {
  const input: GetItemInput = {
    Key: {
      PK: { S: pk },
    },
    TableName: config.tokenGenerationStatesTable,
  };

  // try {
  // TODO should we use try/catch in every dynamoDB query?
  const command = new GetItemCommand(input);
  const data: GetItemCommandOutput = await dynamoDBClient.send(command);

  if (!data.Item) {
    throw tokenGenerationStatesEntryNotFound(pk);
  } else {
    const unmarshalled = unmarshall(data.Item);
    const tokenGenerationEntry =
      TokenGenerationStatesGenericEntry.safeParse(unmarshalled);

    if (!tokenGenerationEntry.success) {
      throw genericInternalError(
        `Unable to parse token generation entry item: result ${JSON.stringify(
          tokenGenerationEntry
        )} - data ${JSON.stringify(data)} `
      );
    }

    return match(tokenGenerationEntry.data)
      .when(
        (entry) =>
          entry.clientKind === clientKindTokenStates.consumer &&
          entry.PK.startsWith(clientKidPurposePrefix),
        () => {
          // TODO: remove as
          const clientKidPurposeEntry =
            tokenGenerationEntry.data as TokenGenerationStatesClientPurposeEntry;
          if (
            !clientKidPurposeEntry.GSIPK_purposeId ||
            !clientKidPurposeEntry.purposeState ||
            !clientKidPurposeEntry.purposeVersionId ||
            !clientKidPurposeEntry.agreementId ||
            !clientKidPurposeEntry.agreementState ||
            !clientKidPurposeEntry.GSIPK_eserviceId_descriptorId ||
            !clientKidPurposeEntry.descriptorState ||
            !clientKidPurposeEntry.descriptorAudience ||
            !clientKidPurposeEntry.descriptorVoucherLifespan
          ) {
            throw invalidTokenClientKidPurposeEntry();
          }

          const key: ConsumerKey = {
            kid: clientKidPurposeEntry.GSIPK_kid,
            purposeId: clientKidPurposeEntry.GSIPK_purposeId,
            clientId: clientKidPurposeEntry.GSIPK_clientId,
            consumerId: clientKidPurposeEntry.consumerId,
            publicKey: clientKidPurposeEntry.publicKey,
            // algorithm: clientAssertion.header.alg,
            algorithm: "RS256" /* TODO pass this as a parameter? */,
            clientKind: clientKindTokenStates.consumer, // TODO this doesn't work with clientKidPurpose Entry.clientKind, but it should be already validated in the "when"
            purposeState: {
              state: clientKidPurposeEntry.purposeState,
              versionId: clientKidPurposeEntry.purposeVersionId,
            },
            agreementId: clientKidPurposeEntry.agreementId,
            agreementState: {
              state: clientKidPurposeEntry.agreementState,
            },
            // TODO: make function for this split
            eServiceId: unsafeBrandId<EServiceId>(
              clientKidPurposeEntry.GSIPK_eserviceId_descriptorId.split("#")[0]
            ),
            eServiceState: {
              state: clientKidPurposeEntry.descriptorState,
              descriptorId: unsafeBrandId<DescriptorId>(
                clientKidPurposeEntry.GSIPK_eserviceId_descriptorId.split(
                  "#"
                )[1]
              ),
              audience: clientKidPurposeEntry.descriptorAudience,
              voucherLifespan: clientKidPurposeEntry.descriptorVoucherLifespan,
            },
          };
          return key;
        }
      )
      .when(
        (entry) =>
          entry.clientKind === clientKindTokenStates.consumer &&
          entry.PK.startsWith(clientKidPrefix),
        (entry) => {
          throw keyTypeMismatch(clientKidPrefix, entry.clientKind);
        }
      )
      .when(
        (entry) =>
          entry.clientKind === clientKindTokenStates.api &&
          entry.PK.startsWith(clientKidPurposePrefix),
        (entry) => {
          throw keyTypeMismatch(clientKidPurposePrefix, entry.clientKind);
        }
      )
      .when(
        (entry) =>
          entry.clientKind === clientKindTokenStates.api &&
          entry.PK.startsWith(clientKidPrefix),
        () => {
          const clientKidEntry =
            tokenGenerationEntry.data as TokenGenerationStatesClientEntry;

          const key: ApiKey = {
            kid: clientKidEntry.GSIPK_kid,
            clientId: clientKidEntry.GSIPK_clientId,
            consumerId: clientKidEntry.consumerId,
            publicKey: clientKidEntry.publicKey,
            algorithm: "RS256", // TODO pass this as a parameter?,
            clientKind: clientKindTokenStates.api, // TODO this doesn't work with clientKidEntry.clientKind, but it should be already validated in the "when"
          };
          return key;
        }
      )
      .otherwise(() => {
        throw unexpectedTokenGenerationStatesEntry();
      });
  }
  // } catch (error) {
  //   // error handling.
  //   // TODO Handle both dynamodb errors and throw error for empty public key
  //   throw keyRetrievalFailed();
  // }
};

export const generateInteropToken = async (
  kmsClient: KMSClient,
  clientAssertion: ClientAssertion,
  audience: string[],
  tokenDurationInSeconds: number,
  // TODO: improve object type
  customClaims: object
): Promise<InteropToken> => {
  const currentTimestamp = Date.now();

  const header: InteropJwtHeader = {
    alg: "RS256",
    use: "sig",
    typ: "at+jwt",
    kid: config.generatedInteropTokenKid,
  };

  const payload: InteropJwtPayload = {
    jti: generateId(),
    iss: config.generatedInteropTokenIssuer,
    aud: audience,
    sub: clientAssertion.payload.sub,
    iat: currentTimestamp,
    nbf: currentTimestamp,
    exp: currentTimestamp + tokenDurationInSeconds * 1000,
    ...customClaims,
  };

  const serializedToken = `${b64UrlEncode(
    JSON.stringify(header)
  )}.${b64UrlEncode(JSON.stringify(payload))}`;

  const commandParams: SignCommandInput = {
    KeyId: config.generatedInteropTokenKid,
    Message: new TextEncoder().encode(serializedToken),
    SigningAlgorithm: "RSASSA_PKCS1_V1_5_SHA_256", // TODO move this to config?
  };

  const command = new SignCommand(commandParams);
  const response = await kmsClient.send(command);

  if (!response.Signature) {
    throw tokenSigningFailed(payload.jti);
  }

  const jwtSignature = b64ByteUrlEncode(response.Signature);

  return {
    header,
    payload,
    serialized: `${serializedToken}.${jwtSignature}`,
  };
};

export const publishAudit = async ({
  producer,
  generatedToken,
  key,
  clientAssertion,
  correlationId,
  fileManager,
  logger,
}: {
  producer: Awaited<ReturnType<typeof initProducer>>;
  generatedToken: InteropToken;
  key: ConsumerKey;
  clientAssertion: ClientAssertion;
  correlationId: string;
  fileManager: FileManager;
  logger: Logger;
}): Promise<void> => {
  const messageBody: GeneratedTokenAuditDetails = {
    jwtId: generatedToken.payload.jti,
    correlationId,
    issuedAt: generatedToken.payload.iat,
    clientId: clientAssertion.payload.sub,
    organizationId: key.consumerId,
    agreementId: key.agreementId,
    eserviceId: key.eServiceId,
    descriptorId: unsafeBrandId(key.eServiceState.descriptorId),
    purposeId: key.purposeId,
    purposeVersionId: unsafeBrandId(key.purposeState.versionId),
    algorithm: generatedToken.header.alg,
    keyId: generatedToken.header.kid,
    audience: generatedToken.payload.aud.join(","),
    subject: generatedToken.payload.sub,
    notBefore: generatedToken.payload.nbf,
    expirationTime: generatedToken.payload.exp,
    issuer: generatedToken.payload.iss,
    clientAssertion: {
      algorithm: clientAssertion.header.alg,
      // TODO: improve typeof
      audience:
        typeof clientAssertion.payload.aud === "string"
          ? clientAssertion.payload.aud
          : clientAssertion.payload.aud.join(","),
      // TODO: double check if the toMillis function is needed
      expirationTime: clientAssertion.payload.exp,
      issuedAt: clientAssertion.payload.iat,
      issuer: clientAssertion.payload.iss,
      jwtId: clientAssertion.payload.jti,
      keyId: clientAssertion.header.kid,
      subject: clientAssertion.payload.sub,
    },
  };

  try {
    const res = await producer.send({
      messages: [
        {
          // TODO: is this key correct?
          key: generatedToken.payload.jti,
          value: JSON.stringify(messageBody) + "\n",
        },
      ],
    });
    if (res.length === 0 || res[0].errorCode !== 0) {
      throw kafkaAuditingFailed();
    }
  } catch (e) {
    logger.info("main auditing flow failed, going through fallback");
    await fallbackAudit(messageBody, fileManager, logger);
  }
};

export const fallbackAudit = async (
  messageBody: GeneratedTokenAuditDetails,
  fileManager: FileManager,
  logger: Logger
): Promise<void> => {
  const date = new Date();
  const ymdDate = formatDateyyyyMMdd(date);
  const hmsTime = formatTimehhmmss(date);

  const fileName = `${ymdDate}_${hmsTime}_${generateId()}.ndjson`;
  const filePath = `token-details/${ymdDate}`;

  try {
    await fileManager.storeBytes(
      {
        bucket: config.s3Bucket,
        path: filePath,
        name: fileName,
        content: Buffer.from(JSON.stringify(messageBody) + "\n"),
      },
      logger
    );
    logger.info("auditing succeeded through fallback");
  } catch {
    throw fallbackAuditFailed(messageBody.jwtId);
  }
};

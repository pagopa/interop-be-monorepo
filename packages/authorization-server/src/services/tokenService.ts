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
  TokenGenerationStatesClientEntry,
  TokenGenerationStatesClientKidPK,
  TokenGenerationStatesClientKidPurposePK,
  TokenGenerationStatesClientPurposeEntry,
  TokenGenerationStatesGenericEntry,
  unsafeBrandId,
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
  genericLogger,
  Logger,
  RateLimiter,
} from "pagopa-interop-commons";
import { KMSClient, SignCommand, SignCommandInput } from "@aws-sdk/client-kms";
import { initProducer } from "kafka-iam-auth";
import {
  GeneratedTokenAuditDetails,
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
  invalidPlatformStates,
  kafkaAuditingFailed,
  keyNotFound,
  keyRetrievalError,
  keyTypeMismatch,
  tokenSigningFailed,
  unexpectedTokenGenerationStatesEntry,
} from "../model/domain/errors.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tokenServiceBuilder(
  dynamoDBClient: DynamoDBClient,
  kmsClient: KMSClient,
  redisRateLimiter: RateLimiter,
  producer: Awaited<ReturnType<typeof initProducer>>,
  correlationId: string,
  fileManager: FileManager,
  logger: Logger
) {
  return {
    async generateToken(
      request: authorizationServerApi.AccessTokenRequest
      // TODO: fix return type
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ): Promise<any> {
      const { errors: parametersErrors } = validateRequestParameters({
        client_assertion: request.client_assertion,
        client_assertion_type: request.client_assertion_type,
        grant_type: request.grant_type,
        client_id: request.client_id,
      });

      if (parametersErrors) {
        throw clientAssertionRequestValidationFailed();
      }

      const { data: jwt, errors: clientAssertionErrors } =
        verifyClientAssertion(request.client_assertion, request.client_id);

      if (clientAssertionErrors) {
        throw clientAssertionValidationFailed();
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
        verifyClientAssertionSignature(request.client_assertion, key);
      if (clientAssertionSignatureErrors) {
        throw clientAssertionSignatureValidationFailed();
      }

      const { errors: platformStateErrors } =
        validateClientKindAndPlatformState(key, jwt);
      if (platformStateErrors) {
        throw clientAssertionSignatureValidationFailed();
      }

      // TODO throw error if limit reached? Maybe not, because info have to be passed
      const { limitReached, ...rateLimiterStatus } =
        await redisRateLimiter.rateLimitByOrganization(
          key.consumerId,
          genericLogger
        );

      if (limitReached) {
        return {
          limitReached: true,
          token: undefined,
          rateLimitedTenantId: key.consumerId,
          rateLimiterStatus,
        };
      }

      const token = await generateInteropToken(kmsClient, jwt, [], 0, {});

      if (key.clientKind === clientKindTokenStates.consumer) {
        await publishAudit(
          producer,
          token,
          key,
          jwt,
          correlationId,
          fileManager,
          logger
        );

        return token;
      }

      return token;
    },
  };
}

export type TokenService = ReturnType<typeof tokenServiceBuilder>;

export const retrieveKey = async (
  dynamoDBClient: DynamoDBClient,
  pk: TokenGenerationStatesClientKidPurposePK | TokenGenerationStatesClientKidPK
): Promise<ConsumerKey | ApiKey> => {
  const input: GetItemInput = {
    Key: {
      PK: { S: pk },
    },
    TableName: config.tokenGenerationStatesTable,
  };

  try {
    // TODO should we use try/catch in every dynamoDB query?
    const command = new GetItemCommand(input);
    const data: GetItemCommandOutput = await dynamoDBClient.send(command);

    if (!data.Item) {
      throw keyNotFound();
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

      match(tokenGenerationEntry.data)
        .when(
          (entry) =>
            entry.clientKind === clientKindTokenStates.consumer &&
            entry.PK.startsWith(clientKidPurposePrefix),
          () => {
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
              throw invalidPlatformStates();
            }

            const key: ConsumerKey = {
              kid: clientKidPurposeEntry.GSIPK_kid,
              purposeId: clientKidPurposeEntry.GSIPK_purposeId,
              clientId: clientKidPurposeEntry.GSIPK_clientId,
              consumerId: clientKidPurposeEntry.consumerId,
              publicKey: clientKidPurposeEntry.publicKey,
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
              eServiceId: unsafeBrandId<EServiceId>(
                clientKidPurposeEntry.GSIPK_eserviceId_descriptorId.split(
                  "#"
                )[0]
              ),
              eServiceState: {
                state: clientKidPurposeEntry.descriptorState,
                descriptorId: unsafeBrandId<DescriptorId>(
                  clientKidPurposeEntry.GSIPK_eserviceId_descriptorId.split(
                    "#"
                  )[1]
                ),
                audience: clientKidPurposeEntry.descriptorAudience,
                voucherLifespan:
                  clientKidPurposeEntry.descriptorVoucherLifespan,
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
        .run();

      throw unexpectedTokenGenerationStatesEntry();
    }
  } catch (error) {
    // error handling.
    // TODO Handle both dynamodb errors and throw error for empty public key
    throw keyRetrievalError();
  }
};

export const generateInteropToken = async (
  kmsClient: KMSClient,
  clientAssertion: ClientAssertion,
  audience: string[],
  tokenDurationInSeconds: number,
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
    throw tokenSigningFailed();
  }

  const jwtSignature = b64ByteUrlEncode(response.Signature);

  return {
    header,
    payload,
    serialized: `${serializedToken}.${jwtSignature}`,
  };
};

export const publishAudit = async (
  producer: Awaited<ReturnType<typeof initProducer>>,
  generatedToken: InteropToken,
  key: ConsumerKey,
  clientAssertion: ClientAssertion,
  correlationId: string,
  fileManager: FileManager,
  logger: Logger
): Promise<void> => {
  const messageBody: GeneratedTokenAuditDetails = {
    jwtId: generatedToken.payload.jti,
    correlationId,
    issuedAt: generatedToken.payload.iat,
    clientId: clientAssertion.payload.sub,
    organizationId: key.consumerId,
    agreementId: key.agreementId,
    eserviceId: key.eServiceId,
    descriptorId: key.eServiceState.descriptorId,
    purposeId: key.purposeId,
    purposeVersionId: key.purposeState.versionId,
    algorithm: generatedToken.header.alg,
    keyId: generatedToken.header.kid,
    audience: generatedToken.payload.aud.join(","),
    subject: generatedToken.payload.sub,
    notBefore: generatedToken.payload.nbf,
    expirationTime: generatedToken.payload.exp,
    issuer: generatedToken.payload.iss,
    clientAssertion: {
      algorithm: clientAssertion.header.alg,
      audience: clientAssertion.payload.aud.join(","),
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
          key: generatedToken.payload.jti,
          value: JSON.stringify(messageBody),
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
  const ymdDate = formatDateyyyyMMdd(new Date());

  const fileName = `${ymdDate}_${messageBody.jwtId}.ndjson`;
  const filePath = `token-details/${ymdDate}/${fileName}`;

  try {
    await fileManager.storeBytes(
      {
        bucket: config.interopGeneratedJwtDetailsFallback,
        path: filePath,
        name: fileName,
        content: Buffer.from(JSON.stringify(messageBody)),
      },
      logger
    );
    logger.info("auditing succeded through fallback");
  } catch {
    throw fallbackAuditFailed();
  }
};

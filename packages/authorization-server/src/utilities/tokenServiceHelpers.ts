import {
  AsyncClientAssertion,
  AsyncPlatformStatesCatalogEntry,
  clientKindTokenGenStates,
  ClientAssertion,
  ClientKindTokenGenStates,
  DescriptorId,
  DPoPProof,
  EServiceId,
  FullTokenGenerationStatesConsumerClient,
  genericInternalError,
  GSIPKEServiceIdDescriptorId,
  itemState,
  makePlatformStatesEServiceDescriptorPK,
  makeProducerKeychainPlatformStatesPK,
  PlatformStatesCatalogEntry,
  ProducerKeychainId,
  ProducerKeychainPlatformStateEntry,
  PurposeId,
  TokenGenerationStatesApiClient,
  TokenGenerationStatesClientKidPK,
  TokenGenerationStatesClientKidPurposePK,
  TokenGenStatesConsumerClientGSIPurpose,
  TokenGenerationStatesGenericClient,
} from "pagopa-interop-models";
import {
  DynamoDBClient,
  GetItemCommand,
  GetItemCommandOutput,
  GetItemInput,
  QueryCommand,
  QueryCommandOutput,
  QueryInput,
} from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { match } from "ts-pattern";
import { Logger } from "pagopa-interop-commons";
import {
  verifyDPoPProof,
  verifyDPoPProofSignature,
} from "pagopa-interop-dpop-validation";
import { config } from "../config/config.js";
import {
  asyncExchangePropertiesNotFound,
  catalogEntryNotFound,
  dpopProofSignatureValidationFailed,
  dpopProofValidationFailed,
  incompleteTokenGenerationStatesConsumerClient,
  platformStateValidationFailed,
  producerKeychainEntryNotFound,
  tokenGenerationStatesEntryNotFound,
  tokenGenerationStatesEntriesByPurposeIdNotFound,
} from "../model/domain/errors.js";

const EXPECTED_HTM = "POST";

export const retrieveKey = async (
  dynamoDBClient: DynamoDBClient,
  pk: TokenGenerationStatesClientKidPurposePK | TokenGenerationStatesClientKidPK
): Promise<
  FullTokenGenerationStatesConsumerClient | TokenGenerationStatesApiClient
> => {
  const input: GetItemInput = {
    Key: {
      PK: { S: pk },
    },
    TableName: config.tokenGenerationStatesTable,
  };

  const command = new GetItemCommand(input);
  const data: GetItemCommandOutput = await dynamoDBClient.send(command);

  if (!data.Item) {
    throw tokenGenerationStatesEntryNotFound(pk);
  } else {
    const unmarshalled = unmarshall(data.Item);
    const tokenGenStatesClient =
      TokenGenerationStatesGenericClient.safeParse(unmarshalled);

    if (!tokenGenStatesClient.success) {
      throw genericInternalError(
        `Unable to parse token-generation-states client: result ${JSON.stringify(
          tokenGenStatesClient
        )} - data ${JSON.stringify(data)} `
      );
    }

    return match(tokenGenStatesClient.data)
      .with({ clientKind: clientKindTokenGenStates.consumer }, (entry) => {
        const tokenGenStatesConsumerClient =
          FullTokenGenerationStatesConsumerClient.safeParse(entry);
        if (!tokenGenStatesConsumerClient.success) {
          throw incompleteTokenGenerationStatesConsumerClient(entry.PK);
        }

        return tokenGenStatesConsumerClient.data;
      })
      .with({ clientKind: clientKindTokenGenStates.api }, (entry) => entry)
      .exhaustive();
  }
};

const retrieveCatalogEntry = async (
  dynamoDBClient: DynamoDBClient,
  eserviceId: EServiceId,
  descriptorId: DescriptorId,
  platformStatesTable: string
): Promise<PlatformStatesCatalogEntry> => {
  const pk = makePlatformStatesEServiceDescriptorPK({
    eserviceId,
    descriptorId,
  });

  const input: GetItemInput = {
    Key: {
      PK: { S: pk },
    },
    TableName: platformStatesTable,
  };

  const command = new GetItemCommand(input);
  const data: GetItemCommandOutput = await dynamoDBClient.send(command);

  if (!data.Item) {
    throw catalogEntryNotFound(eserviceId, descriptorId);
  }

  const unmarshalled = unmarshall(data.Item);
  const catalogEntry = PlatformStatesCatalogEntry.safeParse(unmarshalled);

  if (!catalogEntry.success) {
    throw genericInternalError(
      `Unable to parse platform-states catalog entry: result ${JSON.stringify(
        catalogEntry
      )} - data ${JSON.stringify(data)} `
    );
  }

  return catalogEntry.data;
};

export const retrieveAsyncCatalogEntry = async (
  dynamoDBClient: DynamoDBClient,
  eserviceId: EServiceId,
  descriptorId: DescriptorId,
  platformStatesTable: string
): Promise<AsyncPlatformStatesCatalogEntry> => {
  const catalogEntry = await retrieveCatalogEntry(
    dynamoDBClient,
    eserviceId,
    descriptorId,
    platformStatesTable
  );
  const asyncCatalogEntry =
    AsyncPlatformStatesCatalogEntry.safeParse(catalogEntry);
  if (!asyncCatalogEntry.success) {
    throw asyncExchangePropertiesNotFound(eserviceId, descriptorId);
  }
  // The descriptor is pinned on the Interaction at start_interaction; the
  // token-generation-states row may have been rewritten to point at a
  // different descriptor, so validatePlatformState(key) would not catch a
  // pinned descriptor that has since become INACTIVE.
  if (asyncCatalogEntry.data.state !== itemState.active) {
    throw platformStateValidationFailed(
      `E-Service state for pinned descriptor ${descriptorId} is: ${asyncCatalogEntry.data.state}`
    );
  }
  return asyncCatalogEntry.data;
};

export const retrieveTokenGenStatesEntryByPurposeId = async (
  dynamoDBClient: DynamoDBClient,
  purposeId: PurposeId,
  tokenGenerationStatesTable: string
): Promise<TokenGenStatesConsumerClientGSIPurpose> => {
  const input: QueryInput = {
    TableName: tokenGenerationStatesTable,
    IndexName: "Purpose",
    KeyConditionExpression: "GSIPK_purposeId = :purposeId",
    ExpressionAttributeValues: {
      ":purposeId": { S: purposeId },
    },
    Limit: 1,
  };

  const command = new QueryCommand(input);
  const data: QueryCommandOutput = await dynamoDBClient.send(command);

  if (!data.Items || data.Items.length === 0) {
    throw tokenGenerationStatesEntriesByPurposeIdNotFound(purposeId);
  }

  const unmarshalled = unmarshall(data.Items[0]);
  const entry = TokenGenStatesConsumerClientGSIPurpose.safeParse(unmarshalled);

  if (!entry.success) {
    throw genericInternalError(
      `Unable to parse token-generation-states entry from Purpose GSI: result ${JSON.stringify(
        entry
      )} - data ${JSON.stringify(data)} `
    );
  }

  return entry.data;
};

export const deconstructGSIPK_eserviceId_descriptorId = (
  gsi: GSIPKEServiceIdDescriptorId
): { eserviceId: EServiceId; descriptorId: DescriptorId } => {
  const substrings = gsi.split("#");
  const eserviceId = substrings[0];
  const descriptorId = substrings[1];
  const parsedEserviceId = EServiceId.safeParse(eserviceId);

  if (!parsedEserviceId.success) {
    throw genericInternalError(
      `Unable to parse extract eserviceId from GSIPKEServiceIdDescriptorId: ${GSIPKEServiceIdDescriptorId}`
    );
  }

  const parsedDescriptorId = DescriptorId.safeParse(descriptorId);

  if (!parsedDescriptorId.success) {
    throw genericInternalError(
      `Unable to parse extract descriptorId from GSIPKEServiceIdDescriptorId: ${GSIPKEServiceIdDescriptorId}`
    );
  }

  return {
    eserviceId: parsedEserviceId.data,
    descriptorId: parsedDescriptorId.data,
  };
};

export const logTokenGenerationInfo = ({
  validatedJwt,
  clientKind,
  tokenJti,
  message,
  logger,
}: {
  validatedJwt: ClientAssertion | AsyncClientAssertion;
  clientKind: ClientKindTokenGenStates | undefined;
  tokenJti: string | undefined;
  message: string;
  logger: Logger;
}): void => {
  const clientId = `[CLIENTID=${validatedJwt.payload.sub}]`;
  const kid = `[KID=${validatedJwt.header.kid}]`;
  const purposeId = `[PURPOSEID=${validatedJwt.payload.purposeId}]`;
  const tokenType = `[TYPE=${clientKind}]`;
  const jti = `[JTI=${tokenJti}]`;
  logger.info(`${clientId}${kid}${purposeId}${tokenType}${jti} - ${message}`);
};

export const retrieveProducerKey = async (
  dynamoDBClient: DynamoDBClient,
  tableName: string,
  {
    producerKeychainId,
    kid,
    eServiceId,
  }: {
    producerKeychainId: ProducerKeychainId;
    kid: string;
    eServiceId: EServiceId;
  }
): Promise<ProducerKeychainPlatformStateEntry> => {
  const pk = makeProducerKeychainPlatformStatesPK({
    producerKeychainId,
    kid,
    eServiceId,
  });
  const input: GetItemInput = {
    Key: {
      PK: { S: pk },
    },
    TableName: tableName,
    ConsistentRead: true,
  };

  const data: GetItemCommandOutput = await dynamoDBClient.send(
    new GetItemCommand(input)
  );

  if (!data.Item) {
    throw producerKeychainEntryNotFound(producerKeychainId, kid, eServiceId);
  }

  const unmarshalled = unmarshall(data.Item);
  const entry = ProducerKeychainPlatformStateEntry.safeParse(unmarshalled);

  if (!entry.success) {
    throw genericInternalError(
      `Unable to parse producer-keychain-platform-states entry: result ${JSON.stringify(
        entry
      )} - data ${JSON.stringify(data)} `
    );
  }

  return entry.data;
};

export const validateDPoPProof = async (
  dpopProofHeader: string | undefined,
  clientId: string | undefined,
  logger: Logger
): Promise<{
  dpopProofJWS: string | undefined;
  dpopProofJWT: DPoPProof | undefined;
}> => {
  const { data, errors: dpopProofErrors } = dpopProofHeader
    ? verifyDPoPProof({
        dpopProofJWS: dpopProofHeader,
        expectedDPoPProofHtu: config.dpopHtuBase,
        expectedDPoPProofHtm: EXPECTED_HTM,
        dpopProofIatToleranceSeconds: config.dpopIatToleranceSeconds,
        dpopProofDurationSeconds: config.dpopDurationSeconds,
      })
    : { data: undefined, errors: undefined };

  if (dpopProofErrors) {
    throw dpopProofValidationFailed(
      clientId,
      dpopProofErrors.map((error) => error.detail).join(", ")
    );
  }

  const dpopProofJWT = data?.dpopProofJWT;
  const dpopProofJWS = data?.dpopProofJWS;

  if (dpopProofJWT && dpopProofJWS) {
    const { errors: dpopProofSignatureErrors } = await verifyDPoPProofSignature(
      dpopProofJWS,
      dpopProofJWT.header.jwk
    );

    if (dpopProofSignatureErrors) {
      throw dpopProofSignatureValidationFailed(
        clientId,
        dpopProofSignatureErrors.map((error) => error.detail).join(", ")
      );
    }

    logger.info(`[JTI=${dpopProofJWT.payload.jti}] - DPoP proof validated`);
  }

  return { dpopProofJWS, dpopProofJWT };
};

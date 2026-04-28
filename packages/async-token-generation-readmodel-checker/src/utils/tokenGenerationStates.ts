import { Logger } from "pagopa-interop-commons";
import {
  clientKind,
  clientKindTokenGenStates,
  FullTokenGenerationStatesConsumerClient,
  makeGSIPKClientIdKid,
  makeGSIPKClientIdPurposeId,
  makeGSIPKConsumerIdEServiceId,
  makeGSIPKEServiceIdDescriptorId,
  makeTokenGenerationStatesClientKidPurposePK,
  TokenGenerationStatesGenericClient,
} from "pagopa-interop-models";
import {
  agreementItemState,
  buildAgreementMaps,
  buildAsyncDescriptorMap,
  buildPurposeMaps,
  descriptorItemState,
  getLastAgreement,
  getLastPurposeVersion,
  logDifference,
  purposeVersionItemState,
  ReadModelContext,
} from "./common.js";

type ComparableFullTokenGenerationStatesConsumerClient = Pick<
  FullTokenGenerationStatesConsumerClient,
  | "PK"
  | "clientKind"
  | "publicKey"
  | "consumerId"
  | "producerId"
  | "agreementId"
  | "agreementState"
  | "purposeState"
  | "purposeVersionId"
  | "descriptorState"
  | "descriptorAudience"
  | "descriptorVoucherLifespan"
  | "asyncExchange"
  | "GSIPK_clientId"
  | "GSIPK_clientId_kid"
  | "GSIPK_clientId_purposeId"
  | "GSIPK_purposeId"
  | "GSIPK_consumerId_eserviceId"
  | "GSIPK_eserviceId_descriptorId"
>;

const buildExpectedAsyncTokenGenerationStatesByPK = (
  readModelContext: ReadModelContext
): Map<string, ComparableFullTokenGenerationStatesConsumerClient> => {
  const { purposesById } = buildPurposeMaps(readModelContext.purposes);
  const { agreementsByConsumerIdEServiceId } = buildAgreementMaps(
    readModelContext.agreements
  );
  const asyncDescriptorsByEServiceDescriptor = buildAsyncDescriptorMap(
    readModelContext.eservices
  );
  const expectedByPK = new Map<
    string,
    ComparableFullTokenGenerationStatesConsumerClient
  >();

  for (const client of readModelContext.clients.filter(
    (c) => c.kind === clientKind.consumer
  )) {
    for (const purposeId of client.purposes) {
      const purpose = purposesById.get(purposeId);
      const purposeVersion = purpose
        ? getLastPurposeVersion(purpose.versions)
        : undefined;
      const agreement = purpose
        ? getLastAgreement(
            agreementsByConsumerIdEServiceId.get(
              makeGSIPKConsumerIdEServiceId({
                consumerId: purpose.consumerId,
                eserviceId: purpose.eserviceId,
              })
            ) ?? []
          )
        : undefined;
      const asyncDescriptor =
        agreement &&
        asyncDescriptorsByEServiceDescriptor.get(
          makeGSIPKEServiceIdDescriptorId({
            eserviceId: agreement.eserviceId,
            descriptorId: agreement.descriptorId,
          })
        );

      if (!purpose || !purposeVersion || !agreement || !asyncDescriptor) {
        continue;
      }

      for (const key of client.keys) {
        const expectedPK = makeTokenGenerationStatesClientKidPurposePK({
          clientId: client.id,
          kid: key.kid,
          purposeId,
        });
        expectedByPK.set(expectedPK, {
          PK: expectedPK,
          clientKind: clientKindTokenGenStates.consumer,
          publicKey: key.encodedPem,
          consumerId: purpose.consumerId,
          producerId: asyncDescriptor.eservice.producerId,
          agreementId: agreement.id,
          agreementState: agreementItemState(agreement),
          purposeState: purposeVersionItemState(purposeVersion),
          purposeVersionId: purposeVersion.id,
          descriptorState: descriptorItemState(asyncDescriptor.descriptor),
          descriptorAudience: asyncDescriptor.descriptor.audience,
          descriptorVoucherLifespan: asyncDescriptor.descriptor.voucherLifespan,
          asyncExchange: true,
          GSIPK_clientId: client.id,
          GSIPK_clientId_kid: makeGSIPKClientIdKid({
            clientId: client.id,
            kid: key.kid,
          }),
          GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
            clientId: client.id,
            purposeId,
          }),
          GSIPK_purposeId: purposeId,
          GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
            consumerId: purpose.consumerId,
            eserviceId: asyncDescriptor.eservice.id,
          }),
          GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
            eserviceId: asyncDescriptor.eservice.id,
            descriptorId: asyncDescriptor.descriptor.id,
          }),
        });
      }
    }
  }

  return expectedByPK;
};

const comparableAsyncTokenGenerationStatesEntry = (
  entry: FullTokenGenerationStatesConsumerClient
): ComparableFullTokenGenerationStatesConsumerClient => ({
  PK: entry.PK,
  clientKind: entry.clientKind,
  publicKey: entry.publicKey,
  consumerId: entry.consumerId,
  producerId: entry.producerId,
  agreementId: entry.agreementId,
  agreementState: entry.agreementState,
  purposeState: entry.purposeState,
  purposeVersionId: entry.purposeVersionId,
  descriptorState: entry.descriptorState,
  descriptorAudience: entry.descriptorAudience,
  descriptorVoucherLifespan: entry.descriptorVoucherLifespan,
  asyncExchange: entry.asyncExchange,
  GSIPK_clientId: entry.GSIPK_clientId,
  GSIPK_clientId_kid: entry.GSIPK_clientId_kid,
  GSIPK_clientId_purposeId: entry.GSIPK_clientId_purposeId,
  GSIPK_purposeId: entry.GSIPK_purposeId,
  GSIPK_consumerId_eserviceId: entry.GSIPK_consumerId_eserviceId,
  GSIPK_eserviceId_descriptorId: entry.GSIPK_eserviceId_descriptorId,
});

const compareAsyncTokenGenerationStateEntries = ({
  expectedByPK,
  tokenGenerationStates,
  logger,
}: {
  expectedByPK: Map<string, ComparableFullTokenGenerationStatesConsumerClient>;
  tokenGenerationStates: Iterable<TokenGenerationStatesGenericClient>;
  logger: Logger;
}): { differencesCount: number; seenExpectedPKs: Set<string> } => {
  const seenExpectedPKs = new Set<string>();
  let differencesCount = 0;

  for (const entry of tokenGenerationStates) {
    const parsedEntry =
      FullTokenGenerationStatesConsumerClient.safeParse(entry);
    const expected = expectedByPK.get(entry.PK);

    if (expected) {
      seenExpectedPKs.add(entry.PK);

      if (!parsedEntry.success) {
        differencesCount += logDifference({
          logger,
          message: `Missing or invalid async token-generation-states entry ${entry.PK}`,
          actual: entry,
          expected,
        });
        continue;
      }

      const comparableActual = comparableAsyncTokenGenerationStatesEntry(
        parsedEntry.data
      );

      if (JSON.stringify(comparableActual) !== JSON.stringify(expected)) {
        differencesCount += logDifference({
          logger,
          message: `Differences in async token-generation-states entry ${entry.PK}`,
          actual: comparableActual,
          expected,
        });
      }
      continue;
    }

    if (entry.clientKind === clientKindTokenGenStates.consumer) {
      if (entry.asyncExchange !== true) {
        continue;
      }

      if (!parsedEntry.success) {
        differencesCount += logDifference({
          logger,
          message: `Unexpected invalid async token-generation-states entry ${entry.PK}`,
          actual: entry,
          expected: undefined,
        });
        continue;
      }

      differencesCount += logDifference({
        logger,
        message: `Unexpected async token-generation-states entry ${parsedEntry.data.PK}`,
        actual: parsedEntry.data,
        expected: undefined,
      });
    }
  }

  return { differencesCount, seenExpectedPKs };
};

const countMissingExpectedAsyncTokenGenerationStates = ({
  expectedByPK,
  seenExpectedPKs,
  logger,
}: {
  expectedByPK: Map<string, ComparableFullTokenGenerationStatesConsumerClient>;
  seenExpectedPKs: Set<string>;
  logger: Logger;
}): number => {
  let differencesCount = 0;

  for (const [pk, expected] of expectedByPK) {
    if (!seenExpectedPKs.has(pk)) {
      differencesCount += logDifference({
        logger,
        message: `Missing or invalid async token-generation-states entry ${pk}`,
        actual: undefined,
        expected,
      });
    }
  }

  return differencesCount;
};

export const compareAsyncTokenGenerationStates = ({
  readModelContext,
  tokenGenerationStates,
  logger,
}: {
  readModelContext: ReadModelContext;
  tokenGenerationStates: TokenGenerationStatesGenericClient[];
  logger: Logger;
}): number => {
  const expectedByPK =
    buildExpectedAsyncTokenGenerationStatesByPK(readModelContext);
  const result = compareAsyncTokenGenerationStateEntries({
    expectedByPK,
    tokenGenerationStates,
    logger,
  });

  return (
    result.differencesCount +
    countMissingExpectedAsyncTokenGenerationStates({
      expectedByPK,
      seenExpectedPKs: result.seenExpectedPKs,
      logger,
    })
  );
};

export const compareAsyncTokenGenerationStatesPages = async ({
  readModelContext,
  tokenGenerationStatesPages,
  logger,
}: {
  readModelContext: ReadModelContext;
  tokenGenerationStatesPages: AsyncGenerator<
    TokenGenerationStatesGenericClient[],
    void,
    void
  >;
  logger: Logger;
}): Promise<number> => {
  const expectedByPK =
    buildExpectedAsyncTokenGenerationStatesByPK(readModelContext);
  const seenExpectedPKs = new Set<string>();
  let differencesCount = 0;

  for await (const page of tokenGenerationStatesPages) {
    const result = compareAsyncTokenGenerationStateEntries({
      expectedByPK,
      tokenGenerationStates: page,
      logger,
    });
    differencesCount += result.differencesCount;
    for (const pk of result.seenExpectedPKs) {
      seenExpectedPKs.add(pk);
    }
  }

  return (
    differencesCount +
    countMissingExpectedAsyncTokenGenerationStates({
      expectedByPK,
      seenExpectedPKs,
      logger,
    })
  );
};

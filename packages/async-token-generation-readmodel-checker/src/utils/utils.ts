import { dateToSeconds, Logger } from "pagopa-interop-commons";
import {
  Agreement,
  agreementState,
  AsyncPlatformStatesCatalogEntry,
  Client,
  clientKind,
  clientKindTokenGenStates,
  Descriptor,
  DescriptorId,
  descriptorState,
  EService,
  EServiceId,
  FullTokenGenerationStatesConsumerClient,
  GSIPKConsumerIdEServiceId,
  Interaction,
  interactionState,
  ItemState,
  itemState,
  makeGSIPKClientIdKid,
  makeGSIPKClientIdPurposeId,
  makeGSIPKConsumerIdEServiceId,
  makeGSIPKEServiceIdDescriptorId,
  makePlatformStatesEServiceDescriptorPK,
  makeProducerKeychainPlatformStatesPK,
  makeTokenGenerationStatesClientKidPurposePK,
  PlatformStatesCatalogEntry,
  PlatformStatesGenericEntry,
  ProducerKeychainPlatformStateEntry,
  Purpose,
  PurposeId,
  PurposeVersion,
  purposeVersionState,
  TenantId,
  TokenGenerationStatesGenericClient,
  unsafeBrandId,
} from "pagopa-interop-models";
import { diff } from "json-diff";
import { AsyncTokenGenerationReadModelService } from "../services/asyncTokenGenerationReadModelService.js";
import {
  ProducerKeychainReadModelEntry,
  ReadModelServiceSQL,
} from "../services/readModelServiceSQL.js";

type AsyncDescriptor = {
  eservice: EService;
  descriptor: Descriptor & {
    asyncExchangeProperties: NonNullable<Descriptor["asyncExchangeProperties"]>;
  };
};

type ReadModelContext = {
  eservices: EService[];
  purposes: Purpose[];
  agreements: Agreement[];
  clients: Client[];
  producerKeychains: ProducerKeychainReadModelEntry[];
};

type ExpectedAsyncPlatformStatesCatalogEntry = {
  PK: string;
  state: ItemState;
  descriptorAudience: string[];
  descriptorVoucherLifespan: number;
  asyncExchange: true;
  asyncExchangeProperties: NonNullable<Descriptor["asyncExchangeProperties"]>;
};

type AsyncPlatformStatesComparisonResult = {
  differencesCount: number;
  asyncPlatformStatesByPK: Map<string, AsyncPlatformStatesCatalogEntry>;
};

type ExpectedAsyncTokenGenerationStatesEntry = {
  PK: string;
  clientKind: typeof clientKindTokenGenStates.consumer;
  publicKey: string;
  consumerId: TenantId;
  producerId: TenantId;
  agreementId: Agreement["id"];
  agreementState: ItemState;
  purposeState: ItemState;
  purposeVersionId: PurposeVersion["id"];
  descriptorState: ItemState;
  descriptorAudience: string[];
  descriptorVoucherLifespan: number;
  asyncExchange: boolean | undefined;
  GSIPK_clientId: Client["id"];
  GSIPK_clientId_kid: string;
  GSIPK_clientId_purposeId: string;
  GSIPK_purposeId: Purpose["id"];
  GSIPK_consumerId_eserviceId: string;
  GSIPK_eserviceId_descriptorId: string;
};

type ExpectedProducerKeychainPlatformStateEntry = {
  PK: string;
  publicKey: string;
  producerKeychainId: ProducerKeychainReadModelEntry["producerKeychainId"];
  producerId: TenantId;
  kid: string;
  eServiceId: EServiceId;
};

const validDescriptorStates = [
  descriptorState.published,
  descriptorState.suspended,
  descriptorState.deprecated,
] as string[];

const activeOrInactive = (isActive: boolean): ItemState =>
  isActive ? itemState.active : itemState.inactive;

const descriptorItemState = (descriptor: Descriptor): ItemState =>
  activeOrInactive(descriptor.state === descriptorState.published);

const purposeVersionItemState = (purposeVersion: PurposeVersion): ItemState =>
  activeOrInactive(purposeVersion.state === purposeVersionState.active);

const agreementItemState = (agreement: Agreement): ItemState =>
  activeOrInactive(agreement.state === agreementState.active);

export const getLastPurposeVersion = (
  purposeVersions: PurposeVersion[]
): PurposeVersion | undefined =>
  purposeVersions
    .filter(
      (purposeVersion) =>
        purposeVersion.state === purposeVersionState.active ||
        purposeVersion.state === purposeVersionState.suspended ||
        purposeVersion.state === purposeVersionState.archived
    )
    .toSorted(
      (purposeVersion1, purposeVersion2) =>
        purposeVersion2.createdAt.getTime() -
        purposeVersion1.createdAt.getTime()
    )[0];

const getLastAgreement = (agreements: Agreement[]): Agreement | undefined =>
  agreements
    .filter(
      (agreement) =>
        agreement.state === agreementState.active ||
        agreement.state === agreementState.suspended ||
        agreement.state === agreementState.archived
    )
    .toSorted(
      (agreement1, agreement2) =>
        agreement2.createdAt.getTime() - agreement1.createdAt.getTime()
    )[0];

const getAsyncDescriptors = (eservices: EService[]): AsyncDescriptor[] =>
  eservices.flatMap((eservice) =>
    eservice.asyncExchange === true
      ? eservice.descriptors
          .filter(
            (descriptor): descriptor is AsyncDescriptor["descriptor"] =>
              descriptor.asyncExchangeProperties !== undefined &&
              validDescriptorStates.includes(descriptor.state)
          )
          .map((descriptor) => ({ eservice, descriptor }))
      : []
  );

const logDifference = ({
  logger,
  message,
  actual,
  expected,
}: {
  logger: Logger;
  message: string;
  actual: unknown;
  expected: unknown;
}): number => {
  const jsonDiff = diff(actual, expected);
  logger.error(
    `${message}: ${JSON.stringify(jsonDiff ?? { actual, expected })}`
  );
  return 1;
};

const pushMapValue = <K, V>(map: Map<K, V[]>, key: K, value: V): void => {
  const values = map.get(key) ?? [];
  // eslint-disable-next-line functional/immutable-data
  values.push(value);
  map.set(key, values);
};

const collectReadModelContext = async (
  readModelService: ReadModelServiceSQL
): Promise<ReadModelContext> => ({
  eservices: await readModelService.getAllReadModelEServices(),
  purposes: await readModelService.getAllReadModelPurposes(),
  agreements: await readModelService.getAllReadModelAgreements(),
  clients: await readModelService.getAllReadModelClients(),
  producerKeychains:
    await readModelService.getAllProducerKeychainReadModelEntries(),
});

const buildExpectedAsyncPlatformStatesByPK = (
  eservices: EService[]
): Map<string, ExpectedAsyncPlatformStatesCatalogEntry> =>
  new Map(
    getAsyncDescriptors(eservices).map(({ eservice, descriptor }) => {
      const pk = makePlatformStatesEServiceDescriptorPK({
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
      });
      return [
        pk,
        {
          PK: pk,
          state: descriptorItemState(descriptor),
          descriptorAudience: descriptor.audience,
          descriptorVoucherLifespan: descriptor.voucherLifespan,
          asyncExchange: true,
          asyncExchangeProperties: descriptor.asyncExchangeProperties,
        } satisfies ExpectedAsyncPlatformStatesCatalogEntry,
      ];
    })
  );

const comparableAsyncPlatformStatesEntry = (
  entry: AsyncPlatformStatesCatalogEntry
): ExpectedAsyncPlatformStatesCatalogEntry => ({
  PK: entry.PK,
  state: entry.state,
  descriptorAudience: entry.descriptorAudience,
  descriptorVoucherLifespan: entry.descriptorVoucherLifespan,
  asyncExchange: entry.asyncExchange,
  asyncExchangeProperties: entry.asyncExchangeProperties,
});

const compareAsyncPlatformStatesEntries = ({
  eservices,
  platformStates,
  logger,
}: {
  eservices: EService[];
  platformStates: Iterable<PlatformStatesGenericEntry>;
  logger: Logger;
}): AsyncPlatformStatesComparisonResult => {
  const expectedByPK = buildExpectedAsyncPlatformStatesByPK(eservices);
  const seenExpectedPKs = new Set<string>();
  const asyncPlatformStatesByPK = new Map<
    string,
    AsyncPlatformStatesCatalogEntry
  >();
  let differencesCount = 0;

  for (const entry of platformStates) {
    const parsedCatalogEntry = PlatformStatesCatalogEntry.safeParse(entry);
    if (!parsedCatalogEntry.success) {
      continue;
    }

    const { PK: pk } = parsedCatalogEntry.data;
    const expected = expectedByPK.get(pk);
    const parsedAsyncEntry = AsyncPlatformStatesCatalogEntry.safeParse(
      parsedCatalogEntry.data
    );

    if (parsedAsyncEntry.success) {
      asyncPlatformStatesByPK.set(pk, parsedAsyncEntry.data);
    }

    if (expected) {
      seenExpectedPKs.add(pk);

      if (!parsedAsyncEntry.success) {
        differencesCount += logDifference({
          logger,
          message: `Missing or invalid async platform-states catalog entry ${pk}`,
          actual: parsedCatalogEntry.data,
          expected,
        });
        continue;
      }

      const comparableActual = comparableAsyncPlatformStatesEntry(
        parsedAsyncEntry.data
      );

      if (JSON.stringify(comparableActual) !== JSON.stringify(expected)) {
        differencesCount += logDifference({
          logger,
          message: `Differences in async platform-states catalog entry ${pk}`,
          actual: comparableActual,
          expected,
        });
      }
      continue;
    }

    if (parsedCatalogEntry.data.asyncExchange === true) {
      differencesCount += logDifference({
        logger,
        message: `Unexpected async platform-states catalog entry ${pk}`,
        actual: parsedCatalogEntry.data,
        expected: undefined,
      });
    }
  }

  for (const [pk, expected] of expectedByPK) {
    if (!seenExpectedPKs.has(pk)) {
      differencesCount += logDifference({
        logger,
        message: `Missing or invalid async platform-states catalog entry ${pk}`,
        actual: undefined,
        expected,
      });
    }
  }

  return { differencesCount, asyncPlatformStatesByPK };
};

const compareAsyncPlatformStatesPages = async ({
  eservices,
  platformStatesPages,
  logger,
}: {
  eservices: EService[];
  platformStatesPages: AsyncGenerator<PlatformStatesGenericEntry[], void, void>;
  logger: Logger;
}): Promise<AsyncPlatformStatesComparisonResult> => {
  const expectedByPK = buildExpectedAsyncPlatformStatesByPK(eservices);
  const seenExpectedPKs = new Set<string>();
  const asyncPlatformStatesByPK = new Map<
    string,
    AsyncPlatformStatesCatalogEntry
  >();
  let differencesCount = 0;

  for await (const page of platformStatesPages) {
    for (const entry of page) {
      const parsedCatalogEntry = PlatformStatesCatalogEntry.safeParse(entry);
      if (!parsedCatalogEntry.success) {
        continue;
      }

      const { PK: pk } = parsedCatalogEntry.data;
      const expected = expectedByPK.get(pk);
      const parsedAsyncEntry = AsyncPlatformStatesCatalogEntry.safeParse(
        parsedCatalogEntry.data
      );

      if (parsedAsyncEntry.success) {
        asyncPlatformStatesByPK.set(pk, parsedAsyncEntry.data);
      }

      if (expected) {
        seenExpectedPKs.add(pk);

        if (!parsedAsyncEntry.success) {
          differencesCount += logDifference({
            logger,
            message: `Missing or invalid async platform-states catalog entry ${pk}`,
            actual: parsedCatalogEntry.data,
            expected,
          });
          continue;
        }

        const comparableActual = comparableAsyncPlatformStatesEntry(
          parsedAsyncEntry.data
        );

        if (JSON.stringify(comparableActual) !== JSON.stringify(expected)) {
          differencesCount += logDifference({
            logger,
            message: `Differences in async platform-states catalog entry ${pk}`,
            actual: comparableActual,
            expected,
          });
        }
        continue;
      }

      if (parsedCatalogEntry.data.asyncExchange === true) {
        differencesCount += logDifference({
          logger,
          message: `Unexpected async platform-states catalog entry ${pk}`,
          actual: parsedCatalogEntry.data,
          expected: undefined,
        });
      }
    }
  }

  for (const [pk, expected] of expectedByPK) {
    if (!seenExpectedPKs.has(pk)) {
      differencesCount += logDifference({
        logger,
        message: `Missing or invalid async platform-states catalog entry ${pk}`,
        actual: undefined,
        expected,
      });
    }
  }

  return { differencesCount, asyncPlatformStatesByPK };
};

export const compareAsyncPlatformStates = ({
  eservices,
  platformStates,
  logger,
}: {
  eservices: EService[];
  platformStates: PlatformStatesGenericEntry[];
  logger: Logger;
}): number => {
  const { differencesCount } = compareAsyncPlatformStatesEntries({
    eservices,
    platformStates,
    logger,
  });
  return differencesCount;
};

const buildPurposeMaps = (
  purposes: Purpose[]
): {
  purposesById: Map<PurposeId, Purpose>;
} => ({
  purposesById: new Map(purposes.map((purpose) => [purpose.id, purpose])),
});

const buildAgreementMaps = (
  agreements: Agreement[]
): {
  agreementsByConsumerIdEServiceId: Map<GSIPKConsumerIdEServiceId, Agreement[]>;
} => {
  const agreementsByConsumerIdEServiceId = new Map<
    GSIPKConsumerIdEServiceId,
    Agreement[]
  >();

  for (const agreement of agreements) {
    pushMapValue(
      agreementsByConsumerIdEServiceId,
      makeGSIPKConsumerIdEServiceId({
        consumerId: agreement.consumerId,
        eserviceId: agreement.eserviceId,
      }),
      agreement
    );
  }

  return { agreementsByConsumerIdEServiceId };
};

const buildAsyncDescriptorMap = (
  eservices: EService[]
): Map<string, AsyncDescriptor> =>
  new Map(
    getAsyncDescriptors(eservices).map(({ eservice, descriptor }) => [
      makeGSIPKEServiceIdDescriptorId({
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
      }),
      { eservice, descriptor },
    ])
  );

const buildExpectedAsyncTokenGenerationStatesByPK = (
  readModelContext: ReadModelContext
): Map<string, ExpectedAsyncTokenGenerationStatesEntry> => {
  const { purposesById } = buildPurposeMaps(readModelContext.purposes);
  const { agreementsByConsumerIdEServiceId } = buildAgreementMaps(
    readModelContext.agreements
  );
  const asyncDescriptorsByEServiceDescriptor = buildAsyncDescriptorMap(
    readModelContext.eservices
  );
  const expectedByPK = new Map<
    string,
    ExpectedAsyncTokenGenerationStatesEntry
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
        const expected: ExpectedAsyncTokenGenerationStatesEntry = {
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
        };
        expectedByPK.set(expectedPK, expected);
      }
    }
  }

  return expectedByPK;
};

const comparableAsyncTokenGenerationStatesEntry = (
  entry: FullTokenGenerationStatesConsumerClient
): ExpectedAsyncTokenGenerationStatesEntry => ({
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
  expectedByPK: Map<string, ExpectedAsyncTokenGenerationStatesEntry>;
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

    if (
      parsedEntry.success &&
      parsedEntry.data.asyncExchange === true &&
      !expectedByPK.has(parsedEntry.data.PK)
    ) {
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
  expectedByPK: Map<string, ExpectedAsyncTokenGenerationStatesEntry>;
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

const compareAsyncTokenGenerationStatesPages = async ({
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

const buildExpectedProducerKeychainPlatformStatesByPK = (
  producerKeychains: ProducerKeychainReadModelEntry[]
): Map<string, ExpectedProducerKeychainPlatformStateEntry> =>
  new Map(
    producerKeychains.map((entry) => [
      makeProducerKeychainPlatformStatesPK({
        producerKeychainId: entry.producerKeychainId,
        kid: entry.kid,
        eServiceId: entry.eServiceId,
      }),
      {
        PK: makeProducerKeychainPlatformStatesPK({
          producerKeychainId: entry.producerKeychainId,
          kid: entry.kid,
          eServiceId: entry.eServiceId,
        }),
        publicKey: entry.publicKey,
        producerKeychainId: entry.producerKeychainId,
        producerId: entry.producerId,
        kid: entry.kid,
        eServiceId: entry.eServiceId,
      },
    ])
  );

const comparableProducerKeychainPlatformStateEntry = (
  entry: ProducerKeychainPlatformStateEntry
): ExpectedProducerKeychainPlatformStateEntry => ({
  PK: entry.PK,
  publicKey: entry.publicKey,
  producerKeychainId: entry.producerKeychainId,
  producerId: entry.producerId,
  kid: entry.kid,
  eServiceId: entry.eServiceId,
});

const compareProducerKeychainPlatformStateEntries = ({
  expectedByPK,
  producerKeychainPlatformStates,
  logger,
}: {
  expectedByPK: Map<string, ExpectedProducerKeychainPlatformStateEntry>;
  producerKeychainPlatformStates: Iterable<ProducerKeychainPlatformStateEntry>;
  logger: Logger;
}): { differencesCount: number; seenExpectedPKs: Set<string> } => {
  const seenExpectedPKs = new Set<string>();
  let differencesCount = 0;

  for (const entry of producerKeychainPlatformStates) {
    const expected = expectedByPK.get(entry.PK);
    if (!expected) {
      differencesCount += logDifference({
        logger,
        message: `Unexpected producer-keychain-platform-states entry ${entry.PK}`,
        actual: entry,
        expected: undefined,
      });
      continue;
    }

    seenExpectedPKs.add(entry.PK);
    const comparableActual =
      comparableProducerKeychainPlatformStateEntry(entry);

    if (JSON.stringify(comparableActual) !== JSON.stringify(expected)) {
      differencesCount += logDifference({
        logger,
        message: `Differences in producer-keychain-platform-states entry ${entry.PK}`,
        actual: comparableActual,
        expected,
      });
    }
  }

  return { differencesCount, seenExpectedPKs };
};

const countMissingExpectedProducerKeychainPlatformStates = ({
  expectedByPK,
  seenExpectedPKs,
  logger,
}: {
  expectedByPK: Map<string, ExpectedProducerKeychainPlatformStateEntry>;
  seenExpectedPKs: Set<string>;
  logger: Logger;
}): number => {
  let differencesCount = 0;

  for (const [pk, expected] of expectedByPK) {
    if (!seenExpectedPKs.has(pk)) {
      differencesCount += logDifference({
        logger,
        message: `Missing producer-keychain-platform-states entry ${pk}`,
        actual: undefined,
        expected,
      });
    }
  }

  return differencesCount;
};

export const compareProducerKeychainPlatformStates = ({
  producerKeychains,
  producerKeychainPlatformStates,
  logger,
}: {
  producerKeychains: ProducerKeychainReadModelEntry[];
  producerKeychainPlatformStates: ProducerKeychainPlatformStateEntry[];
  logger: Logger;
}): number => {
  const expectedByPK =
    buildExpectedProducerKeychainPlatformStatesByPK(producerKeychains);
  const result = compareProducerKeychainPlatformStateEntries({
    expectedByPK,
    producerKeychainPlatformStates,
    logger,
  });

  return (
    result.differencesCount +
    countMissingExpectedProducerKeychainPlatformStates({
      expectedByPK,
      seenExpectedPKs: result.seenExpectedPKs,
      logger,
    })
  );
};

const compareProducerKeychainPlatformStatesPages = async ({
  producerKeychains,
  producerKeychainPlatformStatesPages,
  logger,
}: {
  producerKeychains: ProducerKeychainReadModelEntry[];
  producerKeychainPlatformStatesPages: AsyncGenerator<
    ProducerKeychainPlatformStateEntry[],
    void,
    void
  >;
  logger: Logger;
}): Promise<number> => {
  const expectedByPK =
    buildExpectedProducerKeychainPlatformStatesByPK(producerKeychains);
  const seenExpectedPKs = new Set<string>();
  let differencesCount = 0;

  for await (const page of producerKeychainPlatformStatesPages) {
    const result = compareProducerKeychainPlatformStateEntries({
      expectedByPK,
      producerKeychainPlatformStates: page,
      logger,
    });
    differencesCount += result.differencesCount;
    for (const pk of result.seenExpectedPKs) {
      seenExpectedPKs.add(pk);
    }
  }

  return (
    differencesCount +
    countMissingExpectedProducerKeychainPlatformStates({
      expectedByPK,
      seenExpectedPKs,
      logger,
    })
  );
};

const getInteractionRequiredTimestampFields = (
  interaction: Interaction
): Array<keyof Interaction> => {
  switch (interaction.state) {
    case interactionState.startInteraction:
      return ["startInteractionTokenIssuedAt"];
    case interactionState.callbackInvocation:
      return [
        "startInteractionTokenIssuedAt",
        "callbackInvocationTokenIssuedAt",
      ];
    case interactionState.getResource:
      return [
        "startInteractionTokenIssuedAt",
        "callbackInvocationTokenIssuedAt",
      ];
    case interactionState.confirmation:
      return [
        "startInteractionTokenIssuedAt",
        "callbackInvocationTokenIssuedAt",
        "confirmationTokenIssuedAt",
      ];
  }
};

const compareInteractionEntries = ({
  rawInteractions,
  readModelContext,
  asyncPlatformStatesByPK,
  interactionTtlEpsilonSeconds,
  logger,
}: {
  rawInteractions: Iterable<unknown>;
  readModelContext: ReadModelContext;
  asyncPlatformStatesByPK: Map<string, AsyncPlatformStatesCatalogEntry>;
  interactionTtlEpsilonSeconds: number | undefined;
  logger: Logger;
}): number => {
  const { purposesById } = buildPurposeMaps(readModelContext.purposes);
  const asyncDescriptorsByEServiceDescriptor = buildAsyncDescriptorMap(
    readModelContext.eservices
  );
  const clientsById = new Map(
    readModelContext.clients.map((client) => [client.id, client])
  );

  let differencesCount = 0;

  for (const rawInteraction of rawInteractions) {
    const parsedInteraction = Interaction.safeParse(rawInteraction);
    if (!parsedInteraction.success) {
      differencesCount += logDifference({
        logger,
        message: "Unable to parse interactions entry",
        actual: rawInteraction,
        expected: "Interaction",
      });
      continue;
    }

    const interaction = parsedInteraction.data;
    const client = clientsById.get(interaction.clientId);
    const purpose = purposesById.get(interaction.purposeId);
    const asyncDescriptor = asyncDescriptorsByEServiceDescriptor.get(
      makeGSIPKEServiceIdDescriptorId({
        eserviceId: interaction.eServiceId,
        descriptorId: interaction.descriptorId,
      })
    );
    const platformEntry = asyncPlatformStatesByPK.get(
      makePlatformStatesEServiceDescriptorPK({
        eserviceId: interaction.eServiceId,
        descriptorId: interaction.descriptorId,
      })
    );

    if (!client || !client.purposes.includes(interaction.purposeId)) {
      differencesCount += logDifference({
        logger,
        message: `Interaction ${interaction.PK} references an unknown or incoherent client`,
        actual: interaction.clientId,
        expected: `client with purpose ${interaction.purposeId}`,
      });
    }

    if (
      !purpose ||
      purpose.consumerId !== interaction.consumerId ||
      purpose.eserviceId !== interaction.eServiceId
    ) {
      differencesCount += logDifference({
        logger,
        message: `Interaction ${interaction.PK} references an unknown or incoherent purpose`,
        actual: purpose,
        expected: {
          purposeId: interaction.purposeId,
          consumerId: interaction.consumerId,
          eServiceId: interaction.eServiceId,
        },
      });
    }

    if (!asyncDescriptor) {
      differencesCount += logDifference({
        logger,
        message: `Interaction ${interaction.PK} references a non-async descriptor`,
        actual: {
          eServiceId: interaction.eServiceId,
          descriptorId: interaction.descriptorId,
        },
        expected: "async descriptor in readmodel SQL",
      });
    }

    if (!platformEntry) {
      differencesCount += logDifference({
        logger,
        message: `Interaction ${interaction.PK} references a descriptor missing from async platform-states`,
        actual: {
          eServiceId: interaction.eServiceId,
          descriptorId: interaction.descriptorId,
        },
        expected: "async platform-states catalog entry",
      });
    }

    for (const field of getInteractionRequiredTimestampFields(interaction)) {
      if (!interaction[field]) {
        differencesCount += logDifference({
          logger,
          message: `Interaction ${interaction.PK} is missing timestamp ${String(
            field
          )}`,
          actual: interaction,
          expected: `${String(field)} valued`,
        });
      }
    }

    if (interaction.ttl <= 0) {
      differencesCount += logDifference({
        logger,
        message: `Interaction ${interaction.PK} has invalid ttl`,
        actual: interaction.ttl,
        expected: "positive ttl",
      });
    }

    if (
      interactionTtlEpsilonSeconds !== undefined &&
      interaction.startInteractionTokenIssuedAt &&
      asyncDescriptor?.descriptor.asyncExchangeProperties
    ) {
      const expectedTtl =
        dateToSeconds(new Date(interaction.startInteractionTokenIssuedAt)) +
        asyncDescriptor.descriptor.asyncExchangeProperties.responseTime +
        asyncDescriptor.descriptor.asyncExchangeProperties
          .resourceAvailableTime +
        interactionTtlEpsilonSeconds;

      if (interaction.ttl !== expectedTtl) {
        differencesCount += logDifference({
          logger,
          message: `Interaction ${interaction.PK} has incoherent ttl`,
          actual: interaction.ttl,
          expected: expectedTtl,
        });
      }
    }
  }

  return differencesCount;
};

export const compareInteractions = ({
  rawInteractions,
  readModelContext,
  platformStates,
  interactionTtlEpsilonSeconds,
  logger,
}: {
  rawInteractions: unknown[];
  readModelContext: ReadModelContext;
  platformStates: PlatformStatesGenericEntry[];
  interactionTtlEpsilonSeconds: number | undefined;
  logger: Logger;
}): number => {
  const asyncPlatformStatesByPK = new Map(
    platformStates.flatMap((entry) => {
      const parsedEntry = AsyncPlatformStatesCatalogEntry.safeParse(entry);
      return parsedEntry.success
        ? [[parsedEntry.data.PK, parsedEntry.data]]
        : [];
    })
  );

  return compareInteractionEntries({
    rawInteractions,
    readModelContext,
    asyncPlatformStatesByPK,
    interactionTtlEpsilonSeconds,
    logger,
  });
};

const compareInteractionsPages = async ({
  rawInteractionsPages,
  readModelContext,
  asyncPlatformStatesByPK,
  interactionTtlEpsilonSeconds,
  logger,
}: {
  rawInteractionsPages: AsyncGenerator<unknown[], void, void>;
  readModelContext: ReadModelContext;
  asyncPlatformStatesByPK: Map<string, AsyncPlatformStatesCatalogEntry>;
  interactionTtlEpsilonSeconds: number | undefined;
  logger: Logger;
}): Promise<number> => {
  let differencesCount = 0;

  for await (const page of rawInteractionsPages) {
    differencesCount += compareInteractionEntries({
      rawInteractions: page,
      readModelContext,
      asyncPlatformStatesByPK,
      interactionTtlEpsilonSeconds,
      logger,
    });
  }

  return differencesCount;
};

export const compareAsyncTokenGenerationReadModel = async ({
  asyncTokenGenerationReadModelService,
  readModelService,
  logger,
  interactionTtlEpsilonSeconds,
}: {
  asyncTokenGenerationReadModelService: AsyncTokenGenerationReadModelService;
  readModelService: ReadModelServiceSQL;
  logger: Logger;
  interactionTtlEpsilonSeconds: number | undefined;
}): Promise<number> => {
  const readModelContext = await collectReadModelContext(readModelService);
  const asyncPlatformStatesComparison = await compareAsyncPlatformStatesPages({
    eservices: readModelContext.eservices,
    platformStatesPages:
      asyncTokenGenerationReadModelService.readPlatformStatesItemsPages(),
    logger,
  });

  return (
    asyncPlatformStatesComparison.differencesCount +
    (await compareAsyncTokenGenerationStatesPages({
      readModelContext,
      tokenGenerationStatesPages:
        asyncTokenGenerationReadModelService.readTokenGenerationStatesItemsPages(),
      logger,
    })) +
    (await compareProducerKeychainPlatformStatesPages({
      producerKeychains: readModelContext.producerKeychains,
      producerKeychainPlatformStatesPages:
        asyncTokenGenerationReadModelService.readProducerKeychainPlatformStatesItemsPages(),
      logger,
    })) +
    (await compareInteractionsPages({
      rawInteractionsPages:
        asyncTokenGenerationReadModelService.readInteractionsItemsPages(),
      readModelContext,
      asyncPlatformStatesByPK:
        asyncPlatformStatesComparison.asyncPlatformStatesByPK,
      interactionTtlEpsilonSeconds,
      logger,
    }))
  );
};

export const unsafeTenantId = (id: string): TenantId =>
  unsafeBrandId<TenantId>(id);

export const unsafeEServiceId = (id: string): EServiceId =>
  unsafeBrandId<EServiceId>(id);

export const unsafeDescriptorId = (id: string): DescriptorId =>
  unsafeBrandId<DescriptorId>(id);

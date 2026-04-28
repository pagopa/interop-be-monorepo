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
  descriptor: Descriptor;
};

type ReadModelContext = {
  eservices: EService[];
  purposes: Purpose[];
  agreements: Agreement[];
  clients: Client[];
  producerKeychains: ProducerKeychainReadModelEntry[];
};

type DynamoContext = {
  platformStates: PlatformStatesGenericEntry[];
  tokenGenerationStates: TokenGenerationStatesGenericClient[];
  producerKeychainPlatformStates: ProducerKeychainPlatformStateEntry[];
  rawInteractions: unknown[];
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
            (descriptor) =>
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

const collectDynamoContext = async (
  asyncTokenGenerationReadModelService: AsyncTokenGenerationReadModelService
): Promise<DynamoContext> => {
  const platformStates = new Array<PlatformStatesGenericEntry>();
  for await (const page of asyncTokenGenerationReadModelService.readPlatformStatesItemsPages()) {
    platformStates.push(...page);
  }

  const tokenGenerationStates = new Array<TokenGenerationStatesGenericClient>();
  for await (const page of asyncTokenGenerationReadModelService.readTokenGenerationStatesItemsPages()) {
    tokenGenerationStates.push(...page);
  }

  const producerKeychainPlatformStates =
    new Array<ProducerKeychainPlatformStateEntry>();
  for await (const page of asyncTokenGenerationReadModelService.readProducerKeychainPlatformStatesItemsPages()) {
    producerKeychainPlatformStates.push(...page);
  }

  const rawInteractions = new Array<unknown>();
  for await (const page of asyncTokenGenerationReadModelService.readInteractionsItemsPages()) {
    rawInteractions.push(...page);
  }

  return {
    platformStates,
    tokenGenerationStates,
    producerKeychainPlatformStates,
    rawInteractions,
  };
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

export const compareAsyncPlatformStates = ({
  eservices,
  platformStates,
  logger,
}: {
  eservices: EService[];
  platformStates: PlatformStatesGenericEntry[];
  logger: Logger;
}): number => {
  const platformCatalogEntriesByPK = new Map(
    platformStates.flatMap((entry) => {
      const parsedEntry = PlatformStatesCatalogEntry.safeParse(entry);
      return parsedEntry.success
        ? [[parsedEntry.data.PK, parsedEntry.data]]
        : [];
    })
  );

  const expectedByPK = new Map(
    getAsyncDescriptors(eservices).map(({ eservice, descriptor }) => [
      makePlatformStatesEServiceDescriptorPK({
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
      }),
      {
        PK: makePlatformStatesEServiceDescriptorPK({
          eserviceId: eservice.id,
          descriptorId: descriptor.id,
        }),
        state: descriptorItemState(descriptor),
        descriptorAudience: descriptor.audience,
        descriptorVoucherLifespan: descriptor.voucherLifespan,
        asyncExchange: true,
        asyncExchangeProperties: descriptor.asyncExchangeProperties,
      },
    ])
  );

  let differencesCount = 0;

  for (const [pk, expected] of expectedByPK) {
    const actual = platformCatalogEntriesByPK.get(pk);
    const parsedActual = actual
      ? AsyncPlatformStatesCatalogEntry.safeParse(actual)
      : undefined;

    if (!parsedActual?.success) {
      differencesCount += logDifference({
        logger,
        message: `Missing or invalid async platform-states catalog entry ${pk}`,
        actual,
        expected,
      });
      continue;
    }

    const comparableActual = {
      PK: parsedActual.data.PK,
      state: parsedActual.data.state,
      descriptorAudience: parsedActual.data.descriptorAudience,
      descriptorVoucherLifespan: parsedActual.data.descriptorVoucherLifespan,
      asyncExchange: parsedActual.data.asyncExchange,
      asyncExchangeProperties: parsedActual.data.asyncExchangeProperties,
    };

    if (JSON.stringify(comparableActual) !== JSON.stringify(expected)) {
      differencesCount += logDifference({
        logger,
        message: `Differences in async platform-states catalog entry ${pk}`,
        actual: comparableActual,
        expected,
      });
    }
  }

  for (const [pk, entry] of platformCatalogEntriesByPK) {
    if (entry.asyncExchange === true && !expectedByPK.has(pk)) {
      differencesCount += logDifference({
        logger,
        message: `Unexpected async platform-states catalog entry ${pk}`,
        actual: entry,
        expected: undefined,
      });
    }
  }

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

export const compareAsyncTokenGenerationStates = ({
  readModelContext,
  tokenGenerationStates,
  logger,
}: {
  readModelContext: ReadModelContext;
  tokenGenerationStates: TokenGenerationStatesGenericClient[];
  logger: Logger;
}): number => {
  const { purposesById } = buildPurposeMaps(readModelContext.purposes);
  const { agreementsByConsumerIdEServiceId } = buildAgreementMaps(
    readModelContext.agreements
  );
  const asyncDescriptorsByEServiceDescriptor = buildAsyncDescriptorMap(
    readModelContext.eservices
  );
  const tokenGenerationStatesByPK = new Map(
    tokenGenerationStates.map((entry) => [entry.PK, entry])
  );
  const expectedPKs = new Set<string>();

  let differencesCount = 0;

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
        const expected = {
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
        expectedPKs.add(expectedPK);

        const actual = tokenGenerationStatesByPK.get(expectedPK);
        const parsedActual = actual
          ? FullTokenGenerationStatesConsumerClient.safeParse(actual)
          : undefined;

        if (!parsedActual?.success) {
          differencesCount += logDifference({
            logger,
            message: `Missing or invalid async token-generation-states entry ${expectedPK}`,
            actual,
            expected,
          });
          continue;
        }

        const comparableActual = {
          PK: parsedActual.data.PK,
          clientKind: parsedActual.data.clientKind,
          publicKey: parsedActual.data.publicKey,
          consumerId: parsedActual.data.consumerId,
          producerId: parsedActual.data.producerId,
          agreementId: parsedActual.data.agreementId,
          agreementState: parsedActual.data.agreementState,
          purposeState: parsedActual.data.purposeState,
          purposeVersionId: parsedActual.data.purposeVersionId,
          descriptorState: parsedActual.data.descriptorState,
          descriptorAudience: parsedActual.data.descriptorAudience,
          descriptorVoucherLifespan:
            parsedActual.data.descriptorVoucherLifespan,
          asyncExchange: parsedActual.data.asyncExchange,
          GSIPK_clientId: parsedActual.data.GSIPK_clientId,
          GSIPK_clientId_kid: parsedActual.data.GSIPK_clientId_kid,
          GSIPK_clientId_purposeId: parsedActual.data.GSIPK_clientId_purposeId,
          GSIPK_purposeId: parsedActual.data.GSIPK_purposeId,
          GSIPK_consumerId_eserviceId:
            parsedActual.data.GSIPK_consumerId_eserviceId,
          GSIPK_eserviceId_descriptorId:
            parsedActual.data.GSIPK_eserviceId_descriptorId,
        };

        if (JSON.stringify(comparableActual) !== JSON.stringify(expected)) {
          differencesCount += logDifference({
            logger,
            message: `Differences in async token-generation-states entry ${expectedPK}`,
            actual: comparableActual,
            expected,
          });
        }
      }
    }
  }

  for (const entry of tokenGenerationStates) {
    const parsedEntry =
      FullTokenGenerationStatesConsumerClient.safeParse(entry);
    if (
      parsedEntry.success &&
      parsedEntry.data.asyncExchange === true &&
      !expectedPKs.has(parsedEntry.data.PK)
    ) {
      differencesCount += logDifference({
        logger,
        message: `Unexpected async token-generation-states entry ${parsedEntry.data.PK}`,
        actual: parsedEntry.data,
        expected: undefined,
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
  const producerKeychainEntriesByPK = new Map(
    producerKeychainPlatformStates.map((entry) => [entry.PK, entry])
  );
  const expectedByPK = new Map(
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

  let differencesCount = 0;

  for (const [pk, expected] of expectedByPK) {
    const actual = producerKeychainEntriesByPK.get(pk);
    if (!actual) {
      differencesCount += logDifference({
        logger,
        message: `Missing producer-keychain-platform-states entry ${pk}`,
        actual,
        expected,
      });
      continue;
    }

    const comparableActual = {
      PK: actual.PK,
      publicKey: actual.publicKey,
      producerKeychainId: actual.producerKeychainId,
      producerId: actual.producerId,
      kid: actual.kid,
      eServiceId: actual.eServiceId,
    };

    if (JSON.stringify(comparableActual) !== JSON.stringify(expected)) {
      differencesCount += logDifference({
        logger,
        message: `Differences in producer-keychain-platform-states entry ${pk}`,
        actual: comparableActual,
        expected,
      });
    }
  }

  for (const [pk, entry] of producerKeychainEntriesByPK) {
    if (!expectedByPK.has(pk)) {
      differencesCount += logDifference({
        logger,
        message: `Unexpected producer-keychain-platform-states entry ${pk}`,
        actual: entry,
        expected: undefined,
      });
    }
  }

  return differencesCount;
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
  const { purposesById } = buildPurposeMaps(readModelContext.purposes);
  const asyncDescriptorsByEServiceDescriptor = buildAsyncDescriptorMap(
    readModelContext.eservices
  );
  const clientsById = new Map(
    readModelContext.clients.map((client) => [client.id, client])
  );
  const asyncPlatformStatesByPK = new Map(
    platformStates.flatMap((entry) => {
      const parsedEntry = AsyncPlatformStatesCatalogEntry.safeParse(entry);
      return parsedEntry.success
        ? [[parsedEntry.data.PK, parsedEntry.data]]
        : [];
    })
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
  const [readModelContext, dynamoContext] = await Promise.all([
    collectReadModelContext(readModelService),
    collectDynamoContext(asyncTokenGenerationReadModelService),
  ]);

  return (
    compareAsyncPlatformStates({
      eservices: readModelContext.eservices,
      platformStates: dynamoContext.platformStates,
      logger,
    }) +
    compareAsyncTokenGenerationStates({
      readModelContext,
      tokenGenerationStates: dynamoContext.tokenGenerationStates,
      logger,
    }) +
    compareProducerKeychainPlatformStates({
      producerKeychains: readModelContext.producerKeychains,
      producerKeychainPlatformStates:
        dynamoContext.producerKeychainPlatformStates,
      logger,
    }) +
    compareInteractions({
      rawInteractions: dynamoContext.rawInteractions,
      readModelContext,
      platformStates: dynamoContext.platformStates,
      interactionTtlEpsilonSeconds,
      logger,
    })
  );
};

export const unsafeTenantId = (id: string): TenantId =>
  unsafeBrandId<TenantId>(id);

export const unsafeEServiceId = (id: string): EServiceId =>
  unsafeBrandId<EServiceId>(id);

export const unsafeDescriptorId = (id: string): DescriptorId =>
  unsafeBrandId<DescriptorId>(id);

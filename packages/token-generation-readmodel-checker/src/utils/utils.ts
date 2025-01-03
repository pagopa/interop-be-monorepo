import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { Logger, ReadModelRepository } from "pagopa-interop-commons";
import {
  Agreement,
  AgreementId,
  agreementState,
  AgreementState,
  Client,
  ClientId,
  clientKind,
  ClientKind,
  ClientKindTokenGenStates,
  clientKindTokenGenStates,
  Descriptor,
  DescriptorId,
  DescriptorState,
  descriptorState,
  EService,
  EServiceId,
  genericInternalError,
  GSIPKConsumerIdEServiceId,
  itemState,
  ItemState,
  makeGSIPKClientIdPurposeId,
  makeGSIPKConsumerIdEServiceId,
  makeGSIPKEServiceIdDescriptorId,
  makePlatformStatesAgreementPK,
  makePlatformStatesEServiceDescriptorPK,
  makePlatformStatesPurposePK,
  PlatformStatesAgreementEntry,
  PlatformStatesAgreementPK,
  PlatformStatesCatalogEntry,
  PlatformStatesClientEntry,
  PlatformStatesClientPK,
  PlatformStatesEServiceDescriptorPK,
  PlatformStatesPurposeEntry,
  PlatformStatesPurposePK,
  Purpose,
  PurposeId,
  PurposeVersion,
  purposeVersionState,
  TokenGenerationStatesClientKidPK,
  TokenGenerationStatesClientKidPurposePK,
  TokenGenerationStatesGenericClient,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { diff } from "json-diff";
import { config } from "../configs/config.js";
import {
  ClientDifferencesResult,
  ComparisonClient,
  ComparisonPlatformStatesAgreementEntry,
  ComparisonPlatformStatesCatalogEntry,
  ComparisonPlatformStatesClientEntry,
  ComparisonPlatformStatesPurposeEntry,
  ComparisonTokenGenStatesGenericClient,
} from "../models/types.js";
import { readModelServiceBuilder } from "../services/readModelService.js";
import { tokenGenerationReadModelServiceBuilder } from "../services/tokenGenerationReadModelService.js";

export function getLastPurposeVersion(
  purposeVersions: PurposeVersion[]
): PurposeVersion {
  return purposeVersions
    .filter(
      (pv) =>
        pv.state === purposeVersionState.active ||
        pv.state === purposeVersionState.suspended ||
        pv.state === purposeVersionState.archived
    )
    .toSorted(
      (purposeVersion1, purposeVersion2) =>
        purposeVersion2.createdAt.getTime() -
        purposeVersion1.createdAt.getTime()
    )[0];
}

export function getLastAgreement(agreements: Agreement[]): Agreement {
  return agreements
    .filter(
      (a) =>
        a.state === agreementState.active ||
        a.state === agreementState.suspended
    )
    .toSorted(
      (agreement1, agreement2) =>
        agreement2.createdAt.getTime() - agreement1.createdAt.getTime()
    )[0];
}

export function getValidDescriptors(descriptors: Descriptor[]): Descriptor[] {
  return descriptors.filter(
    (descriptor) =>
      descriptor.state === descriptorState.published ||
      descriptor.state === descriptorState.suspended ||
      descriptor.state === descriptorState.deprecated
  );
}

function getIdFromPlatformStatesPK<
  T extends PurposeId | AgreementId | ClientId
>(
  pk:
    | PlatformStatesPurposePK
    | PlatformStatesAgreementPK
    | PlatformStatesClientPK
): T {
  return unsafeBrandId<T>(pk.split("#")[1]);
}

function getCatalogIdsFromPlatformStatesPK(
  pk: PlatformStatesEServiceDescriptorPK
): {
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
} {
  const splitPK = pk.split("#");
  return {
    eserviceId: unsafeBrandId<EServiceId>(splitPK[1]),
    descriptorId: unsafeBrandId<DescriptorId>(splitPK[2]),
  };
}

function getClientIdFromTokenGenStatesPK(
  pk: TokenGenerationStatesClientKidPurposePK | TokenGenerationStatesClientKidPK
): ClientId {
  const splitPK = pk.split("#");
  return unsafeBrandId<ClientId>(splitPK[1]);
}

function getKidFromTokenGenStatesPK(
  pk: TokenGenerationStatesClientKidPurposePK | TokenGenerationStatesClientKidPK
): string {
  const splitPK = pk.split("#");
  return unsafeBrandId<ClientId>(splitPK[2]);
}

function getPurposeIdFromTokenGenStatesPK(
  pk: TokenGenerationStatesClientKidPurposePK | TokenGenerationStatesClientKidPK
): PurposeId | undefined {
  const splitPK = pk.split("#");
  return unsafeBrandId<PurposeId>(splitPK[3]);
}

export async function compareTokenGenerationReadModel(
  dynamoDBClient: DynamoDBClient,
  logger: Logger
): Promise<number> {
  logger.info(
    "Token generation read model and read model comparison started.\n"
  );
  logger.info("> Connecting to database...");
  const readModel = ReadModelRepository.init(config);
  const readModelService = readModelServiceBuilder(readModel);
  logger.info("> Connected to database!\n");

  const tokenGenerationService =
    tokenGenerationReadModelServiceBuilder(dynamoDBClient);
  const platformStatesEntries =
    await tokenGenerationService.readAllPlatformStatesItems();
  const tokenGenerationStatesEntries =
    await tokenGenerationService.readAllTokenGenerationStatesItems();

  const tokenGenStatesByClient = tokenGenerationStatesEntries.reduce(
    (acc: Map<ClientId, TokenGenerationStatesGenericClient[]>, entry) => {
      const clientId = getClientIdFromTokenGenStatesPK(entry.PK);
      acc.set(clientId, [...(acc.get(clientId) || []), entry]);
      return acc;
    },
    new Map<ClientId, TokenGenerationStatesGenericClient[]>()
  );

  const platformStates: {
    purposes: Map<PurposeId, PlatformStatesPurposeEntry>;
    agreements: Map<AgreementId, PlatformStatesAgreementEntry>;
    eservices: Map<EServiceId, Map<DescriptorId, PlatformStatesCatalogEntry>>;
    clients: Map<ClientId, PlatformStatesClientEntry>;
  } = platformStatesEntries.reduce<{
    purposes: Map<PurposeId, PlatformStatesPurposeEntry>;
    agreements: Map<AgreementId, PlatformStatesAgreementEntry>;
    eservices: Map<EServiceId, Map<DescriptorId, PlatformStatesCatalogEntry>>;
    clients: Map<ClientId, PlatformStatesClientEntry>;
  }>(
    (acc, e) => {
      const parsedPurpose = PlatformStatesPurposeEntry.safeParse(e);
      if (parsedPurpose.success) {
        acc.purposes.set(
          unsafeBrandId<PurposeId>(
            getIdFromPlatformStatesPK(parsedPurpose.data.PK)
          ),
          parsedPurpose.data
        );
        return acc;
      }

      const parsedAgreement = PlatformStatesAgreementEntry.safeParse(e);
      if (parsedAgreement.success) {
        acc.agreements.set(
          unsafeBrandId<AgreementId>(
            getIdFromPlatformStatesPK(parsedAgreement.data.PK)
          ),
          parsedAgreement.data
        );
        return acc;
      }

      const parsedCatalog = PlatformStatesCatalogEntry.safeParse(e);
      if (parsedCatalog.success) {
        const catalogIds = getCatalogIdsFromPlatformStatesPK(
          parsedCatalog.data.PK
        );

        acc.eservices.set(
          catalogIds.eserviceId,
          (
            acc.eservices.get(catalogIds.eserviceId) ??
            new Map<DescriptorId, PlatformStatesCatalogEntry>()
          ).set(catalogIds.descriptorId, parsedCatalog.data)
        );

        return acc;
      }

      const parsedClient = PlatformStatesClientEntry.safeParse(e);
      if (parsedClient.success) {
        acc.clients.set(
          unsafeBrandId<ClientId>(
            getIdFromPlatformStatesPK(parsedClient.data.PK)
          ),
          parsedClient.data
        );
        return acc;
      }

      throw genericInternalError(
        `Unknown platform-states type for entry: ${JSON.stringify(e)} `
      );
    },
    {
      purposes: new Map<PurposeId, PlatformStatesPurposeEntry>(),
      agreements: new Map<AgreementId, PlatformStatesAgreementEntry>(),
      eservices: new Map<
        EServiceId,
        Map<DescriptorId, PlatformStatesCatalogEntry>
      >(),
      clients: new Map<ClientId, PlatformStatesClientEntry>(),
    }
  );

  const purposes = await readModelService.getAllReadModelPurposes();
  const purposesById = new Map(
    purposes.map((purpose) => [purpose.id, purpose])
  );

  const agreements = await readModelService.getAllReadModelAgreements();
  const agreementsById = new Map<AgreementId, Agreement>();
  const agreementsByConsumerIdEserviceId = new Map<
    GSIPKConsumerIdEServiceId,
    Agreement[]
  >();

  for (const agreement of agreements) {
    agreementsById.set(agreement.id, agreement);

    const consumerIdEServiceId = makeGSIPKConsumerIdEServiceId({
      consumerId: agreement.consumerId,
      eserviceId: agreement.eserviceId,
    });
    const existingAgreements =
      agreementsByConsumerIdEserviceId.get(consumerIdEServiceId);

    agreementsByConsumerIdEserviceId.set(consumerIdEServiceId, [
      ...(existingAgreements || []),
      agreement,
    ]);
  }

  const eservices = await readModelService.getAllReadModelEServices();
  const eservicesById = new Map<EServiceId, EService>();
  for (const eservice of eservices) {
    eservicesById.set(eservice.id, eservice);
  }

  const clients = await readModelService.getAllReadModelClients();
  const clientsById = new Map<ClientId, Client>(
    clients.map((client) => [unsafeBrandId<ClientId>(client.id), client])
  );

  const purposeDifferences = await compareReadModelPurposesWithPlatformStates({
    platformStatesPurposeById: platformStates.purposes,
    purposesById,
    logger,
  });
  const agreementDifferences =
    await compareReadModelAgreementsWithPlatformStates({
      platformStatesAgreementById: platformStates.agreements,
      agreementsById,
      logger,
    });
  const catalogDifferences = await compareReadModelEServicesWithPlatformStates({
    platformStatesEServiceById: platformStates.eservices,
    eservicesById,
    logger,
  });
  const clientAndTokenGenStatesDifferences =
    await compareReadModelClientsAndTokenGenStates({
      platformStatesClientById: platformStates.clients,
      tokenGenStatesByClient,
      clientsById,
      purposesById,
      eservicesById,
      agreementsByConsumerIdEserviceId,
      logger,
    });

  return (
    purposeDifferences +
    agreementDifferences +
    catalogDifferences +
    clientAndTokenGenStatesDifferences.length
  );
}

// purposes
export async function compareReadModelPurposesWithPlatformStates({
  platformStatesPurposeById,
  purposesById,
  logger,
}: {
  platformStatesPurposeById: Map<PurposeId, PlatformStatesPurposeEntry>;
  purposesById: Map<PurposeId, Purpose>;
  logger: Logger;
}): Promise<number> {
  const allIds = new Set([
    ...platformStatesPurposeById.keys(),
    ...purposesById.keys(),
  ]);

  // eslint-disable-next-line functional/no-let
  let differencesCount = 0;
  for (const id of allIds) {
    const platformStatesEntry = platformStatesPurposeById.get(id);
    const purpose = purposesById.get(id);

    if (!platformStatesEntry && !purpose) {
      throw genericInternalError(
        `Purpose and platform-states entry not found for id: ${id}`
      );
    }

    if (platformStatesEntry && !purpose) {
      logger.error(`Read model purpose not found for id: ${id}`);
      differencesCount++;
    }

    if (!platformStatesEntry && purpose) {
      const lastPurposeVersion = getLastPurposeVersion(purpose.versions);
      const isArchived =
        lastPurposeVersion.state === purposeVersionState.archived;
      if (!isArchived) {
        logger.error(
          `Purpose platform-states entry is missing for purpose with id: ${purpose.id}`
        );
        differencesCount++;
      }
    }

    if (platformStatesEntry && purpose) {
      const expectedPlatformStatesPurposeEntry: ComparisonPlatformStatesPurposeEntry =
        {
          PK: makePlatformStatesPurposePK(purpose.id),
          state: getPurposeStateFromPurposeVersions(purpose.versions),
          purposeVersionId: getLastPurposeVersion(purpose.versions).id,
          purposeEserviceId: purpose.eserviceId,
          purposeConsumerId: purpose.consumerId,
        };

      const objectsDiff = diff(
        ComparisonPlatformStatesPurposeEntry.parse(platformStatesEntry),
        expectedPlatformStatesPurposeEntry,
        { sort: true }
      );
      if (objectsDiff) {
        differencesCount++;
        // For info: __old = platform-states entry and __new = read model agreement
        logger.error(`Differences in purpose with id ${purpose.id}`);
        logger.error(JSON.stringify(objectsDiff, null, 2));
      }
    }
  }

  return differencesCount;
}

// agreements
export async function compareReadModelAgreementsWithPlatformStates({
  platformStatesAgreementById,
  agreementsById,
  logger,
}: {
  platformStatesAgreementById: Map<AgreementId, PlatformStatesAgreementEntry>;
  agreementsById: Map<AgreementId, Agreement>;
  logger: Logger;
}): Promise<number> {
  const allIds = new Set([
    ...platformStatesAgreementById.keys(),
    ...agreementsById.keys(),
  ]);

  // eslint-disable-next-line functional/no-let
  let differencesCount = 0;
  for (const id of allIds) {
    const platformStatesEntry = platformStatesAgreementById.get(id);
    const agreement = agreementsById.get(id);

    if (!platformStatesEntry && !agreement) {
      throw genericInternalError(
        `Agreement and platform-states entry not found for id: ${id}`
      );
    }

    if (platformStatesEntry && !agreement) {
      logger.error(`Read model agreement not found for id: ${id}`);
      differencesCount++;
    }

    if (
      !platformStatesEntry &&
      agreement &&
      (agreement.state === agreementState.active ||
        agreement.state === agreementState.suspended)
    ) {
      logger.error(`platform-states agreement not found for id: ${id}`);
      differencesCount++;
    }

    if (platformStatesEntry && agreement) {
      const expectedPlatformStatesAgreementEntry: ComparisonPlatformStatesAgreementEntry =
        {
          PK: makePlatformStatesAgreementPK(agreement.id),
          state: agreementStateToItemState(agreement.state),
          GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
            consumerId: agreement.consumerId,
            eserviceId: agreement.eserviceId,
          }),
          GSISK_agreementTimestamp:
            agreement.stamps.activation?.when.toISOString() ||
            agreement.createdAt.toISOString(),
          agreementDescriptorId: agreement.descriptorId,
        };

      const objectsDiff = diff(
        ComparisonPlatformStatesAgreementEntry.parse(platformStatesEntry),
        expectedPlatformStatesAgreementEntry,
        { sort: true }
      );
      if (objectsDiff) {
        differencesCount++;
        // For info: __old = platform-states entry and __new = read model agreement
        logger.error(`Differences in agreement with id ${agreement.id}`);
        logger.error(JSON.stringify(objectsDiff, null, 2));
      }
    }
  }
  return differencesCount;
}

// eservices
// eslint-disable-next-line sonarjs/cognitive-complexity
export async function compareReadModelEServicesWithPlatformStates({
  platformStatesEServiceById,
  eservicesById,
  logger,
}: {
  platformStatesEServiceById: Map<
    EServiceId,
    Map<DescriptorId, PlatformStatesCatalogEntry>
  >;
  eservicesById: Map<EServiceId, EService>;
  logger: Logger;
}): Promise<number> {
  const allIds = new Set([
    ...platformStatesEServiceById.keys(),
    ...eservicesById.keys(),
  ]);

  // eslint-disable-next-line functional/no-let
  let differencesCount = 0;
  for (const id of allIds) {
    const eservice = eservicesById.get(id);

    if (
      !eservice?.descriptors.some(
        (d) =>
          d.state === descriptorState.deprecated ||
          d.state === descriptorState.published ||
          d.state === descriptorState.suspended
      )
    ) {
      continue;
    }

    const platformStatesEntries = platformStatesEServiceById.get(id);

    // TODO
    if (!eservice) {
      throw genericInternalError("");
    }

    const expectedMap = new Map<
      DescriptorId,
      ComparisonPlatformStatesCatalogEntry
    >();

    eservice.descriptors.forEach((descriptor) => {
      expectedMap.set(descriptor.id, {
        PK: makePlatformStatesEServiceDescriptorPK({
          eserviceId: eservice.id,
          descriptorId: descriptor.id,
        }),
        state: descriptorStateToItemState(descriptor.state),
        descriptorAudience: descriptor.audience,
        descriptorVoucherLifespan: descriptor.voucherLifespan,
      });
    });
    const allDescriptorIds = new Set([
      ...expectedMap.keys(),
      // TODO
      ...platformStatesEntries!.keys(),
    ]);

    for (const descriptorId of allDescriptorIds) {
      const readModelEntry = expectedMap.get(descriptorId);
      const platformStatesEntry = platformStatesEntries!.get(descriptorId);

      if (!platformStatesEntry && !readModelEntry) {
        throw genericInternalError(
          `E-Service and platform-states entry not found for id: ${id}`
        );
      }

      if (platformStatesEntry && !readModelEntry) {
        logger.error(`Read model e-service not found for id: ${id}`);
        differencesCount++;
      }

      if (platformStatesEntry && readModelEntry) {
        const objectsDiff = diff(
          ComparisonPlatformStatesCatalogEntry.parse(platformStatesEntry),
          readModelEntry,
          { sort: true }
        );
        if (objectsDiff) {
          differencesCount++;
          // For info: __old = platform-states entry and __new = read model e-service
          logger.error(`Differences in e-service with id ${eservice.id}`);
          logger.error(JSON.stringify(objectsDiff, null, 2));
        }
      }
    }
  }
  return differencesCount;
}

// clients
export async function compareReadModelClientsAndTokenGenStates({
  platformStatesClientById,
  tokenGenStatesByClient,
  clientsById,
  purposesById,
  eservicesById,
  agreementsByConsumerIdEserviceId,
  logger,
}: {
  platformStatesClientById: Map<ClientId, PlatformStatesClientEntry>;
  tokenGenStatesByClient: Map<ClientId, TokenGenerationStatesGenericClient[]>;
  clientsById: Map<ClientId, Client>;
  purposesById: Map<PurposeId, Purpose>;
  eservicesById: Map<EServiceId, EService>;
  agreementsByConsumerIdEserviceId: Map<GSIPKConsumerIdEServiceId, Agreement[]>;
  logger: Logger;
}): Promise<ClientDifferencesResult> {
  const allIds = new Set([
    ...platformStatesClientById.keys(),
    ...tokenGenStatesByClient.keys(),
    ...clientsById.keys(),
  ]);

  return Array.from(allIds).reduce<ClientDifferencesResult>((acc, id) => {
    const platformStatesEntry = platformStatesClientById.get(id);
    const tokenGenStatesEntries = tokenGenStatesByClient.get(id);
    const client = clientsById.get(id);

    if (!platformStatesEntry && !tokenGenStatesEntries && !client) {
      throw genericInternalError(
        `Client, platform-states entry and token-generation states entries not found for id: ${id}`
      );
    }

    if (!client) {
      logger.error(`Read model client not found for id: ${id}`);

      return [
        ...acc,
        [
          platformStatesEntry
            ? ComparisonPlatformStatesClientEntry.parse(platformStatesEntry)
            : undefined,
          tokenGenStatesEntries && tokenGenStatesEntries.length > 0
            ? ComparisonTokenGenStatesGenericClient.array().parse(
                tokenGenStatesEntries
              )
            : undefined,
          client,
        ],
      ];
    }

    const {
      isPlatformStatesClientCorrect: isPlatformStatesCorrect,
      data: platformClientEntryDiff,
    } = validateClientPlatformStates({
      platformClientEntry: platformStatesEntry,
      client,
      logger,
    });

    const {
      isTokenGenerationStatesClientCorrect: isTokenGenerationStatesCorrect,
      data: tokenGenStatesDiff,
    } = validateTokenGenerationStates({
      tokenGenStatesEntries,
      client,
      purposesById,
      eservicesById,
      agreementsByConsumerIdEserviceId,
      logger,
    });

    if (!isPlatformStatesCorrect || !isTokenGenerationStatesCorrect) {
      const clientDifferencesEntry: [
        ComparisonPlatformStatesClientEntry | undefined,
        ComparisonTokenGenStatesGenericClient[] | undefined,
        ComparisonClient | undefined
      ] = [
        platformClientEntryDiff,
        tokenGenStatesDiff,
        ComparisonClient.parse(client),
      ];
      return [...acc, clientDifferencesEntry];
    }

    return acc;
  }, []);
}

function validateClientPlatformStates({
  platformClientEntry: platformStatesClientEntry,
  client,
  logger,
}: {
  platformClientEntry: PlatformStatesClientEntry | undefined;
  client: Client;
  logger: Logger;
}): {
  isPlatformStatesClientCorrect: boolean;
  data: ComparisonPlatformStatesClientEntry | undefined;
} {
  if (!platformStatesClientEntry) {
    logger.error(
      `Client platform-states entry is missing for client with id: ${client.id}`
    );
    return { isPlatformStatesClientCorrect: false, data: undefined };
  }

  const isPlatformStatesClientCorrect =
    platformStatesClientEntry.state === itemState.active &&
    getIdFromPlatformStatesPK<ClientId>(platformStatesClientEntry.PK) ===
      client.id &&
    platformStatesClientEntry.clientKind ===
      clientKindToTokenGenerationStatesClientKind(client.kind) &&
    platformStatesClientEntry.clientConsumerId === client.consumerId &&
    platformStatesClientEntry.clientPurposesIds.every((p) =>
      client.purposes.includes(p)
    );

  if (!isPlatformStatesClientCorrect) {
    logger.error(
      `Client states are not equal:
  platform-states entry: ${JSON.stringify(
    ComparisonPlatformStatesClientEntry.parse(platformStatesClientEntry)
  )}
  client read-model: ${JSON.stringify(ComparisonClient.parse(client))}`
    );

    return {
      isPlatformStatesClientCorrect,
      data: {
        PK: platformStatesClientEntry.PK,
        clientKind: platformStatesClientEntry.clientKind,
        clientConsumerId: platformStatesClientEntry.clientConsumerId,
        clientPurposesIds: platformStatesClientEntry.clientPurposesIds,
      },
    };
  }

  return {
    isPlatformStatesClientCorrect,
    data: undefined,
  };
}

// eslint-disable-next-line sonarjs/cognitive-complexity
function validateTokenGenerationStates({
  tokenGenStatesEntries,
  client,
  purposesById,
  eservicesById,
  agreementsByConsumerIdEserviceId,
  logger,
}: {
  tokenGenStatesEntries: TokenGenerationStatesGenericClient[] | undefined;
  client: Client;
  purposesById: Map<PurposeId, Purpose>;
  eservicesById: Map<EServiceId, EService>;
  agreementsByConsumerIdEserviceId: Map<GSIPKConsumerIdEServiceId, Agreement[]>;
  logger: Logger;
}): {
  isTokenGenerationStatesClientCorrect: boolean;
  data: ComparisonTokenGenStatesGenericClient[] | undefined;
} {
  if (!tokenGenStatesEntries || tokenGenStatesEntries.length === 0) {
    if (client.keys.length === 0) {
      return {
        isTokenGenerationStatesClientCorrect: true,
        data: undefined,
      };
    }

    logger.error(
      `Client ${client.id} has ${client.keys.length} ${
        client.keys.length > 1 ? "keys" : "key"
      } but zero token-generation-states entries`
    );
    return {
      isTokenGenerationStatesClientCorrect: false,
      data: undefined,
    };
  }

  const tokenGenStatesEntriesCount =
    client.purposes.length > 0
      ? client.keys.length * client.purposes.length
      : client.keys.length;
  const wrongTokenGenStatesEntries = tokenGenStatesEntries.reduce<
    ComparisonTokenGenStatesGenericClient[]
  >(
    (acc, e) =>
      match(e)
        // eslint-disable-next-line complexity
        .with({ clientKind: clientKindTokenGenStates.consumer }, (e) => {
          if (client.purposes.length !== 0) {
            // TokenGenerationStatesConsumerClient with CLIENTKIDPURPOSE PK
            const purposeId = getPurposeIdFromTokenGenStatesPK(e.PK);
            const purpose = purposeId ? purposesById.get(purposeId) : undefined;

            if (!purpose) {
              if (
                TokenGenerationStatesClientKidPurposePK.safeParse(e.PK).success
              ) {
                logger.error(
                  `no purpose found in read model for token-generation-states entry with PK ${e.PK}`
                );
              }

              logger.error(
                `token-generation-states entry has PK ${e.PK}, but should have a CLIENTKIDPURPOSE PK`
              );
              return [
                ...acc,
                {
                  PK: e.PK,
                  consumerId: e.consumerId,
                  clientKind: e.clientKind,
                  publicKey: e.publicKey,
                  GSIPK_clientId: e.GSIPK_clientId,
                  GSIPK_kid: e.GSIPK_kid,
                  GSIPK_clientId_purposeId: e.GSIPK_clientId_purposeId,
                },
              ];
            }

            const purposeState = getPurposeStateFromPurposeVersions(
              purpose.versions
            );
            const lastPurposeVersion = getLastPurposeVersion(purpose.versions);
            const agreements = agreementsByConsumerIdEserviceId.get(
              makeGSIPKConsumerIdEServiceId({
                consumerId: client.consumerId,
                eserviceId: purpose.eserviceId,
              })
            );

            if (!agreements) {
              logger.error(
                `no agreements found in read model for token-generation-states entry with PK ${e.PK}`
              );

              return [
                ...acc,
                {
                  PK: e.PK,
                  consumerId: e.consumerId,
                  clientKind: e.clientKind,
                  publicKey: e.publicKey,
                  GSIPK_clientId: e.GSIPK_clientId,
                  GSIPK_kid: e.GSIPK_kid,
                  GSIPK_clientId_purposeId: e.GSIPK_clientId_purposeId,
                  GSIPK_purposeId: e.GSIPK_purposeId,
                  purposeState: e.purposeState,
                  purposeVersionId: e.purposeVersionId,
                  GSIPK_eserviceId_descriptorId:
                    e.GSIPK_eserviceId_descriptorId,
                },
              ];
            }

            const agreement = getLastAgreement(agreements);
            const agreementItemState = agreementStateToItemState(
              agreement.state
            );

            const eservice = eservicesById.get(agreement.eserviceId);

            const descriptor = eservice?.descriptors.find(
              (d) => d.id === agreement.descriptorId
            );

            if (!eservice || !descriptor) {
              const missingEServiceDescriptor = [
                !eservice ? "e-service" : null,
                !descriptor ? "descriptor" : null,
              ]
                .filter(Boolean)
                .join(" and ");

              logger.error(
                `no ${missingEServiceDescriptor} in read model for token-generation-states entry with PK ${e.PK}`
              );

              return [
                ...acc,
                {
                  PK: e.PK,
                  consumerId: e.consumerId,
                  clientKind: e.clientKind,
                  publicKey: e.publicKey,
                  GSIPK_clientId: e.GSIPK_clientId,
                  GSIPK_kid: e.GSIPK_kid,
                  GSIPK_clientId_purposeId: e.GSIPK_clientId_purposeId,
                  GSIPK_purposeId: e.GSIPK_purposeId,
                  purposeState: e.purposeState,
                  purposeVersionId: e.purposeVersionId,
                  GSIPK_eserviceId_descriptorId:
                    e.GSIPK_eserviceId_descriptorId,
                  agreementId: e.agreementId,
                  agreementState: e.agreementState,
                },
              ];
            }

            if (
              getClientIdFromTokenGenStatesPK(e.PK) !== client.id ||
              e.consumerId !== client.consumerId ||
              e.GSIPK_clientId !== client.id ||
              client.keys.every(
                (k) => !(k.kid === e.GSIPK_kid && k.encodedPem === e.publicKey)
              ) ||
              e.GSIPK_kid !== getKidFromTokenGenStatesPK(e.PK) ||
              e.GSIPK_clientId_purposeId !==
                makeGSIPKClientIdPurposeId({
                  clientId: client.id,
                  purposeId: purpose.id,
                }) ||
              e.GSIPK_purposeId !== purpose.id ||
              e.purposeState !== purposeState ||
              e.purposeVersionId !== lastPurposeVersion.id ||
              e.GSIPK_consumerId_eserviceId !==
                makeGSIPKConsumerIdEServiceId({
                  consumerId: client.consumerId,
                  eserviceId: purpose.eserviceId,
                }) ||
              e.agreementId !== agreement.id ||
              e.agreementState !== agreementItemState ||
              e.GSIPK_eserviceId_descriptorId !==
                makeGSIPKEServiceIdDescriptorId({
                  eserviceId: agreement.eserviceId,
                  descriptorId: agreement.descriptorId,
                }) ||
              e.descriptorState !==
                descriptorStateToItemState(descriptor.state) ||
              !e.descriptorAudience?.every((aud) =>
                descriptor.audience.includes(aud)
              ) ||
              e.descriptorVoucherLifespan !== descriptor.voucherLifespan
            ) {
              // TODO: add precise logs
              console.log(
                "A",
                getClientIdFromTokenGenStatesPK(e.PK) !== client.id
              );
              console.log(e.consumerId !== client.consumerId);
              console.log(e.GSIPK_clientId !== client.id);
              console.log(
                client.keys.every(
                  (k) =>
                    !(k.kid === e.GSIPK_kid && k.encodedPem === e.publicKey)
                )
              );
              console.log(
                "B",
                e.GSIPK_kid !== getKidFromTokenGenStatesPK(e.PK)
              );
              console.log(
                e.GSIPK_clientId_purposeId !==
                  makeGSIPKClientIdPurposeId({
                    clientId: client.id,
                    purposeId: purpose.id,
                  })
              );
              console.log(e.GSIPK_purposeId !== purpose.id);
              console.log(e.purposeState !== purposeState);
              console.log(e.purposeVersionId !== lastPurposeVersion.id);
              console.log(
                "C",
                e.GSIPK_consumerId_eserviceId !==
                  makeGSIPKConsumerIdEServiceId({
                    consumerId: client.consumerId,
                    eserviceId: purpose.eserviceId,
                  })
              );
              console.log(e.agreementId !== agreement.id);
              console.log(e.agreementState !== agreementItemState);
              console.log(
                e.GSIPK_eserviceId_descriptorId !==
                  makeGSIPKEServiceIdDescriptorId({
                    eserviceId: agreement.eserviceId,
                    descriptorId: agreement.descriptorId,
                  })
              );
              console.log(
                e.descriptorState !==
                  descriptorStateToItemState(descriptor.state)
              );
              console.log(
                !e.descriptorAudience?.every((aud) =>
                  descriptor.audience.includes(aud)
                )
              );
              console.log(
                e.descriptorVoucherLifespan !== descriptor.voucherLifespan
              );

              const wrongTokenGenStatesEntry: ComparisonTokenGenStatesGenericClient =
                {
                  PK: e.PK,
                  consumerId: e.consumerId,
                  clientKind: e.clientKind,
                  publicKey: e.publicKey,
                  GSIPK_clientId: e.GSIPK_clientId,
                  GSIPK_kid: e.GSIPK_kid,
                  GSIPK_clientId_purposeId: e.GSIPK_clientId_purposeId,
                  GSIPK_purposeId: e.GSIPK_purposeId,
                  purposeState: e.purposeState,
                  purposeVersionId: e.purposeVersionId,
                  GSIPK_consumerId_eserviceId: e.GSIPK_consumerId_eserviceId,
                  agreementId: e.agreementId,
                  agreementState: e.agreementState,
                  GSIPK_eserviceId_descriptorId:
                    e.GSIPK_eserviceId_descriptorId,
                  descriptorState: e.descriptorState,
                  descriptorAudience: e.descriptorAudience,
                  descriptorVoucherLifespan: e.descriptorVoucherLifespan,
                };

              logger.error(`token-generation-states entry with PK ${
                e.PK
              } is incorrect:
  ${JSON.stringify(wrongTokenGenStatesEntry)}`);
              return [...acc, wrongTokenGenStatesEntry];
            }
          } else {
            // TokenGenerationStatesConsumerClient with CLIENTKID PK
            if (TokenGenerationStatesClientKidPK.safeParse(e.PK).success) {
              if (
                getClientIdFromTokenGenStatesPK(e.PK) !== client.id ||
                e.consumerId !== client.consumerId ||
                e.GSIPK_clientId !== client.id ||
                client.keys.every(
                  (k) =>
                    !(k.kid === e.GSIPK_kid && k.encodedPem === e.publicKey)
                ) ||
                e.GSIPK_kid !== getKidFromTokenGenStatesPK(e.PK)
              ) {
                return [
                  ...acc,
                  {
                    PK: e.PK,
                    consumerId: e.consumerId,
                    clientKind: e.clientKind,
                    publicKey: e.publicKey,
                    GSIPK_clientId: e.GSIPK_clientId,
                    GSIPK_kid: e.GSIPK_kid,
                  },
                ];
              }
            } else {
              logger.error(
                `token-generation-states entry has PK ${e.PK}, but should have a CLIENTKID PK`
              );

              return [
                ...acc,
                {
                  PK: e.PK,
                  consumerId: e.consumerId,
                  clientKind: e.clientKind,
                  publicKey: e.publicKey,
                  GSIPK_clientId: e.GSIPK_clientId,
                  GSIPK_kid: e.GSIPK_kid,
                  GSIPK_clientId_purposeId: e.GSIPK_clientId_purposeId,
                  GSIPK_purposeId: e.GSIPK_purposeId,
                  purposeState: e.purposeState,
                  purposeVersionId: e.purposeVersionId,
                  GSIPK_consumerId_eserviceId: e.GSIPK_consumerId_eserviceId,
                  agreementId: e.agreementId,
                  agreementState: e.agreementState,
                  GSIPK_eserviceId_descriptorId:
                    e.GSIPK_eserviceId_descriptorId,
                  descriptorState: e.descriptorState,
                  descriptorAudience: e.descriptorAudience,
                  descriptorVoucherLifespan: e.descriptorVoucherLifespan,
                },
              ];
            }
          }
          return acc;
        })
        .with({ clientKind: clientKindTokenGenStates.api }, (e) => {
          if (
            getClientIdFromTokenGenStatesPK(e.PK) !== client.id ||
            e.consumerId !== client.consumerId ||
            e.GSIPK_clientId !== client.id ||
            client.keys.every(
              (k) => !(k.kid === e.GSIPK_kid && k.encodedPem === e.publicKey)
            ) ||
            e.GSIPK_kid !== getKidFromTokenGenStatesPK(e.PK)
          ) {
            return [
              ...acc,
              {
                PK: e.PK,
                consumerId: e.consumerId,
                clientKind: e.clientKind,
                publicKey: e.publicKey,
                GSIPK_clientId: e.GSIPK_clientId,
                GSIPK_kid: e.GSIPK_kid,
              },
            ];
          }
          return acc;
        })
        .exhaustive(),
    []
  );
  return {
    isTokenGenerationStatesClientCorrect:
      wrongTokenGenStatesEntries.length === 0 &&
      tokenGenStatesEntries.length === tokenGenStatesEntriesCount,
    data:
      wrongTokenGenStatesEntries.length > 0
        ? wrongTokenGenStatesEntries
        : undefined,
  };
}

export const agreementStateToItemState = (state: AgreementState): ItemState =>
  state === agreementState.active ? itemState.active : itemState.inactive;

export const getPurposeStateFromPurposeVersions = (
  purposeVersions: PurposeVersion[]
): ItemState => {
  if (purposeVersions.find((v) => v.state === purposeVersionState.active)) {
    return itemState.active;
  } else {
    return itemState.inactive;
  }
};

export const clientKindToTokenGenerationStatesClientKind = (
  kind: ClientKind
): ClientKindTokenGenStates =>
  match<ClientKind, ClientKindTokenGenStates>(kind)
    .with(clientKind.consumer, () => clientKindTokenGenStates.consumer)
    .with(clientKind.api, () => clientKindTokenGenStates.api)
    .exhaustive();

export const descriptorStateToItemState = (state: DescriptorState): ItemState =>
  state === descriptorState.published || state === descriptorState.deprecated
    ? itemState.active
    : itemState.inactive;

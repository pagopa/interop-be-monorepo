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
  makePlatformStatesClientPK,
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
  ComparisonPlatformStatesAgreementEntry,
  ComparisonPlatformStatesCatalogEntry,
  ComparisonPlatformStatesClientEntry,
  ComparisonPlatformStatesPurposeEntry,
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
    clientAndTokenGenStatesDifferences
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
        // For info: __old = platform-states entry and __new = read model purpose
        logger.error(
          `Differences in platform-states when checking purpose with id ${purpose.id}`
        );
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
        logger.error(
          `Differences in platform-states when checking agreement with id ${agreement.id}`
        );
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

    if (!eservice) {
      differencesCount++;
      logger.error(`Read model e-service not found for id: ${id}`);
    } else {
      // Descriptors with a state other than deprecated, published or suspended are not considered because they are not expected in the platform-states
      if (
        !eservice.descriptors.some(
          (d) =>
            d.state === descriptorState.deprecated ||
            d.state === descriptorState.published ||
            d.state === descriptorState.suspended
        )
      ) {
        continue;
      }

      const platformStatesEntries = platformStatesEServiceById.get(id);

      if (!platformStatesEntries) {
        logger.error(
          `platform-states entries not found for e-service with id: ${id}`
        );
        differencesCount++;
        continue;
      }

      const expectedDescriptorsMap = new Map<
        DescriptorId,
        ComparisonPlatformStatesCatalogEntry
      >();

      eservice.descriptors.forEach((descriptor) => {
        expectedDescriptorsMap.set(descriptor.id, {
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
        ...expectedDescriptorsMap.keys(),
        ...platformStatesEntries.keys(),
      ]);

      for (const descriptorId of allDescriptorIds) {
        const readModelEntry = expectedDescriptorsMap.get(descriptorId);
        const platformStatesEntry = platformStatesEntries.get(descriptorId);

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
            logger.error(
              `Differences in platform-states when checking e-service with id ${eservice.id}`
            );
            logger.error(JSON.stringify(objectsDiff, null, 2));
          }
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
}): Promise<number> {
  const allIds = new Set([
    ...platformStatesClientById.keys(),
    ...tokenGenStatesByClient.keys(),
    ...clientsById.keys(),
  ]);

  // eslint-disable-next-line functional/no-let
  let differencesCount = 0;

  for (const id of allIds) {
    const platformStatesEntry = platformStatesClientById.get(id);
    const tokenGenStatesEntries = tokenGenStatesByClient.get(id);
    const client = clientsById.get(id);

    if (!platformStatesEntry && !tokenGenStatesEntries && !client) {
      throw genericInternalError(
        `Client, platform-states entry and token-generation states entries not found for id: ${id}`
      );
    }

    if (platformStatesEntry && !client) {
      logger.error(`Read model client not found for id: ${id}`);
      differencesCount++;
    }

    if (client) {
      if (!platformStatesEntry) {
        logger.error(
          `Client platform-states entry is missing for client with id: ${client.id}`
        );
        differencesCount++;
      }

      if (platformStatesEntry) {
        const expectedPlatformStatesClientEntry: ComparisonPlatformStatesClientEntry =
          {
            PK: makePlatformStatesClientPK(client.id),
            clientKind: clientKindToTokenGenerationStatesClientKind(
              client.kind
            ),
            clientConsumerId: client.consumerId,
            clientPurposesIds: client.purposes,
          };

        const objectsDiff = diff(
          ComparisonPlatformStatesClientEntry.parse(platformStatesEntry),
          expectedPlatformStatesClientEntry,
          {
            sort: true,
            // We're not able to check clientPurposesIds because events V1 use it and events V2 don't
            excludeKeys: ["clientPurposesIds"],
          }
        );
        if (objectsDiff) {
          differencesCount++;
          // For info: __old = platform-states entry and __new = read model client
          logger.error(
            `Differences in platform-states when checking client with id ${client.id}`
          );
          logger.error(JSON.stringify(objectsDiff, null, 2));
        }
      }

      differencesCount += validateTokenGenerationStates({
        tokenGenStatesEntries,
        client,
        purposesById,
        eservicesById,
        agreementsByConsumerIdEserviceId,
        logger,
      });
    }
  }

  return differencesCount;
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
}): number {
  const expectedTokenGenStatesEntriesCount =
    client.purposes.length > 0
      ? client.keys.length * client.purposes.length
      : client.keys.length;

  if (!tokenGenStatesEntries || tokenGenStatesEntries.length === 0) {
    if (client.keys.length === 0) {
      return 0;
    }

    logger.error(
      `Client ${client.id} has ${client.keys.length} ${
        client.keys.length > 1 ? "keys" : "key"
      } but zero token-generation-states entries`
    );
    return expectedTokenGenStatesEntriesCount;
  }

  // eslint-disable-next-line functional/no-let
  let differencesCount = 0;
  for (const e of tokenGenStatesEntries) {
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
            differencesCount++;
            return;
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

            differencesCount++;
            return;
          }

          const agreement = getLastAgreement(agreements);
          const agreementItemState = agreementStateToItemState(agreement.state);

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

            differencesCount++;
            return;
          }

          const clientIdCheck =
            getClientIdFromTokenGenStatesPK(e.PK) === client.id;
          const consumerIdCheck = e.consumerId === client.consumerId;
          const gsiPKClientIdCheck = e.GSIPK_clientId === client.id;
          const keysCheck = client.keys.some(
            (k) => k.kid === e.GSIPK_kid && k.encodedPem === e.publicKey
          );
          const gsiPKKidCheck =
            e.GSIPK_kid === getKidFromTokenGenStatesPK(e.PK);
          const gsiPKClientIdPurposeIdCheck =
            e.GSIPK_clientId_purposeId ===
            makeGSIPKClientIdPurposeId({
              clientId: client.id,
              purposeId: purpose.id,
            });
          const gsiPKPurposeIdCheck = e.GSIPK_purposeId === purpose.id;
          const purposeStateCheck = e.purposeState === purposeState;
          const purposeVersionIdCheck =
            e.purposeVersionId === lastPurposeVersion.id;
          const gsiPKConsumerIdEServiceIdCheck =
            e.GSIPK_consumerId_eserviceId ===
            makeGSIPKConsumerIdEServiceId({
              consumerId: client.consumerId,
              eserviceId: purpose.eserviceId,
            });
          const agreementIdCheck = e.agreementId === agreement.id;
          const agreementStateCheck = e.agreementState === agreementItemState;
          const gsiPKEServiceIdDescriptorIdCheck =
            e.GSIPK_eserviceId_descriptorId ===
            makeGSIPKEServiceIdDescriptorId({
              eserviceId: agreement.eserviceId,
              descriptorId: agreement.descriptorId,
            });
          const descriptorStateCheck =
            e.descriptorState === descriptorStateToItemState(descriptor.state);
          const descriptorAudienceCheck = !!e.descriptorAudience?.every((aud) =>
            descriptor.audience.includes(aud)
          );
          const descriptorVoucherLifespanCheck =
            e.descriptorVoucherLifespan === descriptor.voucherLifespan;

          if (
            !clientIdCheck ||
            !consumerIdCheck ||
            !gsiPKClientIdCheck ||
            !keysCheck ||
            !gsiPKKidCheck ||
            !gsiPKClientIdPurposeIdCheck ||
            !gsiPKPurposeIdCheck ||
            !purposeStateCheck ||
            !purposeVersionIdCheck ||
            !gsiPKConsumerIdEServiceIdCheck ||
            !agreementIdCheck ||
            !agreementStateCheck ||
            !gsiPKEServiceIdDescriptorIdCheck ||
            !descriptorStateCheck ||
            !descriptorAudienceCheck ||
            !descriptorVoucherLifespanCheck
          ) {
            logger.error(
              `token-generation-states check failed for entry with PK ${e.PK}`
            );
            logger.error(`clientIdCheck: ${clientIdCheck}`);
            logger.error(`consumerIdCheck: ${consumerIdCheck}`);
            logger.error(`gsiPKClientIdCheck: ${gsiPKClientIdCheck}`);
            logger.error(`keysCheck: ${keysCheck}`);
            logger.error(`kidCheck: ${gsiPKKidCheck}`);
            logger.error(
              `gsiPKClientIdPurposeIdCheck: ${gsiPKClientIdPurposeIdCheck}`
            );
            logger.error(`gsiPKPurposeIdCheck: ${gsiPKPurposeIdCheck}`);
            logger.error(`purposeStateCheck: ${purposeStateCheck}`);
            logger.error(`purposeVersionIdCheck: ${purposeVersionIdCheck}`);
            logger.error(
              `gsiPKConsumerIdEServiceIdCheck: ${gsiPKConsumerIdEServiceIdCheck}`
            );
            logger.error(`agreementIdCheck: ${agreementIdCheck}`);
            logger.error(`agreementStateCheck: ${agreementStateCheck}`);
            logger.error(
              `gsiPKEServiceIdDescriptorIdCheck: ${gsiPKEServiceIdDescriptorIdCheck}`
            );
            logger.error(`descriptorStateCheck: ${descriptorStateCheck}`);
            logger.error(`descriptorAudienceCheck: ${descriptorAudienceCheck}`);
            logger.error(
              `descriptorVoucherLifespanCheck: ${descriptorVoucherLifespanCheck}`
            );

            differencesCount++;
          }
        } else {
          // TokenGenerationStatesConsumerClient with CLIENTKID PK
          if (TokenGenerationStatesClientKidPK.safeParse(e.PK).success) {
            const clientIdCheck =
              getClientIdFromTokenGenStatesPK(e.PK) === client.id;
            const consumerIdCheck = e.consumerId === client.consumerId;
            const gsiPKClientIdCheck = e.GSIPK_clientId === client.id;
            const keysCheck = client.keys.some(
              (k) => k.kid === e.GSIPK_kid && k.encodedPem === e.publicKey
            );
            const gsiPKKidCheck =
              e.GSIPK_kid === getKidFromTokenGenStatesPK(e.PK);

            if (
              !clientIdCheck ||
              !consumerIdCheck ||
              !gsiPKClientIdCheck ||
              !keysCheck ||
              !gsiPKKidCheck
            ) {
              logger.error(
                `token-generation-states check failed for entry with PK ${e.PK}`
              );
              logger.error(`clientIdCheck: ${clientIdCheck}`);
              logger.error(`consumerIdCheck: ${consumerIdCheck}`);
              logger.error(`gsiPKClientIdCheck: ${gsiPKClientIdCheck}`);
              logger.error(`keysCheck: ${keysCheck}`);
              logger.error(`kidCheck: ${gsiPKKidCheck}`);
              differencesCount++;
            }
          } else {
            logger.error(
              `token-generation-states entry has PK ${e.PK}, but should have a CLIENTKID PK`
            );
            differencesCount++;
          }
        }
      })
      .with({ clientKind: clientKindTokenGenStates.api }, (e) => {
        if (TokenGenerationStatesClientKidPK.safeParse(e.PK).success) {
          const clientIdCheck =
            getClientIdFromTokenGenStatesPK(e.PK) === client.id;
          const consumerIdCheck = e.consumerId === client.consumerId;
          const gsiPKClientIdCheck = e.GSIPK_clientId === client.id;
          const keysCheck = client.keys.some(
            (k) => k.kid === e.GSIPK_kid && k.encodedPem === e.publicKey
          );
          const gsiPKKidCheck =
            e.GSIPK_kid === getKidFromTokenGenStatesPK(e.PK);

          if (
            !clientIdCheck ||
            !consumerIdCheck ||
            !gsiPKClientIdCheck ||
            !keysCheck ||
            !gsiPKKidCheck
          ) {
            logger.error(
              `token-generation-states check failed for entry with PK ${e.PK}`
            );
            logger.error(`clientIdCheck: ${clientIdCheck}`);
            logger.error(`consumerIdCheck: ${consumerIdCheck}`);
            logger.error(`gsiPKClientIdCheck: ${gsiPKClientIdCheck}`);
            logger.error(`keysCheck: ${keysCheck}`);
            logger.error(`kidCheck: ${gsiPKKidCheck}`);
            differencesCount++;
          }
        }
      })
      .exhaustive();
  }

  return differencesCount;
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

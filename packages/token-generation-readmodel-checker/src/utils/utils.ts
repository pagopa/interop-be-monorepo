import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { Logger } from "pagopa-interop-commons";
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
  makeGSIPKClientIdKid,
  makePlatformStatesAgreementPK,
  makePlatformStatesEServiceDescriptorPK,
  makePlatformStatesPurposePK,
  makeTokenGenerationStatesClientKidPK,
  makeTokenGenerationStatesClientKidPurposePK,
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
  ComparisonPlatformStatesPurposeEntry,
  ComparisonTokenGenStatesGenericClient,
} from "../models/types.js";
import { tokenGenerationReadModelServiceBuilder } from "../services/tokenGenerationReadModelService.js";
import { ReadModelServiceSQL } from "../services/readModelServiceSQL.js";

export function getLastPurposeVersion(
  purposeVersions: PurposeVersion[]
): PurposeVersion | undefined {
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

export function getPurposeStateFromPurposeVersion(
  purposeVersion: PurposeVersion
): ItemState {
  return purposeVersion.state === purposeVersionState.active
    ? itemState.active
    : itemState.inactive;
}

export function getLastAgreement(agreements: Agreement[]): Agreement {
  return agreements
    .filter(
      (a) =>
        a.state === agreementState.active ||
        a.state === agreementState.suspended ||
        a.state === agreementState.archived
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
  readModelService: ReadModelServiceSQL,
  logger: Logger
): Promise<number> {
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
  } = platformStatesEntries.reduce<{
    purposes: Map<PurposeId, PlatformStatesPurposeEntry>;
    agreements: Map<AgreementId, PlatformStatesAgreementEntry>;
    eservices: Map<EServiceId, Map<DescriptorId, PlatformStatesCatalogEntry>>;
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
          parsedAgreement.data.agreementId,
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

      if (PlatformStatesClientEntry.safeParse(e).success) {
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
// eslint-disable-next-line sonarjs/cognitive-complexity
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

    if (purpose) {
      const lastPurposeVersion = getLastPurposeVersion(purpose.versions);

      if (!platformStatesEntry) {
        const hasValidState =
          lastPurposeVersion &&
          lastPurposeVersion.state !== purposeVersionState.archived;
        if (hasValidState) {
          logger.error(
            `Purpose platform-states entry is missing for purpose with id: ${purpose.id}`
          );
          differencesCount++;
        }
      }

      if (platformStatesEntry && lastPurposeVersion) {
        if (lastPurposeVersion.state === purposeVersionState.archived) {
          logger.error(
            `platform-states entry with ${platformStatesEntry.PK} should not be in the table because the purpose is archived`
          );
          differencesCount++;
          continue;
        }

        const expectedPlatformStatesPurposeEntry: ComparisonPlatformStatesPurposeEntry =
          {
            PK: makePlatformStatesPurposePK(purpose.id),
            state: getPurposeStateFromPurposeVersion(lastPurposeVersion),
            purposeVersionId: lastPurposeVersion.id,
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
  }

  return differencesCount;
}

// agreements
// eslint-disable-next-line sonarjs/cognitive-complexity
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
    if (config.agreementsToSkip.includes(id)) {
      continue;
    }

    const platformStatesEntry = platformStatesAgreementById.get(id);
    const agreement = agreementsById.get(id);

    if (!platformStatesEntry && !agreement) {
      throw genericInternalError(
        `Agreement and platform-states entry not found for id: ${id}`
      );
    }

    if (
      platformStatesEntry &&
      !agreement &&
      platformStatesEntry.state === itemState.active
    ) {
      logger.error(
        `Read model agreement not found for id ${id} and platform-states entry with PK ${platformStatesEntry.PK}`
      );
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
          PK: makePlatformStatesAgreementPK({
            consumerId: agreement.consumerId,
            eserviceId: agreement.eserviceId,
          }),
          state: agreementStateToItemState(agreement.state),
          agreementId: agreement.id,
          agreementTimestamp: extractAgreementTimestamp(agreement),
          agreementDescriptorId: agreement.descriptorId,
          producerId: agreement.producerId,
        };

      const objectsDiff = diff(
        ComparisonPlatformStatesAgreementEntry.parse(platformStatesEntry),
        expectedPlatformStatesAgreementEntry,
        { sort: true }
      );
      if (objectsDiff) {
        differencesCount++;
        // For info: __old = platform-states agreement and __new = read model agreement
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
      // Descriptors with a state other than deprecated, published or suspended are not considered because they are not expected to be in the platform-states
      const shouldPlatformStatesCatalogEntriesExist = eservice.descriptors.some(
        (d) =>
          d.state === descriptorState.deprecated ||
          d.state === descriptorState.published ||
          d.state === descriptorState.suspended
      );
      const platformStatesEntries = platformStatesEServiceById.get(id);

      if (!platformStatesEntries) {
        if (shouldPlatformStatesCatalogEntriesExist) {
          logger.error(
            `platform-states entries not found for e-service with id: ${id}`
          );
          differencesCount++;
        }
        continue;
      }

      const expectedDescriptorsMap = new Map<
        DescriptorId,
        ComparisonPlatformStatesCatalogEntry
      >();

      eservice.descriptors.forEach((descriptor) => {
        if (shouldPlatformStatesCatalogEntriesExist) {
          expectedDescriptorsMap.set(descriptor.id, {
            PK: makePlatformStatesEServiceDescriptorPK({
              eserviceId: eservice.id,
              descriptorId: descriptor.id,
            }),
            state: descriptorStateToItemState(descriptor.state),
            descriptorAudience: descriptor.audience,
            descriptorVoucherLifespan: descriptor.voucherLifespan,
          });
        }
      });
      const allDescriptorIds = new Set([
        ...expectedDescriptorsMap.keys(),
        ...platformStatesEntries.keys(),
      ]);
      for (const descriptorId of allDescriptorIds) {
        const readModelEntry = expectedDescriptorsMap.get(descriptorId);
        const platformStatesEntry = platformStatesEntries.get(descriptorId);

        if (platformStatesEntry && !readModelEntry) {
          logger.error(
            `platform-states entry with ${platformStatesEntry.PK} should not be in the table because the descriptor state is not published, suspended or deprecated`
          );
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
              `Differences in platform-states when checking catalog entry ${platformStatesEntry.PK}`
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
  tokenGenStatesByClient,
  clientsById,
  purposesById,
  eservicesById,
  agreementsByConsumerIdEserviceId,
  logger,
}: {
  tokenGenStatesByClient: Map<ClientId, TokenGenerationStatesGenericClient[]>;
  clientsById: Map<ClientId, Client>;
  purposesById: Map<PurposeId, Purpose>;
  eservicesById: Map<EServiceId, EService>;
  agreementsByConsumerIdEserviceId: Map<GSIPKConsumerIdEServiceId, Agreement[]>;
  logger: Logger;
}): Promise<number> {
  const allIds = new Set([
    ...tokenGenStatesByClient.keys(),
    ...clientsById.keys(),
  ]);

  // eslint-disable-next-line functional/no-let
  let differencesCount = 0;

  for (const id of allIds) {
    const tokenGenStatesEntries = tokenGenStatesByClient.get(id);
    const client = clientsById.get(id);

    if (client) {
      differencesCount += validateTokenGenerationStates({
        tokenGenStatesEntries,
        client,
        purposesById,
        eservicesById,
        agreementsByConsumerIdEserviceId,
        logger,
      });
    } else {
      logger.error(`Read model client not found for id: ${id}`);
      differencesCount++;
    }
  }

  return differencesCount;
}

// eslint-disable-next-line complexity, sonarjs/cognitive-complexity
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
  // eslint-disable-next-line functional/no-let
  let expectedTokenGenStatesEntriesCount =
    client.purposes.length > 0 || client.kind === clientKind.consumer
      ? client.keys.length * client.purposes.length
      : client.keys.length;

  if (!tokenGenStatesEntries || tokenGenStatesEntries.length === 0) {
    if (client.keys.length === 0 || client.purposes.length === 0) {
      /*
      In the token-generation-states table it's possible for the consumer clients to have CLIENTKID PKs if the associated client has keys but not purposes.
      This only happens for the events V1, but the script is not able to differentiate the entries based on the data provided, so all the entries of that type
      are ignored in the token-generation-states check.
      */
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
  // eslint-disable-next-line functional/no-let
  let correctCount = 0;
  for (const e of tokenGenStatesEntries) {
    const extractedKid = getKidFromTokenGenStatesPK(e.PK);
    const key = client.keys.find(
      (k) => k.encodedPem === e.publicKey && k.kid === extractedKid
    );

    match(e)
      .with({ clientKind: clientKindTokenGenStates.consumer }, (e) => {
        if (client.purposes.length > 0) {
          // TokenGenerationStatesConsumerClient should have a CLIENTKIDPURPOSE PK
          const purposeId = getPurposeIdFromTokenGenStatesPK(e.PK);
          const purpose = purposeId ? purposesById.get(purposeId) : undefined;
          if (!purpose) {
            if (
              TokenGenerationStatesClientKidPurposePK.safeParse(e.PK).success
            ) {
              if (!e.purposeState || e.purposeState === itemState.inactive) {
                // Ignore consumer clients with purpose state inactive if the purpose is not found in the read model
                expectedTokenGenStatesEntriesCount--;
                return;
              }

              logger.error(
                `no purpose found in read model for token-generation-states entry with PK ${e.PK}`
              );
            } else {
              logger.error(
                `token-generation-states entry has PK ${e.PK}, but should have a CLIENTKIDPURPOSE PK`
              );
            }

            differencesCount++;
            return;
          }

          const lastPurposeVersion = getLastPurposeVersion(purpose.versions);
          const agreements = agreementsByConsumerIdEserviceId.get(
            makeGSIPKConsumerIdEServiceId({
              consumerId: purpose.consumerId,
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

          const comparisonTokenGenStatesEntry: ComparisonTokenGenStatesGenericClient =
            {
              PK: key
                ? makeTokenGenerationStatesClientKidPurposePK({
                    clientId: client.id,
                    kid: key.kid,
                    purposeId: purpose.id,
                  })
                : undefined,
              consumerId: purpose.consumerId,
              clientKind: clientKindToTokenGenerationStatesClientKind(
                client.kind
              ),
              publicKey: key?.encodedPem,
              GSIPK_clientId: client.id,
              GSIPK_clientId_kid: key
                ? makeGSIPKClientIdKid({ clientId: client.id, kid: key.kid })
                : undefined,
              GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
                clientId: client.id,
                purposeId: purpose.id,
              }),
              GSIPK_purposeId: purpose.id,

              ...(lastPurposeVersion
                ? {
                    purposeState:
                      getPurposeStateFromPurposeVersion(lastPurposeVersion),
                    purposeVersionId: lastPurposeVersion.id,
                    GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
                      consumerId: purpose.consumerId,
                      eserviceId: purpose.eserviceId,
                    }),
                    agreementId: agreement.id,
                    agreementState: agreementItemState,
                    GSIPK_eserviceId_descriptorId:
                      makeGSIPKEServiceIdDescriptorId({
                        eserviceId: agreement.eserviceId,
                        descriptorId: agreement.descriptorId,
                      }),
                    descriptorState: descriptorStateToItemState(
                      descriptor.state
                    ),
                    descriptorAudience: descriptor.audience,
                    descriptorVoucherLifespan: descriptor.voucherLifespan,
                  }
                : {}),
            };

          const objectsDiff = diff(
            ComparisonTokenGenStatesGenericClient.parse(e),
            comparisonTokenGenStatesEntry,
            { sort: true }
          );
          if (objectsDiff) {
            differencesCount++;
            logger.error(
              `Differences in token-generation-states when checking entry with PK ${e.PK}`
            );
            logger.error(JSON.stringify(objectsDiff, null, 2));
          } else {
            correctCount++;
          }
        } else {
          // TokenGenerationStatesConsumerClient should have a CLIENTKID PK
          if (TokenGenerationStatesClientKidPurposePK.safeParse(e.PK).success) {
            logger.error(
              `token-generation-states should have ${expectedTokenGenStatesEntriesCount} entries, but has a consumer client with PK ${e.PK}`
            );
            differencesCount++;
          } else {
            // Ignore consumer clients with CLIENTKID PK. If there's a consumer client with CLIENTKID, it's generated by events V1 that add incomplete consumer clients (KeysAdded but no purposes yet).
            correctCount++;
            expectedTokenGenStatesEntriesCount++;
          }
        }
      })
      .with({ clientKind: clientKindTokenGenStates.api }, () => {
        const comparisonTokenGenStatesEntry: ComparisonTokenGenStatesGenericClient =
          {
            PK: key
              ? makeTokenGenerationStatesClientKidPK({
                  clientId: client.id,
                  kid: key.kid,
                })
              : undefined,
            consumerId: client.consumerId,
            clientKind: clientKindToTokenGenerationStatesClientKind(
              client.kind
            ),
            publicKey: key?.encodedPem,
            GSIPK_clientId: client.id,
            GSIPK_clientId_kid: key
              ? makeGSIPKClientIdKid({ clientId: client.id, kid: key.kid })
              : undefined,
          };

        const objectsDiff = diff(
          ComparisonTokenGenStatesGenericClient.parse(e),
          comparisonTokenGenStatesEntry,
          { sort: true }
        );
        if (objectsDiff) {
          differencesCount++;
          logger.error(
            `Differences in token-generation-states when checking entry with PK ${e.PK}`
          );
          logger.error(JSON.stringify(objectsDiff, null, 2));
        } else {
          correctCount++;
        }
      })
      .exhaustive();
  }

  const missingEntriesCount = Math.max(
    expectedTokenGenStatesEntriesCount - correctCount - differencesCount,
    0
  );
  if (missingEntriesCount > 0) {
    logger.error(
      `${missingEntriesCount} missing token-generation-states entries for client id ${client.id}`
    );
  }

  return missingEntriesCount + differencesCount;
}

export const agreementStateToItemState = (state: AgreementState): ItemState =>
  state === agreementState.active ? itemState.active : itemState.inactive;

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

export const extractAgreementTimestamp = (agreement: Agreement): string =>
  agreement.stamps.upgrade?.when.toISOString() ||
  agreement.stamps.activation?.when.toISOString() ||
  agreement.createdAt.toISOString();

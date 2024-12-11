/* eslint-disable no-console */
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
  GSIPKEServiceIdDescriptorId,
  itemState,
  ItemState,
  makeGSIPKClientIdPurposeId,
  makeGSIPKConsumerIdEServiceId,
  makeGSIPKEServiceIdDescriptorId,
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
import { config } from "../configs/config.js";
import {
  AgreementDifferencesResult,
  CatalogDifferencesResult,
  ClientDifferencesResult,
  ComparisonAgreement,
  ComparisonClient,
  ComparisonEService,
  ComparisonPlatformStatesAgreementEntry,
  ComparisonPlatformStatesCatalogEntry,
  ComparisonPlatformStatesClientEntry,
  ComparisonPlatformStatesPurposeEntry,
  ComparisonPurpose,
  ComparisonTokenGenStatesGenericClient,
  PurposeDifferencesResult,
} from "../models/types.js";
import { readModelServiceBuilder } from "../services/readModelService.js";
import { tokenGenerationReadModelServiceBuilder } from "../services/tokenGenerationReadModelService.js";

export function getLastPurposeVersion(
  purposeVersions: PurposeVersion[]
): PurposeVersion {
  return purposeVersions.toSorted(
    (purposeVersion1, purposeVersion2) =>
      purposeVersion2.createdAt.getTime() - purposeVersion1.createdAt.getTime()
  )[0];
}

export function getLastEServiceDescriptor(
  descriptors: Descriptor[]
): Descriptor {
  return descriptors.toSorted(
    (descriptor1, descriptor2) =>
      descriptor2.createdAt.getTime() - descriptor1.createdAt.getTime()
  )[0];
}

function getIdFromPlatformStatesPK<
  T extends PurposeId | AgreementId | ClientId | EServiceId
>(
  pk:
    | PlatformStatesPurposePK
    | PlatformStatesAgreementPK
    | PlatformStatesClientPK
    | PlatformStatesEServiceDescriptorPK
): {
  id: T;
  descriptorId?: DescriptorId;
} {
  const splitPK = pk.split("#");
  if (PlatformStatesEServiceDescriptorPK.safeParse(pk).success) {
    return {
      id: unsafeBrandId<T>(splitPK[1]),
      descriptorId: unsafeBrandId<DescriptorId>(splitPK[2]),
    };
  }
  return { id: unsafeBrandId<T>(splitPK[1]) };
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

  const tokenGenStatesMaps = tokenGenerationStatesEntries.reduce(
    (acc: Map<ClientId, TokenGenerationStatesGenericClient[]>, entry) => {
      const clientId = getClientIdFromTokenGenStatesPK(entry.PK);
      acc.set(clientId, [...(acc.get(clientId) || []), entry]);
      return acc;
    },
    new Map<ClientId, TokenGenerationStatesGenericClient[]>()
  );

  const platformStatesMap: {
    purposes: Map<PurposeId, PlatformStatesPurposeEntry>;
    agreements: Map<AgreementId, PlatformStatesAgreementEntry>;
    eservices: Map<EServiceId, PlatformStatesCatalogEntry>;
    clients: Map<ClientId, PlatformStatesClientEntry>;
  } = platformStatesEntries.reduce<{
    purposes: Map<PurposeId, PlatformStatesPurposeEntry>;
    agreements: Map<AgreementId, PlatformStatesAgreementEntry>;
    eservices: Map<EServiceId, PlatformStatesCatalogEntry>;
    clients: Map<ClientId, PlatformStatesClientEntry>;
  }>(
    (acc, e) => {
      const parsedPurpose = PlatformStatesPurposeEntry.safeParse(e);
      if (parsedPurpose.success) {
        acc.purposes.set(
          unsafeBrandId<PurposeId>(
            getIdFromPlatformStatesPK(parsedPurpose.data.PK).id
          ),
          parsedPurpose.data
        );
        return acc;
      }

      const parsedAgreement = PlatformStatesAgreementEntry.safeParse(e);
      if (parsedAgreement.success) {
        acc.agreements.set(
          unsafeBrandId<AgreementId>(
            getIdFromPlatformStatesPK(parsedAgreement.data.PK).id
          ),
          parsedAgreement.data
        );
        return acc;
      }

      const parsedCatalog = PlatformStatesCatalogEntry.safeParse(e);
      if (parsedCatalog.success) {
        acc.eservices.set(
          unsafeBrandId<EServiceId>(
            getIdFromPlatformStatesPK(parsedCatalog.data.PK).id
          ),
          parsedCatalog.data
        );
        return acc;
      }

      const parsedClient = PlatformStatesClientEntry.safeParse(e);
      if (parsedClient.success) {
        acc.clients.set(
          unsafeBrandId<ClientId>(
            getIdFromPlatformStatesPK(parsedClient.data.PK).id
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
      eservices: new Map<EServiceId, PlatformStatesCatalogEntry>(),
      clients: new Map<ClientId, PlatformStatesClientEntry>(),
    }
  );

  const purposes = await readModelService.getAllReadModelPurposes();
  const purposesMap = new Map(purposes.map((purpose) => [purpose.id, purpose]));

  const agreements = await readModelService.getAllReadModelAgreements();
  const agreementsMap = new Map<AgreementId, Agreement>();
  const consumerIdEserviceIdMap = new Map<
    GSIPKConsumerIdEServiceId,
    Agreement
  >();

  for (const agreement of agreements) {
    agreementsMap.set(agreement.id, agreement);
    consumerIdEserviceIdMap.set(
      unsafeBrandId<GSIPKConsumerIdEServiceId>(
        `${agreement.consumerId}#${agreement.eserviceId}`
      ),
      agreement
    );
  }

  const eservices = await readModelService.getAllReadModelEServices();
  const eservicesMap = new Map<EServiceId, EService>();
  const eserviceIdDescriptorIdMap = new Map<
    GSIPKEServiceIdDescriptorId,
    EService
  >();
  for (const eservice of eservices) {
    const descriptor = getLastEServiceDescriptor(eservice.descriptors);
    eservicesMap.set(eservice.id, eservice);
    eserviceIdDescriptorIdMap.set(
      unsafeBrandId<GSIPKEServiceIdDescriptorId>(
        `${eservice.id}#${descriptor.id}`
      ),
      eservice
    );
  }

  const clients = await readModelService.getAllReadModelClients();
  const clientsMap = new Map<ClientId, Client>(
    clients.map((client) => [unsafeBrandId<ClientId>(client.id), client])
  );

  const purposeDifferences = await compareReadModelPurposesWithPlatformStates({
    platformStatesPurposeMap: platformStatesMap.purposes,
    purposesMap,
    logger,
  });
  const agreementDifferences =
    await compareReadModelAgreementsWithPlatformStates({
      platformStatesAgreementMap: platformStatesMap.agreements,
      agreementsMap,
      logger,
    });
  const catalogDifferences = await compareReadModelEServicesWithPlatformStates({
    platformStatesEServiceMap: platformStatesMap.eservices,
    eservicesMap,
    logger,
  });
  const clientAndTokenGenStatesDifferences =
    await compareReadModelClientsAndTokenGenStates({
      platformStatesClientMap: platformStatesMap.clients,
      tokenGenStatesMaps,
      clientsMap,
      purposesMap,
      consumerIdEserviceIdMap,
      eserviceIdDescriptorIdMap,
      logger,
    });

  return (
    purposeDifferences.length +
    agreementDifferences.length +
    catalogDifferences.length +
    clientAndTokenGenStatesDifferences.length
  );
}

// purposes
export async function compareReadModelPurposesWithPlatformStates({
  platformStatesPurposeMap,
  purposesMap,
  logger,
}: {
  platformStatesPurposeMap: Map<PurposeId, PlatformStatesPurposeEntry>;
  purposesMap: Map<PurposeId, Purpose>;
  logger: Logger;
}): Promise<PurposeDifferencesResult> {
  const allIds = new Set([
    ...platformStatesPurposeMap.keys(),
    ...purposesMap.keys(),
  ]);

  return Array.from(allIds).reduce<PurposeDifferencesResult>((acc, id) => {
    const platformStatesEntry = platformStatesPurposeMap.get(id);
    const purpose = purposesMap.get(id);

    if (!platformStatesEntry && !purpose) {
      return acc;
    } else if (!purpose) {
      const purposeDifferencesEntry: [
        ComparisonPlatformStatesPurposeEntry | undefined,
        ComparisonPurpose | undefined
      ] = [
        platformStatesEntry
          ? ComparisonPlatformStatesPurposeEntry.parse(platformStatesEntry)
          : undefined,
        undefined,
      ];
      console.log(`Read model purpose not found for id: ${id}`);
      logger.error(`Read model purpose not found for id: ${id}`);
      return [...acc, purposeDifferencesEntry];
    }

    const purposeState = getPurposeStateFromPurposeVersions(purpose.versions);
    const lastPurposeVersion = getLastPurposeVersion(purpose.versions);

    const {
      isPlatformStatesPurposeCorrect: isPlatformStatesCorrect,
      data: platformPurposeEntryDiff,
    } = validatePurposePlatformStates({
      platformPurposeEntry: platformStatesEntry,
      purpose,
      purposeState,
      lastPurposeVersion,
      logger,
    });

    if (!isPlatformStatesCorrect) {
      const purposeDifferencesEntry: [
        ComparisonPlatformStatesPurposeEntry | undefined,
        ComparisonPurpose | undefined
      ] = [platformPurposeEntryDiff, ComparisonPurpose.parse(purpose)];
      return [...acc, purposeDifferencesEntry];
    }

    return acc;
  }, []);
}

function validatePurposePlatformStates({
  platformPurposeEntry: platformStatesPurposeEntry,
  purpose,
  purposeState,
  lastPurposeVersion,
  logger,
}: {
  platformPurposeEntry: PlatformStatesPurposeEntry | undefined;
  purpose: Purpose;
  purposeState: ItemState;
  lastPurposeVersion: PurposeVersion;
  logger: Logger;
}): {
  isPlatformStatesPurposeCorrect: boolean;
  data: ComparisonPlatformStatesPurposeEntry | undefined;
} {
  const isArchived = lastPurposeVersion.state === purposeVersionState.archived;
  if (!platformStatesPurposeEntry) {
    if (!isArchived) {
      console.log(
        `Purpose platform-states entry is missing for purpose with id: ${purpose.id}`
      );
      logger.error(
        `Purpose platform-states entry is missing for purpose with id: ${purpose.id}`
      );
    }

    return {
      isPlatformStatesPurposeCorrect: isArchived,
      data: undefined,
    };
  }

  const isPlatformStatesPurposeCorrect = !platformStatesPurposeEntry
    ? isArchived
    : !isArchived &&
      getIdFromPlatformStatesPK<PurposeId>(platformStatesPurposeEntry.PK).id ===
        purpose.id &&
      purposeState === platformStatesPurposeEntry.state &&
      platformStatesPurposeEntry.purposeConsumerId === purpose.consumerId &&
      platformStatesPurposeEntry.purposeEserviceId === purpose.eserviceId &&
      platformStatesPurposeEntry.purposeVersionId === lastPurposeVersion.id;

  if (!isPlatformStatesPurposeCorrect) {
    console.log(`Purpose states are not equal:
  platform-states entry: ${
    platformStatesPurposeEntry
      ? JSON.stringify(
          ComparisonPlatformStatesPurposeEntry.parse(platformStatesPurposeEntry)
        )
      : platformStatesPurposeEntry
  }
  purpose read-model: ${JSON.stringify(ComparisonPurpose.parse(purpose))}`);
    logger.error(
      `Purpose states are not equal:
  platform-states entry: ${
    platformStatesPurposeEntry
      ? JSON.stringify(
          ComparisonPlatformStatesPurposeEntry.parse(platformStatesPurposeEntry)
        )
      : platformStatesPurposeEntry
  }
  purpose read-model: ${JSON.stringify(ComparisonPurpose.parse(purpose))}`
    );
  }

  return {
    isPlatformStatesPurposeCorrect,
    data:
      !isPlatformStatesPurposeCorrect && platformStatesPurposeEntry
        ? {
            PK: platformStatesPurposeEntry.PK,
            state: platformStatesPurposeEntry.state,
            purposeConsumerId: platformStatesPurposeEntry.purposeConsumerId,
            purposeEserviceId: platformStatesPurposeEntry.purposeEserviceId,
            purposeVersionId: platformStatesPurposeEntry.purposeVersionId,
          }
        : undefined,
  };
}

// agreements
export async function compareReadModelAgreementsWithPlatformStates({
  platformStatesAgreementMap,
  agreementsMap,
  logger,
}: {
  platformStatesAgreementMap: Map<AgreementId, PlatformStatesAgreementEntry>;
  agreementsMap: Map<AgreementId, Agreement>;
  logger: Logger;
}): Promise<AgreementDifferencesResult> {
  const allIds = new Set([
    ...platformStatesAgreementMap.keys(),
    ...agreementsMap.keys(),
  ]);

  return Array.from(allIds).reduce<AgreementDifferencesResult>((acc, id) => {
    const platformStatesEntry = platformStatesAgreementMap.get(id);
    const agreement = agreementsMap.get(id);

    if (!platformStatesEntry && !agreement) {
      return acc;
    } else if (!agreement) {
      const agreementDifferencesEntry: [
        ComparisonPlatformStatesAgreementEntry | undefined,
        ComparisonAgreement | undefined
      ] = [
        platformStatesEntry
          ? ComparisonPlatformStatesAgreementEntry.parse(platformStatesEntry)
          : undefined,
        undefined,
      ];
      console.log(`Read model agreement not found for id: ${id}`);
      logger.error(`Read model agreement not found for id: ${id}`);
      return [...acc, agreementDifferencesEntry];
    }

    const agreementItemState = agreementStateToItemState(agreement.state);
    const {
      isPlatformStatesAgreementCorrect: isPlatformStatesCorrect,
      data: platformAgreementEntryDiff,
    } = validateAgreementPlatformStates({
      platformAgreementEntry: platformStatesEntry,
      agreement,
      agreementItemState,
      logger,
    });

    if (!isPlatformStatesCorrect) {
      const agreementDifferencesEntry: [
        ComparisonPlatformStatesAgreementEntry | undefined,
        ComparisonAgreement | undefined
      ] = [platformAgreementEntryDiff, ComparisonAgreement.parse(agreement)];
      return [...acc, agreementDifferencesEntry];
    }

    return acc;
  }, []);
}

function validateAgreementPlatformStates({
  platformAgreementEntry,
  agreement,
  agreementItemState,
  logger,
}: {
  platformAgreementEntry: PlatformStatesAgreementEntry | undefined;
  agreement: Agreement;
  agreementItemState: ItemState;
  logger: Logger;
}): {
  isPlatformStatesAgreementCorrect: boolean;
  data: ComparisonPlatformStatesAgreementEntry | undefined;
} {
  const isArchived = agreement.state === agreementState.archived;

  if (!platformAgreementEntry) {
    if (!isArchived) {
      console.log(
        `Agreement platform-states entry is missing for agreement with id: ${agreement.id}`
      );
      logger.error(
        `Agreement platform-states entry is missing for agreement with id: ${agreement.id}`
      );
    }

    return {
      isPlatformStatesAgreementCorrect: isArchived,
      data: undefined,
    };
  }

  const isPlatformStatesAgreementCorrect = !platformAgreementEntry
    ? isArchived
    : !isArchived &&
      agreementItemState === platformAgreementEntry.state &&
      platformAgreementEntry.GSIPK_consumerId_eserviceId ===
        makeGSIPKConsumerIdEServiceId({
          consumerId: agreement.consumerId,
          eserviceId: agreement.eserviceId,
        }) &&
      platformAgreementEntry.agreementDescriptorId === agreement.descriptorId;

  if (!isPlatformStatesAgreementCorrect) {
    console.log(`Agreement states are not equal:
  platform-states entry: ${
    platformAgreementEntry
      ? JSON.stringify(
          ComparisonPlatformStatesAgreementEntry.parse(platformAgreementEntry)
        )
      : platformAgreementEntry
  }
  agreement: ${JSON.stringify(ComparisonAgreement.parse(agreement))}`);
    logger.error(
      `Agreement states are not equal:
  platform-states entry: ${
    platformAgreementEntry
      ? JSON.stringify(
          ComparisonPlatformStatesAgreementEntry.parse(platformAgreementEntry)
        )
      : platformAgreementEntry
  }
  agreement: ${JSON.stringify(ComparisonAgreement.parse(agreement))}`
    );
  }

  return {
    isPlatformStatesAgreementCorrect,
    data:
      !isPlatformStatesAgreementCorrect && platformAgreementEntry
        ? {
            PK: platformAgreementEntry.PK,
            state: platformAgreementEntry.state,
            GSIPK_consumerId_eserviceId:
              platformAgreementEntry.GSIPK_consumerId_eserviceId,
            agreementDescriptorId: platformAgreementEntry.agreementDescriptorId,
          }
        : undefined,
  };
}

// eservices
export async function compareReadModelEServicesWithPlatformStates({
  platformStatesEServiceMap,
  eservicesMap,
  logger,
}: {
  platformStatesEServiceMap: Map<EServiceId, PlatformStatesCatalogEntry>;
  eservicesMap: Map<EServiceId, EService>;
  logger: Logger;
}): Promise<CatalogDifferencesResult> {
  const allIds = new Set([
    ...platformStatesEServiceMap.keys(),
    ...eservicesMap.keys(),
  ]);

  return Array.from(allIds).reduce<CatalogDifferencesResult>((acc, id) => {
    const platformStatesEntry = platformStatesEServiceMap.get(id);
    const eservice = eservicesMap.get(id);

    if (!platformStatesEntry && !eservice) {
      return acc;
    } else if (!eservice) {
      const catalogDifferences: [
        ComparisonPlatformStatesCatalogEntry | undefined,
        ComparisonEService | undefined
      ] = [
        platformStatesEntry
          ? ComparisonPlatformStatesCatalogEntry.parse(platformStatesEntry)
          : undefined,
        undefined,
      ];
      console.log(`Read model eservice not found for id: ${id}`);
      logger.error(`Read model eservice not found for id: ${id}`);
      return [...acc, catalogDifferences];
    }

    const lastEServiceDescriptor = getLastEServiceDescriptor(
      eservice.descriptors
    );
    const {
      isPlatformStatesCatalogCorrect: isPlatformStatesCorrect,
      data: platformCatalogEntryDiff,
    } = validateCatalogPlatformStates({
      platformCatalogEntry: platformStatesEntry,
      eservice,
      descriptor: lastEServiceDescriptor,
      logger,
    });

    if (!isPlatformStatesCorrect) {
      const catalogDifferencesEntry: [
        ComparisonPlatformStatesCatalogEntry | undefined,
        ComparisonEService | undefined
      ] = [platformCatalogEntryDiff, ComparisonEService.parse(eservice)];
      return [...acc, catalogDifferencesEntry];
    }

    return acc;
  }, []);
}

function validateCatalogPlatformStates({
  platformCatalogEntry,
  eservice,
  descriptor,
  logger,
}: {
  platformCatalogEntry: PlatformStatesCatalogEntry | undefined;
  eservice: EService;
  descriptor: Descriptor;
  logger: Logger;
}): {
  isPlatformStatesCatalogCorrect: boolean;
  data: ComparisonPlatformStatesCatalogEntry | undefined;
} {
  const isArchived = descriptor.state === descriptorState.archived;
  if (!platformCatalogEntry) {
    if (!isArchived) {
      console.log(
        `Catalog platform-states entry is missing for eservice with id ${eservice.id} and descriptor with id ${descriptor.id}`
      );
      logger.error(
        `Catalog platform-states entry is missing for eservice with id ${eservice.id} and descriptor with id ${descriptor.id}`
      );
    }
    return {
      isPlatformStatesCatalogCorrect: isArchived,
      data: undefined,
    };
  }

  const extractedDescriptorId = getIdFromPlatformStatesPK<ClientId>(
    platformCatalogEntry.PK
  ).descriptorId;
  if (descriptor.id !== extractedDescriptorId) {
    console.log(
      `Catalog platform-states entry descriptor id ${extractedDescriptorId} is not equal to eservice descriptor id ${descriptor.id}`
    );
    logger.error(
      `Catalog platform-states entry descriptor id ${extractedDescriptorId} is not equal to eservice descriptor id ${descriptor.id}`
    );
    return {
      isPlatformStatesCatalogCorrect: false,
      data: ComparisonPlatformStatesCatalogEntry.parse(platformCatalogEntry),
    };
  }

  const catalogState = descriptorStateToItemState(descriptor.state);

  const isPlatformStatesCatalogCorrect =
    !isArchived &&
    platformCatalogEntry.state === catalogState &&
    platformCatalogEntry.descriptorVoucherLifespan ===
      descriptor.voucherLifespan &&
    descriptor.audience.every((aud) =>
      platformCatalogEntry.descriptorAudience.includes(aud)
    );

  if (!isPlatformStatesCatalogCorrect) {
    console.log(`Catalog states are not equal:
  platform-states entry: ${JSON.stringify(
    ComparisonPlatformStatesCatalogEntry.parse(platformCatalogEntry)
  )}
  eservice read-model: ${JSON.stringify(ComparisonEService.parse(eservice))}`);
    logger.error(`Catalog states are not equal:
  platform-states entry: ${JSON.stringify(
    ComparisonPlatformStatesCatalogEntry.parse(platformCatalogEntry)
  )}
  eservice read-model: ${JSON.stringify(ComparisonEService.parse(eservice))}`);
  }

  return {
    isPlatformStatesCatalogCorrect,
    data: !isPlatformStatesCatalogCorrect
      ? {
          PK: platformCatalogEntry.PK,
          state: platformCatalogEntry.state,
          descriptorVoucherLifespan:
            platformCatalogEntry.descriptorVoucherLifespan,
          descriptorAudience: platformCatalogEntry.descriptorAudience,
        }
      : undefined,
  };
}

// clients
export async function compareReadModelClientsAndTokenGenStates({
  platformStatesClientMap,
  tokenGenStatesMaps,
  clientsMap,
  purposesMap,
  consumerIdEserviceIdMap,
  eserviceIdDescriptorIdMap,
  logger,
}: {
  platformStatesClientMap: Map<ClientId, PlatformStatesClientEntry>;
  tokenGenStatesMaps: Map<ClientId, TokenGenerationStatesGenericClient[]>;
  clientsMap: Map<ClientId, Client>;
  purposesMap: Map<PurposeId, Purpose>;
  consumerIdEserviceIdMap: Map<GSIPKConsumerIdEServiceId, Agreement>;
  eserviceIdDescriptorIdMap: Map<GSIPKEServiceIdDescriptorId, EService>;
  logger: Logger;
}): Promise<ClientDifferencesResult> {
  const allIds = new Set([
    ...platformStatesClientMap.keys(),
    ...tokenGenStatesMaps.keys(),
    ...clientsMap.keys(),
  ]);

  return Array.from(allIds).reduce<ClientDifferencesResult>((acc, id) => {
    const platformStatesEntry = platformStatesClientMap.get(id);
    const tokenGenStatesEntries = tokenGenStatesMaps.get(id);
    const client = clientsMap.get(id);

    if (!platformStatesEntry && !tokenGenStatesEntries?.length && !client) {
      return acc;
    } else if (!client) {
      const clientDifferencesEntry: [
        ComparisonPlatformStatesClientEntry | undefined,
        ComparisonTokenGenStatesGenericClient[] | undefined,
        ComparisonClient | undefined
      ] = [
        platformStatesEntry
          ? ComparisonPlatformStatesClientEntry.parse(platformStatesEntry)
          : undefined,
        tokenGenStatesEntries && tokenGenStatesEntries.length > 0
          ? ComparisonTokenGenStatesGenericClient.array().parse(
              tokenGenStatesEntries
            )
          : undefined,
        undefined,
      ];
      console.log(`Read model client not found for id: ${id}`);
      logger.error(`Read model client not found for id: ${id}`);
      return [...acc, clientDifferencesEntry];
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
      purposesMap,
      consumerIdEserviceIdMap,
      eserviceIdDescriptorIdMap,
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
    console.log(
      `Client platform-states entry is missing for client with id: ${client.id}`
    );
    logger.error(
      `Client platform-states entry is missing for client with id: ${client.id}`
    );
    return { isPlatformStatesClientCorrect: false, data: undefined };
  }

  const isPlatformStatesClientCorrect = !platformStatesClientEntry
    ? true
    : platformStatesClientEntry.state === itemState.active &&
      getIdFromPlatformStatesPK<ClientId>(platformStatesClientEntry.PK).id ===
        client.id &&
      platformStatesClientEntry.clientKind ===
        clientKindToTokenGenerationStatesClientKind(client.kind) &&
      platformStatesClientEntry.clientConsumerId === client.consumerId &&
      platformStatesClientEntry.clientPurposesIds.every((p) =>
        client.purposes.includes(p)
      );

  if (!isPlatformStatesClientCorrect) {
    console.log(`Client states are not equal:
  platform-states entry: ${
    platformStatesClientEntry
      ? JSON.stringify(
          ComparisonPlatformStatesClientEntry.parse(platformStatesClientEntry)
        )
      : platformStatesClientEntry
  }
  client read-model: ${JSON.stringify(ComparisonClient.parse(client))}`);
    logger.error(
      `Client states are not equal:
  platform-states entry: ${
    platformStatesClientEntry
      ? JSON.stringify(
          ComparisonPlatformStatesClientEntry.parse(platformStatesClientEntry)
        )
      : platformStatesClientEntry
  }
  client read-model: ${JSON.stringify(ComparisonClient.parse(client))}`
    );
  }

  return {
    isPlatformStatesClientCorrect,
    data:
      !isPlatformStatesClientCorrect && platformStatesClientEntry
        ? {
            PK: platformStatesClientEntry.PK,
            clientKind: platformStatesClientEntry.clientKind,
            clientConsumerId: platformStatesClientEntry.clientConsumerId,
            clientPurposesIds: platformStatesClientEntry.clientPurposesIds,
          }
        : undefined,
  };
}

// eslint-disable-next-line sonarjs/cognitive-complexity
function validateTokenGenerationStates({
  tokenGenStatesEntries,
  client,
  purposesMap,
  consumerIdEserviceIdMap,
  eserviceIdDescriptorIdMap,
  logger,
}: {
  tokenGenStatesEntries: TokenGenerationStatesGenericClient[] | undefined;
  client: Client;
  purposesMap: Map<PurposeId, Purpose>;
  consumerIdEserviceIdMap: Map<GSIPKConsumerIdEServiceId, Agreement>;
  eserviceIdDescriptorIdMap: Map<GSIPKEServiceIdDescriptorId, EService>;
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

    console.log(
      `Client ${client.id} has ${client.keys.length} ${
        client.keys.length > 1 ? "keys" : "key"
      } but zero token-generation-states entries`
    );
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
            const purpose = purposeId ? purposesMap.get(purposeId) : undefined;

            if (!purpose) {
              if (TokenGenerationStatesClientKidPK.safeParse(e.PK).success) {
                console.log(
                  `token-generation-states entry has PK ${e.PK}, but should have a CLIENTKIDPURPOSE PK`
                );
                logger.error(
                  `token-generation-states entry has PK ${e.PK}, but should have a CLIENTKIDPURPOSE PK`
                );
              } else {
                console.log(
                  `token-generation-states entry with PK ${e.PK} has no purpose`
                );
                logger.error(
                  `token-generation-states entry with PK ${e.PK} has no purpose`
                );
              }

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
            const agreement = consumerIdEserviceIdMap.get(
              makeGSIPKConsumerIdEServiceId({
                consumerId: client.consumerId,
                eserviceId: purpose.eserviceId,
              })
            );

            if (!agreement) {
              logger.error(
                `token-generation-states entry with PK ${e.PK} has no agreement`
              );
              console.log(
                `token-generation-states entry with PK ${e.PK} has no agreement`
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
            const agreementItemState = agreementStateToItemState(
              agreement.state
            );

            const eservice = eserviceIdDescriptorIdMap.get(
              makeGSIPKEServiceIdDescriptorId({
                eserviceId: agreement.eserviceId,
                descriptorId: agreement.descriptorId,
              })
            );

            if (!eservice) {
              console.log(
                `token-generation-states entry with PK ${e.PK} has no eservice`
              );
              logger.error(
                `token-generation-states entry with PK ${e.PK} has no eservice`
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
            const descriptor = getLastEServiceDescriptor(eservice.descriptors);

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
              e.descriptorAudience !== descriptor.audience ||
              e.descriptorVoucherLifespan !== descriptor.voucherLifespan
            ) {
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

              console.log(
                `token-generation-states entry with PK ${e.PK} is incorrect:
  ${JSON.stringify(wrongTokenGenStatesEntry)}
                `
              );
              return [...acc, wrongTokenGenStatesEntry];
            }
          } else {
            // TokenGenerationStatesConsumerClient with CLIENTKID PK
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

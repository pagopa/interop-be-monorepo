import { ReadModelRepository, Logger } from "pagopa-interop-commons";
import {
  Agreement,
  AgreementId,
  agreementState,
  AgreementState,
  Client,
  ClientId,
  clientKind,
  ClientKind,
  ClientKindTokenStates,
  clientKindTokenStates,
  Descriptor,
  DescriptorId,
  DescriptorState,
  descriptorState,
  EService,
  EServiceId,
  genericInternalError,
  GSIPKClientIdPurposeId,
  GSIPKConsumerIdEServiceId,
  GSIPKEServiceIdDescriptorId,
  itemState,
  ItemState,
  makeGSIPKConsumerIdEServiceId,
  makeGSIPKEServiceIdDescriptorId,
  PlatformStatesAgreementEntry,
  PlatformStatesAgreementPK,
  PlatformStatesCatalogEntry,
  PlatformStatesClientEntry,
  PlatformStatesClientPK,
  PlatformStatesEServiceDescriptorPK,
  PlatformStatesGenericEntry,
  PlatformStatesPurposeEntry,
  PlatformStatesPurposePK,
  Purpose,
  PurposeId,
  PurposeVersion,
  purposeVersionState,
  TenantId,
  TokenGenerationStatesClientKidPK,
  TokenGenerationStatesClientKidPurposePK,
  TokenGenerationStatesClientPurposeEntry,
  TokenGenerationStatesGenericEntry,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { readModelServiceBuilder } from "../services/readModelService.js";
import { tokenGenerationReadModelServiceBuilder } from "../services/tokenGenerationReadModelService.js";
import { config } from "../configs/config.js";
import {
  AgreementDifferencesResult,
  ComparisonPlatformStatesAgreementEntry,
  ComparisonPlatformStatesPurposeEntry,
  PurposeDifferencesResult,
  ComparisonAgreement,
  ComparisonPurpose,
  ComparisonTokenStatesAgreementEntry,
  ComparisonTokenStatesPurposeEntry,
  ComparisonPlatformStatesCatalogEntry,
  ComparisonTokenStatesCatalogEntry,
  CatalogDifferencesResult,
  ComparisonEService,
  ComparisonPlatformStatesClientEntry,
  ComparisonTokenStatesClientEntry,
  ClientDifferencesResult,
  ComparisonClient,
} from "../models/types.js";

type Accumulator = {
  platformPurposeEntries: PlatformStatesPurposeEntry[];
  platformAgreementEntries: PlatformStatesAgreementEntry[];
  platformCatalogEntries: PlatformStatesCatalogEntry[];
  platformClientEntries: PlatformStatesClientEntry[];
};

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

function getClientIdFromTokenStatesPK(
  pk: TokenGenerationStatesClientKidPurposePK | TokenGenerationStatesClientKidPK
): ClientId {
  const splitPK = pk.split("#");
  return unsafeBrandId<ClientId>(splitPK[1]);
}

function getPurposeIdFromTokenStatesPK(
  pk: TokenGenerationStatesClientKidPurposePK | TokenGenerationStatesClientKidPK
): PurposeId | undefined {
  const splitPK = pk.split("#");
  return unsafeBrandId<PurposeId>(splitPK[3]);
}

function getIdsFromGSIPKClientIdPurposeId(gsiPK?: GSIPKClientIdPurposeId):
  | {
      clientId: ClientId;
      purposeId: PurposeId;
    }
  | undefined {
  if (!gsiPK) {
    return undefined;
  }

  const splitPK = gsiPK.split("#");
  return {
    clientId: unsafeBrandId<ClientId>(splitPK[0]),
    purposeId: unsafeBrandId<PurposeId>(splitPK[1]),
  };
}

function getIdsFromGSIPKEServiceIdDescriptorId(
  gsiPK?: GSIPKEServiceIdDescriptorId
):
  | {
      eserviceId: EServiceId;
      descriptorId: DescriptorId;
    }
  | undefined {
  if (!gsiPK) {
    return undefined;
  }

  const splitPK = gsiPK.split("#");
  return {
    eserviceId: unsafeBrandId<EServiceId>(splitPK[0]),
    descriptorId: unsafeBrandId<DescriptorId>(splitPK[1]),
  };
}

function getIdsFromGSIPKConsumerIdEServiceId(
  gsiPK?: GSIPKConsumerIdEServiceId
):
  | {
      consumerId: TenantId;
      eserviceId: EServiceId;
    }
  | undefined {
  if (!gsiPK) {
    return undefined;
  }

  const splitPK = gsiPK.split("#");
  return {
    consumerId: unsafeBrandId<TenantId>(splitPK[0]),
    eserviceId: unsafeBrandId<EServiceId>(splitPK[1]),
  };
}

export async function compareTokenGenerationReadModel(
  dynamoDBClient: DynamoDBClient,
  loggerInstance: Logger
): Promise<number> {
  loggerInstance.info(
    "Token generation read model and read model comparison started.\n"
  );
  loggerInstance.info("> Connecting to database...");
  const readModel = ReadModelRepository.init(config);
  const readModelService = readModelServiceBuilder(readModel);
  loggerInstance.info("> Connected to database!\n");

  const tokenGenerationService =
    tokenGenerationReadModelServiceBuilder(dynamoDBClient);
  const platformStatesEntries =
    await tokenGenerationService.readAllPlatformStatesItems();
  const tokenGenerationStatesEntries =
    await tokenGenerationService.readAllTokenGenerationStatesItems();
  const tokenGenerationStatesClientPurposeEntries: TokenGenerationStatesClientPurposeEntry[] =
    tokenGenerationStatesEntries
      .map((e) => TokenGenerationStatesClientPurposeEntry.safeParse(e))
      .filter(
        (
          res
        ): res is {
          success: true;
          data: TokenGenerationStatesClientPurposeEntry;
        } => res.success
      )
      .map((res) => res.data);

  const {
    platformPurposeEntries,
    platformAgreementEntries,
    platformCatalogEntries,
    platformClientEntries,
  } = platformStatesEntries.reduce<Accumulator>(
    (acc: Accumulator, e: PlatformStatesGenericEntry) => {
      const parsedPurpose = PlatformStatesPurposeEntry.safeParse(e);
      if (parsedPurpose.success) {
        return {
          ...acc,
          platformPurposeEntries: [
            ...acc.platformPurposeEntries,
            parsedPurpose.data,
          ],
        };
      }

      const parsedAgreement = PlatformStatesAgreementEntry.safeParse(e);
      if (parsedAgreement.success) {
        return {
          ...acc,
          platformAgreementEntries: [
            ...acc.platformAgreementEntries,
            parsedAgreement.data,
          ],
        };
      }

      const parsedCatalog = PlatformStatesCatalogEntry.safeParse(e);
      if (parsedCatalog.success) {
        return {
          ...acc,
          platformCatalogEntries: [
            ...acc.platformCatalogEntries,
            parsedCatalog.data,
          ],
        };
      }

      const parsedClient = PlatformStatesClientEntry.safeParse(e);
      if (parsedClient.success) {
        return {
          ...acc,
          platformClientEntries: [
            ...acc.platformClientEntries,
            parsedClient.data,
          ],
        };
      }

      throw genericInternalError(
        `Unknown platform-states type for entry: ${JSON.stringify(e)} `
      );
    },
    {
      platformPurposeEntries: [],
      platformAgreementEntries: [],
      platformCatalogEntries: [],
      platformClientEntries: [],
    }
  );

  const purposeDifferences =
    await compareReadModelPurposesWithTokenGenReadModel({
      platformStatesEntries: platformPurposeEntries,
      tokenGenerationStatesEntries: tokenGenerationStatesClientPurposeEntries,
      readModelService,
    });
  const agreementDifferences =
    await compareReadModelAgreementsWithTokenGenReadModel({
      platformStatesEntries: platformAgreementEntries,
      tokenGenerationStatesEntries: tokenGenerationStatesClientPurposeEntries,
      readModelService,
    });
  const catalogDifferences =
    await compareReadModelEServicesWithTokenGenReadModel({
      platformStatesEntries: platformCatalogEntries,
      tokenGenerationStatesEntries: tokenGenerationStatesClientPurposeEntries,
      readModelService,
    });
  const clientDifferences = await compareReadModelClientsWithTokenGenReadModel({
    platformStatesEntries: platformClientEntries,
    tokenGenerationStatesEntries,
    readModelService,
  });

  return (
    countPurposeDifferences(purposeDifferences, loggerInstance) +
    countAgreementDifferences(agreementDifferences, loggerInstance) +
    countCatalogDifferences(catalogDifferences, loggerInstance) +
    countClientDifferences(clientDifferences, loggerInstance)
  );
}

// purposes
export async function compareReadModelPurposesWithTokenGenReadModel({
  platformStatesEntries,
  tokenGenerationStatesEntries,
  readModelService,
}: {
  platformStatesEntries: PlatformStatesPurposeEntry[];
  tokenGenerationStatesEntries: TokenGenerationStatesClientPurposeEntry[];
  readModelService: ReturnType<typeof readModelServiceBuilder>;
}): Promise<PurposeDifferencesResult> {
  return zipPurposeDataById(
    platformStatesEntries,
    tokenGenerationStatesEntries,
    await readModelService.getAllReadModelPurposes()
  ).reduce<PurposeDifferencesResult>(
    (acc, [platformStatesEntry, tokenStatesEntries, purpose]) => {
      if (!platformStatesEntry && !tokenStatesEntries.length && !purpose) {
        return acc;
      } else if (!purpose) {
        return [
          ...acc,
          [
            platformStatesEntry
              ? ComparisonPlatformStatesPurposeEntry.parse(platformStatesEntry)
              : undefined,
            tokenStatesEntries && tokenStatesEntries.length > 0
              ? ComparisonTokenStatesPurposeEntry.array().parse(
                  tokenStatesEntries
                )
              : undefined,
            undefined,
          ],
        ];
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
      });

      const {
        isTokenGenerationStatesPurposeCorrect: isTokenGenerationStatesCorrect,
        data: tokenPurposeEntryDiff,
      } = validatePurposeTokenGenerationStates({
        tokenStatesEntries,
        purpose,
        purposeState,
        lastPurposeVersion,
      });

      if (!isPlatformStatesCorrect || !isTokenGenerationStatesCorrect) {
        return [
          ...acc,
          [
            platformPurposeEntryDiff,
            tokenPurposeEntryDiff,
            ComparisonPurpose.parse(purpose),
          ],
        ];
      }

      return acc;
    },
    []
  );
}

function validatePurposePlatformStates({
  platformPurposeEntry,
  purpose,
  purposeState,
  lastPurposeVersion,
}: {
  platformPurposeEntry: PlatformStatesPurposeEntry | undefined;
  purpose: Purpose;
  purposeState: ItemState;
  lastPurposeVersion: PurposeVersion;
}): {
  isPlatformStatesPurposeCorrect: boolean;
  data: ComparisonPlatformStatesPurposeEntry | undefined;
} {
  const isArchived = lastPurposeVersion.state === purposeVersionState.archived;
  const isPlatformStatesPurposeCorrect = !platformPurposeEntry
    ? isArchived
    : !isArchived &&
      getIdFromPlatformStatesPK<PurposeId>(platformPurposeEntry.PK).id ===
        purpose.id &&
      purposeState === platformPurposeEntry.state &&
      platformPurposeEntry.purposeConsumerId === purpose.consumerId &&
      platformPurposeEntry.purposeEserviceId === purpose.eserviceId &&
      platformPurposeEntry.purposeVersionId === lastPurposeVersion.id;

  return {
    isPlatformStatesPurposeCorrect,
    data:
      !isPlatformStatesPurposeCorrect && platformPurposeEntry
        ? {
            PK: platformPurposeEntry.PK,
            state: platformPurposeEntry.state,
            purposeConsumerId: platformPurposeEntry.purposeConsumerId,
            purposeEserviceId: platformPurposeEntry.purposeEserviceId,
            purposeVersionId: platformPurposeEntry.purposeVersionId,
          }
        : undefined,
  };
}

function validatePurposeTokenGenerationStates({
  tokenStatesEntries,
  purpose,
  purposeState,
  lastPurposeVersion,
}: {
  tokenStatesEntries: TokenGenerationStatesClientPurposeEntry[] | undefined;
  purpose: Purpose;
  purposeState: ItemState;
  lastPurposeVersion: PurposeVersion;
}): {
  isTokenGenerationStatesPurposeCorrect: boolean;
  data: ComparisonTokenStatesPurposeEntry[] | undefined;
} {
  if (!tokenStatesEntries || tokenStatesEntries.length === 0) {
    if (lastPurposeVersion.state === purposeVersionState.archived) {
      return {
        isTokenGenerationStatesPurposeCorrect: true,
        data: undefined,
      };
    }
    return {
      isTokenGenerationStatesPurposeCorrect: false,
      data: undefined,
    };
  }

  const wrongTokenStatesEntries = tokenStatesEntries.filter(
    (e) =>
      getPurposeIdFromTokenStatesPK(e.PK) !== purpose.id ||
      e.consumerId !== purpose.consumerId ||
      e.GSIPK_purposeId !== purpose.id ||
      e.purposeState !== purposeState ||
      e.purposeVersionId !== lastPurposeVersion.id ||
      getIdsFromGSIPKClientIdPurposeId(e.GSIPK_clientId_purposeId)
        ?.purposeId !== purpose.id
  );

  return {
    isTokenGenerationStatesPurposeCorrect: wrongTokenStatesEntries.length === 0,
    data:
      wrongTokenStatesEntries.length > 0
        ? wrongTokenStatesEntries.map((entry) => ({
            PK: entry.PK,
            consumerId: entry.consumerId,
            GSIPK_purposeId: entry.GSIPK_purposeId,
            purposeState: entry.purposeState,
            purposeVersionId: entry.purposeVersionId,
            GSIPK_clientId_purposeId: entry.GSIPK_clientId_purposeId,
          }))
        : undefined,
  };
}

export function zipPurposeDataById(
  platformStates: PlatformStatesPurposeEntry[],
  tokenStates: TokenGenerationStatesClientPurposeEntry[],
  purposes: Purpose[]
): Array<
  [
    PlatformStatesPurposeEntry | undefined,
    TokenGenerationStatesClientPurposeEntry[],
    Purpose | undefined
  ]
> {
  const platformStatesMap = new Map<PurposeId, PlatformStatesPurposeEntry>(
    platformStates.map((platformEntry) => [
      unsafeBrandId<PurposeId>(getIdFromPlatformStatesPK(platformEntry.PK).id),
      platformEntry,
    ])
  );

  const tokenStatesMap = tokenStates.reduce((tokenStatesMap, entry) => {
    if (entry.GSIPK_purposeId === undefined) {
      return tokenStatesMap;
    }
    return tokenStatesMap.set(entry.GSIPK_purposeId, [
      ...(tokenStatesMap.get(entry.GSIPK_purposeId) || []),
      entry,
    ]);
  }, new Map<PurposeId, TokenGenerationStatesClientPurposeEntry[]>());

  const purposesMap = new Map(purposes.map((purpose) => [purpose.id, purpose]));

  const allIds = new Set([
    ...platformStatesMap.keys(),
    ...tokenStatesMap.keys(),
    ...purposesMap.keys(),
  ]);

  return Array.from(allIds).map((id) => [
    platformStatesMap.get(id),
    tokenStatesMap.get(id) || [],
    purposesMap.get(id),
  ]);
}

export function countPurposeDifferences(
  differences: PurposeDifferencesResult,
  logger: Logger
): number {
  // eslint-disable-next-line functional/no-let
  let differencesCount = 0;
  differences.forEach(([platformStatesEntry, tokenStatesEntries, purpose]) => {
    if (!purpose) {
      const id = platformStatesEntry
        ? getIdFromPlatformStatesPK(platformStatesEntry.PK).id
        : tokenStatesEntries?.[0]
        ? getPurposeIdFromTokenStatesPK(tokenStatesEntries[0].PK)
        : undefined;

      if (id) {
        logger.error(`Read model purpose not found for id: ${id}`);
        differencesCount++;
      }
    } else if (purpose) {
      logger.error(
        `Purpose states are not equal:
  platform-states entry: ${JSON.stringify(platformStatesEntry)}
  token-generation-states entries: ${JSON.stringify(tokenStatesEntries)}
  purpose read-model: ${JSON.stringify(purpose)}`
      );
      differencesCount++;
    }
  });

  return differencesCount;
}

// agreements
export async function compareReadModelAgreementsWithTokenGenReadModel({
  platformStatesEntries,
  tokenGenerationStatesEntries,
  readModelService,
}: {
  platformStatesEntries: PlatformStatesAgreementEntry[];
  tokenGenerationStatesEntries: TokenGenerationStatesClientPurposeEntry[];
  readModelService: ReturnType<typeof readModelServiceBuilder>;
}): Promise<AgreementDifferencesResult> {
  return zipAgreementDataById(
    platformStatesEntries,
    tokenGenerationStatesEntries,
    await readModelService.getAllReadModelAgreements()
  ).reduce<AgreementDifferencesResult>(
    (acc, [platformStatesEntry, tokenStatesEntries, agreement]) => {
      if (!platformStatesEntry && !tokenStatesEntries.length && !agreement) {
        return acc;
      } else if (!agreement) {
        return [
          ...acc,
          [
            platformStatesEntry
              ? ComparisonPlatformStatesAgreementEntry.parse(
                  platformStatesEntry
                )
              : undefined,
            tokenStatesEntries && tokenStatesEntries.length > 0
              ? ComparisonTokenStatesAgreementEntry.array().parse(
                  tokenStatesEntries
                )
              : undefined,
            undefined,
          ],
        ];
      }

      const agreementItemState = agreementStateToItemState(agreement.state);
      const {
        isPlatformStatesAgreementCorrect: isPlatformStatesAgreementCorrect,
        data: platformAgreementEntryDiff,
      } = validateAgreementPlatformStates({
        platformAgreementEntry: platformStatesEntry,
        agreement,
        agreementItemState,
      });

      const {
        isTokenGenerationStatesAgreementCorrect: isTokenGenerationStatesCorrect,
        data: tokenAgreementEntryDiff,
      } = validateAgreementTokenGenerationStates({
        tokenStatesEntries,
        agreementState: agreementItemState,
        agreement,
      });

      if (
        !isPlatformStatesAgreementCorrect ||
        !isTokenGenerationStatesCorrect
      ) {
        return [
          ...acc,
          [
            platformAgreementEntryDiff,
            tokenAgreementEntryDiff,
            ComparisonAgreement.parse(agreement),
          ],
        ];
      }

      return acc;
    },
    []
  );
}

function validateAgreementPlatformStates({
  platformAgreementEntry,
  agreement,
  agreementItemState,
}: {
  platformAgreementEntry: PlatformStatesAgreementEntry | undefined;
  agreement: Agreement;
  agreementItemState: ItemState;
}): {
  isPlatformStatesAgreementCorrect: boolean;
  data: ComparisonPlatformStatesAgreementEntry | undefined;
} {
  const isArchived = agreement.state === agreementState.archived;
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

function validateAgreementTokenGenerationStates({
  tokenStatesEntries,
  agreementState,
  agreement,
}: {
  tokenStatesEntries: TokenGenerationStatesClientPurposeEntry[];
  agreementState: ItemState;
  agreement: Agreement;
}): {
  isTokenGenerationStatesAgreementCorrect: boolean;
  data: ComparisonTokenStatesAgreementEntry[] | undefined;
} {
  if (!tokenStatesEntries || tokenStatesEntries.length === 0) {
    return {
      isTokenGenerationStatesAgreementCorrect: true,
      data: undefined,
    };
  }

  const wrongTokenStatesEntries = tokenStatesEntries.filter(
    (e) =>
      e.consumerId !== agreement.consumerId ||
      e.agreementId !== agreement.id ||
      e.agreementState !== agreementState ||
      e.GSIPK_consumerId_eserviceId !==
        makeGSIPKConsumerIdEServiceId({
          consumerId: agreement.consumerId,
          eserviceId: agreement.eserviceId,
        }) ||
      getIdsFromGSIPKEServiceIdDescriptorId(e.GSIPK_eserviceId_descriptorId)
        ?.descriptorId !== agreement.descriptorId
  );

  return {
    isTokenGenerationStatesAgreementCorrect:
      wrongTokenStatesEntries.length === 0,
    data:
      wrongTokenStatesEntries.length > 0
        ? wrongTokenStatesEntries.map((entry) => ({
            PK: entry.PK,
            consumerId: entry.consumerId,
            agreementId: entry.agreementId,
            agreementState: entry.agreementState,
            GSIPK_consumerId_eserviceId: entry.GSIPK_consumerId_eserviceId,
            GSIPK_eserviceId_descriptorId: entry.GSIPK_eserviceId_descriptorId,
          }))
        : undefined,
  };
}

export function zipAgreementDataById(
  platformStates: PlatformStatesAgreementEntry[],
  tokenStates: TokenGenerationStatesClientPurposeEntry[],
  agreements: Agreement[]
): Array<
  [
    PlatformStatesAgreementEntry | undefined,
    TokenGenerationStatesClientPurposeEntry[],
    Agreement | undefined
  ]
> {
  const platformStatesMap = new Map<AgreementId, PlatformStatesAgreementEntry>(
    platformStates.map((platformEntry) => [
      unsafeBrandId<AgreementId>(
        getIdFromPlatformStatesPK(platformEntry.PK).id
      ),
      platformEntry,
    ])
  );

  const tokenStatesMap = tokenStates.reduce((tokenStatesMap, entry) => {
    const agreementId = entry.agreementId;
    if (agreementId === undefined) {
      return tokenStatesMap;
    }
    return tokenStatesMap.set(agreementId, [
      ...(tokenStatesMap.get(agreementId) || []),
      entry,
    ]);
  }, new Map<AgreementId, TokenGenerationStatesClientPurposeEntry[]>());

  const agreementsMap = new Map(
    agreements.map((agreement) => [agreement.id, agreement])
  );

  const allIds = new Set([
    ...platformStatesMap.keys(),
    ...tokenStatesMap.keys(),
    ...agreementsMap.keys(),
  ]);
  return Array.from(allIds).map((id) => [
    platformStatesMap.get(id),
    tokenStatesMap.get(id) || [],
    agreementsMap.get(id),
  ]);
}

export function countAgreementDifferences(
  differences: AgreementDifferencesResult,
  logger: Logger
): number {
  // eslint-disable-next-line functional/no-let
  let differencesCount = 0;
  differences.forEach(
    ([platformStatesEntry, tokenStatesEntries, agreement]) => {
      if (!agreement) {
        const id = platformStatesEntry
          ? getIdFromPlatformStatesPK(platformStatesEntry.PK).id
          : tokenStatesEntries?.[0].agreementId ?? undefined;

        if (id) {
          logger.error(`Read model agreement not found for id: ${id}`);
          differencesCount++;
        }
      } else if (agreement) {
        logger.error(
          `Agreement states are not equal:
    platform-states entry: ${JSON.stringify(platformStatesEntry)}
    token-generation-states entries: ${JSON.stringify(tokenStatesEntries)}
    agreement read-model: ${JSON.stringify(agreement)}`
        );
        differencesCount++;
      }
    }
  );

  return differencesCount;
}

// eservices
export async function compareReadModelEServicesWithTokenGenReadModel({
  platformStatesEntries,
  tokenGenerationStatesEntries,
  readModelService,
}: {
  platformStatesEntries: PlatformStatesCatalogEntry[];
  tokenGenerationStatesEntries: TokenGenerationStatesClientPurposeEntry[];
  readModelService: ReturnType<typeof readModelServiceBuilder>;
}): Promise<CatalogDifferencesResult> {
  return zipEServiceDataById(
    platformStatesEntries,
    tokenGenerationStatesEntries,
    await readModelService.getAllReadModelEServices()
  ).reduce<CatalogDifferencesResult>(
    (acc, [platformStatesEntry, tokenStatesEntries, eservice]) => {
      if (!platformStatesEntry && !tokenStatesEntries.length && !eservice) {
        return acc;
      } else if (!eservice) {
        return [
          ...acc,
          [
            platformStatesEntry
              ? ComparisonPlatformStatesCatalogEntry.parse(platformStatesEntry)
              : undefined,
            tokenStatesEntries && tokenStatesEntries.length > 0
              ? ComparisonTokenStatesCatalogEntry.array().parse(
                  tokenStatesEntries
                )
              : undefined,
            undefined,
          ],
        ];
      }

      const lastEServiceDescriptor = getLastEServiceDescriptor(
        eservice.descriptors
      );
      const {
        isPlatformStatesCatalogCorrect: isPlatformStatesCorrect,
        data: platformCatalogEntryDiff,
      } = validateCatalogPlatformStates({
        platformCatalogEntry: platformStatesEntry,
        descriptor: lastEServiceDescriptor,
      });

      const {
        isTokenGenerationStatesCatalogCorrect: isTokenGenerationStatesCorrect,
        data: tokenCatalogEntryDiff,
      } = validateCatalogTokenGenerationStates({
        tokenStatesEntries,
        eservice,
        descriptor: lastEServiceDescriptor,
      });

      if (!isPlatformStatesCorrect || !isTokenGenerationStatesCorrect) {
        return [
          ...acc,
          [
            platformCatalogEntryDiff,
            tokenCatalogEntryDiff,
            ComparisonEService.parse(eservice),
          ],
        ];
      }

      return acc;
    },
    []
  );
}

function validateCatalogPlatformStates({
  platformCatalogEntry,
  descriptor,
}: {
  platformCatalogEntry: PlatformStatesCatalogEntry | undefined;
  descriptor: Descriptor;
}): {
  isPlatformStatesCatalogCorrect: boolean;
  data: ComparisonPlatformStatesCatalogEntry | undefined;
} {
  if (!platformCatalogEntry) {
    return {
      isPlatformStatesCatalogCorrect:
        descriptor.state === descriptorState.archived,
      data: undefined,
    };
  }

  const extractedDescriptorId = getIdFromPlatformStatesPK<ClientId>(
    platformCatalogEntry.PK
  ).descriptorId;
  if (descriptor.id !== extractedDescriptorId) {
    return {
      isPlatformStatesCatalogCorrect: false,
      data: ComparisonPlatformStatesCatalogEntry.parse(platformCatalogEntry),
    };
  }

  const isArchived = descriptor.state === descriptorState.archived;
  const catalogState = descriptorStateToItemState(descriptor.state);

  const isPlatformStatesCatalogCorrect =
    !isArchived &&
    platformCatalogEntry.state === catalogState &&
    platformCatalogEntry.descriptorVoucherLifespan ===
      descriptor.voucherLifespan &&
    descriptor.audience.every((aud) =>
      platformCatalogEntry.descriptorAudience.includes(aud)
    );

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

function validateCatalogTokenGenerationStates({
  tokenStatesEntries,
  eservice,
  descriptor,
}: {
  tokenStatesEntries: TokenGenerationStatesClientPurposeEntry[];
  eservice: EService;
  descriptor: Descriptor;
}): {
  isTokenGenerationStatesCatalogCorrect: boolean;
  data: ComparisonTokenStatesCatalogEntry[] | undefined;
} {
  if (!tokenStatesEntries || tokenStatesEntries.length === 0) {
    return {
      isTokenGenerationStatesCatalogCorrect: true,
      data: undefined,
    };
  }

  const wrongTokenStatesEntries = tokenStatesEntries.filter((e) => {
    const entryDescriptor = eservice.descriptors.find(
      (d) =>
        d.id ===
        getIdsFromGSIPKEServiceIdDescriptorId(e.GSIPK_eserviceId_descriptorId)
          ?.descriptorId
    );
    if (!entryDescriptor || entryDescriptor !== descriptor) {
      return true;
    }

    const catalogState = descriptorStateToItemState(entryDescriptor.state);
    return (
      e.descriptorState !== catalogState ||
      !entryDescriptor.audience.every((aud) =>
        e.descriptorAudience?.includes(aud)
      ) ||
      e.descriptorVoucherLifespan !== entryDescriptor.voucherLifespan ||
      e.GSIPK_eserviceId_descriptorId !==
        makeGSIPKEServiceIdDescriptorId({
          eserviceId: eservice.id,
          descriptorId: entryDescriptor.id,
        }) ||
      getIdsFromGSIPKConsumerIdEServiceId(e.GSIPK_consumerId_eserviceId)
        ?.eserviceId !== eservice.id
    );
  });
  return {
    isTokenGenerationStatesCatalogCorrect: wrongTokenStatesEntries.length === 0,
    data:
      wrongTokenStatesEntries.length > 0
        ? wrongTokenStatesEntries.map(
            (entry): ComparisonTokenStatesCatalogEntry => ({
              PK: entry.PK,
              GSIPK_consumerId_eserviceId: entry.GSIPK_consumerId_eserviceId,
              GSIPK_eserviceId_descriptorId:
                entry.GSIPK_eserviceId_descriptorId,
              descriptorState: entry.descriptorState,
              descriptorAudience: entry.descriptorAudience,
              descriptorVoucherLifespan: entry.descriptorVoucherLifespan,
            })
          )
        : undefined,
  };
}

export function zipEServiceDataById(
  platformStates: PlatformStatesCatalogEntry[],
  tokenStates: TokenGenerationStatesClientPurposeEntry[],
  eservices: EService[]
): Array<
  [
    PlatformStatesCatalogEntry | undefined,
    TokenGenerationStatesClientPurposeEntry[],
    EService | undefined
  ]
> {
  const platformStatesMap = new Map<EServiceId, PlatformStatesCatalogEntry>(
    platformStates.map((platformEntry) => [
      getIdFromPlatformStatesPK<EServiceId>(platformEntry.PK).id,
      platformEntry,
    ])
  );

  const tokenStatesMap = tokenStates.reduce((tokenStatesMap, entry) => {
    const eserviceId = entry.GSIPK_eserviceId_descriptorId
      ? getIdsFromGSIPKEServiceIdDescriptorId(
          entry.GSIPK_eserviceId_descriptorId
        )?.eserviceId
      : entry.GSIPK_consumerId_eserviceId
      ? getIdsFromGSIPKConsumerIdEServiceId(entry.GSIPK_consumerId_eserviceId)
          ?.eserviceId
      : undefined;

    if (!eserviceId) {
      return tokenStatesMap;
    }

    tokenStatesMap.set(eserviceId, [
      ...(tokenStatesMap.get(eserviceId) || []),
      entry,
    ]);

    return tokenStatesMap;
  }, new Map<EServiceId, TokenGenerationStatesClientPurposeEntry[]>());

  const eservicesMap = new Map<EServiceId, EService>(
    eservices.map((eservice) => [eservice.id, eservice])
  );

  const allIds = new Set([
    ...platformStatesMap.keys(),
    ...tokenStatesMap.keys(),
    ...eservicesMap.keys(),
  ]);

  return Array.from(allIds).map((id) => [
    platformStatesMap.get(id),
    tokenStatesMap.get(id) || [],
    eservicesMap.get(id),
  ]);
}

export function countCatalogDifferences(
  differences: CatalogDifferencesResult,
  logger: Logger
): number {
  // eslint-disable-next-line functional/no-let
  let differencesCount = 0;
  differences.forEach(([platformStatesEntry, tokenStatesEntries, eservice]) => {
    if (!eservice) {
      const id = platformStatesEntry
        ? getIdFromPlatformStatesPK(platformStatesEntry.PK).id
        : tokenStatesEntries?.[0].GSIPK_eserviceId_descriptorId
        ? getIdsFromGSIPKEServiceIdDescriptorId(
            tokenStatesEntries[0].GSIPK_eserviceId_descriptorId
          )?.eserviceId
        : undefined;

      if (id) {
        logger.error(`Read model eservice not found for id: ${id}`);
        differencesCount++;
      }
    } else if (eservice) {
      logger.error(
        `Catalog states are not equal:
  platform-states entry: ${JSON.stringify(platformStatesEntry)}
  token-generation-states entries: ${JSON.stringify(tokenStatesEntries)}
  purpose read-model: ${JSON.stringify(eservice)}`
      );
      differencesCount++;
    }
  });

  return differencesCount;
}

// clients
export async function compareReadModelClientsWithTokenGenReadModel({
  platformStatesEntries,
  tokenGenerationStatesEntries,
  readModelService,
}: {
  platformStatesEntries: PlatformStatesClientEntry[];
  tokenGenerationStatesEntries: TokenGenerationStatesGenericEntry[];
  readModelService: ReturnType<typeof readModelServiceBuilder>;
}): Promise<ClientDifferencesResult> {
  return zipClientDataById(
    platformStatesEntries,
    tokenGenerationStatesEntries,
    await readModelService.getAllReadModelClients()
  ).reduce<ClientDifferencesResult>(
    (acc, [platformStatesEntry, tokenStatesEntries, client]) => {
      if (!platformStatesEntry && !tokenStatesEntries?.length && !client) {
        return acc;
      } else if (!client) {
        return [
          ...acc,
          [
            platformStatesEntry
              ? ComparisonPlatformStatesClientEntry.parse(platformStatesEntry)
              : undefined,
            tokenStatesEntries && tokenStatesEntries.length > 0
              ? ComparisonTokenStatesClientEntry.array().parse(
                  tokenStatesEntries
                )
              : undefined,
            undefined,
          ],
        ];
      }

      const {
        isPlatformStatesClientCorrect: isPlatformStatesCorrect,
        data: platformClientEntryDiff,
      } = validateClientPlatformStates({
        platformClientEntry: platformStatesEntry,
        client,
      });

      const {
        isTokenGenerationStatesClientCorrect: isTokenGenerationStatesCorrect,
        data: tokenClientEntryDiff,
      } = validateClientTokenGenerationStates({
        tokenStatesEntries,
        client,
      });
      if (!isPlatformStatesCorrect || !isTokenGenerationStatesCorrect) {
        return [
          ...acc,
          [
            platformClientEntryDiff,
            tokenClientEntryDiff,
            ComparisonClient.parse(client),
          ],
        ];
      }

      return acc;
    },
    []
  );
}

function validateClientPlatformStates({
  platformClientEntry,
  client,
}: {
  platformClientEntry: PlatformStatesClientEntry | undefined;
  client: Client;
}): {
  isPlatformStatesClientCorrect: boolean;
  data: ComparisonPlatformStatesClientEntry | undefined;
} {
  const isPlatformStatesClientCorrect = !platformClientEntry
    ? true
    : platformClientEntry.state === itemState.active &&
      getIdFromPlatformStatesPK<ClientId>(platformClientEntry.PK).id ===
        client.id &&
      platformClientEntry.clientKind ===
        clientKindToTokenGenerationStatesClientKind(client.kind) &&
      platformClientEntry.clientConsumerId === client.consumerId &&
      platformClientEntry.clientPurposesIds.every((p) =>
        client.purposes.includes(p)
      );

  return {
    isPlatformStatesClientCorrect,
    data:
      !isPlatformStatesClientCorrect && platformClientEntry
        ? {
            PK: platformClientEntry.PK,
            clientKind: platformClientEntry.clientKind,
            clientConsumerId: platformClientEntry.clientConsumerId,
            clientPurposesIds: platformClientEntry.clientPurposesIds,
          }
        : undefined,
  };
}

function validateClientTokenGenerationStates({
  tokenStatesEntries,
  client,
}: {
  tokenStatesEntries: TokenGenerationStatesGenericEntry[] | undefined;
  client: Client;
}): {
  isTokenGenerationStatesClientCorrect: boolean;
  data: ComparisonTokenStatesClientEntry[] | undefined;
} {
  if (!tokenStatesEntries || tokenStatesEntries.length === 0) {
    if (client.keys.length === 0) {
      return {
        isTokenGenerationStatesClientCorrect: true,
        data: undefined,
      };
    }

    return {
      isTokenGenerationStatesClientCorrect: false,
      data: undefined,
    };
  }

  const wrongTokenStatesEntries = tokenStatesEntries.reduce<
    ComparisonTokenStatesClientEntry[]
  >((acc, e) => {
    const parsedTokenClientPurposeEntry =
      TokenGenerationStatesClientPurposeEntry.safeParse(e);
    const splitGSIPKClientIdPurposeId = getIdsFromGSIPKClientIdPurposeId(
      parsedTokenClientPurposeEntry.data?.GSIPK_clientId_purposeId
    );

    if (
      // TODO: double check if the purposeId gets removed from client.purposes when ClientPurposeRemoved
      !(
        client.purposes.length !== 0 && parsedTokenClientPurposeEntry.success
      ) ||
      getClientIdFromTokenStatesPK(e.PK) !== client.id ||
      e.consumerId !== client.consumerId ||
      e.clientKind !==
        clientKindToTokenGenerationStatesClientKind(client.kind) ||
      e.GSIPK_clientId !== client.id ||
      client.keys.every(
        (k) => k.kid !== e.GSIPK_kid || k.encodedPem !== e.publicKey
      ) ||
      (parsedTokenClientPurposeEntry.success &&
        (splitGSIPKClientIdPurposeId?.clientId !== client.id ||
          client.purposes.every(
            (p) => p !== splitGSIPKClientIdPurposeId?.purposeId
          )))
    ) {
      return [
        ...acc,
        {
          PK: e.PK,
          consumerId: e.consumerId,
          clientKind: e.clientKind,
          GSIPK_clientId: e.GSIPK_clientId,
          GSIPK_clientId_purposeId:
            parsedTokenClientPurposeEntry.data?.GSIPK_clientId_purposeId,
        },
      ];
    }
    return acc;
  }, []);

  return {
    isTokenGenerationStatesClientCorrect:
      wrongTokenStatesEntries.length === 0 &&
      tokenStatesEntries.length === client.keys.length * client.purposes.length,
    data:
      wrongTokenStatesEntries.length > 0 ? wrongTokenStatesEntries : undefined,
  };
}

export function zipClientDataById(
  platformStates: PlatformStatesClientEntry[],
  tokenStates: TokenGenerationStatesGenericEntry[],
  clients: Client[]
): Array<
  [
    PlatformStatesClientEntry | undefined,
    TokenGenerationStatesGenericEntry[],
    Client | undefined
  ]
> {
  const platformStatesMap = new Map<ClientId, PlatformStatesClientEntry>(
    platformStates.map((platformEntry) => [
      unsafeBrandId<ClientId>(getIdFromPlatformStatesPK(platformEntry.PK).id),
      platformEntry,
    ])
  );

  const tokenStatesMap = tokenStates.reduce((tokenStatesMap, entry) => {
    const clientId = getClientIdFromTokenStatesPK(entry.PK);
    if (clientId === undefined) {
      return tokenStatesMap;
    }
    return tokenStatesMap.set(clientId, [
      ...(tokenStatesMap.get(clientId) || []),
      entry,
    ]);
  }, new Map<ClientId, TokenGenerationStatesGenericEntry[]>());

  const clientMap = new Map<ClientId, Client>(
    clients.map((client) => [unsafeBrandId<ClientId>(client.id), client])
  );

  const allIds = new Set([
    ...platformStatesMap.keys(),
    ...tokenStatesMap.keys(),
    ...clientMap.keys(),
  ]);

  return Array.from(allIds).map((id) => [
    platformStatesMap.get(id),
    tokenStatesMap.get(id) || [],
    clientMap.get(id),
  ]);
}

export function countClientDifferences(
  differences: ClientDifferencesResult,
  logger: Logger
): number {
  // eslint-disable-next-line functional/no-let
  let differencesCount = 0;
  differences.forEach(([platformStatesEntry, tokenStatesEntries, client]) => {
    if (!client) {
      const id = platformStatesEntry
        ? getIdFromPlatformStatesPK(platformStatesEntry.PK).id
        : tokenStatesEntries && tokenStatesEntries.length > 0
        ? getClientIdFromTokenStatesPK(tokenStatesEntries[0].PK)
        : undefined;

      if (id) {
        logger.error(`Read model client not found for id: ${id}`);
        differencesCount++;
      }
    } else {
      logger.error(
        `Client states are not equal.
        platform-states entry: ${JSON.stringify(platformStatesEntry)}
        token-generation-states entries: ${JSON.stringify(tokenStatesEntries)}
        purpose read-model: ${JSON.stringify(client)}`
      );
      differencesCount++;
    }
  });

  return differencesCount;
}

// TODO: copied
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
): ClientKindTokenStates =>
  match<ClientKind, ClientKindTokenStates>(kind)
    .with(clientKind.consumer, () => clientKindTokenStates.consumer)
    .with(clientKind.api, () => clientKindTokenStates.api)
    .exhaustive();

export const descriptorStateToItemState = (state: DescriptorState): ItemState =>
  state === descriptorState.published || state === descriptorState.deprecated
    ? itemState.active
    : itemState.inactive;

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
  PartialPlatformStatesAgreementEntry,
  PartialPlatformStatesPurposeEntry,
  PurposeDifferencesResult,
  PartialAgreement,
  PartialPurpose,
  PartialTokenStatesAgreementEntry,
  PartialTokenStatesPurposeEntry,
  PartialPlatformStatesCatalogEntry,
  PartialTokenStatesCatalogEntry,
  CatalogDifferencesResult,
  PartialEService,
  PartialPlatformStatesClientEntry,
  PartialTokenStatesClientEntry,
  ClientDifferencesResult,
  PartialClient,
} from "../models/types.js";

type Accumulator = {
  platformPurposeEntries: PlatformStatesPurposeEntry[];
  platformAgreementEntries: PlatformStatesAgreementEntry[];
  platformCatalogEntries: PlatformStatesCatalogEntry[];
  platformClientEntries: PlatformStatesClientEntry[];
};

function getLastPurposeVersion(
  purposeVersions: PurposeVersion[]
): PurposeVersion {
  return purposeVersions
    .slice()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
}

function getLastEServiceDescriptor(
  descriptors: Descriptor[]
): Descriptor | undefined {
  return descriptors
    .slice()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
}

function extractIdFromPlatformStatesPK<
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

function extractIdsFromTokenGenerationStatesPK(
  pk: TokenGenerationStatesClientKidPurposePK | TokenGenerationStatesClientKidPK
): {
  clientId: ClientId;
  kid: string;
  purposeId?: PurposeId;
} {
  const splitPK = pk.split("#");
  return {
    clientId: unsafeBrandId<ClientId>(splitPK[1]),
    kid: splitPK[2],
    purposeId: unsafeBrandId<PurposeId>(splitPK[3]),
  };
}

function extractIdsFromGSIPKClientIdPurposeId(gsiPK?: GSIPKClientIdPurposeId):
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

function extractIdsFromGSIPKEServiceIdDescriptorId(
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

function extractIdsFromGSIPKConsumerIdEServiceId(
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

function getIdentificationKey<T extends { PK: string } | { id: string }>(
  obj: T
): string {
  if ("PK" in obj) {
    return unsafeBrandId(obj.PK.split("#")[1]);
  } else {
    return obj.id;
  }
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
        // eslint-disable-next-line functional/immutable-data
        acc.platformPurposeEntries.push(parsedPurpose.data);
      } else {
        const parsedAgreement = PlatformStatesAgreementEntry.safeParse(e);
        if (parsedAgreement.success) {
          // eslint-disable-next-line functional/immutable-data
          acc.platformAgreementEntries.push(parsedAgreement.data);
        } else {
          const parsedCatalog = PlatformStatesCatalogEntry.safeParse(e);
          if (parsedCatalog.success) {
            // eslint-disable-next-line functional/immutable-data
            acc.platformCatalogEntries.push(parsedCatalog.data);
          } else {
            const parsedClient = PlatformStatesClientEntry.safeParse(e);
            if (parsedClient.success) {
              // eslint-disable-next-line functional/immutable-data
              acc.platformClientEntries.push(parsedClient.data);
            } else {
              throw genericInternalError("Unknown platform-states type");
            }
          }
        }
      }
      return acc;
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
      readModel,
    });
  const agreementDifferences =
    await compareReadModelAgreementsWithTokenGenReadModel({
      platformStatesEntries: platformAgreementEntries,
      tokenGenerationStatesEntries: tokenGenerationStatesClientPurposeEntries,
      readModel,
    });
  const catalogDifferences =
    await compareReadModelEServicesWithTokenGenReadModel({
      platformStatesEntries: platformCatalogEntries,
      tokenGenerationStatesEntries: tokenGenerationStatesClientPurposeEntries,
      readModel,
    });
  const clientDifferences = await compareReadModelClientsWithTokenGenReadModel({
    platformStatesEntries: platformClientEntries,
    tokenGenerationStatesEntries,
    readModel,
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
  readModel,
}: {
  platformStatesEntries: PlatformStatesPurposeEntry[];
  tokenGenerationStatesEntries: TokenGenerationStatesClientPurposeEntry[];
  readModel: ReadModelRepository;
}): Promise<PurposeDifferencesResult> {
  const readModelService = readModelServiceBuilder(readModel);
  const [resultsA, resultsB, resultsC] = await Promise.all([
    platformStatesEntries,
    tokenGenerationStatesEntries.filter(
      (e) => TokenGenerationStatesClientPurposeEntry.safeParse(e).success
    ),
    readModelService.getAllReadModelPurposes(),
  ]);

  return zipPurposeDataById(
    resultsA,
    resultsB,
    resultsC
  ).reduce<PurposeDifferencesResult>((acc, [a, b, c]) => {
    if (!c) {
      // eslint-disable-next-line functional/immutable-data
      acc.push([
        a ? PartialPlatformStatesPurposeEntry.parse(a) : undefined,
        b && b.length > 0
          ? PartialTokenStatesPurposeEntry.array().parse(b)
          : undefined,
        undefined,
      ]);
      return acc;
    }

    const purposeState = getPurposeStateFromPurposeVersions(c.versions);
    const lastPurposeVersion = getLastPurposeVersion(c.versions);

    const { status: isPlatformStatesCorrect, data: platformPurposeEntryDiff } =
      validatePurposePlatformStates({
        platformPurposeEntry: a,
        purpose: c,
        purposeState,
        lastPurposeVersion,
      });

    const {
      status: isTokenGenerationStatesCorrect,
      data: tokenPurposeEntryDiff,
    } = validatePurposeTokenGenerationStates({
      tokenEntries: b,
      purpose: c,
      purposeState,
      lastPurposeVersion,
    });

    if (!isPlatformStatesCorrect || !isTokenGenerationStatesCorrect) {
      // eslint-disable-next-line functional/immutable-data
      acc.push([
        platformPurposeEntryDiff,
        tokenPurposeEntryDiff,
        PartialPurpose.parse(c),
      ]);
    }

    return acc;
  }, []);
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
  status: boolean;
  data: PartialPlatformStatesPurposeEntry | undefined;
} {
  const isArchived = lastPurposeVersion.state === purposeVersionState.archived;
  const status = !platformPurposeEntry
    ? isArchived
    : !isArchived &&
      extractIdFromPlatformStatesPK<PurposeId>(platformPurposeEntry.PK).id ===
        purpose.id &&
      purposeState === platformPurposeEntry.state &&
      platformPurposeEntry.purposeConsumerId === purpose.consumerId &&
      platformPurposeEntry.purposeEserviceId === purpose.eserviceId &&
      platformPurposeEntry.purposeVersionId === lastPurposeVersion.id;

  return {
    status,
    data:
      !status && platformPurposeEntry
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
  tokenEntries,
  purpose,
  purposeState,
  lastPurposeVersion,
}: {
  tokenEntries: TokenGenerationStatesClientPurposeEntry[] | undefined;
  purpose: Purpose;
  purposeState: ItemState;
  lastPurposeVersion: PurposeVersion;
}): {
  status: boolean;
  data: PartialTokenStatesPurposeEntry[] | undefined;
} {
  if (!tokenEntries || tokenEntries.length === 0) {
    return {
      status: true,
      data: undefined,
    };
  }

  const foundEntries = tokenEntries.filter(
    (e) =>
      extractIdsFromTokenGenerationStatesPK(e.PK).purposeId !== purpose.id ||
      e.consumerId !== purpose.consumerId ||
      e.GSIPK_purposeId !== purpose.id ||
      e.purposeState !== purposeState ||
      e.purposeVersionId !== lastPurposeVersion.id ||
      extractIdsFromGSIPKClientIdPurposeId(e.GSIPK_clientId_purposeId)
        ?.purposeId !== purpose.id
  );

  return {
    status: foundEntries.length === 0,
    data:
      foundEntries.length > 0
        ? foundEntries.map((entry) => ({
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
  dataA: PlatformStatesPurposeEntry[],
  dataB: TokenGenerationStatesClientPurposeEntry[],
  dataC: Purpose[]
): Array<
  [
    PlatformStatesPurposeEntry | undefined,
    TokenGenerationStatesClientPurposeEntry[],
    Purpose | undefined
  ]
> {
  const allIds = new Set([
    ...dataA.map((d) => getIdentificationKey(d)),
    ...dataB.map((d) => extractIdsFromTokenGenerationStatesPK(d.PK).purposeId),
    ...dataC.map((d) => getIdentificationKey(d)),
  ]);
  return Array.from(allIds).map((id) => [
    dataA.find(
      (d: PlatformStatesPurposeEntry) => getIdentificationKey(d) === id
    ),
    dataB.filter(
      (d: TokenGenerationStatesClientPurposeEntry) =>
        extractIdsFromTokenGenerationStatesPK(d.PK).purposeId === id
    ),
    dataC.find((d: Purpose) => getIdentificationKey(d) === id),
  ]);
}

export function countPurposeDifferences(
  differences: PurposeDifferencesResult,
  logger: Logger
): number {
  // eslint-disable-next-line functional/no-let
  let differencesCount = 0;
  differences.forEach(([platformPurpose, tokenPurpose, readModelPurpose]) => {
    if (!readModelPurpose) {
      if (platformPurpose) {
        logger.error(
          `Read model purpose not found for id: ${
            extractIdFromPlatformStatesPK(platformPurpose.PK).id
          }`
        );
      } else if (tokenPurpose?.[0].GSIPK_purposeId) {
        logger.error(
          `Read model purpose not found for id: ${
            extractIdsFromTokenGenerationStatesPK(tokenPurpose[0].PK).purposeId
          }`
        );
      } else {
        throw genericInternalError(
          "Unexpected error while counting purpose differences"
        );
      }
      differencesCount++;
    } else if (readModelPurpose) {
      logger.error(
        `Purpose states are not equal:
  platform-states entry: ${JSON.stringify(platformPurpose)}
  token-generation-states entries: ${JSON.stringify(tokenPurpose)}
  purpose read-model: ${JSON.stringify(readModelPurpose)}`
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
  readModel,
}: {
  platformStatesEntries: PlatformStatesAgreementEntry[];
  tokenGenerationStatesEntries: TokenGenerationStatesClientPurposeEntry[];
  readModel: ReadModelRepository;
}): Promise<AgreementDifferencesResult> {
  const readModelService = readModelServiceBuilder(readModel);
  const [resultsA, resultsB, resultsC] = await Promise.all([
    platformStatesEntries,
    tokenGenerationStatesEntries,
    readModelService.getAllReadModelAgreements(),
  ]);
  return zipAgreementDataById(
    resultsA,
    resultsB,
    resultsC
  ).reduce<AgreementDifferencesResult>((acc, [a, b, c]) => {
    if (!c) {
      // eslint-disable-next-line functional/immutable-data
      acc.push([
        a ? PartialPlatformStatesAgreementEntry.parse(a) : undefined,
        b && b.length > 0
          ? PartialTokenStatesAgreementEntry.array().parse(b)
          : undefined,
        undefined,
      ]);
      return acc;
    }

    const agreementItemState = agreementStateToItemState(c.state);
    const {
      status: isPlatformStatesCorrect,
      data: platformAgreementEntryDiff,
    } = validateAgreementPlatformStates({
      platformAgreementEntry: a,
      agreement: c,
      agreementItemState,
    });

    const {
      status: isTokenGenerationStatesCorrect,
      data: tokenAgreementEntryDiff,
    } = validateAgreementTokenGenerationStates({
      tokenEntries: b,
      agreementState: agreementItemState,
      agreement: c,
    });

    if (!isPlatformStatesCorrect || !isTokenGenerationStatesCorrect) {
      // eslint-disable-next-line functional/immutable-data
      acc.push([
        platformAgreementEntryDiff,
        tokenAgreementEntryDiff,
        PartialAgreement.parse(c),
      ]);
    }

    return acc;
  }, []);
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
  status: boolean;
  data: PartialPlatformStatesAgreementEntry | undefined;
} {
  const isArchived = agreement.state === agreementState.archived;
  const status = !platformAgreementEntry
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
    status,
    data:
      !status && platformAgreementEntry
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
  tokenEntries,
  agreementState,
  agreement,
}: {
  tokenEntries: TokenGenerationStatesClientPurposeEntry[];
  agreementState: ItemState;
  agreement: Agreement;
}): {
  status: boolean;
  data: PartialTokenStatesAgreementEntry[] | undefined;
} {
  if (!tokenEntries || tokenEntries.length === 0) {
    return {
      status: true,
      data: undefined,
    };
  }

  const foundEntries = tokenEntries.filter(
    (e) =>
      e.consumerId !== agreement.consumerId ||
      e.agreementId !== agreement.id ||
      e.agreementState !== agreementState ||
      e.GSIPK_consumerId_eserviceId !==
        makeGSIPKConsumerIdEServiceId({
          consumerId: agreement.consumerId,
          eserviceId: agreement.eserviceId,
        }) ||
      extractIdsFromGSIPKEServiceIdDescriptorId(e.GSIPK_eserviceId_descriptorId)
        ?.descriptorId !== agreement.descriptorId
  );

  return {
    status: foundEntries.length === 0,
    data:
      foundEntries.length > 0
        ? foundEntries.map((entry) => ({
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
  dataA: PlatformStatesAgreementEntry[],
  dataB: TokenGenerationStatesClientPurposeEntry[],
  dataC: Agreement[]
): Array<
  [
    PlatformStatesAgreementEntry | undefined,
    TokenGenerationStatesClientPurposeEntry[],
    Agreement | undefined
  ]
> {
  const allIds = new Set([
    ...dataA.map((d) => getIdentificationKey(d)),
    ...dataB.map((d) => d.agreementId),
    ...dataC.map((d) => getIdentificationKey(d)),
  ]);
  return Array.from(allIds).map((id) => [
    dataA.find(
      (d: PlatformStatesAgreementEntry) => getIdentificationKey(d) === id
    ),
    dataB.filter(
      (d: TokenGenerationStatesClientPurposeEntry) => d.agreementId === id
    ),
    dataC.find((d: Agreement) => getIdentificationKey(d) === id),
  ]);
}

export function countAgreementDifferences(
  differences: AgreementDifferencesResult,
  logger: Logger
): number {
  // eslint-disable-next-line functional/no-let
  let differencesCount = 0;
  differences.forEach(
    ([platformAgreement, tokenAgreement, readModelAgreement]) => {
      if (!readModelAgreement) {
        if (platformAgreement) {
          logger.error(
            `Read model agreement not found for id: ${
              extractIdFromPlatformStatesPK(platformAgreement.PK).id
            }`
          );
        } else if (tokenAgreement?.[0].agreementId) {
          logger.error(
            `Read model agreement not found for id: ${tokenAgreement[0].agreementId}`
          );
        } else {
          throw genericInternalError(
            "Unexpected error while counting agreement differences"
          );
        }
        differencesCount++;
      } else if (readModelAgreement) {
        logger.error(
          `Agreement states are not equal:
    platform-states entry: ${JSON.stringify(platformAgreement)}
    token-generation-states entries: ${JSON.stringify(tokenAgreement)}
    agreement read-model: ${JSON.stringify(readModelAgreement)}`
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
  readModel,
}: {
  platformStatesEntries: PlatformStatesCatalogEntry[];
  tokenGenerationStatesEntries: TokenGenerationStatesClientPurposeEntry[];
  readModel: ReadModelRepository;
}): Promise<CatalogDifferencesResult> {
  const readModelService = readModelServiceBuilder(readModel);
  const [resultsA, resultsB, resultsC] = await Promise.all([
    platformStatesEntries,
    tokenGenerationStatesEntries,
    readModelService.getAllReadModelEServices(),
  ]);

  return zipEServiceDataById(
    resultsA,
    resultsB,
    resultsC
  ).reduce<CatalogDifferencesResult>((acc, [a, b, c]) => {
    const lastEServiceDescriptor = c
      ? getLastEServiceDescriptor(c.descriptors)
      : undefined;
    if (!c || !lastEServiceDescriptor) {
      // eslint-disable-next-line functional/immutable-data
      acc.push([
        a ? PartialPlatformStatesCatalogEntry.parse(a) : undefined,
        b && b.length > 0
          ? PartialTokenStatesCatalogEntry.array().parse(b)
          : undefined,
        c ? PartialEService.parse(c) : undefined,
      ]);
      return acc;
    }

    const { status: isPlatformStatesCorrect, data: platformCatalogEntryDiff } =
      validateCatalogPlatformStates({
        platformCatalogEntry: a,
        descriptor: lastEServiceDescriptor,
      });

    const {
      status: isTokenGenerationStatesCorrect,
      data: tokenCatalogEntryDiff,
    } = validateCatalogTokenGenerationStates({
      tokenEntries: b,
      eservice: c,
      descriptor: lastEServiceDescriptor,
    });

    if (!isPlatformStatesCorrect || !isTokenGenerationStatesCorrect) {
      // eslint-disable-next-line functional/immutable-data
      acc.push([
        platformCatalogEntryDiff,
        tokenCatalogEntryDiff,
        PartialEService.parse(c),
      ]);
    }

    return acc;
  }, []);
}

function validateCatalogPlatformStates({
  platformCatalogEntry,
  descriptor,
}: {
  platformCatalogEntry: PlatformStatesCatalogEntry | undefined;
  descriptor: Descriptor;
}): {
  status: boolean;
  data: PartialPlatformStatesCatalogEntry | undefined;
} {
  if (!platformCatalogEntry) {
    return {
      status: descriptor.state === descriptorState.archived,
      data: undefined,
    };
  }

  const extractedDescriptorId = extractIdFromPlatformStatesPK<ClientId>(
    platformCatalogEntry.PK
  ).descriptorId;
  if (descriptor.id !== extractedDescriptorId) {
    return {
      status: false,
      data: PartialPlatformStatesCatalogEntry.parse(platformCatalogEntry),
    };
  }

  const isArchived = descriptor.state === descriptorState.archived;
  const catalogState = descriptorStateToItemState(descriptor.state);

  const status =
    !isArchived &&
    platformCatalogEntry.state === catalogState &&
    platformCatalogEntry.descriptorVoucherLifespan ===
      descriptor.voucherLifespan &&
    descriptor.audience.every((aud) =>
      platformCatalogEntry.descriptorAudience.includes(aud)
    );

  return {
    status,
    data: !status
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
  tokenEntries,
  eservice,
  descriptor,
}: {
  tokenEntries: TokenGenerationStatesClientPurposeEntry[];
  eservice: EService;
  descriptor: Descriptor;
}): {
  status: boolean;
  data: PartialTokenStatesCatalogEntry[] | undefined;
} {
  if (!tokenEntries || tokenEntries.length === 0) {
    return {
      status: true,
      data: undefined,
    };
  }

  const foundEntries = tokenEntries.filter((e) => {
    const entryDescriptor = eservice.descriptors.find(
      (d) =>
        d.id ===
        extractIdsFromGSIPKEServiceIdDescriptorId(
          e.GSIPK_eserviceId_descriptorId
        )?.descriptorId
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
      extractIdsFromGSIPKConsumerIdEServiceId(e.GSIPK_consumerId_eserviceId)
        ?.eserviceId !== eservice.id
    );
  });
  return {
    status: foundEntries.length === 0,
    data:
      foundEntries.length > 0
        ? foundEntries.map(
            (entry): PartialTokenStatesCatalogEntry => ({
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
  dataA: PlatformStatesCatalogEntry[],
  dataB: TokenGenerationStatesClientPurposeEntry[],
  dataC: EService[]
): Array<
  [
    PlatformStatesCatalogEntry | undefined,
    TokenGenerationStatesClientPurposeEntry[],
    EService | undefined
  ]
> {
  const allIds = new Set([
    ...dataA.map((d) => getIdentificationKey(d)),
    ...dataB.flatMap((d) =>
      d.GSIPK_eserviceId_descriptorId
        ? [
            extractIdsFromGSIPKEServiceIdDescriptorId(
              d.GSIPK_eserviceId_descriptorId
            )?.eserviceId,
          ]
        : d.GSIPK_consumerId_eserviceId
        ? [
            extractIdsFromGSIPKConsumerIdEServiceId(
              d.GSIPK_consumerId_eserviceId
            )?.eserviceId,
          ]
        : []
    ),
    ...dataC.map((d) => getIdentificationKey(d)),
  ]);
  return Array.from(allIds).map((id) => [
    dataA.find(
      (d: PlatformStatesCatalogEntry) => getIdentificationKey(d) === id
    ),
    dataB.filter(
      (d: TokenGenerationStatesClientPurposeEntry) =>
        extractIdsFromGSIPKEServiceIdDescriptorId(
          d.GSIPK_eserviceId_descriptorId
        )?.eserviceId === id ||
        extractIdsFromGSIPKConsumerIdEServiceId(d.GSIPK_consumerId_eserviceId)
          ?.eserviceId === id
    ),
    dataC.find((d: EService) => getIdentificationKey(d) === id),
  ]);
}

export function countCatalogDifferences(
  differences: CatalogDifferencesResult,
  logger: Logger
): number {
  // eslint-disable-next-line functional/no-let
  let differencesCount = 0;
  differences.forEach(([platformCatalog, tokenCatalog, readModelEService]) => {
    if (!readModelEService) {
      if (platformCatalog) {
        logger.error(
          `Read model eservice not found for ${
            extractIdFromPlatformStatesPK(platformCatalog.PK).id
          }`
        );
      } else if (tokenCatalog?.[0].GSIPK_eserviceId_descriptorId) {
        logger.error(
          `Read model eservice not found for ${
            extractIdsFromGSIPKEServiceIdDescriptorId(
              tokenCatalog[0].GSIPK_eserviceId_descriptorId
            )?.eserviceId
          }`
        );
      } else {
        throw genericInternalError(
          "Unexpected error while counting catalog differences"
        );
      }
      differencesCount++;
    } else if (readModelEService) {
      logger.error(
        `Catalog states are not equal:
  platform-states entry: ${JSON.stringify(platformCatalog)}
  token-generation-states entries: ${JSON.stringify(tokenCatalog)}
  purpose read-model: ${JSON.stringify(readModelEService)}`
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
  readModel,
}: {
  platformStatesEntries: PlatformStatesClientEntry[];
  tokenGenerationStatesEntries: TokenGenerationStatesGenericEntry[];
  readModel: ReadModelRepository;
}): Promise<ClientDifferencesResult> {
  const readModelService = readModelServiceBuilder(readModel);
  const [resultsA, resultsB, resultsC] = await Promise.all([
    platformStatesEntries,
    tokenGenerationStatesEntries,
    readModelService.getAllReadModelClients(),
  ]);
  return zipClientDataById(
    resultsA,
    resultsB,
    resultsC
  ).reduce<ClientDifferencesResult>((acc, [a, b, c]) => {
    // TODO: are missing token entries considered errors or not?
    if (!c || (c && (!a || b?.length === 0))) {
      // eslint-disable-next-line functional/immutable-data
      acc.push([
        a ? PartialPlatformStatesClientEntry.parse(a) : undefined,
        b && b.length > 0
          ? PartialTokenStatesClientEntry.array().parse(b)
          : undefined,
        c ? PartialClient.parse(c) : undefined,
      ]);
      return acc;
    }

    const { status: isPlatformStatesCorrect, data: platformClientEntryDiff } =
      validateClientPlatformStates({
        platformClientEntry: a,
        client: c,
      });

    const {
      status: isTokenGenerationStatesCorrect,
      data: tokenClientEntryDiff,
    } = validateClientTokenGenerationStates({
      tokenEntries: b,
      client: c,
    });
    if (!isPlatformStatesCorrect || !isTokenGenerationStatesCorrect) {
      // eslint-disable-next-line functional/immutable-data
      acc.push([
        platformClientEntryDiff,
        tokenClientEntryDiff,
        PartialClient.parse(c),
      ]);
    }

    return acc;
  }, []);
}

function validateClientPlatformStates({
  platformClientEntry,
  client,
}: {
  platformClientEntry: PlatformStatesClientEntry | undefined;
  client: Client;
}): {
  status: boolean;
  data: PartialPlatformStatesClientEntry | undefined;
} {
  const status = !platformClientEntry
    ? true
    : extractIdFromPlatformStatesPK<ClientId>(platformClientEntry.PK).id ===
        client.id &&
      platformClientEntry.clientKind ===
        clientKindToTokenGenerationStatesClientKind(client.kind) &&
      platformClientEntry.clientConsumerId === client.consumerId &&
      platformClientEntry.clientPurposesIds.every((p) =>
        client.purposes.includes(p)
      );

  return {
    status,
    data:
      !status && platformClientEntry
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
  tokenEntries,
  client,
}: {
  tokenEntries: TokenGenerationStatesGenericEntry[] | undefined;
  client: Client;
}): {
  status: boolean;
  data: PartialTokenStatesClientEntry[] | undefined;
} {
  // TODO: is this correct?
  if (!tokenEntries || tokenEntries.length === 0) {
    return {
      status: true,
      data: undefined,
    };
  }

  const parsedTokenClientPurposeEntry =
    TokenGenerationStatesClientPurposeEntry.safeParse(tokenEntries[0]);
  const foundEntries = tokenEntries.filter(
    (e) =>
      extractIdsFromTokenGenerationStatesPK(e.PK).clientId !== client.id ||
      e.consumerId !== client.consumerId ||
      e.clientKind !==
        clientKindToTokenGenerationStatesClientKind(client.kind) ||
      e.GSIPK_clientId !== client.id ||
      client.keys.some(
        (k) => k.kid !== e.GSIPK_kid || k.encodedPem !== e.publicKey
      ) ||
      (parsedTokenClientPurposeEntry.success
        ? extractIdsFromGSIPKClientIdPurposeId(
            parsedTokenClientPurposeEntry.data.GSIPK_clientId_purposeId
          )?.clientId !== client.id
        : true)
  );

  return {
    status: foundEntries.length === 0,
    data:
      foundEntries.length > 0
        ? foundEntries.map((entry) => ({
            PK: entry.PK,
            consumerId: entry.consumerId,
            clientKind: entry.clientKind,
            GSIPK_clientId: entry.GSIPK_clientId,
            GSIPK_clientId_purposeId:
              parsedTokenClientPurposeEntry.data?.GSIPK_clientId_purposeId,
          }))
        : undefined,
  };
}

export function zipClientDataById(
  dataA: PlatformStatesClientEntry[],
  dataB: TokenGenerationStatesGenericEntry[],
  dataC: Client[]
): Array<
  [
    PlatformStatesClientEntry | undefined,
    TokenGenerationStatesGenericEntry[] | undefined,
    Client | undefined
  ]
> {
  const allIds = new Set(
    [...dataA, ...dataB, ...dataC].map((d) => getIdentificationKey(d))
  );
  return Array.from(allIds).map((id) => [
    dataA.find(
      (d: PlatformStatesClientEntry) => getIdentificationKey(d) === id
    ),
    dataB.filter(
      (d: TokenGenerationStatesGenericEntry) => getIdentificationKey(d) === id
    ),
    dataC.find((d: Client) => getIdentificationKey(d) === id),
  ]);
}

export function countClientDifferences(
  differences: ClientDifferencesResult,
  logger: Logger
): number {
  // eslint-disable-next-line functional/no-let
  let differencesCount = 0;
  differences.forEach(([platformClient, tokenClient, readModelClient]) => {
    if (!readModelClient) {
      if (platformClient) {
        logger.error(
          `Read model client not found for ${
            extractIdFromPlatformStatesPK(platformClient.PK).id
          }`
        );
      } else if (tokenClient && tokenClient.length > 0) {
        logger.error(
          `Read model client not found for ${
            extractIdsFromTokenGenerationStatesPK(tokenClient[0].PK).clientId
          }`
        );
      } else {
        throw genericInternalError(
          "Unexpected error while counting client differences"
        );
      }
      differencesCount++;
    } else if (readModelClient) {
      logger.error(
        `Client states are not equal.
        platform-states entry: ${JSON.stringify(platformClient)}
        token-generation-states entries: ${JSON.stringify(tokenClient)}
        purpose read-model: ${JSON.stringify(readModelClient)}`
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

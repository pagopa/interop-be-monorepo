// TODO: remove no-console
/* eslint-disable no-console */
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
  DescriptorId,
  DescriptorState,
  descriptorState,
  EService,
  EServiceId,
  genericInternalError,
  GSIPKClientIdPurposeId,
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
  PlatformStatesPurposeEntryDiff,
  PurposeDifferencesResult,
  ReducedPurpose,
  TokenGenerationStatesPurposeEntryDiff,
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

// function getLastEServiceDescriptor(descriptors: Descriptor[]): Descriptor {
//   return descriptors
//     .slice()
//     .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
// }

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

function extractIdsFromGSIPKClientIdPurposeId(gsipk: GSIPKClientIdPurposeId): {
  clientId: ClientId;
  purposeId: PurposeId;
} {
  const splitPK = gsipk.split("#");
  return {
    clientId: unsafeBrandId<ClientId>(splitPK[0]),
    purposeId: unsafeBrandId<PurposeId>(splitPK[1]),
  };
}

function extractIdsFromGSIPKEServiceIdDescriptorId(
  gsipk?: GSIPKEServiceIdDescriptorId
):
  | {
      eserviceId: EServiceId;
      descriptorId: DescriptorId;
    }
  | undefined {
  if (!gsipk) {
    return undefined;
  }

  const splitPK = gsipk.split("#");
  return {
    eserviceId: unsafeBrandId<EServiceId>(splitPK[0]),
    descriptorId: unsafeBrandId<DescriptorId>(splitPK[1]),
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
  loggerInstance.info("Program started.\n");
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
        PlatformStatesPurposeEntryDiff.parse(a),
        TokenGenerationStatesPurposeEntryDiff.array().parse(b),
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
        ReducedPurpose.parse(c),
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
  data: PlatformStatesPurposeEntryDiff | undefined;
} {
  // no yes archived -> yes
  // no yes not archived -> no
  // yes yes archived -> no
  // yes yes not archived -> yes check

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
  data: TokenGenerationStatesPurposeEntryDiff[] | undefined;
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
      !e.GSIPK_purposeId ||
      e.GSIPK_purposeId !== purpose.id ||
      !e.purposeState ||
      e.purposeState !== purposeState ||
      !e.purposeVersionId ||
      e.purposeVersionId !== lastPurposeVersion.id ||
      !e.GSIPK_clientId_purposeId ||
      extractIdsFromGSIPKClientIdPurposeId(e.GSIPK_clientId_purposeId)
        .purposeId !== purpose.id
  );

  return {
    status: foundEntries.length === 0,
    data: foundEntries.map((entry) => ({
      PK: entry.PK,
      consumerId: entry.consumerId,
      GSIPK_purposeId: entry.GSIPK_purposeId,
      purposeState: entry.purposeState,
      purposeVersionId: entry.purposeVersionId,
      GSIPK_clientId_purposeId: entry.GSIPK_clientId_purposeId,
    })),
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
  const allIds = new Set(
    [...dataA, ...dataC].map((d) => getIdentificationKey(d))
  );
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
    if (!readModelPurpose && (platformPurpose || tokenPurpose)) {
      const missingId = platformPurpose
        ? extractIdFromPlatformStatesPK(platformPurpose.PK).id
        : tokenPurpose
        ? extractIdsFromTokenGenerationStatesPK(tokenPurpose[0].PK).purposeId
        : undefined;
      console.warn(`Read model purpose not found for id: ${missingId}`);
      // TODO
      logger.error(`Read model purpose not found for id: ${missingId}`);
      differencesCount++;
    } else if (readModelPurpose) {
      logger.error(
        `Purpose states are not equal:
  platform-states entry: ${JSON.stringify(platformPurpose)}
  token-generation-states entries: ${JSON.stringify(tokenPurpose)}
  purpose read-model: ${JSON.stringify(readModelPurpose)}`
      );
      console.warn(
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
// TODO: rename
export async function compareReadModelAgreementsWithTokenGenReadModel({
  platformStatesEntries,
  tokenGenerationStatesEntries,
  readModel,
}: {
  platformStatesEntries: PlatformStatesAgreementEntry[];
  tokenGenerationStatesEntries: TokenGenerationStatesClientPurposeEntry[];
  readModel: ReadModelRepository;
}): Promise<
  Array<
    [
      PlatformStatesAgreementEntry | undefined,
      TokenGenerationStatesClientPurposeEntry[],
      Agreement | undefined
    ]
  >
> {
  const readModelService = readModelServiceBuilder(readModel);
  const [resultsA, resultsB, resultsC] = await Promise.all([
    platformStatesEntries,
    tokenGenerationStatesEntries,
    readModelService.getAllReadModelAgreements(),
  ]);

  return zipAgreementDataById(resultsA, resultsB, resultsC).filter(
    ([a, b, c]) => {
      if (c) {
        const agreementState = agreementStateToItemState(c.state);
        const isPlatformStatesCorrect = a
          ? validateAgreementPlatformStates({
              platformAgreementEntry: a,
              agreement: c,
              agreementState,
            })
          : true;

        const isTokenGenerationStatesCorrect = b
          ? validateAgreementTokenGenerationStates({
              tokenEntries: b,
              agreementState,
              agreement: c,
            })
          : true;

        if (isPlatformStatesCorrect && isTokenGenerationStatesCorrect) {
          return false;
        }
      }
      return true;
    }
  );
}

function validateAgreementPlatformStates({
  platformAgreementEntry,
  agreement,
  agreementState,
}: {
  platformAgreementEntry: PlatformStatesAgreementEntry;
  agreement: Agreement;
  agreementState: ItemState;
}): boolean {
  return (
    agreementState === platformAgreementEntry.state &&
    platformAgreementEntry.GSIPK_consumerId_eserviceId ===
      makeGSIPKConsumerIdEServiceId({
        consumerId: agreement.consumerId,
        eserviceId: agreement.eserviceId,
      }) &&
    platformAgreementEntry.agreementDescriptorId === agreement.descriptorId
  );
}

function validateAgreementTokenGenerationStates({
  tokenEntries,
  agreementState,
  agreement,
}: {
  tokenEntries: TokenGenerationStatesClientPurposeEntry[];
  agreementState: ItemState;
  agreement: Agreement;
}): boolean {
  if (!tokenEntries || tokenEntries.length === 0) {
    return true;
  }

  return tokenEntries.some(
    (e) =>
      e.consumerId === agreement.consumerId &&
      (!e.agreementId || e.agreementId === agreement.id) &&
      (!e.agreementState || e.agreementState === agreementState) &&
      (!e.GSIPK_consumerId_eserviceId ||
        e.GSIPK_consumerId_eserviceId ===
          makeGSIPKConsumerIdEServiceId({
            consumerId: agreement.consumerId,
            eserviceId: agreement.eserviceId,
          })) &&
      (!e.GSIPK_eserviceId_descriptorId ||
        extractIdsFromGSIPKEServiceIdDescriptorId(
          e.GSIPK_eserviceId_descriptorId
        )?.descriptorId === agreement.descriptorId)
  );
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
  const allIds = new Set(
    [...dataA, ...dataC].map((d) => getIdentificationKey(d))
  );
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
  differences: Array<
    [
      PlatformStatesAgreementEntry | undefined,
      TokenGenerationStatesClientPurposeEntry[],
      Agreement | undefined
    ]
  >,
  logger: Logger
): number {
  // eslint-disable-next-line functional/no-let
  let differencesCount = 0;
  differences.forEach(
    ([platformAgreement, tokenAgreement, readModelAgreement]) => {
      if (platformAgreement && !readModelAgreement) {
        console.warn(
          `Read model agreement not found for ${platformAgreement.PK}`
        );
        // TODO
        logger.error(
          `Read model agreement not found for ${platformAgreement.PK}`
        );
        differencesCount++;
      } else if (platformAgreement && readModelAgreement) {
        logger.error(
          `Agreement states are not equal.
  platform-states entry: ${JSON.stringify(platformAgreement)}
  token-generation-states entries: ${JSON.stringify(tokenAgreement)}
  purpose read-model: ${JSON.stringify(readModelAgreement)}`
        );
        console.warn(
          `Agreement states are not equal.
  platform-states entry: ${JSON.stringify(platformAgreement)}
  token-generation-states entries: ${JSON.stringify(tokenAgreement)}
  purpose read-model: ${JSON.stringify(readModelAgreement)}`
        );
        differencesCount++;
      }
      // else if (
      //   !platformAgreement &&
      //   readModelAgreement &&
      //   readModelAgreement.state !== agreementState.archived
      // ) {
      //   logger.error(
      //     `platform-states agreement entry not found for read model agreement:\n${JSON.stringify(
      //       readModelAgreement
      //     )}`
      //   );
      //   console.warn(
      //     `platform-states agreement entry not found for read model agreement:\n${JSON.stringify(
      //       readModelAgreement
      //     )}`
      //   );
      //   differencesCount++;
      // }
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
}): Promise<
  Array<
    [
      PlatformStatesCatalogEntry | undefined,
      TokenGenerationStatesClientPurposeEntry[],
      EService | undefined
    ]
  >
> {
  const readModelService = readModelServiceBuilder(readModel);
  const [resultsA, resultsB, resultsC] = await Promise.all([
    platformStatesEntries,
    tokenGenerationStatesEntries,
    readModelService.getAllReadModelEServices(),
  ]);

  return zipEServiceDataById(resultsA, resultsB, resultsC).filter(
    ([a, b, c]) => {
      if (c) {
        const isPlatformStatesCorrect = a
          ? validateCatalogPlatformStates({
              platformCatalogEntry: a,
              eservice: c,
            })
          : true;
        const isTokenGenerationStatesCorrect = b
          ? validateCatalogTokenGenerationStates({
              tokenEntries: b,
              eservice: c,
            })
          : true;
        if (isPlatformStatesCorrect && isTokenGenerationStatesCorrect) {
          return false;
        }
      }

      return true;
    }
  );
}

function validateCatalogPlatformStates({
  platformCatalogEntry,
  eservice,
}: {
  platformCatalogEntry: PlatformStatesCatalogEntry;
  eservice: EService;
}): boolean {
  const descriptor = eservice.descriptors.find(
    (d) =>
      d.id ===
      extractIdFromPlatformStatesPK<ClientId>(platformCatalogEntry.PK)
        .descriptorId
  );
  if (!descriptor) {
    throw genericInternalError(
      `Descriptor not found in EService with id ${eservice.id}`
    );
  }

  const catalogState = descriptorStateToItemState(descriptor.state);

  return (
    platformCatalogEntry.state === catalogState &&
    platformCatalogEntry.descriptorVoucherLifespan ===
      descriptor.voucherLifespan &&
    platformCatalogEntry.descriptorAudience.every((aud) =>
      descriptor.audience.includes(aud)
    )
  );
}

function validateCatalogTokenGenerationStates({
  tokenEntries,
  eservice,
}: {
  tokenEntries: TokenGenerationStatesClientPurposeEntry[];
  eservice: EService;
}): boolean {
  if (!tokenEntries || tokenEntries.length === 0) {
    return true;
  }

  return tokenEntries.some((e) =>
    // TODO: where's consumerId?
    {
      const descriptor = eservice.descriptors.find(
        (d) =>
          d.id ===
          extractIdsFromGSIPKEServiceIdDescriptorId(
            e.GSIPK_eserviceId_descriptorId
          )?.descriptorId
      );
      if (!descriptor) {
        throw genericInternalError(
          `Descriptor not found in EService with id ${eservice.id}`
        );
      }

      const catalogState = descriptorStateToItemState(descriptor.state);
      return (
        (!e.descriptorState || e.descriptorState === catalogState) &&
        (!e.descriptorAudience ||
          e.descriptorAudience.every((aud) =>
            descriptor.audience.includes(aud)
          )) &&
        (!e.descriptorVoucherLifespan ||
          e.descriptorVoucherLifespan === descriptor.voucherLifespan) &&
        (!e.GSIPK_eserviceId_descriptorId ||
          e.GSIPK_eserviceId_descriptorId ===
            makeGSIPKEServiceIdDescriptorId({
              eserviceId: eservice.id,
              descriptorId: descriptor.id,
            }))
      );
    }
  );
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
  const allIds = new Set(
    [...dataA, ...dataC].map((d) => getIdentificationKey(d))
  );
  return Array.from(allIds).map((id) => [
    dataA.find(
      (d: PlatformStatesCatalogEntry) => getIdentificationKey(d) === id
    ),
    dataB.filter(
      (d: TokenGenerationStatesClientPurposeEntry) =>
        extractIdsFromGSIPKEServiceIdDescriptorId(
          d.GSIPK_eserviceId_descriptorId
        )?.eserviceId === id
    ),
    dataC.find((d: EService) => getIdentificationKey(d) === id),
  ]);
}

export function countCatalogDifferences(
  differences: Array<
    [
      PlatformStatesCatalogEntry | undefined,
      TokenGenerationStatesClientPurposeEntry[],
      EService | undefined
    ]
  >,
  logger: Logger
): number {
  // eslint-disable-next-line functional/no-let
  let differencesCount = 0;
  differences.forEach(([platformCatalog, tokenCatalog, readModelEService]) => {
    if (platformCatalog && !readModelEService) {
      logger.error(`Read model eservice not found for ${platformCatalog.PK}`);
      console.warn(`Read model eservice not found for ${platformCatalog.PK}`);
      differencesCount++;
    } else if (platformCatalog && readModelEService) {
      logger.error(
        `Catalog states are not equal.
        platform-states entry: ${JSON.stringify(platformCatalog)}
        token-generation-states entries: ${JSON.stringify(tokenCatalog)}
        purpose read-model: ${JSON.stringify(readModelEService)}`
      );
      console.warn(
        `States are not equal for platform-states catalog entry:\n ${JSON.stringify(
          platformCatalog
        )} \nand eservice read-model:\n ${JSON.stringify(readModelEService)}`
      );
      differencesCount++;
    }
    // else if (!platformCatalog && readModelEService) {
    //   const lastEServiceDescriptor = getLastEServiceDescriptor(
    //     readModelEService.descriptors
    //   );
    //   if (lastEServiceDescriptor.state !== descriptorState.archived) {
    //     logger.error(
    //       `platform-states catalog entry not found for read model eservice:\n${JSON.stringify(
    //         readModelEService
    //       )}`
    //     );
    //     console.warn(
    //       `platform-states catalog entry not found for read model eservice:\n${JSON.stringify(
    //         readModelEService
    //       )}`
    //     );
    //     differencesCount++;
    //   }
    // }
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
}): Promise<
  Array<
    [
      PlatformStatesClientEntry | undefined,
      TokenGenerationStatesGenericEntry[] | undefined,
      Client | undefined
    ]
  >
> {
  const readModelService = readModelServiceBuilder(readModel);
  const [resultsA, resultsB, resultsC] = await Promise.all([
    platformStatesEntries,
    tokenGenerationStatesEntries,
    readModelService.getAllReadModelClients(),
  ]);
  return zipClientDataById(resultsA, resultsB, resultsC).filter(([a, b, c]) => {
    if (c) {
      const isPlatformStatesCorrect = a
        ? validateClientPlatformStates({
            platformClientEntry: a,
            client: c,
          })
        : true;
      const isTokenGenerationStatesCorrect = b
        ? validateClientTokenGenerationStates({
            tokenEntries: b,
            client: c,
          })
        : true;
      if (isPlatformStatesCorrect && isTokenGenerationStatesCorrect) {
        return false;
      }
    }
    return true;
  });
}

function validateClientPlatformStates({
  platformClientEntry,
  client,
}: {
  platformClientEntry: PlatformStatesClientEntry;
  client: Client;
}): boolean {
  return (
    extractIdFromPlatformStatesPK<ClientId>(platformClientEntry.PK).id ===
      client.id &&
    platformClientEntry.clientKind ===
      clientKindToTokenGenerationStatesClientKind(client.kind) &&
    platformClientEntry.clientConsumerId === client.consumerId &&
    platformClientEntry.clientPurposesIds.every((p) =>
      client.purposes.includes(p)
    )
  );
}

function validateClientTokenGenerationStates({
  tokenEntries,
  client,
}: {
  tokenEntries: TokenGenerationStatesGenericEntry[] | undefined;
  client: Client;
}): boolean {
  if (!tokenEntries || tokenEntries.length === 0) {
    return true;
  }

  const parsedTokenClientPurposeEntry =
    TokenGenerationStatesClientPurposeEntry.safeParse(tokenEntries[0]);

  return tokenEntries.some(
    (e) =>
      extractIdsFromTokenGenerationStatesPK(e.PK).clientId === client.id &&
      e.consumerId === client.consumerId &&
      e.clientKind ===
        clientKindToTokenGenerationStatesClientKind(client.kind) &&
      e.GSIPK_clientId === client.id &&
      client.keys.some(
        (k) => k.kid === e.GSIPK_kid && k.encodedPem === e.publicKey
      ) &&
      // TODO: should missing optional fields be considered correct or not?
      (parsedTokenClientPurposeEntry.success
        ? parsedTokenClientPurposeEntry.data.GSIPK_clientId_purposeId
          ? extractIdsFromGSIPKClientIdPurposeId(
              parsedTokenClientPurposeEntry.data.GSIPK_clientId_purposeId
            ).clientId === client.id
          : true
        : false)
  );
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
    [...dataA, ...dataC].map((d) => getIdentificationKey(d))
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
  differences: Array<
    [
      PlatformStatesClientEntry | undefined,
      TokenGenerationStatesGenericEntry[] | undefined,
      Client | undefined
    ]
  >,
  logger: Logger
): number {
  // eslint-disable-next-line functional/no-let
  let differencesCount = 0;
  differences.forEach(([platformClient, tokenClient, readModelClient]) => {
    if (platformClient && !readModelClient) {
      logger.error(`Read model client not found for ${platformClient.PK}`);
      console.warn(`Read model client not found for ${platformClient.PK}`);
      differencesCount++;
    } else if (platformClient && readModelClient) {
      logger.error(
        `Client states are not equal.
        platform-states entry: ${JSON.stringify(platformClient)}
        token-generation-states entries: ${JSON.stringify(tokenClient)}
        purpose read-model: ${JSON.stringify(readModelClient)}`
      );
      console.warn(
        `Client states are not equal.
        platform-states entry: ${JSON.stringify(platformClient)}
        token-generation-states entries: ${JSON.stringify(tokenClient)}
        purpose read-model: ${JSON.stringify(readModelClient)}`
      );
      differencesCount++;
    }
    // else if (!platformClient && readModelClient) {
    //   logger.error(``);
    //   // TODO: how to tell if client is deleted
    //   differencesCount++;
    // }
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

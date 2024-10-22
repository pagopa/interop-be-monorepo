// TODO: remove no-console
/* eslint-disable no-console */
import { ReadModelRepository, logger, Logger } from "pagopa-interop-commons";
import {
  Agreement,
  agreementState,
  AgreementState,
  Client,
  clientKind,
  ClientKind,
  ClientKindTokenStates,
  clientKindTokenStates,
  Descriptor,
  DescriptorState,
  descriptorState,
  EService,
  generateId,
  genericInternalError,
  itemState,
  ItemState,
  makeGSIPKConsumerIdEServiceId,
  makeGSIPKEServiceIdDescriptorId,
  PlatformStatesAgreementEntry,
  PlatformStatesCatalogEntry,
  PlatformStatesClientEntry,
  PlatformStatesGenericEntry,
  PlatformStatesPurposeEntry,
  Purpose,
  PurposeVersion,
  purposeVersionState,
  TokenGenerationStatesClientPurposeEntry,
  TokenGenerationStatesGenericEntry,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { readModelServiceBuilder } from "../services/readModelService.js";
import { tokenGenerationReadModelServiceBuilder } from "../services/tokenGenerationReadModelService.js";
import { config } from "../configs/config.js";

type Accumulator = {
  platformPurposeEntries: PlatformStatesPurposeEntry[];
  platformAgreementEntries: PlatformStatesAgreementEntry[];
  platformCatalogEntries: PlatformStatesCatalogEntry[];
  platformClientEntries: PlatformStatesClientEntry[];
};

export function getLastPurposeVersion(
  purposeVersions: PurposeVersion[]
): PurposeVersion {
  return purposeVersions
    .slice()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
}

export function getLastEServiceDescriptor(
  descriptors: Descriptor[]
): Descriptor {
  return descriptors
    .slice()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
}

const loggerInstance = logger({
  serviceName: "token-generation-readmodel-checker-verifier",
  correlationId: generateId(),
});

export async function compareTokenGenerationReadModel(
  dynamoDBClient: DynamoDBClient
): Promise<void> {
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
  const purposeDifferences = await compareReadModelPurposesWithPlatformStates({
    platformStatesEntries: platformPurposeEntries,
    tokenGenerationStatesEntries: tokenGenerationStatesClientPurposeEntries,
    readModel,
  });
  const agreementDifferences =
    await compareReadModelAgreementsWithPlatformStates({
      platformStatesEntries: platformAgreementEntries,
      tokenGenerationStatesEntries: tokenGenerationStatesClientPurposeEntries,
      readModel,
    });
  const catalogDifferences = await compareReadModelEServicesWithPlatformStates({
    platformStatesEntries: platformCatalogEntries,
    tokenGenerationStatesEntries: tokenGenerationStatesClientPurposeEntries,
    readModel,
  });
  console.log("Catalog differences: ", catalogDifferences);
  const clientDifferences = await compareReadModelClientsWithPlatformStates({
    platformStatesEntries: platformClientEntries,
    tokenGenerationStatesEntries,
    readModel,
  });

  const differencesCount =
    countPurposeDifferences(purposeDifferences, loggerInstance) +
    countAgreementDifferences(agreementDifferences, loggerInstance) +
    countCatalogDifferences(catalogDifferences, loggerInstance) +
    countClientDifferences(clientDifferences, loggerInstance);
  console.log("Differences count: ", differencesCount);
  if (differencesCount > 0) {
    process.exit(1);
  }

  console.log("No differences found");
}

function getIdentificationKey<T extends { PK: string } | { id: string }>(
  obj: T
): string {
  if ("PK" in obj) {
    // TODO: make extract functions
    return obj.PK.split("#")[1];
  } else {
    return obj.id;
  }
}

// purposes
export async function compareReadModelPurposesWithPlatformStates({
  platformStatesEntries,
  tokenGenerationStatesEntries,
  readModel,
}: {
  platformStatesEntries: PlatformStatesPurposeEntry[];
  tokenGenerationStatesEntries: TokenGenerationStatesClientPurposeEntry[];
  readModel: ReadModelRepository;
}): Promise<
  Array<
    [
      PlatformStatesPurposeEntry | undefined,
      TokenGenerationStatesClientPurposeEntry[],
      Purpose | undefined
    ]
  >
> {
  const readModelService = readModelServiceBuilder(readModel);
  const [resultsA, resultsB, resultsC] = await Promise.all([
    platformStatesEntries,
    tokenGenerationStatesEntries.filter(
      (e) => TokenGenerationStatesClientPurposeEntry.safeParse(e).success
    ),
    readModelService.getAllReadModelPurposes(),
  ]);
  return zipPurposeDataById(resultsA, resultsB, resultsC).filter(
    ([a, b, c]) => {
      if (a && c) {
        const purposeState = getPurposeStateFromPurposeVersions(c.versions);
        const lastPurposeVersion = getLastPurposeVersion(c.versions);
        const isPlatformStatesCorrect = validatePurposePlatformStates({
          platformPurposeEntry: a,
          purpose: c,
          purposeState,
          lastPurposeVersion,
        });
        const isTokenGenerationStatesCorrect =
          validatePurposeTokenGenerationStates({
            tokenEntries: b,
            purpose: c,
            purposeState,
            lastPurposeVersion,
          });

        if (isPlatformStatesCorrect && isTokenGenerationStatesCorrect) {
          return false;
        }
      }
      return true;
    }
  );
}

function validatePurposePlatformStates({
  platformPurposeEntry,
  purpose,
  purposeState,
  lastPurposeVersion,
}: {
  platformPurposeEntry: PlatformStatesPurposeEntry;
  purpose: Purpose;
  purposeState: ItemState;
  lastPurposeVersion: PurposeVersion;
}): boolean {
  return (
    platformPurposeEntry.PK.split("#")[1] === purpose.id &&
    purposeState === platformPurposeEntry.state &&
    platformPurposeEntry.purposeConsumerId === purpose.consumerId &&
    platformPurposeEntry.purposeEserviceId === purpose.eserviceId &&
    platformPurposeEntry.purposeVersionId === lastPurposeVersion.id
  );
}

function validatePurposeTokenGenerationStates({
  tokenEntries,
  purpose,
  purposeState,
  lastPurposeVersion,
}: {
  tokenEntries: TokenGenerationStatesClientPurposeEntry[];
  purpose: Purpose;
  purposeState: ItemState;
  lastPurposeVersion: PurposeVersion;
}): boolean {
  if (!tokenEntries || tokenEntries.length === 0) {
    return true;
  }

  return tokenEntries.some(
    (e) =>
      e.PK.split("#")[3] === purpose.id &&
      e.consumerId === purpose.consumerId &&
      (!e.GSIPK_purposeId || e.GSIPK_purposeId === purpose.id) &&
      (!e.purposeState || e.purposeState === purposeState) &&
      (!e.purposeVersionId || e.purposeVersionId === lastPurposeVersion.id) &&
      (!e.GSIPK_clientId_purposeId ||
        e.GSIPK_clientId_purposeId.split("#")[1] === purpose.id)
  );
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
      (d: TokenGenerationStatesClientPurposeEntry) => d.PK.split("#")[3] === id
    ),
    dataC.find((d: Purpose) => getIdentificationKey(d) === id),
  ]);
}

export function countPurposeDifferences(
  differences: Array<
    [
      PlatformStatesPurposeEntry | undefined,
      TokenGenerationStatesClientPurposeEntry[],
      Purpose | undefined
    ]
  >,
  logger: Logger
): number {
  // eslint-disable-next-line functional/no-let
  let differencesCount = 0;
  differences.forEach(([platformPurpose, _tokenPurpose, readModelPurpose]) => {
    if (platformPurpose && !readModelPurpose) {
      console.warn(
        `Read model purpose not found for platform-states entry with PK: ${platformPurpose.PK}`
      );
      // TODO
      logger.error(
        `Read model purpose not found for platform-states entry with PK: ${platformPurpose.PK}`
      );
      differencesCount++;
    } else if (platformPurpose && readModelPurpose) {
      console.warn("Platform states and read model states are not equal");
      logger.error(
        `States are not equal for platform-states purpose entry:\n ${JSON.stringify(
          platformPurpose
        )} \nand purpose read-model:\n ${JSON.stringify(readModelPurpose)}`
      );
      console.warn(
        `States are not equal for platform-states purpose entry:\n ${JSON.stringify(
          platformPurpose
        )} \nand purpose read-model:\n ${JSON.stringify(readModelPurpose)}`
      );
      differencesCount++;
    } else if (!platformPurpose && readModelPurpose) {
      const lastPurposeVersion = getLastPurposeVersion(
        readModelPurpose.versions
      );

      if (lastPurposeVersion.state !== purposeVersionState.archived) {
        logger.error(
          `platform-states purpose entry not found for read model purpose:\n${JSON.stringify(
            readModelPurpose
          )}`
        );
        console.warn(
          `platform-states purpose entry not found for read model purpose:\n${JSON.stringify(
            readModelPurpose
          )}`
        );
        differencesCount++;
      }
    }
  });

  return differencesCount;
}

// agreements
export async function compareReadModelAgreementsWithPlatformStates({
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
      if (a && c) {
        const agreementState = agreementStateToItemState(c.state);
        const isPlatformStatesCorrect = validateAgreementPlatformStates({
          platformAgreementEntry: a,
          agreement: c,
          agreementState,
        });
        const isTokenGenerationStatesCorrect =
          validateAgreementTokenGenerationStates({
            platformAgreementEntry: a,
            tokenEntries: b,
            agreement: c,
          });

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
  platformAgreementEntry,
  tokenEntries,
  agreement,
}: {
  platformAgreementEntry: PlatformStatesAgreementEntry;
  tokenEntries: TokenGenerationStatesClientPurposeEntry[];
  agreement: Agreement;
}): boolean {
  if (!tokenEntries || tokenEntries.length === 0) {
    return true;
  }

  return tokenEntries.some(
    (e) =>
      e.consumerId === agreement.consumerId &&
      (!e.agreementId || e.agreementId === agreement.id) &&
      (!e.agreementState ||
        e.agreementState === platformAgreementEntry.state) &&
      (!e.GSIPK_consumerId_eserviceId ||
        e.GSIPK_consumerId_eserviceId ===
          makeGSIPKConsumerIdEServiceId({
            consumerId: agreement.consumerId,
            eserviceId: agreement.eserviceId,
          }))
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
    ([platformAgreement, _tokenAgreement, readModelAgreement]) => {
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
          `States are not equal for platform-states agreement entry:\n ${JSON.stringify(
            platformAgreement
          )} \nand agreement read-model:\n ${JSON.stringify(
            readModelAgreement
          )}`
        );
        console.warn(
          `States are not equal for platform-states agreement entry:\n ${JSON.stringify(
            platformAgreement
          )} \nand agreement read-model:\n ${JSON.stringify(
            readModelAgreement
          )}`
        );
        differencesCount++;
      } else if (
        !platformAgreement &&
        readModelAgreement &&
        readModelAgreement.state !== agreementState.archived
      ) {
        logger.error(
          `platform-states agreement entry not found for read model agreement:\n${JSON.stringify(
            readModelAgreement
          )}`
        );
        console.warn(
          `platform-states agreement entry not found for read model agreement:\n${JSON.stringify(
            readModelAgreement
          )}`
        );
        differencesCount++;
      }
    }
  );

  return differencesCount;
}

// clients
export async function compareReadModelClientsWithPlatformStates({
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
    if (a && c) {
      const isPlatformStatesCorrect = validateClientPlatformStates({
        platformClientEntry: a,
        client: c,
      });
      const isTokenGenerationStatesCorrect =
        validateClientTokenGenerationStates({
          platformClientEntry: a,
          tokenEntries: b,
          client: c,
        });

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
    platformClientEntry.PK.split("#")[1] === client.id &&
    platformClientEntry.clientKind ===
      clientKindToTokenGenerationStatesClientKind(client.kind) &&
    platformClientEntry.clientConsumerId === client.consumerId &&
    platformClientEntry.clientPurposesIds.every((p) =>
      client.purposes.includes(p)
    )
  );
}

function validateClientTokenGenerationStates({
  platformClientEntry,
  tokenEntries,
  client,
}: {
  platformClientEntry: PlatformStatesClientEntry;
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
      e.PK.split("#")[1] === client.id &&
      e.consumerId === platformClientEntry.clientConsumerId &&
      e.clientKind === platformClientEntry.clientKind &&
      e.GSIPK_clientId === platformClientEntry.PK.split("#")[1] &&
      client.keys.some(
        (k) => k.kid === e.GSIPK_kid && k.encodedPem === e.publicKey
      ) &&
      // TODO: should missing optional fields be considered correct or not?
      (parsedTokenClientPurposeEntry.success
        ? parsedTokenClientPurposeEntry.data.GSIPK_clientId_purposeId
          ? parsedTokenClientPurposeEntry.data.GSIPK_clientId_purposeId.split(
              "#"
            )[0] === client.id
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
  differences.forEach(([platformClient, readModelClient]) => {
    if (platformClient && !readModelClient) {
      logger.error(`Read model client not found for ${platformClient.PK}`);
      console.warn(`Read model client not found for ${platformClient.PK}`);
      differencesCount++;
    } else if (platformClient && readModelClient) {
      logger.error(
        `States are not equal for platform-states client entry:\n ${JSON.stringify(
          platformClient
        )} \nand client read-model:\n ${JSON.stringify(readModelClient)}`
      );
      console.warn(
        `States are not equal for platform-states client entry:\n ${JSON.stringify(
          platformClient
        )} \nand client read-model:\n ${JSON.stringify(readModelClient)}`
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

// eservices
export async function compareReadModelEServicesWithPlatformStates({
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
      if (a && c) {
        const descriptor = c.descriptors.find(
          (d) => d.id === a.PK.split("#")[2]
        );

        if (!descriptor) {
          throw genericInternalError(
            `Descriptor not found in EService with id ${c.id}`
          );
        }

        if (descriptor) {
          const isPlatformStatesCorrect = validateCatalogPlatformStates({
            platformCatalogEntry: a,
            descriptor,
          });
          console.log("isPlatformStatesCorrect", isPlatformStatesCorrect);
          const isTokenGenerationStatesCorrect =
            validateCatalogTokenGenerationStates({
              platformCatalogEntry: a,
              tokenEntries: b,
              descriptor,
              eService: c,
            });

          if (isPlatformStatesCorrect && isTokenGenerationStatesCorrect) {
            return false;
          }
        }
      }
      return true;
    }
  );
}

function validateCatalogPlatformStates({
  platformCatalogEntry,
  descriptor,
}: {
  platformCatalogEntry: PlatformStatesCatalogEntry;
  descriptor: Descriptor;
}): boolean {
  return (
    platformCatalogEntry.state ===
      descriptorStateToItemState(descriptor.state) &&
    platformCatalogEntry.descriptorVoucherLifespan ===
      descriptor.voucherLifespan &&
    platformCatalogEntry.descriptorAudience.every((aud) =>
      descriptor.audience.includes(aud)
    )
  );
}

function validateCatalogTokenGenerationStates({
  platformCatalogEntry,
  tokenEntries,
  descriptor,
  eService,
}: {
  platformCatalogEntry: PlatformStatesCatalogEntry;
  tokenEntries: TokenGenerationStatesClientPurposeEntry[];
  descriptor: Descriptor;
  eService: EService;
}): boolean {
  if (!tokenEntries || tokenEntries.length === 0) {
    return true;
  }

  return tokenEntries.some(
    (e) =>
      // TODO: Handle consumerId if needed
      (!e.descriptorState ||
        e.descriptorState === platformCatalogEntry.state) &&
      (!e.descriptorAudience ||
        e.descriptorAudience.every((aud) =>
          platformCatalogEntry.descriptorAudience.includes(aud)
        )) &&
      (!e.descriptorVoucherLifespan ||
        e.descriptorVoucherLifespan ===
          platformCatalogEntry.descriptorVoucherLifespan) &&
      (!e.GSIPK_eserviceId_descriptorId ||
        e.GSIPK_eserviceId_descriptorId ===
          makeGSIPKEServiceIdDescriptorId({
            eserviceId: eService.id,
            descriptorId: descriptor.id,
          }))
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
        d.GSIPK_eserviceId_descriptorId?.split("#")[0] === id
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
  differences.forEach(([platformCatalog, _tokenCatalog, readModelEService]) => {
    if (platformCatalog && !readModelEService) {
      logger.error(`Read model eservice not found for ${platformCatalog.PK}`);
      console.warn(`Read model eservice not found for ${platformCatalog.PK}`);
      differencesCount++;
    } else if (platformCatalog && readModelEService) {
      logger.error(
        `States are not equal for platform-states catalog entry:\n ${JSON.stringify(
          platformCatalog
        )} \nand eservice read-model:\n ${JSON.stringify(readModelEService)}`
      );
      console.warn(
        `States are not equal for platform-states catalog entry:\n ${JSON.stringify(
          platformCatalog
        )} \nand eservice read-model:\n ${JSON.stringify(readModelEService)}`
      );
      differencesCount++;
    } else if (!platformCatalog && readModelEService) {
      const lastEServiceDescriptor = getLastEServiceDescriptor(
        readModelEService.descriptors
      );
      if (lastEServiceDescriptor.state !== descriptorState.archived) {
        logger.error(
          `platform-states catalog entry not found for read model eservice:\n${JSON.stringify(
            readModelEService
          )}`
        );
        console.warn(
          `platform-states catalog entry not found for read model eservice:\n${JSON.stringify(
            readModelEService
          )}`
        );
        differencesCount++;
      }
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

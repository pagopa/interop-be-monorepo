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
  PlatformStatesAgreementEntry,
  PlatformStatesCatalogEntry,
  PlatformStatesClientEntry,
  PlatformStatesGenericEntry,
  PlatformStatesPurposeEntry,
  Purpose,
  PurposeVersion,
  purposeVersionState,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { readModelServiceBuilder } from "../services/readModelService.js";
import { tokenGenerationReadModelServiceBuilder } from "../services/tokenGenerationReadModelService.js";
import { config } from "../configs/config.js";

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

// main

type Accumulator = {
  platformPurposeEntries: PlatformStatesPurposeEntry[];
  platformAgreementEntries: PlatformStatesAgreementEntry[];
  platformCatalogEntries: PlatformStatesCatalogEntry[];
  platformClientEntries: PlatformStatesClientEntry[];
};

const loggerInstance = logger({
  serviceName: "token-generation-readmodel-checker-verifier",
  correlationId: generateId(),
});

export async function main(dynamoDBClient: DynamoDBClient): Promise<void> {
  loggerInstance.info("Program started.\n");

  loggerInstance.info("> Connecting to database...");
  const readModel = ReadModelRepository.init(config);

  // const readModelQueriesService = readModelServiceBuilder(readModel);
  loggerInstance.info("> Connected to database!\n");

  const tokenGenerationService =
    tokenGenerationReadModelServiceBuilder(dynamoDBClient);
  const platformStatesEntries =
    await tokenGenerationService.readAllPlatformStatesItems();

  const {
    platformPurposeEntries,
    platformAgreementEntries,
    platformCatalogEntries,
    platformClientEntries,
  } = platformStatesEntries.reduce<Accumulator>(
    (acc: Accumulator, e: PlatformStatesGenericEntry) => {
      // TODO: improve without as
      if (PlatformStatesPurposeEntry.safeParse(e).success) {
        // eslint-disable-next-line functional/immutable-data
        acc.platformPurposeEntries.push(e as PlatformStatesPurposeEntry);
      } else if (PlatformStatesAgreementEntry.safeParse(e).success) {
        // eslint-disable-next-line functional/immutable-data
        acc.platformAgreementEntries.push(e as PlatformStatesAgreementEntry);
      } else if (PlatformStatesCatalogEntry.safeParse(e).success) {
        // eslint-disable-next-line functional/immutable-data
        acc.platformCatalogEntries.push(e as PlatformStatesCatalogEntry);
      } else if (PlatformStatesClientEntry.safeParse(e).success) {
        // eslint-disable-next-line functional/immutable-data
        acc.platformClientEntries.push(e as PlatformStatesClientEntry);
      } else {
        throw genericInternalError("Unknown platform-states type");
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
    readModel,
  });
  const agreementDifferences =
    await compareReadModelAgreementsWithPlatformStates({
      platformStatesEntries: platformAgreementEntries,
      readModel,
    });
  const catalogDifferences = await compareReadModelEServicesWithPlatformStates({
    platformStatesEntries: platformCatalogEntries,
    readModel,
  });
  const clientDifferences = await compareReadModelClientsWithPlatformStates({
    platformStatesEntries: platformClientEntries,
    readModel,
  });

  const differencesCount =
    countPlatformPurposeDifferences(purposeDifferences, loggerInstance) +
    countPlatformAgreementDifferences(agreementDifferences, loggerInstance) +
    countPlatformCatalogDifferences(catalogDifferences, loggerInstance) +
    countPlatformClientDifferences(clientDifferences, loggerInstance);

  if (differencesCount > 0) {
    process.exit(1);
  }

  console.log("No differences found");
}

function getIdentificationKey<T extends { PK: string } | { id: string }>(
  obj: T
): string {
  if ("PK" in obj) {
    return obj.PK.split("#")[1];
  } else {
    return obj.id;
  }
}

// purposes
export async function compareReadModelPurposesWithPlatformStates({
  platformStatesEntries,
  readModel: readModel,
}: {
  platformStatesEntries: PlatformStatesPurposeEntry[];
  readModel: ReadModelRepository;
}): Promise<
  Array<[PlatformStatesPurposeEntry | undefined, Purpose | undefined]>
> {
  const readModelService = readModelServiceBuilder(readModel);
  const [resultsA, resultsB] = await Promise.all([
    platformStatesEntries,
    readModelService.getAllReadModelPurposes(),
  ]);

  return zipPurposeDataById(resultsA, resultsB).filter(([a, b]) => {
    if (a && b) {
      const purposeState = getPurposeStateFromPurposeVersions(b.versions);
      const lastPurposeVersion = getLastPurposeVersion(b.versions);
      if (
        purposeState === a.state &&
        a.purposeConsumerId === b.consumerId &&
        a.purposeEserviceId === b.eserviceId &&
        a.purposeVersionId === lastPurposeVersion.id
      ) {
        return false;
      }
    }
    return true;
  });
}

export function zipPurposeDataById(
  dataA: PlatformStatesPurposeEntry[],
  dataB: Purpose[]
): Array<[PlatformStatesPurposeEntry | undefined, Purpose | undefined]> {
  const allIds = new Set(
    [...dataA, ...dataB].map((d) => getIdentificationKey(d))
  );
  return Array.from(allIds).map((id) => [
    dataA.find(
      (d: PlatformStatesPurposeEntry) => getIdentificationKey(d) === id
    ),
    dataB.find((d: Purpose) => getIdentificationKey(d) === id),
  ]);
}

export function countPlatformPurposeDifferences(
  purposeDifferences: Array<
    [PlatformStatesPurposeEntry | undefined, Purpose | undefined]
  >,
  logger: Logger
): number {
  // eslint-disable-next-line functional/no-let
  let differencesCount = 0;
  purposeDifferences.forEach(([platformPurpose, readModelPurpose]) => {
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

// agreement
export async function compareReadModelAgreementsWithPlatformStates({
  platformStatesEntries,
  readModel: readModel,
}: {
  platformStatesEntries: PlatformStatesAgreementEntry[];
  readModel: ReadModelRepository;
}): Promise<
  Array<[PlatformStatesAgreementEntry | undefined, Agreement | undefined]>
> {
  const readModelService = readModelServiceBuilder(readModel);
  const [resultsA, resultsB] = await Promise.all([
    platformStatesEntries,
    readModelService.getAllReadModelAgreements(),
  ]);

  return zipAgreementDataById(resultsA, resultsB).filter(([a, b]) => {
    if (a && b) {
      const agreementState = agreementStateToItemState(b.state);
      if (
        agreementState === a.state &&
        a.GSIPK_consumerId_eserviceId ===
          makeGSIPKConsumerIdEServiceId({
            consumerId: b.consumerId,
            eserviceId: b.eserviceId,
          }) &&
        a.agreementDescriptorId === b.descriptorId
      ) {
        return false;
      }
    }
    return true;
  });
}

export function zipAgreementDataById(
  dataA: PlatformStatesAgreementEntry[],
  dataB: Agreement[]
): Array<[PlatformStatesAgreementEntry | undefined, Agreement | undefined]> {
  const allIds = new Set(
    [...dataA, ...dataB].map((d) => getIdentificationKey(d))
  );
  return Array.from(allIds).map((id) => [
    dataA.find(
      (d: PlatformStatesAgreementEntry) => getIdentificationKey(d) === id
    ),
    dataB.find((d: Agreement) => getIdentificationKey(d) === id),
  ]);
}

export function countPlatformAgreementDifferences(
  differences: Array<
    [PlatformStatesAgreementEntry | undefined, Agreement | undefined]
  >,
  logger: Logger
): number {
  // eslint-disable-next-line functional/no-let
  let differencesCount = 0;
  differences.forEach(([platformAgreement, readModelAgreement]) => {
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
        )} \nand agreement read-model:\n ${JSON.stringify(readModelAgreement)}`
      );
      console.warn(
        `States are not equal for platform-states agreement entry:\n ${JSON.stringify(
          platformAgreement
        )} \nand agreement read-model:\n ${JSON.stringify(readModelAgreement)}`
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
  });

  return differencesCount;
}

// client
export async function compareReadModelClientsWithPlatformStates({
  platformStatesEntries,
  readModel: readModel,
}: {
  platformStatesEntries: PlatformStatesClientEntry[];
  readModel: ReadModelRepository;
}): Promise<
  Array<[PlatformStatesClientEntry | undefined, Client | undefined]>
> {
  const readModelService = readModelServiceBuilder(readModel);
  const [resultsA, resultsB] = await Promise.all([
    platformStatesEntries,
    readModelService.getAllReadModelClients(),
  ]);

  return zipClientDataById(resultsA, resultsB).filter(
    ([a, b]) =>
      !(
        a &&
        b &&
        a.clientKind === clientKindToTokenGenerationStatesClientKind(b.kind) &&
        a.clientConsumerId === b.consumerId &&
        a.clientPurposesIds.every((p) => b.purposes.includes(p))
      )
  );
}

export function zipClientDataById(
  dataA: PlatformStatesClientEntry[],
  dataB: Client[]
): Array<[PlatformStatesClientEntry | undefined, Client | undefined]> {
  const allIds = new Set(
    [...dataA, ...dataB].map((d) => getIdentificationKey(d))
  );
  return Array.from(allIds).map((id) => [
    dataA.find(
      (d: PlatformStatesClientEntry) => getIdentificationKey(d) === id
    ),
    dataB.find((d: Client) => getIdentificationKey(d) === id),
  ]);
}

export function countPlatformClientDifferences(
  differences: Array<
    [PlatformStatesClientEntry | undefined, Client | undefined]
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
    } else if (!platformClient && readModelClient) {
      logger.error(``);
      // TODO: how to tell if client is deleted
      differencesCount++;
    }
  });

  return differencesCount;
}

// eservice
export async function compareReadModelEServicesWithPlatformStates({
  platformStatesEntries,
  readModel: readModel,
}: {
  platformStatesEntries: PlatformStatesCatalogEntry[];
  readModel: ReadModelRepository;
}): Promise<
  Array<[PlatformStatesCatalogEntry | undefined, EService | undefined]>
> {
  const readModelService = readModelServiceBuilder(readModel);
  const [resultsA, resultsB] = await Promise.all([
    platformStatesEntries,
    readModelService.getAllReadModelEServices(),
  ]);

  return zipEServiceDataById(resultsA, resultsB).filter(([a, b]) => {
    if (a && b) {
      const descriptor = b.descriptors.find((d) => d.id === a.PK.split("#")[2]);
      if (descriptor) {
        if (
          a.state === descriptorStateToItemState(descriptor.state) &&
          a.descriptorVoucherLifespan === descriptor.voucherLifespan &&
          a.descriptorAudience.every((aud) => descriptor.audience.includes(aud))
        ) {
          return false;
        }
      } else {
        throw genericInternalError(
          `Descriptor not found in EService with id ${b.id}`
        );
      }
    }
    return true;
  });
}

export function zipEServiceDataById(
  dataA: PlatformStatesCatalogEntry[],
  dataB: EService[]
): Array<[PlatformStatesCatalogEntry | undefined, EService | undefined]> {
  const allIds = new Set(
    [...dataA, ...dataB].map((d) => getIdentificationKey(d))
  );
  return Array.from(allIds).map((id) => [
    dataA.find(
      (d: PlatformStatesCatalogEntry) => getIdentificationKey(d) === id
    ),
    dataB.find((d: EService) => getIdentificationKey(d) === id),
  ]);
}

export function countPlatformCatalogDifferences(
  differences: Array<
    [PlatformStatesCatalogEntry | undefined, EService | undefined]
  >,
  logger: Logger
): number {
  // eslint-disable-next-line functional/no-let
  let differencesCount = 0;
  differences.forEach(([platformCatalog, readModelEService]) => {
    if (platformCatalog && !readModelEService) {
      logger.error(`Read model eservice not found for ${platformCatalog.PK}`);
      console.warn("read model eservice not found");
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

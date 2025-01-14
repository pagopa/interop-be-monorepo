/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  Agreement,
  AgreementActivatedV2,
  AgreementArchivedByConsumerV2,
  AgreementArchivedByUpgradeV2,
  AgreementEventEnvelope,
  AgreementSuspendedByConsumerV2,
  AgreementSuspendedByPlatformV2,
  AgreementSuspendedByProducerV2,
  AgreementUnsuspendedByConsumerV2,
  AgreementUnsuspendedByProducerV2,
  AgreementUpgradedV2,
  EServiceId,
  PlatformStatesAgreementEntry,
  PlatformStatesCatalogEntry,
  TenantId,
  TokenGenerationStatesConsumerClient,
  agreementState,
  generateId,
  itemState,
  makeGSIPKConsumerIdEServiceId,
  makeGSIPKEServiceIdDescriptorId,
  makePlatformStatesAgreementPK,
  makePlatformStatesEServiceDescriptorPK,
  makeTokenGenerationStatesClientKidPurposePK,
  toAgreementV2,
} from "pagopa-interop-models";
import {
  getMockTokenGenStatesConsumerClient,
  getMockAgreement,
  buildDynamoDBTables,
  deleteDynamoDBTables,
  writeTokenGenStatesConsumerClient,
  getMockPlatformStatesAgreementEntry,
  writePlatformCatalogEntry,
  readAllTokenGenStatesItems,
} from "pagopa-interop-commons-test";
import { genericLogger } from "pagopa-interop-commons";
import { readAgreementEntry, writeAgreementEntry } from "../src/utils.js";
import { handleMessageV2 } from "../src/consumerServiceV2.js";
import { dynamoDBClient } from "./utils.js";

describe("integration tests V2 events", async () => {
  beforeEach(async () => {
    await buildDynamoDBTables(dynamoDBClient);
  });
  afterEach(async () => {
    await deleteDynamoDBTables(dynamoDBClient);
  });
  const mockDate = new Date();
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  describe("AgreementActivated", () => {
    it("should do no operation if the existing table entry is more recent", async () => {
      const agreement: Agreement = {
        ...getMockAgreement(),
        state: agreementState.active,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const payload: AgreementActivatedV2 = {
        agreement: toAgreementV2(agreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: agreement.id,
        version: 1,
        type: "AgreementActivated",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const agreementEntryPrimaryKey = makePlatformStatesAgreementPK(
        agreement.id
      );
      const previousStateEntry: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(agreementEntryPrimaryKey),
        version: 2,
      };
      await writeAgreementEntry(
        previousStateEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: agreement.consumerId,
        eserviceId: agreement.eserviceId,
      });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          agreementState: itemState.active,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          agreementState: itemState.active,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedAgreementEntry = await readAgreementEntry(
        agreementEntryPrimaryKey,
        dynamoDBClient
      );

      expect(retrievedAgreementEntry).toEqual(previousStateEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenGenStatesConsumerClient1,
          tokenGenStatesConsumerClient2,
        ])
      );
    });
    it("should update the entry if the incoming version is more recent than existing table entry", async () => {
      const agreement: Agreement = {
        ...getMockAgreement(),
        state: agreementState.active,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const payload: AgreementActivatedV2 = {
        agreement: toAgreementV2(agreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: agreement.id,
        version: 3,
        type: "AgreementActivated",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const agreementEntryPrimaryKey = makePlatformStatesAgreementPK(
        agreement.id
      );
      const previousStateEntry: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(agreementEntryPrimaryKey),
        version: 2,
      };
      await writeAgreementEntry(
        previousStateEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: agreement.consumerId,
        eserviceId: agreement.eserviceId,
      });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          agreementState: itemState.inactive,
          GSIPK_consumerId_eserviceId,
          GSIPK_eserviceId_descriptorId: undefined,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          agreementState: itemState.inactive,
          GSIPK_consumerId_eserviceId,
          GSIPK_eserviceId_descriptorId: undefined,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedAgreementEntry = await readAgreementEntry(
        agreementEntryPrimaryKey,
        dynamoDBClient
      );
      const expectedAgreementEntry: PlatformStatesAgreementEntry = {
        ...previousStateEntry,
        state: itemState.active,
        version: 3,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedAgreementEntry).toEqual(expectedAgreementEntry);

      // token-generation-states
      const GSIPK_eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: agreement.eserviceId,
        descriptorId: agreement.descriptorId,
      });
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );
      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          agreementId: agreement.id,
          agreementState: itemState.active,
          GSIPK_eserviceId_descriptorId,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          agreementId: agreement.id,
          agreementState: itemState.active,
          GSIPK_eserviceId_descriptorId,
          updatedAt: new Date().toISOString(),
        };

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          expectedTokenGenStatesConsumeClient1,
          expectedTokenGenStatesConsumeClient2,
        ])
      );
    });
    it("should add the entry if it doesn't exist", async () => {
      const agreement: Agreement = {
        ...getMockAgreement(),
        state: agreementState.active,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const payload: AgreementActivatedV2 = {
        agreement: toAgreementV2(agreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: agreement.id,
        version: 1,
        type: "AgreementActivated",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const agreementEntryPrimaryKey = makePlatformStatesAgreementPK(
        agreement.id
      );

      // token-generation-states
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: agreement.consumerId,
        eserviceId: agreement.eserviceId,
      });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          agreementState: itemState.inactive,
          GSIPK_consumerId_eserviceId,
          GSIPK_eserviceId_descriptorId: undefined,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          agreementState: itemState.inactive,
          GSIPK_consumerId_eserviceId,
          GSIPK_eserviceId_descriptorId: undefined,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedAgreementEntry = await readAgreementEntry(
        agreementEntryPrimaryKey,
        dynamoDBClient
      );

      const expectedAgreementEntry: PlatformStatesAgreementEntry = {
        PK: agreementEntryPrimaryKey,
        version: 1,
        state: itemState.active,
        updatedAt: agreement.stamps.activation!.when.toISOString(),
        GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
          consumerId: agreement.consumerId,
          eserviceId: agreement.eserviceId,
        }),
        GSISK_agreementTimestamp:
          agreement.stamps.activation!.when.toISOString(),
        agreementDescriptorId: agreement.descriptorId,
      };
      expect(retrievedAgreementEntry).toEqual(expectedAgreementEntry);

      // token-generation-states
      const GSIPK_eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: agreement.eserviceId,
        descriptorId: agreement.descriptorId,
      });
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );
      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          GSIPK_eserviceId_descriptorId,
          agreementId: agreement.id,
          agreementState: itemState.active,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          GSIPK_eserviceId_descriptorId,
          agreementId: agreement.id,
          agreementState: itemState.active,
          updatedAt: new Date().toISOString(),
        };

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          expectedTokenGenStatesConsumeClient1,
          expectedTokenGenStatesConsumeClient2,
        ])
      );
    });
    it("should add the entry if it doesn't exist - and add descriptor info to token-generation-states entry if missing", async () => {
      const agreement: Agreement = {
        ...getMockAgreement(),
        state: agreementState.active,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const payload: AgreementActivatedV2 = {
        agreement: toAgreementV2(agreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: agreement.id,
        version: 1,
        type: "AgreementActivated",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const agreementEntryPrimaryKey = makePlatformStatesAgreementPK(
        agreement.id
      );

      const primaryKeyCatalogEntry = makePlatformStatesEServiceDescriptorPK({
        eserviceId: agreement.eserviceId,
        descriptorId: agreement.descriptorId,
      });

      const catalogEntry: PlatformStatesCatalogEntry = {
        PK: primaryKeyCatalogEntry,
        state: itemState.active,
        descriptorAudience: ["pagopa.it"],
        descriptorVoucherLifespan: 60,
        version: 1,
        updatedAt: new Date().toISOString(),
      };

      await writePlatformCatalogEntry(catalogEntry, dynamoDBClient);

      // token-generation-states
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: agreement.consumerId,
        eserviceId: agreement.eserviceId,
      });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          agreementState: itemState.inactive,
          GSIPK_consumerId_eserviceId,
          GSIPK_eserviceId_descriptorId: undefined,
          descriptorAudience: undefined,
          descriptorState: undefined,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          agreementState: itemState.inactive,
          GSIPK_consumerId_eserviceId,
          GSIPK_eserviceId_descriptorId: undefined,
          descriptorAudience: undefined,
          descriptorState: undefined,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedAgreementEntry = await readAgreementEntry(
        agreementEntryPrimaryKey,
        dynamoDBClient
      );

      const expectedAgreementEntry: PlatformStatesAgreementEntry = {
        PK: agreementEntryPrimaryKey,
        version: 1,
        state: itemState.active,
        updatedAt: agreement.stamps.activation!.when.toISOString(),
        GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
          consumerId: agreement.consumerId,
          eserviceId: agreement.eserviceId,
        }),
        GSISK_agreementTimestamp:
          agreement.stamps.activation!.when.toISOString(),
        agreementDescriptorId: agreement.descriptorId,
      };
      expect(retrievedAgreementEntry).toEqual(expectedAgreementEntry);

      // token-generation-states
      const GSIPK_eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: agreement.eserviceId,
        descriptorId: agreement.descriptorId,
      });
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );
      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          GSIPK_eserviceId_descriptorId,
          agreementId: agreement.id,
          agreementState: itemState.active,
          descriptorState: catalogEntry.state,
          descriptorAudience: catalogEntry.descriptorAudience,
          descriptorVoucherLifespan: catalogEntry.descriptorVoucherLifespan,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          GSIPK_eserviceId_descriptorId,
          agreementId: agreement.id,
          agreementState: itemState.active,
          descriptorState: catalogEntry.state,
          descriptorAudience: catalogEntry.descriptorAudience,
          descriptorVoucherLifespan: catalogEntry.descriptorVoucherLifespan,
          updatedAt: new Date().toISOString(),
        };

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          expectedTokenGenStatesConsumeClient1,
          expectedTokenGenStatesConsumeClient2,
        ])
      );
    });

    it("should add the entry if it doesn't exist (agreement is not the latest -> no operation on token states)", async () => {
      const sixHoursAgo = new Date();
      sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

      const consumerId = generateId<TenantId>();
      const eserviceId = generateId<EServiceId>();

      const previousAgreement: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId,
        state: agreementState.active,
        stamps: {
          activation: {
            when: sixHoursAgo,
            who: generateId(),
          },
        },
      };
      const latestAgreement: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId,
        state: agreementState.active,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };

      const payload: AgreementActivatedV2 = {
        agreement: toAgreementV2(previousAgreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: previousAgreement.id,
        version: 1,
        type: "AgreementActivated",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const agreementEntryPrimaryKey = makePlatformStatesAgreementPK(
        previousAgreement.id
      );

      const primaryKeyCatalogEntry = makePlatformStatesEServiceDescriptorPK({
        eserviceId: previousAgreement.eserviceId,
        descriptorId: previousAgreement.descriptorId,
      });
      const latestAgreementEntryPrimaryKey = makePlatformStatesAgreementPK(
        latestAgreement.id
      );
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId,
        eserviceId,
      });

      const latestAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(latestAgreementEntryPrimaryKey),
        state: itemState.active,
        GSIPK_consumerId_eserviceId,
        GSISK_agreementTimestamp:
          latestAgreement.stamps.activation!.when.toISOString(),
      };

      await writeAgreementEntry(
        latestAgreementStateEntry,
        dynamoDBClient,
        genericLogger
      );

      const catalogEntry: PlatformStatesCatalogEntry = {
        PK: primaryKeyCatalogEntry,
        state: itemState.active,
        descriptorAudience: ["pagopa.it"],
        descriptorVoucherLifespan: 60,
        version: 1,
        updatedAt: new Date().toISOString(),
      };

      await writePlatformCatalogEntry(catalogEntry, dynamoDBClient);

      // token-generation-states
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          agreementState: itemState.inactive,
          GSIPK_consumerId_eserviceId,
          GSIPK_eserviceId_descriptorId: undefined,
          descriptorAudience: undefined,
          descriptorState: undefined,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          agreementState: itemState.inactive,
          GSIPK_consumerId_eserviceId,
          GSIPK_eserviceId_descriptorId: undefined,
          descriptorAudience: undefined,
          descriptorState: undefined,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedAgreementEntry = await readAgreementEntry(
        agreementEntryPrimaryKey,
        dynamoDBClient
      );

      const expectedAgreementEntry: PlatformStatesAgreementEntry = {
        PK: agreementEntryPrimaryKey,
        version: 1,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
        GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
          consumerId: previousAgreement.consumerId,
          eserviceId: previousAgreement.eserviceId,
        }),
        GSISK_agreementTimestamp:
          previousAgreement.stamps.activation!.when.toISOString(),
        agreementDescriptorId: previousAgreement.descriptorId,
      };
      expect(retrievedAgreementEntry).toEqual(expectedAgreementEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );
      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenGenStatesConsumerClient1,
          tokenGenStatesConsumerClient2,
        ])
      );
    });
  });
  describe("AgreementSuspendedByProducer", async () => {
    it("should do no operation if the entry doesn't exist", async () => {
      const agreement: Agreement = {
        ...getMockAgreement(),
        state: agreementState.suspended,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const payload: AgreementSuspendedByProducerV2 = {
        agreement: toAgreementV2(agreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: agreement.id,
        version: 1,
        type: "AgreementSuspendedByProducer",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const agreementEntryPrimaryKey = makePlatformStatesAgreementPK(
        agreement.id
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      const retrievedAgreementEntry = await readAgreementEntry(
        agreementEntryPrimaryKey,
        dynamoDBClient
      );

      expect(retrievedAgreementEntry).toBeUndefined();
    });
    it("should update the entry (agreement is not the latest -> no operation on token states)", async () => {
      const sixHoursAgo = new Date();
      sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

      const consumerId = generateId<TenantId>();
      const eserviceId = generateId<EServiceId>();

      const previousAgreement: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId,
        state: agreementState.suspended,
        stamps: {
          activation: {
            when: sixHoursAgo,
            who: generateId(),
          },
        },
      };
      const latestAgreement: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId,
        state: agreementState.suspended,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const payload: AgreementSuspendedByProducerV2 = {
        agreement: toAgreementV2(previousAgreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: previousAgreement.id,
        version: 1,
        type: "AgreementSuspendedByProducer",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const previousAgreementEntryPrimaryKey = makePlatformStatesAgreementPK(
        previousAgreement.id
      );
      const latestAgreementEntryPrimaryKey = makePlatformStatesAgreementPK(
        latestAgreement.id
      );
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId,
        eserviceId,
      });

      const previousAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(
          previousAgreementEntryPrimaryKey
        ),
        state: itemState.active,
        GSIPK_consumerId_eserviceId,
        GSISK_agreementTimestamp:
          previousAgreement.stamps.activation!.when.toISOString(),
      };

      const latestAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(latestAgreementEntryPrimaryKey),
        state: itemState.active,
        GSIPK_consumerId_eserviceId,
        GSISK_agreementTimestamp:
          latestAgreement.stamps.activation!.when.toISOString(),
      };

      await writeAgreementEntry(
        previousAgreementStateEntry,
        dynamoDBClient,
        genericLogger
      );
      await writeAgreementEntry(
        latestAgreementStateEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          agreementId: previousAgreement.id,
          agreementState: itemState.active,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          agreementId: previousAgreement.id,
          agreementState: itemState.active,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      const expectedAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...previousAgreementStateEntry,
        state: itemState.inactive,
        updatedAt: new Date().toISOString(),
      };

      const retrievedEntry = await readAgreementEntry(
        previousAgreementEntryPrimaryKey,
        dynamoDBClient
      );
      expect(retrievedEntry).toEqual(expectedAgreementStateEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenGenStatesConsumerClient2,
          tokenGenStatesConsumerClient1,
        ])
      );
    });
    it("should update the entry (agreement is the latest -> update in token states)", async () => {
      const sixHoursAgo = new Date();
      sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

      const consumerId = generateId<TenantId>();
      const eserviceId = generateId<EServiceId>();

      const previousAgreement: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId,
        state: agreementState.suspended,
        stamps: {
          activation: {
            when: sixHoursAgo,
            who: generateId(),
          },
        },
      };
      const latestAgreement: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId,
        state: agreementState.suspended,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const payload: AgreementSuspendedByProducerV2 = {
        agreement: toAgreementV2(latestAgreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: latestAgreement.id,
        version: 1,
        type: "AgreementSuspendedByProducer",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const previousAgreementEntryPrimaryKey = makePlatformStatesAgreementPK(
        previousAgreement.id
      );
      const latestAgreementEntryPrimaryKey = makePlatformStatesAgreementPK(
        latestAgreement.id
      );
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId,
        eserviceId,
      });

      const previousAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(
          previousAgreementEntryPrimaryKey
        ),
        state: itemState.active,
        GSIPK_consumerId_eserviceId,
        GSISK_agreementTimestamp:
          previousAgreement.stamps.activation!.when.toISOString(),
      };

      const latestAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(latestAgreementEntryPrimaryKey),
        state: itemState.active,
        GSIPK_consumerId_eserviceId,
        GSISK_agreementTimestamp:
          latestAgreement.stamps.activation!.when.toISOString(),
      };

      await writeAgreementEntry(
        previousAgreementStateEntry,
        dynamoDBClient,
        genericLogger
      );
      await writeAgreementEntry(
        latestAgreementStateEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          agreementId: latestAgreement.id,
          agreementState: itemState.active,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          agreementId: latestAgreement.id,
          agreementState: itemState.active,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      const expectedAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...latestAgreementStateEntry,
        state: itemState.inactive,
        updatedAt: new Date().toISOString(),
      };

      const retrievedEntry = await readAgreementEntry(
        latestAgreementEntryPrimaryKey,
        dynamoDBClient
      );
      expect(retrievedEntry).toEqual(expectedAgreementStateEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );
      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          agreementState: itemState.inactive,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          agreementState: itemState.inactive,
          updatedAt: new Date().toISOString(),
        };

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          expectedTokenGenStatesConsumeClient2,
          expectedTokenGenStatesConsumeClient1,
        ])
      );
    });
  });
  describe("AgreementSuspendedByConsumer", async () => {
    it("should do no operation if the entry doesn't exist", async () => {
      const agreement: Agreement = {
        ...getMockAgreement(),
        state: agreementState.suspended,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const payload: AgreementSuspendedByConsumerV2 = {
        agreement: toAgreementV2(agreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: agreement.id,
        version: 1,
        type: "AgreementSuspendedByConsumer",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const agreementEntryPrimaryKey = makePlatformStatesAgreementPK(
        agreement.id
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      const retrievedAgreementEntry = await readAgreementEntry(
        agreementEntryPrimaryKey,
        dynamoDBClient
      );

      expect(retrievedAgreementEntry).toBeUndefined();
    });
    it("should update the entry (agreement is not the latest -> no operation on token states)", async () => {
      const sixHoursAgo = new Date();
      sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

      const consumerId = generateId<TenantId>();
      const eserviceId = generateId<EServiceId>();

      const previousAgreement: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId,
        state: agreementState.suspended,
        stamps: {
          activation: {
            when: sixHoursAgo,
            who: generateId(),
          },
        },
      };
      const latestAgreement: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId,
        state: agreementState.suspended,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const payload: AgreementSuspendedByConsumerV2 = {
        agreement: toAgreementV2(previousAgreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: previousAgreement.id,
        version: 1,
        type: "AgreementSuspendedByConsumer",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const previousAgreementEntryPrimaryKey = makePlatformStatesAgreementPK(
        previousAgreement.id
      );
      const latestAgreementEntryPrimaryKey = makePlatformStatesAgreementPK(
        latestAgreement.id
      );
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId,
        eserviceId,
      });

      const previousAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(
          previousAgreementEntryPrimaryKey
        ),
        state: itemState.active,
        GSIPK_consumerId_eserviceId,
        GSISK_agreementTimestamp:
          previousAgreement.stamps.activation!.when.toISOString(),
      };

      const latestAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(latestAgreementEntryPrimaryKey),
        state: itemState.active,
        GSIPK_consumerId_eserviceId,
        GSISK_agreementTimestamp:
          latestAgreement.stamps.activation!.when.toISOString(),
      };

      await writeAgreementEntry(
        previousAgreementStateEntry,
        dynamoDBClient,
        genericLogger
      );
      await writeAgreementEntry(
        latestAgreementStateEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          agreementId: previousAgreement.id,
          agreementState: itemState.active,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          agreementId: previousAgreement.id,
          agreementState: itemState.active,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      const expectedAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...previousAgreementStateEntry,
        state: itemState.inactive,
        updatedAt: new Date().toISOString(),
      };

      const retrievedEntry = await readAgreementEntry(
        previousAgreementEntryPrimaryKey,
        dynamoDBClient
      );
      expect(retrievedEntry).toEqual(expectedAgreementStateEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenGenStatesConsumerClient2,
          tokenGenStatesConsumerClient1,
        ])
      );
    });
    it("should update the entry (agreement is the latest -> update in token states)", async () => {
      const sixHoursAgo = new Date();
      sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

      const consumerId = generateId<TenantId>();
      const eserviceId = generateId<EServiceId>();

      const previousAgreement: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId,
        state: agreementState.suspended,
        stamps: {
          activation: {
            when: sixHoursAgo,
            who: generateId(),
          },
        },
      };
      const latestAgreement: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId,
        state: agreementState.suspended,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const payload: AgreementSuspendedByConsumerV2 = {
        agreement: toAgreementV2(latestAgreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: latestAgreement.id,
        version: 1,
        type: "AgreementSuspendedByConsumer",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const previousAgreementEntryPrimaryKey = makePlatformStatesAgreementPK(
        previousAgreement.id
      );
      const latestAgreementEntryPrimaryKey = makePlatformStatesAgreementPK(
        latestAgreement.id
      );
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId,
        eserviceId,
      });

      const previousAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(
          previousAgreementEntryPrimaryKey
        ),
        state: itemState.active,
        GSIPK_consumerId_eserviceId,
        GSISK_agreementTimestamp:
          previousAgreement.stamps.activation!.when.toISOString(),
      };

      const latestAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(latestAgreementEntryPrimaryKey),
        state: itemState.active,
        GSIPK_consumerId_eserviceId,
        GSISK_agreementTimestamp:
          latestAgreement.stamps.activation!.when.toISOString(),
      };

      await writeAgreementEntry(
        previousAgreementStateEntry,
        dynamoDBClient,
        genericLogger
      );
      await writeAgreementEntry(
        latestAgreementStateEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          agreementId: latestAgreement.id,
          agreementState: itemState.active,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          agreementId: latestAgreement.id,
          agreementState: itemState.active,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      const expectedAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...latestAgreementStateEntry,
        state: itemState.inactive,
        updatedAt: new Date().toISOString(),
      };

      const retrievedEntry = await readAgreementEntry(
        latestAgreementEntryPrimaryKey,
        dynamoDBClient
      );
      expect(retrievedEntry).toEqual(expectedAgreementStateEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );
      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          agreementState: itemState.inactive,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          agreementState: itemState.inactive,
          updatedAt: new Date().toISOString(),
        };

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          expectedTokenGenStatesConsumeClient2,
          expectedTokenGenStatesConsumeClient1,
        ])
      );
    });
  });
  describe("AgreementSuspendedByPlatform", async () => {
    it("should do no operation if the entry doesn't exist", async () => {
      const agreement: Agreement = {
        ...getMockAgreement(),
        state: agreementState.suspended,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const payload: AgreementSuspendedByPlatformV2 = {
        agreement: toAgreementV2(agreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: agreement.id,
        version: 1,
        type: "AgreementSuspendedByPlatform",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const agreementEntryPrimaryKey = makePlatformStatesAgreementPK(
        agreement.id
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      const retrievedAgreementEntry = await readAgreementEntry(
        agreementEntryPrimaryKey,
        dynamoDBClient
      );

      expect(retrievedAgreementEntry).toBeUndefined();
    });
    it("should update the entry (agreement is not the latest -> no operation on token states)", async () => {
      const sixHoursAgo = new Date();
      sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

      const consumerId = generateId<TenantId>();
      const eserviceId = generateId<EServiceId>();

      const previousAgreement: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId,
        state: agreementState.suspended,
        stamps: {
          activation: {
            when: sixHoursAgo,
            who: generateId(),
          },
        },
      };
      const latestAgreement: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId,
        state: agreementState.suspended,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const payload: AgreementSuspendedByPlatformV2 = {
        agreement: toAgreementV2(previousAgreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: previousAgreement.id,
        version: 1,
        type: "AgreementSuspendedByPlatform",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const previousAgreementEntryPrimaryKey = makePlatformStatesAgreementPK(
        previousAgreement.id
      );
      const latestAgreementEntryPrimaryKey = makePlatformStatesAgreementPK(
        latestAgreement.id
      );
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId,
        eserviceId,
      });

      const previousAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(
          previousAgreementEntryPrimaryKey
        ),
        state: itemState.active,
        GSIPK_consumerId_eserviceId,
        GSISK_agreementTimestamp:
          previousAgreement.stamps.activation!.when.toISOString(),
      };

      const latestAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(latestAgreementEntryPrimaryKey),
        state: itemState.active,
        GSIPK_consumerId_eserviceId,
        GSISK_agreementTimestamp:
          latestAgreement.stamps.activation!.when.toISOString(),
      };

      await writeAgreementEntry(
        previousAgreementStateEntry,
        dynamoDBClient,
        genericLogger
      );
      await writeAgreementEntry(
        latestAgreementStateEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          agreementId: previousAgreement.id,
          agreementState: itemState.active,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          agreementId: previousAgreement.id,
          agreementState: itemState.active,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      const expectedAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...previousAgreementStateEntry,
        state: itemState.inactive,
        updatedAt: new Date().toISOString(),
      };

      const retrievedEntry = await readAgreementEntry(
        previousAgreementEntryPrimaryKey,
        dynamoDBClient
      );
      expect(retrievedEntry).toEqual(expectedAgreementStateEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenGenStatesConsumerClient2,
          tokenGenStatesConsumerClient1,
        ])
      );
    });
    it("should update the entry (agreement is the latest -> update in token states)", async () => {
      const sixHoursAgo = new Date();
      sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

      const consumerId = generateId<TenantId>();
      const eserviceId = generateId<EServiceId>();

      const previousAgreement: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId,
        state: agreementState.suspended,
        stamps: {
          activation: {
            when: sixHoursAgo,
            who: generateId(),
          },
        },
      };
      const latestAgreement: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId,
        state: agreementState.suspended,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const payload: AgreementSuspendedByPlatformV2 = {
        agreement: toAgreementV2(latestAgreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: latestAgreement.id,
        version: 1,
        type: "AgreementSuspendedByPlatform",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const previousAgreementEntryPrimaryKey = makePlatformStatesAgreementPK(
        previousAgreement.id
      );
      const latestAgreementEntryPrimaryKey = makePlatformStatesAgreementPK(
        latestAgreement.id
      );
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId,
        eserviceId,
      });

      const previousAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(
          previousAgreementEntryPrimaryKey
        ),
        state: itemState.active,
        GSIPK_consumerId_eserviceId,
        GSISK_agreementTimestamp:
          previousAgreement.stamps.activation!.when.toISOString(),
      };

      const latestAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(latestAgreementEntryPrimaryKey),
        state: itemState.active,
        GSIPK_consumerId_eserviceId,
        GSISK_agreementTimestamp:
          latestAgreement.stamps.activation!.when.toISOString(),
      };

      await writeAgreementEntry(
        previousAgreementStateEntry,
        dynamoDBClient,
        genericLogger
      );
      await writeAgreementEntry(
        latestAgreementStateEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          agreementId: latestAgreement.id,
          agreementState: itemState.active,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          agreementId: latestAgreement.id,
          agreementState: itemState.active,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      const expectedAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...latestAgreementStateEntry,
        state: itemState.inactive,
        updatedAt: new Date().toISOString(),
      };

      const retrievedEntry = await readAgreementEntry(
        latestAgreementEntryPrimaryKey,
        dynamoDBClient
      );
      expect(retrievedEntry).toEqual(expectedAgreementStateEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );
      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          agreementState: itemState.inactive,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          agreementState: itemState.inactive,
          updatedAt: new Date().toISOString(),
        };

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          expectedTokenGenStatesConsumeClient2,
          expectedTokenGenStatesConsumeClient1,
        ])
      );
    });
  });
  describe("AgreementUnsuspendedByProducer", async () => {
    it("should do no operation if the entry doesn't exist", async () => {
      const agreement: Agreement = {
        ...getMockAgreement(),
        state: agreementState.active,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const payload: AgreementUnsuspendedByProducerV2 = {
        agreement: toAgreementV2(agreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: agreement.id,
        version: 1,
        type: "AgreementUnsuspendedByProducer",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const agreementEntryPrimaryKey = makePlatformStatesAgreementPK(
        agreement.id
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      const retrievedAgreementEntry = await readAgreementEntry(
        agreementEntryPrimaryKey,
        dynamoDBClient
      );

      expect(retrievedAgreementEntry).toBeUndefined();
    });
    it("should update the entry (agreement is not the latest -> no operation on token states)", async () => {
      const sixHoursAgo = new Date();
      sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

      const consumerId = generateId<TenantId>();
      const eserviceId = generateId<EServiceId>();

      const previousAgreement: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId,
        state: agreementState.active,
        stamps: {
          activation: {
            when: sixHoursAgo,
            who: generateId(),
          },
        },
      };
      const latestAgreement: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId,
        state: agreementState.active,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const payload: AgreementUnsuspendedByProducerV2 = {
        agreement: toAgreementV2(previousAgreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: previousAgreement.id,
        version: 1,
        type: "AgreementUnsuspendedByProducer",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const previousAgreementEntryPrimaryKey = makePlatformStatesAgreementPK(
        previousAgreement.id
      );
      const latestAgreementEntryPrimaryKey = makePlatformStatesAgreementPK(
        latestAgreement.id
      );
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId,
        eserviceId,
      });

      const previousAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(
          previousAgreementEntryPrimaryKey
        ),
        state: itemState.inactive,
        GSIPK_consumerId_eserviceId,
        GSISK_agreementTimestamp:
          previousAgreement.stamps.activation!.when.toISOString(),
      };

      const latestAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(latestAgreementEntryPrimaryKey),
        state: itemState.inactive,
        GSIPK_consumerId_eserviceId,
        GSISK_agreementTimestamp:
          latestAgreement.stamps.activation!.when.toISOString(),
      };

      await writeAgreementEntry(
        previousAgreementStateEntry,
        dynamoDBClient,
        genericLogger
      );
      await writeAgreementEntry(
        latestAgreementStateEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          agreementId: previousAgreement.id,
          agreementState: itemState.inactive,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          agreementId: previousAgreement.id,
          agreementState: itemState.inactive,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      const expectedAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...previousAgreementStateEntry,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
      };

      const retrievedEntry = await readAgreementEntry(
        previousAgreementEntryPrimaryKey,
        dynamoDBClient
      );
      expect(retrievedEntry).toEqual(expectedAgreementStateEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenGenStatesConsumerClient2,
          tokenGenStatesConsumerClient1,
        ])
      );
    });
    it("should update the entry (agreement is the latest -> update in token states)", async () => {
      const sixHoursAgo = new Date();
      sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

      const consumerId = generateId<TenantId>();
      const eserviceId = generateId<EServiceId>();

      const previousAgreement: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId,
        state: agreementState.active,
        stamps: {
          activation: {
            when: sixHoursAgo,
            who: generateId(),
          },
        },
      };
      const latestAgreement: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId,
        state: agreementState.active,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const payload: AgreementUnsuspendedByProducerV2 = {
        agreement: toAgreementV2(latestAgreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: latestAgreement.id,
        version: 1,
        type: "AgreementUnsuspendedByProducer",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const previousAgreementEntryPrimaryKey = makePlatformStatesAgreementPK(
        previousAgreement.id
      );
      const latestAgreementEntryPrimaryKey = makePlatformStatesAgreementPK(
        latestAgreement.id
      );
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId,
        eserviceId,
      });

      const previousAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(
          previousAgreementEntryPrimaryKey
        ),
        state: itemState.inactive,
        GSIPK_consumerId_eserviceId,
        GSISK_agreementTimestamp:
          previousAgreement.stamps.activation!.when.toISOString(),
      };

      const latestAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(latestAgreementEntryPrimaryKey),
        state: itemState.inactive,
        GSIPK_consumerId_eserviceId,
        GSISK_agreementTimestamp:
          latestAgreement.stamps.activation!.when.toISOString(),
      };

      await writeAgreementEntry(
        previousAgreementStateEntry,
        dynamoDBClient,
        genericLogger
      );
      await writeAgreementEntry(
        latestAgreementStateEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          agreementId: latestAgreement.id,
          agreementState: itemState.inactive,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          agreementId: latestAgreement.id,
          agreementState: itemState.inactive,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      const expectedAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...latestAgreementStateEntry,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
      };

      const retrievedEntry = await readAgreementEntry(
        latestAgreementEntryPrimaryKey,
        dynamoDBClient
      );
      expect(retrievedEntry).toEqual(expectedAgreementStateEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );
      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          agreementState: itemState.active,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          agreementState: itemState.active,
          updatedAt: new Date().toISOString(),
        };

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          expectedTokenGenStatesConsumeClient2,
          expectedTokenGenStatesConsumeClient1,
        ])
      );
    });
  });

  describe("AgreementUnsuspendedByConsumer", async () => {
    it("should do no operation if the entry doesn't exist", async () => {
      const agreement: Agreement = {
        ...getMockAgreement(),
        state: agreementState.active,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const payload: AgreementUnsuspendedByConsumerV2 = {
        agreement: toAgreementV2(agreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: agreement.id,
        version: 1,
        type: "AgreementUnsuspendedByConsumer",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const agreementEntryPrimaryKey = makePlatformStatesAgreementPK(
        agreement.id
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      const retrievedAgreementEntry = await readAgreementEntry(
        agreementEntryPrimaryKey,
        dynamoDBClient
      );

      expect(retrievedAgreementEntry).toBeUndefined();
    });
    it("should update the entry (agreement is not the latest -> no operation on token states)", async () => {
      const sixHoursAgo = new Date();
      sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

      const consumerId = generateId<TenantId>();
      const eserviceId = generateId<EServiceId>();

      const previousAgreement: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId,
        state: agreementState.active,
        stamps: {
          activation: {
            when: sixHoursAgo,
            who: generateId(),
          },
        },
      };
      const latestAgreement: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId,
        state: agreementState.active,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const payload: AgreementUnsuspendedByConsumerV2 = {
        agreement: toAgreementV2(previousAgreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: previousAgreement.id,
        version: 1,
        type: "AgreementUnsuspendedByConsumer",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const previousAgreementEntryPrimaryKey = makePlatformStatesAgreementPK(
        previousAgreement.id
      );
      const latestAgreementEntryPrimaryKey = makePlatformStatesAgreementPK(
        latestAgreement.id
      );
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId,
        eserviceId,
      });

      const previousAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(
          previousAgreementEntryPrimaryKey
        ),
        state: itemState.inactive,
        GSIPK_consumerId_eserviceId,
        GSISK_agreementTimestamp:
          previousAgreement.stamps.activation!.when.toISOString(),
      };

      const latestAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(latestAgreementEntryPrimaryKey),
        state: itemState.inactive,
        GSIPK_consumerId_eserviceId,
        GSISK_agreementTimestamp:
          latestAgreement.stamps.activation!.when.toISOString(),
      };

      await writeAgreementEntry(
        previousAgreementStateEntry,
        dynamoDBClient,
        genericLogger
      );
      await writeAgreementEntry(
        latestAgreementStateEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          agreementId: previousAgreement.id,
          agreementState: itemState.inactive,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          agreementId: previousAgreement.id,
          agreementState: itemState.inactive,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      const expectedAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...previousAgreementStateEntry,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
      };

      const retrievedEntry = await readAgreementEntry(
        previousAgreementEntryPrimaryKey,
        dynamoDBClient
      );
      expect(retrievedEntry).toEqual(expectedAgreementStateEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenGenStatesConsumerClient2,
          tokenGenStatesConsumerClient1,
        ])
      );
    });
    it("should update the entry (agreement is the latest -> update in token states)", async () => {
      const sixHoursAgo = new Date();
      sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

      const consumerId = generateId<TenantId>();
      const eserviceId = generateId<EServiceId>();

      const previousAgreement: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId,
        state: agreementState.active,
        stamps: {
          activation: {
            when: sixHoursAgo,
            who: generateId(),
          },
        },
      };
      const latestAgreement: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId,
        state: agreementState.active,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const payload: AgreementUnsuspendedByConsumerV2 = {
        agreement: toAgreementV2(latestAgreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: latestAgreement.id,
        version: 1,
        type: "AgreementUnsuspendedByConsumer",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const previousAgreementEntryPrimaryKey = makePlatformStatesAgreementPK(
        previousAgreement.id
      );
      const latestAgreementEntryPrimaryKey = makePlatformStatesAgreementPK(
        latestAgreement.id
      );
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId,
        eserviceId,
      });

      const previousAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(
          previousAgreementEntryPrimaryKey
        ),
        state: itemState.inactive,
        GSIPK_consumerId_eserviceId,
        GSISK_agreementTimestamp:
          previousAgreement.stamps.activation!.when.toISOString(),
      };

      const latestAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(latestAgreementEntryPrimaryKey),
        state: itemState.inactive,
        GSIPK_consumerId_eserviceId,
        GSISK_agreementTimestamp:
          latestAgreement.stamps.activation!.when.toISOString(),
      };

      await writeAgreementEntry(
        previousAgreementStateEntry,
        dynamoDBClient,
        genericLogger
      );
      await writeAgreementEntry(
        latestAgreementStateEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          agreementId: latestAgreement.id,
          agreementState: itemState.inactive,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          agreementId: latestAgreement.id,
          agreementState: itemState.inactive,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      const expectedAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...latestAgreementStateEntry,
        state: itemState.active,
        updatedAt: new Date().toISOString(),
      };

      const retrievedEntry = await readAgreementEntry(
        latestAgreementEntryPrimaryKey,
        dynamoDBClient
      );
      expect(retrievedEntry).toEqual(expectedAgreementStateEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );
      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          agreementState: itemState.active,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          agreementState: itemState.active,
          updatedAt: new Date().toISOString(),
        };

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          expectedTokenGenStatesConsumeClient2,
          expectedTokenGenStatesConsumeClient1,
        ])
      );
    });
  });

  describe("AgreementUpgraded", async () => {
    it("should do no operation if the table entry is more recent than incoming version", async () => {
      const agreement: Agreement = {
        ...getMockAgreement(),
        state: agreementState.active,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const payload: AgreementUpgradedV2 = {
        agreement: toAgreementV2(agreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: agreement.id,
        version: 2,
        type: "AgreementUpgraded",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const agreementEntryPrimaryKey = makePlatformStatesAgreementPK(
        agreement.id
      );
      const previousStateEntry: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(agreementEntryPrimaryKey),
        version: 3,
      };
      await writeAgreementEntry(
        previousStateEntry,
        dynamoDBClient,
        genericLogger
      );

      const primaryKeyCatalogEntry = makePlatformStatesEServiceDescriptorPK({
        eserviceId: agreement.eserviceId,
        descriptorId: agreement.descriptorId,
      });
      const catalogEntry: PlatformStatesCatalogEntry = {
        PK: primaryKeyCatalogEntry,
        state: itemState.active,
        descriptorAudience: ["pagopa.it"],
        descriptorVoucherLifespan: 60,
        version: 1,
        updatedAt: new Date().toISOString(),
      };

      await writePlatformCatalogEntry(catalogEntry, dynamoDBClient);

      // token-generation-states
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: agreement.consumerId,
        eserviceId: agreement.eserviceId,
      });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          agreementState: itemState.active,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          agreementState: itemState.active,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedAgreementEntry = await readAgreementEntry(
        agreementEntryPrimaryKey,
        dynamoDBClient
      );
      expect(retrievedAgreementEntry).toEqual(previousStateEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenGenStatesConsumerClient1,
          tokenGenStatesConsumerClient2,
        ])
      );
    });

    it("should do no operation if the agreement state is not active nor suspended", async () => {
      const agreement: Agreement = {
        ...getMockAgreement(),
        state: agreementState.pending,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const payload: AgreementUpgradedV2 = {
        agreement: toAgreementV2(agreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: agreement.id,
        version: 2,
        type: "AgreementUpgraded",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };

      // platform-states
      const platformStatesAgreementEntryPK = makePlatformStatesAgreementPK(
        agreement.id
      );
      const platformStatesAgreementEntry: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(platformStatesAgreementEntryPK),
        version: 1,
      };
      await writeAgreementEntry(
        platformStatesAgreementEntry,
        dynamoDBClient,
        genericLogger
      );

      const platformStatesCatalogEntryPK =
        makePlatformStatesEServiceDescriptorPK({
          eserviceId: agreement.eserviceId,
          descriptorId: agreement.descriptorId,
        });
      const platformStatesCatalogEntry: PlatformStatesCatalogEntry = {
        PK: platformStatesCatalogEntryPK,
        state: itemState.active,
        descriptorAudience: ["pagopa.it"],
        descriptorVoucherLifespan: 60,
        version: 1,
        updatedAt: new Date().toISOString(),
      };

      await writePlatformCatalogEntry(
        platformStatesCatalogEntry,
        dynamoDBClient
      );

      // token-generation-states
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: agreement.consumerId,
        eserviceId: agreement.eserviceId,
      });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          agreementState: itemState.active,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          agreementState: itemState.active,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedAgreementEntry = await readAgreementEntry(
        platformStatesAgreementEntryPK,
        dynamoDBClient
      );
      expect(retrievedAgreementEntry).toEqual(platformStatesAgreementEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenGenStatesConsumerClient1,
          tokenGenStatesConsumerClient2,
        ])
      );
    });

    it("should update the entry if the incoming version is more recent than the table entry (agreement is the latest -> update in token states)", async () => {
      const sixHoursAgo = new Date();
      sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

      const consumerId = generateId<TenantId>();
      const eserviceId = generateId<EServiceId>();

      const previousAgreement: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId,
        state: agreementState.active,
        stamps: {
          activation: {
            when: sixHoursAgo,
            who: generateId(),
          },
        },
      };
      const latestAgreement: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId,
        state: agreementState.active,
        stamps: {
          activation: previousAgreement.stamps.activation,
          upgrade: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const payload: AgreementUpgradedV2 = {
        agreement: toAgreementV2(latestAgreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: latestAgreement.id,
        version: 2,
        type: "AgreementUpgraded",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const previousAgreementEntryPrimaryKey = makePlatformStatesAgreementPK(
        previousAgreement.id
      );
      const latestAgreementEntryPrimaryKey = makePlatformStatesAgreementPK(
        latestAgreement.id
      );
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId,
        eserviceId,
      });
      const previousAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(
          previousAgreementEntryPrimaryKey
        ),
        version: 1,
        state: itemState.inactive,
        GSIPK_consumerId_eserviceId,
        GSISK_agreementTimestamp:
          previousAgreement.stamps.activation!.when.toISOString(),
      };
      const latestAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(latestAgreementEntryPrimaryKey),
        version: 1,
        state: itemState.inactive,
        GSIPK_consumerId_eserviceId,
        GSISK_agreementTimestamp:
          latestAgreement.stamps.upgrade!.when.toISOString(),
      };
      await writeAgreementEntry(
        previousAgreementStateEntry,
        dynamoDBClient,
        genericLogger
      );
      await writeAgreementEntry(
        latestAgreementStateEntry,
        dynamoDBClient,
        genericLogger
      );

      const primaryKeyCatalogEntry = makePlatformStatesEServiceDescriptorPK({
        eserviceId: latestAgreement.eserviceId,
        descriptorId: latestAgreement.descriptorId,
      });
      const catalogEntry: PlatformStatesCatalogEntry = {
        PK: primaryKeyCatalogEntry,
        state: itemState.active,
        descriptorAudience: ["pagopa.it"],
        descriptorVoucherLifespan: 60,
        version: 1,
        updatedAt: new Date().toISOString(),
      };

      await writePlatformCatalogEntry(catalogEntry, dynamoDBClient);

      // token-generation-states
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          agreementId: previousAgreement.id,
          agreementState: itemState.inactive,
          GSIPK_eserviceId_descriptorId: undefined,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          agreementId: previousAgreement.id,
          agreementState: itemState.inactive,
          GSIPK_eserviceId_descriptorId: undefined,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      const retrievedEntry = await readAgreementEntry(
        latestAgreementEntryPrimaryKey,
        dynamoDBClient
      );
      const expectedAgreementEntry: PlatformStatesAgreementEntry = {
        ...latestAgreementStateEntry,
        state: itemState.active,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedEntry).toEqual(expectedAgreementEntry);

      // token-generation-states
      const GSIPK_eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId,
        descriptorId: latestAgreement.descriptorId,
      });
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );

      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          GSIPK_eserviceId_descriptorId,
          agreementId: latestAgreement.id,
          agreementState: itemState.active,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          GSIPK_eserviceId_descriptorId,
          agreementId: latestAgreement.id,
          agreementState: itemState.active,
          updatedAt: new Date().toISOString(),
        };

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          expectedTokenGenStatesConsumeClient1,
          expectedTokenGenStatesConsumeClient2,
        ])
      );
    });
    it("should update the entry if the incoming version is more recent than the table entry (agreement is not the latest -> no operation in token states)", async () => {
      const sixHoursAgo = new Date();
      sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

      const consumerId = generateId<TenantId>();
      const eserviceId = generateId<EServiceId>();

      const previousAgreement: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId,
        state: agreementState.active,
        stamps: {
          activation: {
            when: sixHoursAgo,
            who: generateId(),
          },
        },
      };
      const latestAgreement: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId,
        state: agreementState.active,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const payload: AgreementUpgradedV2 = {
        agreement: toAgreementV2(previousAgreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: previousAgreement.id,
        version: 2,
        type: "AgreementUpgraded",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const previousAgreementEntryPrimaryKey = makePlatformStatesAgreementPK(
        previousAgreement.id
      );
      const latestAgreementEntryPrimaryKey = makePlatformStatesAgreementPK(
        latestAgreement.id
      );
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId,
        eserviceId,
      });
      const previousAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(
          previousAgreementEntryPrimaryKey
        ),
        version: 1,
        state: itemState.inactive,
        GSIPK_consumerId_eserviceId,
        GSISK_agreementTimestamp:
          previousAgreement.stamps.activation!.when.toISOString(),
      };
      const latestAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(latestAgreementEntryPrimaryKey),
        version: 1,
        state: itemState.inactive,
        GSIPK_consumerId_eserviceId,
        GSISK_agreementTimestamp:
          latestAgreement.stamps.activation!.when.toISOString(),
      };
      await writeAgreementEntry(
        previousAgreementStateEntry,
        dynamoDBClient,
        genericLogger
      );
      await writeAgreementEntry(
        latestAgreementStateEntry,
        dynamoDBClient,
        genericLogger
      );

      const primaryKeyCatalogEntry = makePlatformStatesEServiceDescriptorPK({
        eserviceId: previousAgreement.eserviceId,
        descriptorId: previousAgreement.descriptorId,
      });
      const catalogEntry: PlatformStatesCatalogEntry = {
        PK: primaryKeyCatalogEntry,
        state: itemState.active,
        descriptorAudience: ["pagopa.it"],
        descriptorVoucherLifespan: 60,
        version: 1,
        updatedAt: new Date().toISOString(),
      };

      await writePlatformCatalogEntry(catalogEntry, dynamoDBClient);

      // token-generation-states
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          agreementId: previousAgreement.id,
          agreementState: itemState.inactive,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          agreementId: previousAgreement.id,
          agreementState: itemState.inactive,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      const retrievedEntry = await readAgreementEntry(
        previousAgreementEntryPrimaryKey,
        dynamoDBClient
      );
      const expectedAgreementEntry: PlatformStatesAgreementEntry = {
        ...previousAgreementStateEntry,
        state: itemState.active,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedEntry).toEqual(expectedAgreementEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenGenStatesConsumerClient1,
          tokenGenStatesConsumerClient2,
        ])
      );
    });
    it("add the entry if it doesn't exist", async () => {
      const agreement: Agreement = {
        ...getMockAgreement(),
        state: agreementState.active,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
          upgrade: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const payload: AgreementUpgradedV2 = {
        agreement: toAgreementV2(agreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: agreement.id,
        version: 1,
        type: "AgreementUpgraded",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const agreementEntryPrimaryKey = makePlatformStatesAgreementPK(
        agreement.id
      );
      const primaryKeyCatalogEntry = makePlatformStatesEServiceDescriptorPK({
        eserviceId: agreement.eserviceId,
        descriptorId: agreement.descriptorId,
      });
      const catalogEntry: PlatformStatesCatalogEntry = {
        PK: primaryKeyCatalogEntry,
        state: itemState.active,
        descriptorAudience: ["pagopa.it"],
        descriptorVoucherLifespan: 60,
        version: 1,
        updatedAt: new Date().toISOString(),
      };

      await writePlatformCatalogEntry(catalogEntry, dynamoDBClient);

      // token-generation-states
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: agreement.consumerId,
        eserviceId: agreement.eserviceId,
      });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          agreementState: itemState.active,
          GSIPK_consumerId_eserviceId,
          GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
            eserviceId: agreement.eserviceId,
            descriptorId: generateId(),
          }),
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          agreementState: itemState.active,
          GSIPK_consumerId_eserviceId,
          GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
            eserviceId: agreement.eserviceId,
            descriptorId: generateId(),
          }),
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedAgreementEntry = await readAgreementEntry(
        agreementEntryPrimaryKey,
        dynamoDBClient
      );

      const expectedAgreementEntry: PlatformStatesAgreementEntry = {
        PK: agreementEntryPrimaryKey,
        version: 1,
        state: itemState.active,
        updatedAt: agreement.stamps.activation!.when.toISOString(),
        GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
          consumerId: agreement.consumerId,
          eserviceId: agreement.eserviceId,
        }),
        GSISK_agreementTimestamp: agreement.stamps.upgrade!.when.toISOString(),
        agreementDescriptorId: agreement.descriptorId,
      };
      expect(retrievedAgreementEntry).toEqual(expectedAgreementEntry);

      // token-generation-states
      const GSIPK_eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: agreement.eserviceId,
        descriptorId: agreement.descriptorId,
      });
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );
      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          GSIPK_eserviceId_descriptorId,
          agreementId: agreement.id,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          GSIPK_eserviceId_descriptorId,
          agreementId: agreement.id,
          updatedAt: new Date().toISOString(),
        };

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          expectedTokenGenStatesConsumeClient1,
          expectedTokenGenStatesConsumeClient2,
        ])
      );
    });
  });

  describe("AgreementArchivedByUpgrade", () => {
    it("should delete the entry (no update in token-generation-states)", async () => {
      const consumerId = generateId<TenantId>();
      const eserviceId = generateId<EServiceId>();

      const agreement: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId,
        state: agreementState.archived,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
          archiving: {
            when: new Date(),
            who: generateId(),
          },
        },
      };

      const payload: AgreementArchivedByUpgradeV2 = {
        agreement: toAgreementV2(agreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: agreement.id,
        version: 1,
        type: "AgreementArchivedByUpgrade",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const agreementEntryPrimaryKey = makePlatformStatesAgreementPK(
        agreement.id
      );

      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId,
        eserviceId,
      });
      const agreementStateEntry: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(agreementEntryPrimaryKey),
        state: itemState.active,
        GSIPK_consumerId_eserviceId,
      };

      await writeAgreementEntry(
        agreementStateEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          agreementId: agreement.id,
          agreementState: itemState.active,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          agreementId: agreement.id,
          agreementState: itemState.active,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      const retrievedEntry = await readAgreementEntry(
        agreementEntryPrimaryKey,
        dynamoDBClient
      );
      expect(retrievedEntry).toBeUndefined();

      // token-generation-states
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenGenStatesConsumerClient1,
          tokenGenStatesConsumerClient2,
        ])
      );
    });
  });

  describe("AgreementArchivedByConsumer", () => {
    it("should delete the entry if it exists (agreement is the latest -> includes operation on token states)", async () => {
      const sixHoursAgo = new Date();
      sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

      const consumerId = generateId<TenantId>();
      const eserviceId = generateId<EServiceId>();

      const previousAgreement: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId,
        state: agreementState.archived,
        stamps: {
          activation: {
            when: sixHoursAgo,
            who: generateId(),
          },
        },
      };
      const latestAgreement: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId,
        state: agreementState.archived,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const payload: AgreementArchivedByConsumerV2 = {
        agreement: toAgreementV2(latestAgreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: latestAgreement.id,
        version: 1,
        type: "AgreementArchivedByConsumer",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const previousAgreementEntryPrimaryKey = makePlatformStatesAgreementPK(
        previousAgreement.id
      );
      const latestAgreementEntryPrimaryKey = makePlatformStatesAgreementPK(
        latestAgreement.id
      );
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId,
        eserviceId,
      });
      const previousAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(
          previousAgreementEntryPrimaryKey
        ),
        state: itemState.inactive,
        GSIPK_consumerId_eserviceId,
        GSISK_agreementTimestamp:
          previousAgreement.stamps.activation!.when.toISOString(),
      };
      const latestAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(latestAgreementEntryPrimaryKey),
        state: itemState.inactive,
        GSIPK_consumerId_eserviceId,
        GSISK_agreementTimestamp:
          latestAgreement.stamps.activation!.when.toISOString(),
      };
      await writeAgreementEntry(
        previousAgreementStateEntry,
        dynamoDBClient,
        genericLogger
      );
      await writeAgreementEntry(
        latestAgreementStateEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          agreementId: latestAgreement.id,
          agreementState: itemState.active,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          agreementId: latestAgreement.id,
          agreementState: itemState.active,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      const retrievedEntry = await readAgreementEntry(
        latestAgreementEntryPrimaryKey,
        dynamoDBClient
      );
      expect(retrievedEntry).toBeUndefined();

      // token-generation-states
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );
      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          agreementState: itemState.inactive,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          agreementState: itemState.inactive,
          updatedAt: new Date().toISOString(),
        };

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          expectedTokenGenStatesConsumeClient1,
          expectedTokenGenStatesConsumeClient2,
        ])
      );
    });
    it("should delete the entry (agreement is not the latest -> no operation on token states)", async () => {
      const sixHoursAgo = new Date();
      sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

      const consumerId = generateId<TenantId>();
      const eserviceId = generateId<EServiceId>();

      const previousAgreement: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId,
        state: agreementState.archived,
        stamps: {
          activation: {
            when: sixHoursAgo,
            who: generateId(),
          },
        },
      };
      const latestAgreement: Agreement = {
        ...getMockAgreement(),
        consumerId,
        eserviceId,
        state: agreementState.archived,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const payload: AgreementArchivedByConsumerV2 = {
        agreement: toAgreementV2(previousAgreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: previousAgreement.id,
        version: 1,
        type: "AgreementArchivedByConsumer",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const previousAgreementEntryPrimaryKey = makePlatformStatesAgreementPK(
        previousAgreement.id
      );
      const latestAgreementEntryPrimaryKey = makePlatformStatesAgreementPK(
        latestAgreement.id
      );
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId,
        eserviceId,
      });
      const previousAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(
          previousAgreementEntryPrimaryKey
        ),
        state: itemState.inactive,
        GSIPK_consumerId_eserviceId,
        GSISK_agreementTimestamp:
          previousAgreement.stamps.activation!.when.toISOString(),
      };
      const latestAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(latestAgreementEntryPrimaryKey),
        state: itemState.inactive,
        GSIPK_consumerId_eserviceId,
        GSISK_agreementTimestamp:
          latestAgreement.stamps.activation!.when.toISOString(),
      };
      await writeAgreementEntry(
        previousAgreementStateEntry,
        dynamoDBClient,
        genericLogger
      );
      await writeAgreementEntry(
        latestAgreementStateEntry,
        dynamoDBClient,
        genericLogger
      );

      // token-generation-states
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          agreementId: previousAgreement.id,
          agreementState: itemState.active,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          agreementId: previousAgreement.id,
          agreementState: itemState.active,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      const retrievedEntry = await readAgreementEntry(
        previousAgreementEntryPrimaryKey,
        dynamoDBClient
      );
      expect(retrievedEntry).toBeUndefined();

      // token-generation-states
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenGenStatesConsumerClient2,
          tokenGenStatesConsumerClient1,
        ])
      );
    });
  });
});

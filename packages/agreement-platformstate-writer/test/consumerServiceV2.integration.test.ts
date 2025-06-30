/* eslint-disable @typescript-eslint/no-non-null-assertion */
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
  writePlatformAgreementEntry,
} from "pagopa-interop-commons-test";
import { genericLogger } from "pagopa-interop-commons";
import { readAgreementEntry } from "../src/utils.js";
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
    it("should do no operation if the existing platform-states entry is more recent", async () => {
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
      const agreementEntryPrimaryKey = makePlatformStatesAgreementPK({
        consumerId: agreement.consumerId,
        eserviceId: agreement.eserviceId,
      });
      const previousPlatformStatesAgreement: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(
          agreementEntryPrimaryKey,
          agreement.id
        ),
        version: 2,
      };
      await writePlatformAgreementEntry(
        previousPlatformStatesAgreement,
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
        agreementEntryPrimaryKey,
        dynamoDBClient
      );

      expect(retrievedAgreementEntry).toEqual(previousPlatformStatesAgreement);

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

    it("should update the entry if the incoming version is more recent than the existing table entry", async () => {
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
      const agreementEntryPrimaryKey = makePlatformStatesAgreementPK({
        consumerId: agreement.consumerId,
        eserviceId: agreement.eserviceId,
      });
      const previousPlatformStatesAgreement: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(
          agreementEntryPrimaryKey,
          agreement.id
        ),
        agreementDescriptorId: agreement.descriptorId,
        version: 2,
      };
      await writePlatformAgreementEntry(
        previousPlatformStatesAgreement,
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
        ...previousPlatformStatesAgreement,
        state: itemState.active,
        producerId: agreement.producerId,
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
          producerId: agreement.producerId,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          agreementId: agreement.id,
          agreementState: itemState.active,
          GSIPK_eserviceId_descriptorId,
          producerId: agreement.producerId,
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

    it("should update the entry if the agreement is the latest", async () => {
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
        state: agreementState.active,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const payload: AgreementActivatedV2 = {
        agreement: toAgreementV2(latestAgreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: latestAgreement.id,
        version: 1,
        type: "AgreementActivated",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const agreementEntryPrimaryKey = makePlatformStatesAgreementPK({
        consumerId,
        eserviceId,
      });
      const previousPlatformStatesAgreement: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(
          agreementEntryPrimaryKey,
          previousAgreement.id
        ),
        agreementDescriptorId: previousAgreement.descriptorId,
        agreementTimestamp: sixHoursAgo.toISOString(),
        version: 8,
      };
      await writePlatformAgreementEntry(
        previousPlatformStatesAgreement,
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
        consumerId,
        eserviceId,
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
        state: itemState.active,
        version: 1,
        updatedAt: new Date().toISOString(),
        agreementId: latestAgreement.id,
        agreementTimestamp:
          latestAgreement.stamps.activation!.when.toISOString(),
        agreementDescriptorId: latestAgreement.descriptorId,
        producerId: latestAgreement.producerId,
      };
      expect(retrievedAgreementEntry).toEqual(expectedAgreementEntry);

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
          agreementId: latestAgreement.id,
          agreementState: itemState.active,
          GSIPK_eserviceId_descriptorId,
          producerId: latestAgreement.producerId,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          agreementId: latestAgreement.id,
          agreementState: itemState.active,
          GSIPK_eserviceId_descriptorId,
          producerId: latestAgreement.producerId,
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
      const agreementEntryPrimaryKey = makePlatformStatesAgreementPK({
        consumerId: agreement.consumerId,
        eserviceId: agreement.eserviceId,
      });

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
        updatedAt: new Date().toISOString(),
        agreementId: agreement.id,
        agreementTimestamp: agreement.stamps.activation!.when.toISOString(),
        agreementDescriptorId: agreement.descriptorId,
        producerId: agreement.producerId,
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
          producerId: agreement.producerId,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          GSIPK_eserviceId_descriptorId,
          agreementId: agreement.id,
          agreementState: itemState.active,
          producerId: agreement.producerId,
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
      const agreementEntryPrimaryKey = makePlatformStatesAgreementPK({
        consumerId: agreement.consumerId,
        eserviceId: agreement.eserviceId,
      });

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
        updatedAt: new Date().toISOString(),
        agreementId: agreement.id,
        agreementTimestamp: agreement.stamps.activation!.when.toISOString(),
        agreementDescriptorId: agreement.descriptorId,
        producerId: agreement.producerId,
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
          producerId: agreement.producerId,
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
          producerId: agreement.producerId,
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

    it("should do no operation if the agreement is not the latest", async () => {
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

      const agreementEntryPrimaryKey = makePlatformStatesAgreementPK({
        consumerId,
        eserviceId,
      });
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId,
        eserviceId,
      });

      const latestPlatformStatesAgreement: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(
          agreementEntryPrimaryKey,
          latestAgreement.id
        ),
        state: itemState.active,
        agreementTimestamp:
          latestAgreement.stamps.activation!.when.toISOString(),
      };

      await writePlatformAgreementEntry(
        latestPlatformStatesAgreement,
        dynamoDBClient
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
      expect(retrievedAgreementEntry).toEqual(latestPlatformStatesAgreement);

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
        version: 2,
        type: "AgreementSuspendedByProducer",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const agreementEntryPrimaryKey = makePlatformStatesAgreementPK({
        consumerId: agreement.consumerId,
        eserviceId: agreement.eserviceId,
      });

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      const retrievedAgreementEntry = await readAgreementEntry(
        agreementEntryPrimaryKey,
        dynamoDBClient
      );

      expect(retrievedAgreementEntry).toBeUndefined();
    });

    it("should do no operation if the message agreement is not the latest", async () => {
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
        state: agreementState.active,
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
        version: 2,
        type: "AgreementSuspendedByProducer",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const platformStatesAgreementPK = makePlatformStatesAgreementPK({
        consumerId,
        eserviceId,
      });
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId,
        eserviceId,
      });

      const latestPlatformStatesAgreement: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(
          platformStatesAgreementPK,
          latestAgreement.id
        ),
        state: itemState.active,
        agreementTimestamp:
          latestAgreement.stamps.activation!.when.toISOString(),
      };
      await writePlatformAgreementEntry(
        latestPlatformStatesAgreement,
        dynamoDBClient
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
        platformStatesAgreementPK,
        dynamoDBClient
      );
      expect(retrievedEntry).toEqual(latestPlatformStatesAgreement);

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

    it("should update token generation read model if the agreement is the latest", async () => {
      const consumerId = generateId<TenantId>();
      const eserviceId = generateId<EServiceId>();

      const agreement: Agreement = {
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
        agreement: toAgreementV2(agreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: agreement.id,
        version: 2,
        type: "AgreementSuspendedByProducer",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const platformStatesAgreementPK = makePlatformStatesAgreementPK({
        consumerId,
        eserviceId,
      });
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId,
        eserviceId,
      });

      const previousAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(
          platformStatesAgreementPK,
          agreement.id
        ),
        state: itemState.active,
        agreementTimestamp: agreement.stamps.activation!.when.toISOString(),
        agreementDescriptorId: agreement.descriptorId,
        version: 1,
      };

      await writePlatformAgreementEntry(
        previousAgreementStateEntry,
        dynamoDBClient
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

      const expectedAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...previousAgreementStateEntry,
        state: itemState.inactive,
        updatedAt: new Date().toISOString(),
        version: 2,
      };

      const retrievedEntry = await readAgreementEntry(
        platformStatesAgreementPK,
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
        version: 2,
        type: "AgreementSuspendedByConsumer",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const agreementEntryPrimaryKey = makePlatformStatesAgreementPK({
        consumerId: agreement.consumerId,
        eserviceId: agreement.eserviceId,
      });

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      const retrievedAgreementEntry = await readAgreementEntry(
        agreementEntryPrimaryKey,
        dynamoDBClient
      );

      expect(retrievedAgreementEntry).toBeUndefined();
    });

    it("should do no operation if the message agreement is not the latest", async () => {
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
        state: agreementState.active,
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
        version: 2,
        type: "AgreementSuspendedByConsumer",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const platformStatesAgreementPK = makePlatformStatesAgreementPK({
        consumerId,
        eserviceId,
      });
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId,
        eserviceId,
      });

      const latestPlatformStatesAgreement: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(
          platformStatesAgreementPK,
          latestAgreement.id
        ),
        state: itemState.active,
        agreementTimestamp:
          latestAgreement.stamps.activation!.when.toISOString(),
      };
      await writePlatformAgreementEntry(
        latestPlatformStatesAgreement,
        dynamoDBClient
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
        platformStatesAgreementPK,
        dynamoDBClient
      );
      expect(retrievedEntry).toEqual(latestPlatformStatesAgreement);

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

    it("should update token generation read model if the agreement is the latest", async () => {
      const consumerId = generateId<TenantId>();
      const eserviceId = generateId<EServiceId>();

      const agreement: Agreement = {
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
        agreement: toAgreementV2(agreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: agreement.id,
        version: 2,
        type: "AgreementSuspendedByConsumer",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const platformStatesAgreementPK = makePlatformStatesAgreementPK({
        consumerId,
        eserviceId,
      });
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId,
        eserviceId,
      });

      const previousAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(
          platformStatesAgreementPK,
          agreement.id
        ),
        state: itemState.active,
        agreementTimestamp: agreement.stamps.activation!.when.toISOString(),
        version: 1,
      };
      await writePlatformAgreementEntry(
        previousAgreementStateEntry,
        dynamoDBClient
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

      const expectedAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...previousAgreementStateEntry,
        state: itemState.inactive,
        updatedAt: new Date().toISOString(),
        version: 2,
      };

      const retrievedEntry = await readAgreementEntry(
        platformStatesAgreementPK,
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
        version: 2,
        type: "AgreementSuspendedByPlatform",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const agreementEntryPrimaryKey = makePlatformStatesAgreementPK({
        consumerId: agreement.consumerId,
        eserviceId: agreement.eserviceId,
      });

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      const retrievedAgreementEntry = await readAgreementEntry(
        agreementEntryPrimaryKey,
        dynamoDBClient
      );

      expect(retrievedAgreementEntry).toBeUndefined();
    });

    it("should do no operation if the message agreement is not the latest", async () => {
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
        version: 2,
        type: "AgreementSuspendedByPlatform",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const platformStatesAgreementPK = makePlatformStatesAgreementPK({
        consumerId,
        eserviceId,
      });
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId,
        eserviceId,
      });

      const latestPlatformStatesAgreement: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(
          platformStatesAgreementPK,
          latestAgreement.id
        ),
        state: itemState.active,
        agreementTimestamp:
          latestAgreement.stamps.activation!.when.toISOString(),
      };
      await writePlatformAgreementEntry(
        latestPlatformStatesAgreement,
        dynamoDBClient
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
        platformStatesAgreementPK,
        dynamoDBClient
      );
      expect(retrievedEntry).toEqual(latestPlatformStatesAgreement);

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

    it("should update token generation read model if the agreement is the latest", async () => {
      const consumerId = generateId<TenantId>();
      const eserviceId = generateId<EServiceId>();

      const agreement: Agreement = {
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
        agreement: toAgreementV2(agreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: agreement.id,
        version: 2,
        type: "AgreementSuspendedByPlatform",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const platformStatesAgreementPK = makePlatformStatesAgreementPK({
        consumerId,
        eserviceId,
      });
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId,
        eserviceId,
      });

      const previousAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(
          platformStatesAgreementPK,
          agreement.id
        ),
        state: itemState.active,
        agreementTimestamp: agreement.stamps.activation!.when.toISOString(),
        version: 1,
      };
      await writePlatformAgreementEntry(
        previousAgreementStateEntry,
        dynamoDBClient
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

      const expectedAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...previousAgreementStateEntry,
        state: itemState.inactive,
        updatedAt: new Date().toISOString(),
        version: 2,
      };

      const retrievedEntry = await readAgreementEntry(
        platformStatesAgreementPK,
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
        version: 3,
        type: "AgreementUnsuspendedByProducer",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const agreementEntryPrimaryKey = makePlatformStatesAgreementPK({
        consumerId: agreement.consumerId,
        eserviceId: agreement.eserviceId,
      });

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      const retrievedAgreementEntry = await readAgreementEntry(
        agreementEntryPrimaryKey,
        dynamoDBClient
      );

      expect(retrievedAgreementEntry).toBeUndefined();
    });

    it("should do no operation if the message agreement is not the latest", async () => {
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
        state: agreementState.suspended,
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
        version: 3,
        type: "AgreementUnsuspendedByProducer",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const platformStatesAgreementPK = makePlatformStatesAgreementPK({
        consumerId,
        eserviceId,
      });
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId,
        eserviceId,
      });

      const latestPlatformStatesAgreement: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(
          platformStatesAgreementPK,
          latestAgreement.id
        ),
        state: itemState.inactive,
        agreementTimestamp:
          latestAgreement.stamps.activation!.when.toISOString(),
        agreementDescriptorId: latestAgreement.descriptorId,
      };
      await writePlatformAgreementEntry(
        latestPlatformStatesAgreement,
        dynamoDBClient
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

      const retrievedEntry = await readAgreementEntry(
        platformStatesAgreementPK,
        dynamoDBClient
      );
      expect(retrievedEntry).toEqual(latestPlatformStatesAgreement);

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

    it("should update token generation read model if the agreement is the latest", async () => {
      const consumerId = generateId<TenantId>();
      const eserviceId = generateId<EServiceId>();

      const agreement: Agreement = {
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
        agreement: toAgreementV2(agreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: agreement.id,
        version: 3,
        type: "AgreementUnsuspendedByProducer",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const platformStatesAgreementPK = makePlatformStatesAgreementPK({
        consumerId,
        eserviceId,
      });
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId,
        eserviceId,
      });

      const previousAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(
          platformStatesAgreementPK,
          agreement.id
        ),
        state: itemState.inactive,
        agreementTimestamp: agreement.stamps.activation!.when.toISOString(),
        agreementDescriptorId: agreement.descriptorId,
        version: 2,
      };
      await writePlatformAgreementEntry(
        previousAgreementStateEntry,
        dynamoDBClient
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
          agreementId: agreement.id,
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
        version: 3,
      };

      const retrievedEntry = await readAgreementEntry(
        platformStatesAgreementPK,
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
        version: 3,
        type: "AgreementUnsuspendedByConsumer",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const agreementEntryPrimaryKey = makePlatformStatesAgreementPK({
        consumerId: agreement.consumerId,
        eserviceId: agreement.eserviceId,
      });

      await handleMessageV2(message, dynamoDBClient, genericLogger);

      const retrievedAgreementEntry = await readAgreementEntry(
        agreementEntryPrimaryKey,
        dynamoDBClient
      );

      expect(retrievedAgreementEntry).toBeUndefined();
    });

    it("should do no operation if the message agreement is not the latest", async () => {
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
        state: agreementState.suspended,
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
        version: 3,
        type: "AgreementUnsuspendedByConsumer",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const platformStatesAgreementPK = makePlatformStatesAgreementPK({
        consumerId,
        eserviceId,
      });
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId,
        eserviceId,
      });

      const latestPlatformStatesAgreement: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(
          platformStatesAgreementPK,
          latestAgreement.id
        ),
        state: itemState.inactive,
        agreementTimestamp:
          latestAgreement.stamps.activation!.when.toISOString(),
      };
      await writePlatformAgreementEntry(
        latestPlatformStatesAgreement,
        dynamoDBClient
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

      const retrievedEntry = await readAgreementEntry(
        platformStatesAgreementPK,
        dynamoDBClient
      );
      expect(retrievedEntry).toEqual(latestPlatformStatesAgreement);

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

    it("should update token generation read model if the agreement is the latest", async () => {
      const consumerId = generateId<TenantId>();
      const eserviceId = generateId<EServiceId>();

      const agreement: Agreement = {
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
        agreement: toAgreementV2(agreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: agreement.id,
        version: 3,
        type: "AgreementUnsuspendedByConsumer",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const platformStatesAgreementPK = makePlatformStatesAgreementPK({
        consumerId,
        eserviceId,
      });
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId,
        eserviceId,
      });

      const previousAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(
          platformStatesAgreementPK,
          agreement.id
        ),
        state: itemState.inactive,
        agreementTimestamp: agreement.stamps.activation!.when.toISOString(),
        version: 2,
      };
      await writePlatformAgreementEntry(
        previousAgreementStateEntry,
        dynamoDBClient
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
          agreementId: agreement.id,
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
        version: 3,
      };

      const retrievedEntry = await readAgreementEntry(
        platformStatesAgreementPK,
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
      const sixHoursAgo = new Date();
      sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

      const agreement: Agreement = {
        ...getMockAgreement(),
        state: agreementState.active,
        stamps: {
          activation: {
            when: sixHoursAgo,
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
        version: 2,
        type: "AgreementUpgraded",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const agreementEntryPrimaryKey = makePlatformStatesAgreementPK({
        consumerId: agreement.consumerId,
        eserviceId: agreement.eserviceId,
      });
      const previousStateEntry: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(
          agreementEntryPrimaryKey,
          agreement.id
        ),
        version: 3,
      };
      await writePlatformAgreementEntry(previousStateEntry, dynamoDBClient);

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
      const sixHoursAgo = new Date();
      sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

      const agreement: Agreement = {
        ...getMockAgreement(),
        state: agreementState.pending,
        stamps: {
          activation: {
            when: sixHoursAgo,
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
        version: 2,
        type: "AgreementUpgraded",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };

      // platform-states
      const platformStatesAgreementEntryPK = makePlatformStatesAgreementPK({
        consumerId: agreement.consumerId,
        eserviceId: agreement.eserviceId,
      });
      const platformStatesAgreementEntry: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(
          platformStatesAgreementEntryPK,
          agreement.id
        ),
        version: 1,
      };
      await writePlatformAgreementEntry(
        platformStatesAgreementEntry,
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

    it("should update the token generation read model if the incoming version is more recent than the platform-states entry and the agreement is the latest", async () => {
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
        state: agreementState.active,
        stamps: {
          ...previousAgreement.stamps,
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
      const platformStatesAgreementPK = makePlatformStatesAgreementPK({
        consumerId,
        eserviceId,
      });
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId,
        eserviceId,
      });
      const previousAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(
          platformStatesAgreementPK,
          previousAgreement.id
        ),
        version: 8,
        state: itemState.inactive,
        agreementTimestamp:
          previousAgreement.stamps.activation!.when.toISOString(),
      };
      await writePlatformAgreementEntry(
        previousAgreementStateEntry,
        dynamoDBClient
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
        platformStatesAgreementPK,
        dynamoDBClient
      );
      const expectedAgreementEntry: PlatformStatesAgreementEntry = {
        PK: platformStatesAgreementPK,
        state: itemState.active,
        version: 2,
        updatedAt: new Date().toISOString(),
        agreementId: latestAgreement.id,
        agreementTimestamp: latestAgreement.stamps.upgrade!.when.toISOString(),
        agreementDescriptorId: latestAgreement.descriptorId,
        producerId: latestAgreement.producerId,
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
          producerId: latestAgreement.producerId,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          GSIPK_eserviceId_descriptorId,
          agreementId: latestAgreement.id,
          agreementState: itemState.active,
          producerId: latestAgreement.producerId,
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

    it("should do no operation if the incoming agreement is not the latest", async () => {
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
          upgrade: {
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
      const platformStatesAgreementPK = makePlatformStatesAgreementPK({
        consumerId,
        eserviceId,
      });
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId,
        eserviceId,
      });
      const latestAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(
          platformStatesAgreementPK,
          latestAgreement.id
        ),
        version: 1,
        state: itemState.active,
        agreementTimestamp:
          latestAgreement.stamps.activation!.when.toISOString(),
      };
      await writePlatformAgreementEntry(
        latestAgreementStateEntry,
        dynamoDBClient
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
        platformStatesAgreementPK,
        dynamoDBClient
      );
      expect(retrievedEntry).toEqual(latestAgreementStateEntry);

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

    it("should add the platform-states entry and update token-generation-states if the platform-states entry doesn't exist", async () => {
      const sixHoursAgo = new Date();
      sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

      const agreement: Agreement = {
        ...getMockAgreement(),
        state: agreementState.active,
        stamps: {
          activation: {
            when: sixHoursAgo,
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
      const agreementEntryPrimaryKey = makePlatformStatesAgreementPK({
        consumerId: agreement.consumerId,
        eserviceId: agreement.eserviceId,
      });

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
        updatedAt: new Date().toISOString(),
        agreementId: agreement.id,
        agreementTimestamp: agreement.stamps.upgrade!.when.toISOString(),
        agreementDescriptorId: agreement.descriptorId,
        producerId: agreement.producerId,
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
          producerId: agreement.producerId,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          GSIPK_eserviceId_descriptorId,
          agreementId: agreement.id,
          agreementState: itemState.active,
          producerId: agreement.producerId,
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

  describe("AgreementArchivedByConsumer", () => {
    it("should update agreement state to inactive in the token generation read model if the platform-states entry exists and the agreement is the latest", async () => {
      const consumerId = generateId<TenantId>();
      const eserviceId = generateId<EServiceId>();

      const agreement: Agreement = {
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
      const archivedAgreement: Agreement = {
        ...agreement,
        state: agreementState.archived,
      };
      const payload: AgreementArchivedByConsumerV2 = {
        agreement: toAgreementV2(archivedAgreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: archivedAgreement.id,
        version: 2,
        type: "AgreementArchivedByConsumer",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };

      // platform-states
      const platformStatesAgreementPK = makePlatformStatesAgreementPK({
        consumerId,
        eserviceId,
      });
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId,
        eserviceId,
      });
      const platformStatesAgreement: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(
          platformStatesAgreementPK,
          agreement.id
        ),
        state: itemState.active,
        agreementTimestamp: agreement.stamps.activation!.when.toISOString(),
      };
      await writePlatformAgreementEntry(
        platformStatesAgreement,
        dynamoDBClient
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

      // platform-states
      const retrievedEntry = await readAgreementEntry(
        platformStatesAgreementPK,
        dynamoDBClient
      );
      const expectedPlatformStatesEntry: PlatformStatesAgreementEntry = {
        ...platformStatesAgreement,
        state: itemState.inactive,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedEntry).toEqual(expectedPlatformStatesEntry);

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

    it("should do no operation if the agreement is not the latest", async () => {
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
        state: agreementState.active,
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
        version: 2,
        type: "AgreementArchivedByConsumer",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      const platformStatesAgreementPK = makePlatformStatesAgreementPK({
        consumerId,
        eserviceId,
      });
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId,
        eserviceId,
      });
      const platformStatesAgreement: PlatformStatesAgreementEntry = {
        ...getMockPlatformStatesAgreementEntry(
          platformStatesAgreementPK,
          latestAgreement.id
        ),
        state: itemState.active,
        agreementTimestamp:
          latestAgreement.stamps.activation!.when.toISOString(),
      };
      await writePlatformAgreementEntry(
        platformStatesAgreement,
        dynamoDBClient
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
        platformStatesAgreementPK,
        dynamoDBClient
      );
      expect(retrievedEntry).toEqual(platformStatesAgreement);

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

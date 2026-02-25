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
  AgreementActivatedV1,
  AgreementAddedV1,
  AgreementDeactivatedV1,
  AgreementDeletedV1,
  AgreementEventEnvelope,
  AgreementId,
  AgreementUpdatedV1,
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
} from "pagopa-interop-models";
import {
  getMockTokenGenStatesConsumerClient,
  getMockAgreement,
  buildDynamoDBTables,
  deleteDynamoDBTables,
  toAgreementV1,
  getMockPlatformStatesAgreementEntry,
  writePlatformCatalogEntry,
  writeTokenGenStatesConsumerClient,
  readAllTokenGenStatesItems,
  writePlatformAgreementEntry,
} from "pagopa-interop-commons-test";
import { genericLogger } from "pagopa-interop-commons";
import { readAgreementEntry } from "../src/utils.js";
import { handleMessageV1 } from "../src/consumerServiceV1.js";
import { dynamoDBClient } from "./utils.js";

describe("integration tests V1 events", async () => {
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
      const payload: AgreementActivatedV1 = {
        agreement: toAgreementV1(agreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: agreement.id,
        version: 1,
        type: "AgreementActivated",
        event_version: 1,
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
        version: 2,
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

      await handleMessageV1(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedAgreementEntry = await readAgreementEntry(
        agreementEntryPrimaryKey,
        dynamoDBClient
      );

      expect(retrievedAgreementEntry).toEqual(previousStateEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);

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
      const payload: AgreementActivatedV1 = {
        agreement: toAgreementV1(agreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: agreement.id,
        version: 3,
        type: "AgreementActivated",
        event_version: 1,
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

      await handleMessageV1(message, dynamoDBClient, genericLogger);

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
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);

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
      const payload: AgreementActivatedV1 = {
        agreement: toAgreementV1(latestAgreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: latestAgreement.id,
        version: 1,
        type: "AgreementActivated",
        event_version: 1,
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

      await handleMessageV1(message, dynamoDBClient, genericLogger);

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
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          agreementId: latestAgreement.id,
          agreementState: itemState.active,
          producerId: latestAgreement.producerId,
          GSIPK_eserviceId_descriptorId,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          agreementId: latestAgreement.id,
          agreementState: itemState.active,
          producerId: latestAgreement.producerId,
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
      const payload: AgreementActivatedV1 = {
        agreement: toAgreementV1(agreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: agreement.id,
        version: 1,
        type: "AgreementActivated",
        event_version: 1,
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

      await handleMessageV1(message, dynamoDBClient, genericLogger);

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
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          agreementId: agreement.id,
          GSIPK_eserviceId_descriptorId,
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
      const payload: AgreementActivatedV1 = {
        agreement: toAgreementV1(agreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: agreement.id,
        version: 1,
        type: "AgreementActivated",
        event_version: 1,
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

      await handleMessageV1(message, dynamoDBClient, genericLogger);

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
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          agreementId: agreement.id,
          agreementState: itemState.active,
          producerId: agreement.producerId,
          descriptorState: catalogEntry.state,
          descriptorAudience: catalogEntry.descriptorAudience,
          descriptorVoucherLifespan: catalogEntry.descriptorVoucherLifespan,
          GSIPK_eserviceId_descriptorId,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          agreementId: agreement.id,
          agreementState: itemState.active,
          producerId: agreement.producerId,
          descriptorState: catalogEntry.state,
          descriptorAudience: catalogEntry.descriptorAudience,
          descriptorVoucherLifespan: catalogEntry.descriptorVoucherLifespan,
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

      const payload: AgreementActivatedV1 = {
        agreement: toAgreementV1(previousAgreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: previousAgreement.id,
        version: 1,
        type: "AgreementActivated",
        event_version: 1,
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
          agreementState: itemState.inactive,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV1(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedAgreementEntry = await readAgreementEntry(
        agreementEntryPrimaryKey,
        dynamoDBClient
      );
      expect(retrievedAgreementEntry).toEqual(latestPlatformStatesAgreement);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenGenStatesConsumerClient1,
          tokenGenStatesConsumerClient2,
        ])
      );
    });
  });

  describe("AgreementAdded (upgrade)", async () => {
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
      const payload: AgreementAddedV1 = {
        agreement: toAgreementV1(agreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: agreement.id,
        version: 2,
        type: "AgreementAdded",
        event_version: 1,
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

      await handleMessageV1(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedAgreementEntry = await readAgreementEntry(
        agreementEntryPrimaryKey,
        dynamoDBClient
      );
      expect(retrievedAgreementEntry).toEqual(previousStateEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);

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
      const payload: AgreementAddedV1 = {
        agreement: toAgreementV1(agreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: agreement.id,
        version: 2,
        type: "AgreementAdded",
        event_version: 1,
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

      await handleMessageV1(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedAgreementEntry = await readAgreementEntry(
        platformStatesAgreementEntryPK,
        dynamoDBClient
      );
      expect(retrievedAgreementEntry).toEqual(platformStatesAgreementEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);

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
      const payload: AgreementAddedV1 = {
        agreement: toAgreementV1(latestAgreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: latestAgreement.id,
        version: 2,
        type: "AgreementAdded",
        event_version: 1,
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
        version: 1,
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
          agreementId: previousAgreement.id,
          agreementState: itemState.inactive,
          GSIPK_consumerId_eserviceId,
          GSIPK_eserviceId_descriptorId: undefined,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV1(message, dynamoDBClient, genericLogger);

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
        eserviceId: latestAgreement.eserviceId,
        descriptorId: latestAgreement.descriptorId,
      });
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);

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
      const payload: AgreementAddedV1 = {
        agreement: toAgreementV1(previousAgreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: previousAgreement.id,
        version: 2,
        type: "AgreementAdded",
        event_version: 1,
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

      await handleMessageV1(message, dynamoDBClient, genericLogger);

      const retrievedEntry = await readAgreementEntry(
        platformStatesAgreementPK,
        dynamoDBClient
      );
      expect(retrievedEntry).toEqual(latestAgreementStateEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);

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
      const payload: AgreementAddedV1 = {
        agreement: toAgreementV1(agreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: agreement.id,
        version: 1,
        type: "AgreementAdded",
        event_version: 1,
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

      await handleMessageV1(message, dynamoDBClient, genericLogger);

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
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
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

  describe("AgreementUpdated (suspended by producer)", async () => {
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
      const payload: AgreementUpdatedV1 = {
        agreement: toAgreementV1(previousAgreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: previousAgreement.id,
        version: 2,
        type: "AgreementUpdated",
        event_version: 1,
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
          agreementId: previousAgreement.id,
          agreementState: itemState.active,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV1(message, dynamoDBClient, genericLogger);

      const retrievedEntry = await readAgreementEntry(
        platformStatesAgreementPK,
        dynamoDBClient
      );
      expect(retrievedEntry).toEqual(latestPlatformStatesAgreement);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);

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
      const payload: AgreementUpdatedV1 = {
        agreement: toAgreementV1(agreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: agreement.id,
        version: 2,
        type: "AgreementUpdated",
        event_version: 1,
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

      await handleMessageV1(message, dynamoDBClient, genericLogger);

      const expectedAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...previousAgreementStateEntry,
        state: itemState.inactive,
        producerId: agreement.producerId,
        updatedAt: new Date().toISOString(),
        version: 2,
      };

      const retrievedEntry = await readAgreementEntry(
        platformStatesAgreementPK,
        dynamoDBClient
      );
      expect(retrievedEntry).toEqual(expectedAgreementStateEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      const GSIPK_eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId,
        descriptorId: agreement.descriptorId,
      });
      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          GSIPK_eserviceId_descriptorId,
          agreementState: itemState.inactive,
          producerId: agreement.producerId,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          GSIPK_eserviceId_descriptorId,
          agreementState: itemState.inactive,
          producerId: agreement.producerId,
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

  describe("AgreementUpdated (first activation)", () => {
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
      const payload: AgreementUpdatedV1 = {
        agreement: toAgreementV1(agreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: agreement.id,
        version: 1,
        type: "AgreementUpdated",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };
      const agreementEntryPrimaryKey = makePlatformStatesAgreementPK({
        consumerId: agreement.consumerId,
        eserviceId: agreement.eserviceId,
      });

      await handleMessageV1(message, dynamoDBClient, genericLogger);

      const retrievedAgreementEntry = await readAgreementEntry(
        agreementEntryPrimaryKey,
        dynamoDBClient
      );

      const expectedAgreementStateEntry: PlatformStatesAgreementEntry = {
        PK: agreementEntryPrimaryKey,
        state: itemState.active,
        agreementId: agreement.id,
        agreementTimestamp: agreement.stamps.activation!.when.toISOString(),
        version: 1,
        updatedAt: new Date().toISOString(),
        agreementDescriptorId: agreement.descriptorId,
        producerId: agreement.producerId,
      };

      expect(retrievedAgreementEntry).toEqual(expectedAgreementStateEntry);
    });
  });

  describe("AgreementUpdated (unsuspended by producer)", async () => {
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
      const payload: AgreementUpdatedV1 = {
        agreement: toAgreementV1(previousAgreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: previousAgreement.id,
        version: 3,
        type: "AgreementUpdated",
        event_version: 1,
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
          agreementId: previousAgreement.id,
          agreementState: itemState.inactive,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV1(message, dynamoDBClient, genericLogger);

      const retrievedEntry = await readAgreementEntry(
        platformStatesAgreementPK,
        dynamoDBClient
      );
      expect(retrievedEntry).toEqual(latestPlatformStatesAgreement);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);

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
      const payload: AgreementUpdatedV1 = {
        agreement: toAgreementV1(agreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: agreement.id,
        version: 3,
        type: "AgreementUpdated",
        event_version: 1,
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

      await handleMessageV1(message, dynamoDBClient, genericLogger);

      const expectedAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...previousAgreementStateEntry,
        state: itemState.active,
        producerId: agreement.producerId,
        updatedAt: new Date().toISOString(),
        version: 3,
      };

      const retrievedEntry = await readAgreementEntry(
        platformStatesAgreementPK,
        dynamoDBClient
      );
      expect(retrievedEntry).toEqual(expectedAgreementStateEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      const GSIPK_eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId,
        descriptorId: agreement.descriptorId,
      });
      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          GSIPK_eserviceId_descriptorId,
          agreementState: itemState.active,
          producerId: agreement.producerId,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          GSIPK_eserviceId_descriptorId,
          agreementState: itemState.active,
          producerId: agreement.producerId,
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

  describe("Agreement Updated (archived by consumer or by upgrade)", () => {
    it("should update agreement state to inactive in token generation read model if the agreement is the latest", async () => {
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
      const payload: AgreementUpdatedV1 = {
        agreement: toAgreementV1(archivedAgreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: archivedAgreement.id,
        version: 2,
        type: "AgreementUpdated",
        event_version: 1,
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

      await handleMessageV1(message, dynamoDBClient, genericLogger);

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
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
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
      const payload: AgreementUpdatedV1 = {
        agreement: toAgreementV1(previousAgreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: previousAgreement.id,
        version: 2,
        type: "AgreementUpdated",
        event_version: 1,
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

      await handleMessageV1(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedEntry = await readAgreementEntry(
        platformStatesAgreementPK,
        dynamoDBClient
      );
      expect(retrievedEntry).toEqual(platformStatesAgreement);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenGenStatesConsumerClient2,
          tokenGenStatesConsumerClient1,
        ])
      );
    });
  });

  describe("AgreementDeactivated (archived by consumer or by upgrade)", () => {
    it("should update agreement state to inactive in token generation read model if the agreement is the latest", async () => {
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
      const payload: AgreementDeactivatedV1 = {
        agreement: toAgreementV1(archivedAgreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: archivedAgreement.id,
        version: 2,
        type: "AgreementDeactivated",
        event_version: 1,
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

      await handleMessageV1(message, dynamoDBClient, genericLogger);

      // platform-states
      const retrievedPlatformStatesEntry = await readAgreementEntry(
        platformStatesAgreementPK,
        dynamoDBClient
      );
      const expectedPlatformStatesEntry: PlatformStatesAgreementEntry = {
        ...platformStatesAgreement,
        state: itemState.inactive,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedPlatformStatesEntry).toEqual(expectedPlatformStatesEntry);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
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
      const payload: AgreementDeactivatedV1 = {
        agreement: toAgreementV1(previousAgreement),
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: previousAgreement.id,
        version: 2,
        type: "AgreementDeactivated",
        event_version: 1,
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

      await handleMessageV1(message, dynamoDBClient, genericLogger);

      const retrievedEntry = await readAgreementEntry(
        platformStatesAgreementPK,
        dynamoDBClient
      );
      expect(retrievedEntry).toEqual(platformStatesAgreement);

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);

      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          tokenGenStatesConsumerClient2,
          tokenGenStatesConsumerClient1,
        ])
      );
    });
  });

  describe("AgreementDeleted", () => {
    it("should update agreement state to inactive in token generation read model", async () => {
      const consumerId = generateId<TenantId>();
      const eserviceId = generateId<EServiceId>();

      const agreementId = generateId<AgreementId>();
      const payload: AgreementDeletedV1 = {
        agreementId,
      };
      const message: AgreementEventEnvelope = {
        sequence_num: 1,
        stream_id: agreementId,
        version: 2,
        type: "AgreementDeleted",
        event_version: 1,
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
          agreementId
        ),
        state: itemState.active,
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
          agreementId,
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
          agreementId,
          agreementState: itemState.active,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV1(message, dynamoDBClient, genericLogger);

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
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
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
  });
});

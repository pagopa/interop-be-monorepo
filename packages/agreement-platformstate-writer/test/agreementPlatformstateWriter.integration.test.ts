/* eslint-disable @typescript-eslint/no-floating-promises */
import { fail } from "assert";
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
  AgreementUnsuspendedByProducerV2,
  EServiceId,
  PlatformStatesAgreementEntry,
  PlatformStatesCatalogEntry,
  TenantId,
  TokenGenerationStatesClientPurposeEntry,
  agreementState,
  generateId,
  itemState,
  makeGSIPKConsumerIdEServiceId,
  makePlatformStatesAgreementPK,
  makePlatformStatesEServiceDescriptorPK,
  makeTokenGenerationStatesClientKidPurposePK,
  toAgreementV2,
} from "pagopa-interop-models";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  getMockTokenStatesClientPurposeEntry,
  getMockAgreement,
  buildDynamoDBTables,
  deleteDynamoDBTables,
} from "pagopa-interop-commons-test";
import {
  readAgreementEntry,
  readTokenStateEntriesByConsumerIdEserviceId,
  writeAgreementEntry,
} from "../src/utils.js";
import { handleMessageV2 } from "../src/consumerServiceV2.js";
import {
  config,
  getMockAgreementEntry,
  sleep,
  writeCatalogEntry,
  writeTokenStateEntry,
} from "./utils.js";

describe("integration tests V2 events", async () => {
  if (!config) {
    fail();
  }
  const dynamoDBClient = new DynamoDBClient({
    credentials: { accessKeyId: "key", secretAccessKey: "secret" },
    region: "eu-central-1",
    endpoint: `http://${config.tokenGenerationReadModelDbHost}:${config.tokenGenerationReadModelDbPort}`,
  });
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
    it("no operation if the entry already exists: incoming has version 1; previous entry has version 2", async () => {
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
        ...getMockAgreementEntry(agreementEntryPrimaryKey),
        version: 2,
      };
      await writeAgreementEntry(previousStateEntry, dynamoDBClient);

      // token-generation-states
      const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: agreement.consumerId,
        eserviceId: agreement.eserviceId,
      });
      const previousTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK1),
          agreementState: itemState.active,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenStateEntry(previousTokenStateEntry1, dynamoDBClient);

      const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const previousTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK2),
          agreementState: itemState.active,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenStateEntry(previousTokenStateEntry2, dynamoDBClient);

      await sleep(1000, mockDate);
      await handleMessageV2(message, dynamoDBClient);

      // platform-states
      const retrievedAgreementEntry = await readAgreementEntry(
        agreementEntryPrimaryKey,
        dynamoDBClient
      );

      expect(retrievedAgreementEntry).toEqual(previousStateEntry);

      // token-generation-states
      const retrievedTokenStateEntries =
        await readTokenStateEntriesByConsumerIdEserviceId(
          GSIPK_consumerId_eserviceId,
          dynamoDBClient
        );

      expect(retrievedTokenStateEntries).toHaveLength(2);
      expect(retrievedTokenStateEntries).toEqual(
        expect.arrayContaining([
          previousTokenStateEntry1,
          previousTokenStateEntry2,
        ])
      );
    });
    it("entry has to be updated: incoming has version 3; previous entry has version 2", async () => {
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
        ...getMockAgreementEntry(agreementEntryPrimaryKey),
        version: 2,
      };
      await writeAgreementEntry(previousStateEntry, dynamoDBClient);

      // token-generation-states
      const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: agreement.consumerId,
        eserviceId: agreement.eserviceId,
      });
      const previousTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK1),
          agreementState: itemState.inactive,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenStateEntry(previousTokenStateEntry1, dynamoDBClient);

      const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const previousTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK2),
          agreementState: itemState.inactive,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenStateEntry(previousTokenStateEntry2, dynamoDBClient);

      await sleep(1000, mockDate);
      await handleMessageV2(message, dynamoDBClient);

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
      const retrievedTokenStateEntries =
        await readTokenStateEntriesByConsumerIdEserviceId(
          GSIPK_consumerId_eserviceId,
          dynamoDBClient
        );
      const expectedTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
        {
          ...previousTokenStateEntry1,
          agreementState: itemState.active,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
        {
          ...previousTokenStateEntry2,
          agreementState: itemState.active,
          updatedAt: new Date().toISOString(),
        };

      expect(retrievedTokenStateEntries).toHaveLength(2);
      expect(retrievedTokenStateEntries).toEqual(
        expect.arrayContaining([
          expectedTokenStateEntry1,
          expectedTokenStateEntry2,
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

      const primaryKeyCatalogEntry = makePlatformStatesEServiceDescriptorPK({
        eserviceId: agreement.eserviceId,
        descriptorId: agreement.descriptorId,
      });

      const catalogEntry: PlatformStatesCatalogEntry = {
        PK: primaryKeyCatalogEntry,
        state: itemState.inactive,
        descriptorAudience: "pagopa.it",
        descriptorVoucherLifespan: 60,
        version: 1,
        updatedAt: new Date().toISOString(),
      };

      await writeCatalogEntry(catalogEntry, dynamoDBClient);

      // token-generation-states
      const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: agreement.consumerId,
        eserviceId: agreement.eserviceId,
      });
      const previousTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK1),
          agreementState: itemState.inactive,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenStateEntry(previousTokenStateEntry1, dynamoDBClient);

      const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const previousTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK2),
          agreementState: itemState.inactive,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenStateEntry(previousTokenStateEntry2, dynamoDBClient);

      await sleep(1000, mockDate);
      await handleMessageV2(message, dynamoDBClient);

      // platform-states
      const retrievedAgreementEntry = await readAgreementEntry(
        agreementEntryPrimaryKey,
        dynamoDBClient
      );

      const expectedAgreementEntry: PlatformStatesAgreementEntry = {
        PK: agreementEntryPrimaryKey,
        version: 1,
        state: itemState.active,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        updatedAt: agreement.stamps.activation!.when.toISOString(),
        GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
          consumerId: agreement.consumerId,
          eserviceId: agreement.eserviceId,
        }),
        GSISK_agreementTimestamp:
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          agreement.stamps.activation!.when.toISOString(),
        agreementDescriptorId: agreement.descriptorId,
      };
      expect(retrievedAgreementEntry).toEqual(expectedAgreementEntry);

      // token-generation-states
      const retrievedTokenStateEntries =
        await readTokenStateEntriesByConsumerIdEserviceId(
          GSIPK_consumerId_eserviceId,
          dynamoDBClient
        );
      const expectedTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
        {
          ...previousTokenStateEntry1,
          agreementState: itemState.active,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
        {
          ...previousTokenStateEntry2,
          agreementState: itemState.active,
          updatedAt: new Date().toISOString(),
        };

      expect(retrievedTokenStateEntries).toHaveLength(2);
      expect(retrievedTokenStateEntries).toEqual(
        expect.arrayContaining([
          expectedTokenStateEntry1,
          expectedTokenStateEntry2,
        ])
      );
    });
    it("should add the entry if it doesn't exist - and add descriptor info to token-generation-states entry if missing", () => {});
  });
  describe("AgreementSuspendedByProducer", async () => {});
  describe("AgreementUnsuspendedByProducer", async () => {
    it("should not throw error if the entry doesn't exist", async () => {
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

      await sleep(1000, mockDate);
      await handleMessageV2(message, dynamoDBClient);

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
        ...getMockAgreementEntry(previousAgreementEntryPrimaryKey),
        state: itemState.inactive,
        GSIPK_consumerId_eserviceId,
        GSISK_agreementTimestamp:
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          previousAgreement.stamps.activation!.when.toISOString(),
      };

      const latestAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...getMockAgreementEntry(latestAgreementEntryPrimaryKey),
        state: itemState.inactive,
        GSIPK_consumerId_eserviceId,
        GSISK_agreementTimestamp:
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          latestAgreement.stamps.activation!.when.toISOString(),
      };

      await writeAgreementEntry(previousAgreementStateEntry, dynamoDBClient);
      await writeAgreementEntry(latestAgreementStateEntry, dynamoDBClient);

      // token-generation-states
      const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const previousTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK1),
          agreementId: previousAgreement.id,
          agreementState: itemState.inactive,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenStateEntry(previousTokenStateEntry1, dynamoDBClient);

      const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const previousTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK2),
          agreementId: previousAgreement.id,
          agreementState: itemState.inactive,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenStateEntry(previousTokenStateEntry2, dynamoDBClient);

      await sleep(1000, mockDate);
      await handleMessageV2(message, dynamoDBClient);

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
      const retrievedTokenStateEntries =
        await readTokenStateEntriesByConsumerIdEserviceId(
          GSIPK_consumerId_eserviceId,
          dynamoDBClient
        );

      expect(retrievedTokenStateEntries).toHaveLength(2);
      // expect(retrievedTokenStateEntries).toEqual(
      //   expect.arrayContaining([
      //     previousTokenStateEntry2,
      //     previousTokenStateEntry1,
      //   ])
      // );
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
        ...getMockAgreementEntry(previousAgreementEntryPrimaryKey),
        state: itemState.inactive,
        GSIPK_consumerId_eserviceId,
        GSISK_agreementTimestamp:
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          previousAgreement.stamps.activation!.when.toISOString(),
      };

      const latestAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...getMockAgreementEntry(latestAgreementEntryPrimaryKey),
        state: itemState.inactive,
        GSIPK_consumerId_eserviceId,
        GSISK_agreementTimestamp:
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          latestAgreement.stamps.activation!.when.toISOString(),
      };

      await writeAgreementEntry(previousAgreementStateEntry, dynamoDBClient);
      await writeAgreementEntry(latestAgreementStateEntry, dynamoDBClient);

      // token-generation-states
      const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const previousTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK1),
          agreementId: latestAgreement.id,
          agreementState: itemState.inactive,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenStateEntry(previousTokenStateEntry1, dynamoDBClient);

      const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const previousTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK2),
          agreementId: latestAgreement.id,
          agreementState: itemState.inactive,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenStateEntry(previousTokenStateEntry2, dynamoDBClient);

      await sleep(1000, mockDate);
      await handleMessageV2(message, dynamoDBClient);

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
      const retrievedTokenStateEntries =
        await readTokenStateEntriesByConsumerIdEserviceId(
          GSIPK_consumerId_eserviceId,
          dynamoDBClient
        );
      const expectedTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
        {
          ...previousTokenStateEntry1,
          agreementState: itemState.active,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
        {
          ...previousTokenStateEntry2,
          agreementState: itemState.active,
          updatedAt: new Date().toISOString(),
        };

      expect(retrievedTokenStateEntries).toHaveLength(2);
      expect(retrievedTokenStateEntries).toEqual(
        expect.arrayContaining([
          expectedTokenStateEntry2,
          expectedTokenStateEntry1,
        ])
      );
    });
  });

  describe("AgreementUpgraded", async () => {});

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
        ...getMockAgreementEntry(agreementEntryPrimaryKey),
        state: itemState.active,
        GSIPK_consumerId_eserviceId,
      };

      await writeAgreementEntry(agreementStateEntry, dynamoDBClient);

      // token-generation-states
      const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const previousTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK1),
          agreementId: agreement.id,
          agreementState: itemState.active,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenStateEntry(previousTokenStateEntry1, dynamoDBClient);

      const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const previousTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK2),
          agreementId: agreement.id,
          agreementState: itemState.active,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenStateEntry(previousTokenStateEntry2, dynamoDBClient);

      await sleep(1000, mockDate);
      await handleMessageV2(message, dynamoDBClient);

      const retrievedEntry = await readAgreementEntry(
        agreementEntryPrimaryKey,
        dynamoDBClient
      );
      expect(retrievedEntry).toBeUndefined();

      // token-generation-states
      const retrievedTokenStateEntries =
        await readTokenStateEntriesByConsumerIdEserviceId(
          GSIPK_consumerId_eserviceId,
          dynamoDBClient
        );

      expect(retrievedTokenStateEntries).toHaveLength(2);
      expect(retrievedTokenStateEntries).toEqual(
        expect.arrayContaining([
          previousTokenStateEntry1,
          previousTokenStateEntry2,
        ])
      );
    });
  });

  describe("AgreementArchivedByConsumer", () => {
    it("agreement is the latest (includes operation on token states)", async () => {
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
        ...getMockAgreementEntry(previousAgreementEntryPrimaryKey),
        state: itemState.inactive,
        GSIPK_consumerId_eserviceId,
        GSISK_agreementTimestamp:
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          previousAgreement.stamps.activation!.when.toISOString(),
      };
      const latestAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...getMockAgreementEntry(latestAgreementEntryPrimaryKey),
        state: itemState.inactive,
        GSIPK_consumerId_eserviceId,
        GSISK_agreementTimestamp:
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          latestAgreement.stamps.activation!.when.toISOString(),
      };
      await writeAgreementEntry(previousAgreementStateEntry, dynamoDBClient);
      await writeAgreementEntry(latestAgreementStateEntry, dynamoDBClient);

      // token-generation-states
      const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const previousTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK1),
          agreementId: latestAgreement.id,
          agreementState: itemState.active,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenStateEntry(previousTokenStateEntry1, dynamoDBClient);

      const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const previousTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK2),
          agreementId: latestAgreement.id,
          agreementState: itemState.active,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenStateEntry(previousTokenStateEntry2, dynamoDBClient);

      await sleep(1000, mockDate);
      await handleMessageV2(message, dynamoDBClient);

      const retrievedEntry = await readAgreementEntry(
        latestAgreementEntryPrimaryKey,
        dynamoDBClient
      );
      expect(retrievedEntry).toBeUndefined();

      // token-generation-states
      const retrievedTokenStateEntries =
        await readTokenStateEntriesByConsumerIdEserviceId(
          GSIPK_consumerId_eserviceId,
          dynamoDBClient
        );
      const expectedTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
        {
          ...previousTokenStateEntry1,
          agreementState: itemState.inactive,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
        {
          ...previousTokenStateEntry2,
          agreementState: itemState.inactive,
          updatedAt: new Date().toISOString(),
        };

      expect(retrievedTokenStateEntries).toHaveLength(2);
      expect(retrievedTokenStateEntries).toEqual([
        expectedTokenStateEntry1,
        expectedTokenStateEntry2,
      ]);
    });
    it("agreement is not the latest (no operation on token states)", async () => {
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
        ...getMockAgreementEntry(previousAgreementEntryPrimaryKey),
        state: itemState.inactive,
        GSIPK_consumerId_eserviceId,
        GSISK_agreementTimestamp:
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          previousAgreement.stamps.activation!.when.toISOString(),
      };
      const latestAgreementStateEntry: PlatformStatesAgreementEntry = {
        ...getMockAgreementEntry(latestAgreementEntryPrimaryKey),
        state: itemState.inactive,
        GSIPK_consumerId_eserviceId,
        GSISK_agreementTimestamp:
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          latestAgreement.stamps.activation!.when.toISOString(),
      };
      await writeAgreementEntry(previousAgreementStateEntry, dynamoDBClient);
      await writeAgreementEntry(latestAgreementStateEntry, dynamoDBClient);

      // token-generation-states
      const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const previousTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK1),
          agreementId: previousAgreement.id,
          agreementState: itemState.active,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenStateEntry(previousTokenStateEntry1, dynamoDBClient);

      const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const previousTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK2),
          agreementId: previousAgreement.id,
          agreementState: itemState.active,
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenStateEntry(previousTokenStateEntry2, dynamoDBClient);

      await sleep(1000, mockDate);
      await handleMessageV2(message, dynamoDBClient);

      const retrievedEntry = await readAgreementEntry(
        previousAgreementEntryPrimaryKey,
        dynamoDBClient
      );
      expect(retrievedEntry).toBeUndefined();

      // token-generation-states
      const retrievedTokenStateEntries =
        await readTokenStateEntriesByConsumerIdEserviceId(
          GSIPK_consumerId_eserviceId,
          dynamoDBClient
        );

      expect(retrievedTokenStateEntries).toHaveLength(2);
      expect(retrievedTokenStateEntries).toEqual(
        expect.arrayContaining([
          previousTokenStateEntry2,
          previousTokenStateEntry1,
        ])
      );
    });
  });
});

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
  PlatformStatesCatalogEntry,
  TokenGenerationStatesConsumerClient,
  descriptorState,
  generateId,
  itemState,
  makeGSIPKEServiceIdDescriptorId,
  makePlatformStatesEServiceDescriptorPK,
  makeTokenGenerationStatesClientKidPurposePK,
} from "pagopa-interop-models";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import {
  getMockTokenGenStatesConsumerClient,
  buildDynamoDBTables,
  deleteDynamoDBTables,
  readAllTokenGenStatesItems,
  writeTokenGenStatesConsumerClient,
  writePlatformCatalogEntry,
} from "pagopa-interop-commons-test";
import { genericLogger } from "pagopa-interop-commons";
import {
  deleteCatalogEntry,
  descriptorStateToItemState,
  readCatalogEntry,
  updateDescriptorStateInPlatformStatesEntry,
  updateDescriptorStateInTokenGenerationStatesTable,
  upsertPlatformStatesCatalogEntry,
} from "../src/utils.js";
import { dynamoDBClient } from "./utils.js";

describe("utils tests", async () => {
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

  describe("updateDescriptorStateInPlatformStatesEntry", async () => {
    it("should throw error if previous entry doesn't exist", async () => {
      const primaryKey = makePlatformStatesEServiceDescriptorPK({
        eserviceId: generateId(),
        descriptorId: generateId(),
      });
      expect(
        updateDescriptorStateInPlatformStatesEntry(
          dynamoDBClient,
          primaryKey,
          itemState.active,
          1,
          genericLogger
        )
      ).rejects.toThrowError(ConditionalCheckFailedException);
      const catalogEntry = await readCatalogEntry(primaryKey, dynamoDBClient);
      expect(catalogEntry).toBeUndefined();
    });

    it("should update state if previous entry exists", async () => {
      const primaryKey = makePlatformStatesEServiceDescriptorPK({
        eserviceId: generateId(),
        descriptorId: generateId(),
      });
      const previousCatalogStateEntry: PlatformStatesCatalogEntry = {
        PK: primaryKey,
        state: itemState.inactive,
        descriptorAudience: ["pagopa.it/test1", "pagopa.it/test2"],
        descriptorVoucherLifespan: 60,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      expect(
        await readCatalogEntry(primaryKey, dynamoDBClient)
      ).toBeUndefined();
      await writePlatformCatalogEntry(
        previousCatalogStateEntry,
        dynamoDBClient
      );
      await updateDescriptorStateInPlatformStatesEntry(
        dynamoDBClient,
        primaryKey,
        itemState.active,
        2,
        genericLogger
      );

      const result = await readCatalogEntry(primaryKey, dynamoDBClient);
      const expectedCatalogEntry: PlatformStatesCatalogEntry = {
        ...previousCatalogStateEntry,
        state: itemState.active,
        version: 2,
        updatedAt: new Date().toISOString(),
      };

      expect(result).toEqual(expectedCatalogEntry);
    });
  });

  describe("upsertPlatformStatesCatalogEntry", async () => {
    it("should update the entry if the previous entry exists", async () => {
      const primaryKey = makePlatformStatesEServiceDescriptorPK({
        eserviceId: generateId(),
        descriptorId: generateId(),
      });
      const wrongCatalogEntry: PlatformStatesCatalogEntry = {
        PK: primaryKey,
        state: itemState.inactive,
        descriptorAudience: ["wrong-audience-1", "wrong-audience-2"],
        descriptorVoucherLifespan: 100,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await upsertPlatformStatesCatalogEntry(
        wrongCatalogEntry,
        dynamoDBClient,
        genericLogger
      );

      const correctCatalogEntry: PlatformStatesCatalogEntry = {
        PK: primaryKey,
        state: itemState.active,
        descriptorAudience: ["pagopa.it/test1", "pagopa.it/test2"],
        descriptorVoucherLifespan: 200,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await upsertPlatformStatesCatalogEntry(
        correctCatalogEntry,
        dynamoDBClient,
        genericLogger
      );

      const retrievedCatalogEntry = await readCatalogEntry(
        primaryKey,
        dynamoDBClient
      );
      expect(retrievedCatalogEntry).toEqual(correctCatalogEntry);
    });

    it("should write if previous entry doesn't exist", async () => {
      const primaryKey = makePlatformStatesEServiceDescriptorPK({
        eserviceId: generateId(),
        descriptorId: generateId(),
      });
      const catalogStateEntry: PlatformStatesCatalogEntry = {
        PK: primaryKey,
        state: itemState.inactive,
        descriptorVoucherLifespan: 100,
        descriptorAudience: ["pagopa.it/test1", "pagopa.it/test2"],
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      expect(
        await readCatalogEntry(primaryKey, dynamoDBClient)
      ).toBeUndefined();
      await upsertPlatformStatesCatalogEntry(
        catalogStateEntry,
        dynamoDBClient,
        genericLogger
      );
      const retrievedCatalogEntry = await readCatalogEntry(
        primaryKey,
        dynamoDBClient
      );

      expect(retrievedCatalogEntry).toEqual(catalogStateEntry);
    });
  });

  describe("readCatalogEntry", async () => {
    it("should return undefined if entry doesn't exist", async () => {
      const primaryKey = makePlatformStatesEServiceDescriptorPK({
        eserviceId: generateId(),
        descriptorId: generateId(),
      });
      const catalogEntry = await readCatalogEntry(primaryKey, dynamoDBClient);
      expect(catalogEntry).toBeUndefined();
    });

    it("should return entry if it exists", async () => {
      const primaryKey = makePlatformStatesEServiceDescriptorPK({
        eserviceId: generateId(),
        descriptorId: generateId(),
      });
      const previousCatalogStateEntry: PlatformStatesCatalogEntry = {
        PK: primaryKey,
        state: itemState.inactive,
        descriptorAudience: ["pagopa.it/test1", "pagopa.it/test2"],
        descriptorVoucherLifespan: 100,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformCatalogEntry(
        previousCatalogStateEntry,
        dynamoDBClient
      );
      const retrievedCatalogEntry = await readCatalogEntry(
        primaryKey,
        dynamoDBClient
      );

      expect(retrievedCatalogEntry).toEqual(previousCatalogStateEntry);
    });
  });

  describe("deleteCatalogEntry", async () => {
    it("should not throw error if previous entry doesn't exist", async () => {
      const primaryKey = makePlatformStatesEServiceDescriptorPK({
        eserviceId: generateId(),
        descriptorId: generateId(),
      });
      expect(
        deleteCatalogEntry(primaryKey, dynamoDBClient, genericLogger)
      ).resolves.not.toThrowError();
    });

    it("should delete the entry if it exists", async () => {
      const primaryKey = makePlatformStatesEServiceDescriptorPK({
        eserviceId: generateId(),
        descriptorId: generateId(),
      });
      const previousCatalogStateEntry: PlatformStatesCatalogEntry = {
        PK: primaryKey,
        state: itemState.inactive,
        descriptorAudience: ["pagopa.it/test1", "pagopa.it/test2"],
        descriptorVoucherLifespan: 100,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformCatalogEntry(
        previousCatalogStateEntry,
        dynamoDBClient
      );
      await deleteCatalogEntry(primaryKey, dynamoDBClient, genericLogger);
      const retrievedCatalogEntry = await readCatalogEntry(
        primaryKey,
        dynamoDBClient
      );
      expect(retrievedCatalogEntry).toBeUndefined();
    });
  });

  describe("descriptorStateToClientState", async () => {
    it.each([descriptorState.published, descriptorState.deprecated])(
      "should convert %s state to active",
      async (s) => {
        expect(descriptorStateToItemState(s)).toBe(itemState.active);
      }
    );

    it.each([
      descriptorState.archived,
      descriptorState.draft,
      descriptorState.suspended,
    ])("should convert %s state to inactive", async (s) => {
      expect(descriptorStateToItemState(s)).toBe(itemState.inactive);
    });
  });

  // token-generation-states
  describe("writeTokenGenStatesEntry", async () => {
    it("should throw error if previous entry exists", async () => {
      const tokenGenStatesEntryPK = makeTokenGenerationStatesClientKidPurposePK(
        {
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        }
      );
      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: generateId(),
        descriptorId: generateId(),
      });
      const tokenGenStatesConsumerClient: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK),
          descriptorState: itemState.inactive,
          descriptorAudience: ["pagopa.it/test1", "pagopa.it/test2"],
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient,
        dynamoDBClient
      );
      expect(
        writeTokenGenStatesConsumerClient(
          tokenGenStatesConsumerClient,
          dynamoDBClient
        )
      ).rejects.toThrowError(ConditionalCheckFailedException);
    });

    it("should write if previous entry doesn't exist", async () => {
      const tokenGenStatesEntryPK = makeTokenGenerationStatesClientKidPurposePK(
        {
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        }
      );
      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: generateId(),
        descriptorId: generateId(),
      });
      const previousTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      expect(previousTokenGenStatesEntries).toEqual([]);
      const tokenGenStatesConsumerClient: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK),
          descriptorState: itemState.inactive,
          descriptorAudience: ["pagopa.it/test1", "pagopa.it/test2"],
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient,
        dynamoDBClient
      );
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);

      expect(retrievedTokenGenStatesEntries).toEqual([
        tokenGenStatesConsumerClient,
      ]);
    });
  });

  describe("updateDescriptorStateInTokenGenerationStatesTable", async () => {
    it("should do nothing if previous entry doesn't exist", async () => {
      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: generateId(),
        descriptorId: generateId(),
      });
      const tokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      expect(tokenGenStatesEntries).toEqual([]);
      expect(
        updateDescriptorStateInTokenGenerationStatesTable(
          eserviceId_descriptorId,
          itemState.inactive,
          dynamoDBClient,
          genericLogger
        )
      ).resolves.not.toThrowError();
      const tokenGenStatesEntriesAfterUpdate =
        await readAllTokenGenStatesItems(dynamoDBClient);
      expect(tokenGenStatesEntriesAfterUpdate).toEqual([]);
    });

    it("should update state if previous entries exist", async () => {
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: generateId(),
        descriptorId: generateId(),
      });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          descriptorState: itemState.inactive,
          descriptorAudience: ["pagopa.it/test1", "pagopa.it/test2"],
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
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
          descriptorState: itemState.inactive,
          descriptorAudience: ["pagopa.it/test1", "pagopa.it/test2"],
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );
      await updateDescriptorStateInTokenGenerationStatesTable(
        eserviceId_descriptorId,
        itemState.active,
        dynamoDBClient,
        genericLogger
      );
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          descriptorState: itemState.active,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          descriptorState: itemState.active,
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
});

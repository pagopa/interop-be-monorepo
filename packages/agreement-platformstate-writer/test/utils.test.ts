/* eslint-disable @typescript-eslint/no-floating-promises */
import { fail } from "assert";
import {
  ConditionalCheckFailedException,
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import {
  buildDynamoDBTables,
  deleteDynamoDBTables,
  getMockTokenStatesClientPurposeEntry,
} from "pagopa-interop-commons-test";
import {
  makePlatformStatesAgreementPK,
  generateId,
  AgreementId,
  itemState,
  PlatformStatesAgreementEntry,
  makeGSIPKConsumerIdEServiceId,
  DescriptorId,
  makePlatformStatesEServiceDescriptorPK,
  agreementState,
  makeTokenGenerationStatesClientKidPurposePK,
  makeGSIPKEServiceIdDescriptorId,
  TokenGenerationStatesClientPurposeEntry,
  descriptorState,
} from "pagopa-interop-models";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  updateAgreementStateInPlatformStatesEntry,
  readAgreementEntry,
  writeAgreementEntry,
  deleteAgreementEntry,
  agreementStateToItemState,
  readTokenStateEntriesByConsumerIdEserviceId,
  updateAgreementStateInTokenGenerationStatesTable,
} from "../src/utils.js";
import {
  getMockAgreementEntry,
  writeTokenStateEntry,
  readAllTokenStateItems,
  config,
} from "./utils.js";

describe("utils", async () => {
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

  describe("updateAgreementStateInPlatformStatesEntry", async () => {
    it("should throw error if previous entry doesn't exist", async () => {
      const primaryKey = makePlatformStatesAgreementPK(
        generateId<AgreementId>()
      );
      expect(
        updateAgreementStateInPlatformStatesEntry(
          dynamoDBClient,
          primaryKey,
          itemState.active,
          1
        )
      ).rejects.toThrowError(ConditionalCheckFailedException);
      const agreementEntry = await readAgreementEntry(
        primaryKey,
        dynamoDBClient
      );
      expect(agreementEntry).toBeUndefined();
    });

    it("should update state if previous entry exists", async () => {
      const primaryKey = makePlatformStatesAgreementPK(
        generateId<AgreementId>()
      );
      const previousAgreementStateEntry = getMockAgreementEntry(primaryKey);
      expect(
        await readAgreementEntry(primaryKey, dynamoDBClient)
      ).toBeUndefined();
      await writeAgreementEntry(previousAgreementStateEntry, dynamoDBClient);
      await updateAgreementStateInPlatformStatesEntry(
        dynamoDBClient,
        primaryKey,
        itemState.active,
        2
      );

      const result = await readAgreementEntry(primaryKey, dynamoDBClient);
      const expectedAgreementEntry: PlatformStatesAgreementEntry = {
        ...previousAgreementStateEntry,
        state: itemState.active,
        version: 2,
        updatedAt: new Date().toISOString(),
      };

      expect(result).toEqual(expectedAgreementEntry);
    });
  });

  describe("writeAgreementEntry", async () => {
    it("should throw error if previous entry exists", async () => {
      const primaryKey = makePlatformStatesAgreementPK(
        generateId<AgreementId>()
      );
      const agreementStateEntry = getMockAgreementEntry(primaryKey);
      await writeAgreementEntry(agreementStateEntry, dynamoDBClient);
      expect(
        writeAgreementEntry(agreementStateEntry, dynamoDBClient)
      ).rejects.toThrowError(ConditionalCheckFailedException);
    });

    it("should write if previous entry doesn't exist", async () => {
      const primaryKey = makePlatformStatesAgreementPK(
        generateId<AgreementId>()
      );
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: generateId(),
        eserviceId: generateId(),
      });
      const agreementStateEntry: PlatformStatesAgreementEntry = {
        PK: primaryKey,
        state: itemState.inactive,
        version: 1,
        updatedAt: new Date().toISOString(),
        GSIPK_consumerId_eserviceId,
        GSISK_agreementTimestamp: new Date().toISOString(),
        agreementDescriptorId: generateId<DescriptorId>(),
      };

      await writeAgreementEntry(agreementStateEntry, dynamoDBClient);

      const retrievedAgreementEntry = await readAgreementEntry(
        primaryKey,
        dynamoDBClient
      );

      expect(retrievedAgreementEntry).toEqual(agreementStateEntry);
    });
  });

  describe("readAgreementEntry", async () => {
    it("should return undefined if entry doesn't exist", async () => {
      const primaryKey = makePlatformStatesEServiceDescriptorPK({
        eserviceId: generateId(),
        descriptorId: generateId(),
      });
      const catalogEntry = await readAgreementEntry(primaryKey, dynamoDBClient);
      expect(catalogEntry).toBeUndefined();
    });

    it("should return entry if it exists", async () => {
      const primaryKey = makePlatformStatesAgreementPK(
        generateId<AgreementId>()
      );
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: generateId(),
        eserviceId: generateId(),
      });
      const agreementStateEntry: PlatformStatesAgreementEntry = {
        PK: primaryKey,
        state: itemState.inactive,
        version: 1,
        updatedAt: new Date().toISOString(),
        GSIPK_consumerId_eserviceId,
        GSISK_agreementTimestamp: new Date().toISOString(),
        agreementDescriptorId: generateId<DescriptorId>(),
      };
      await writeAgreementEntry(agreementStateEntry, dynamoDBClient);
      const retrievedEntry = await readAgreementEntry(
        primaryKey,
        dynamoDBClient
      );

      expect(retrievedEntry).toEqual(agreementStateEntry);
    });
  });

  describe("deleteAgreementEntry", async () => {
    it("should not throw error if previous entry doesn't exist", async () => {
      const primaryKey = makePlatformStatesAgreementPK(
        generateId<AgreementId>()
      );
      expect(
        deleteAgreementEntry(primaryKey, dynamoDBClient)
      ).resolves.not.toThrowError();
    });

    it("should delete the entry if it exists", async () => {
      const primaryKey = makePlatformStatesAgreementPK(
        generateId<AgreementId>()
      );
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: generateId(),
        eserviceId: generateId(),
      });
      const agreementStateEntry: PlatformStatesAgreementEntry = {
        PK: primaryKey,
        state: itemState.inactive,
        version: 1,
        updatedAt: new Date().toISOString(),
        GSIPK_consumerId_eserviceId,
        GSISK_agreementTimestamp: new Date().toISOString(),
        agreementDescriptorId: generateId<DescriptorId>(),
      };
      await writeAgreementEntry(agreementStateEntry, dynamoDBClient);
      await deleteAgreementEntry(primaryKey, dynamoDBClient);
      const retrievedAgreementEntry = await readAgreementEntry(
        primaryKey,
        dynamoDBClient
      );
      expect(retrievedAgreementEntry).toBeUndefined();
    });
  });

  describe("agreementStateToItemState", async () => {
    it.each([agreementState.active])(
      "should convert %s state to active",
      async (s) => {
        expect(agreementStateToItemState(s)).toBe(itemState.active);
      }
    );

    it.each([agreementState.archived, agreementState.suspended])(
      "should convert %s state to inactive",
      async (s) => {
        expect(agreementStateToItemState(s)).toBe(itemState.inactive);
      }
    );
  });

  // token-generation-states
  describe("writeTokenStateEntry", async () => {
    // TODO already tested in catalog-platformstate-writer?
    it("should throw error if previous entry exists", async () => {
      const tokenStateEntryPK = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: generateId(),
        descriptorId: generateId(),
      });
      const tokenStateEntry: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK),
        descriptorState: itemState.inactive,
        descriptorAudience: "pagopa.it",
        GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
      };
      await writeTokenStateEntry(tokenStateEntry, dynamoDBClient);
      expect(
        writeTokenStateEntry(tokenStateEntry, dynamoDBClient)
      ).rejects.toThrowError(ConditionalCheckFailedException);
    });

    it("should write if previous entry doesn't exist", async () => {
      const tokenStateEntryPK = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: generateId(),
        eserviceId: generateId(),
      });
      const previousTokenStateEntries =
        await readTokenStateEntriesByConsumerIdEserviceId(
          GSIPK_consumerId_eserviceId,
          dynamoDBClient
        );
      expect(previousTokenStateEntries).toEqual([]);
      const tokenStateEntry: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK),
        agreementState: itemState.inactive,
        GSIPK_consumerId_eserviceId,
      };
      await writeTokenStateEntry(tokenStateEntry, dynamoDBClient);
      const retrievedTokenStateEntries =
        await readTokenStateEntriesByConsumerIdEserviceId(
          GSIPK_consumerId_eserviceId,
          dynamoDBClient
        );

      expect(retrievedTokenStateEntries).toEqual([tokenStateEntry]);
    });
  });

  describe("readTokenStateEntriesByConsumerIdEserviceId", async () => {
    it("should return empty array if entries do not exist", async () => {
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: generateId(),
        eserviceId: generateId(),
      });
      const result = await readTokenStateEntriesByConsumerIdEserviceId(
        GSIPK_consumerId_eserviceId,
        dynamoDBClient
      );
      expect(result).toEqual([]);
    });

    it("should return entries if they exist (no need for pagination)", async () => {
      const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: generateId(),
        eserviceId: generateId(),
      });
      const tokenStateEntry1: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK1),
        descriptorState: itemState.inactive,
        descriptorAudience: "pagopa.it",
        GSIPK_consumerId_eserviceId,
      };
      await writeTokenStateEntry(tokenStateEntry1, dynamoDBClient);

      const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const tokenStateEntry2: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK2),
        descriptorState: itemState.inactive,
        descriptorAudience: "pagopa.it",
        GSIPK_consumerId_eserviceId,
      };
      await writeTokenStateEntry(tokenStateEntry2, dynamoDBClient);

      const retrievedTokenEntries =
        await readTokenStateEntriesByConsumerIdEserviceId(
          GSIPK_consumerId_eserviceId,
          dynamoDBClient
        );

      expect(retrievedTokenEntries).toEqual(
        expect.arrayContaining([tokenStateEntry1, tokenStateEntry2])
      );
    });

    it("should return entries if they exist (with pagination)", async () => {
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: generateId(),
        eserviceId: generateId(),
      });

      const tokenEntriesLength = 2000;

      const writtenEntries = [];
      // eslint-disable-next-line functional/no-let
      for (let i = 0; i < tokenEntriesLength; i++) {
        const tokenStateEntryPK = makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
        const tokenStateEntry: TokenGenerationStatesClientPurposeEntry = {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK),
          descriptorState: itemState.inactive,
          descriptorAudience: "pagopa.it",
          GSIPK_consumerId_eserviceId,
        };
        await writeTokenStateEntry(tokenStateEntry, dynamoDBClient);
        // eslint-disable-next-line functional/immutable-data
        writtenEntries.push(tokenStateEntry);
      }
      vi.spyOn(dynamoDBClient, "send");
      const tokenEntries = await readTokenStateEntriesByConsumerIdEserviceId(
        GSIPK_consumerId_eserviceId,
        dynamoDBClient
      );

      expect(dynamoDBClient.send).toHaveBeenCalledTimes(2);
      expect(tokenEntries).toHaveLength(tokenEntriesLength);
      expect(tokenEntries).toEqual(expect.arrayContaining(writtenEntries));
    });
  });

  describe("updateAgreementStateInTokenGenerationStatesTable", async () => {
    it("should do nothing if previous entry doesn't exist", async () => {
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: generateId(),
        eserviceId: generateId(),
      });
      const tokenStateEntries = await readAllTokenStateItems(dynamoDBClient);
      expect(tokenStateEntries).toEqual([]);
      expect(
        updateAgreementStateInTokenGenerationStatesTable(
          GSIPK_consumerId_eserviceId,
          descriptorState.archived,
          dynamoDBClient
        )
      ).resolves.not.toThrowError();
      const tokenStateEntriesAfterUpdate = await readAllTokenStateItems(
        dynamoDBClient
      );
      expect(tokenStateEntriesAfterUpdate).toEqual([]);
    });

    it("should update state if previous entries exist", async () => {
      const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: generateId(),
        eserviceId: generateId(),
      });
      const previousTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK1),
          agreementState: itemState.inactive,
          descriptorAudience: "pagopa.it",
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
          descriptorAudience: "pagopa.it",
          GSIPK_consumerId_eserviceId,
        };
      await writeTokenStateEntry(previousTokenStateEntry2, dynamoDBClient);
      await updateAgreementStateInTokenGenerationStatesTable(
        GSIPK_consumerId_eserviceId,
        agreementState.active,
        dynamoDBClient
      );
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
  });
});

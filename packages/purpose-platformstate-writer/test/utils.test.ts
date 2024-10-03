/* eslint-disable functional/no-let */
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
  PlatformStatesAgreementEntry,
  PlatformStatesCatalogEntry,
  PlatformStatesPurposeEntry,
  Purpose,
  PurposeId,
  PurposeVersion,
  PurposeVersionId,
  TokenGenerationStatesClientPurposeEntry,
  generateId,
  itemState,
  makeGSIPKConsumerIdEServiceId,
  makeGSIPKEServiceIdDescriptorId,
  makePlatformStatesAgreementPK,
  makePlatformStatesEServiceDescriptorPK,
  makePlatformStatesPurposePK,
  makeTokenGenerationStatesClientKidPurposePK,
  purposeVersionState,
} from "pagopa-interop-models";
import {
  ConditionalCheckFailedException,
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import {
  buildDynamoDBTables,
  deleteDynamoDBTables,
  getMockPurposeVersion,
  writeTokenStateEntry,
  getMockTokenStatesClientPurposeEntry,
  readAllTokenStateItems,
  getMockPurpose,
  getMockDescriptor,
  getMockAgreement,
} from "pagopa-interop-commons-test";
import {
  deletePlatformPurposeEntry,
  getPurposeStateFromPurposeVersions,
  readAllTokenEntriesByGSIPKPurposeId,
  readPlatformAgreementEntryByGSIPKConsumerIdEServiceId,
  readPlatformPurposeEntry,
  readTokenEntriesByGSIPKPurposeId,
  updatePurposeDataInPlatformStatesEntry,
  updatePurposeDataInTokenGenerationStatesTable,
  updatePurposeEntriesInTokenGenerationStatesTable,
  writePlatformPurposeEntry,
} from "../src/utils.js";
import { config, writeAgreementEntry, writeCatalogEntry } from "./utils.js";

describe("utils tests", async () => {
  if (!config) {
    fail();
  }
  const dynamoDBClient = new DynamoDBClient({
    endpoint: `http://localhost:${config.tokenGenerationReadModelDbPort}`,
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

  describe("getPurposeStateFromPurposeVersions", () => {
    it("should return active if at least one version is active", async () => {
      const purposeVersions: PurposeVersion[] = [
        getMockPurposeVersion(purposeVersionState.archived),
        getMockPurposeVersion(purposeVersionState.active),
      ];
      expect(getPurposeStateFromPurposeVersions(purposeVersions)).toBe(
        itemState.active
      );
    });

    it("should return inactive if all versions aren't active", async () => {
      const purposeVersions: PurposeVersion[] = [
        getMockPurposeVersion(purposeVersionState.archived),
        getMockPurposeVersion(purposeVersionState.suspended),
        getMockPurposeVersion(purposeVersionState.waitingForApproval),
      ];
      expect(getPurposeStateFromPurposeVersions(purposeVersions)).toBe(
        itemState.inactive
      );
    });
  });

  describe("readPlatformPurposeEntry", async () => {
    it("should return undefined if entry doesn't exist", async () => {
      const primaryKey = makePlatformStatesPurposePK(generateId());
      const platformPurposeEntry = await readPlatformPurposeEntry(
        dynamoDBClient,
        primaryKey
      );
      expect(platformPurposeEntry).toBeUndefined();
    });

    it("should return entry if it exists", async () => {
      const primaryKey = makePlatformStatesPurposePK(generateId());
      const previousPlatformPurposeEntry: PlatformStatesPurposeEntry = {
        PK: primaryKey,
        state: itemState.inactive,
        purposeVersionId: generateId(),
        purposeEserviceId: generateId(),
        purposeConsumerId: generateId(),
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformPurposeEntry(
        dynamoDBClient,
        previousPlatformPurposeEntry
      );
      const retrievedPlatformPurposeEntry = await readPlatformPurposeEntry(
        dynamoDBClient,
        primaryKey
      );

      expect(retrievedPlatformPurposeEntry).toEqual(
        previousPlatformPurposeEntry
      );
    });
  });

  describe("writePlatformPurposeEntry", async () => {
    it("should throw error if previous entry exists", async () => {
      const primaryKey = makePlatformStatesPurposePK(generateId());
      const platformPurposeEntry: PlatformStatesPurposeEntry = {
        PK: primaryKey,
        state: itemState.inactive,
        purposeVersionId: generateId(),
        purposeEserviceId: generateId(),
        purposeConsumerId: generateId(),
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformPurposeEntry(dynamoDBClient, platformPurposeEntry);
      expect(
        writePlatformPurposeEntry(dynamoDBClient, platformPurposeEntry)
      ).rejects.toThrowError(ConditionalCheckFailedException);
    });

    it("should write if previous entry doesn't exist", async () => {
      const primaryKey = makePlatformStatesPurposePK(generateId());
      const platformPurposeEntry: PlatformStatesPurposeEntry = {
        PK: primaryKey,
        state: itemState.inactive,
        purposeVersionId: generateId(),
        purposeEserviceId: generateId(),
        purposeConsumerId: generateId(),
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      expect(
        await readPlatformPurposeEntry(dynamoDBClient, primaryKey)
      ).toBeUndefined();
      await writePlatformPurposeEntry(dynamoDBClient, platformPurposeEntry);
      const retrievedPlatformPurposeEntry = await readPlatformPurposeEntry(
        dynamoDBClient,
        primaryKey
      );

      expect(retrievedPlatformPurposeEntry).toEqual(platformPurposeEntry);
    });
  });

  describe("deletePlatformPurposeEntry", async () => {
    it("should do no operation if previous entry doesn't exist", async () => {
      const primaryKey = makePlatformStatesPurposePK(generateId());
      expect(
        deletePlatformPurposeEntry(dynamoDBClient, primaryKey)
      ).resolves.not.toThrowError();
    });

    it("should delete the entry if it exists", async () => {
      const primaryKey = makePlatformStatesPurposePK(generateId());
      const previousPlatformPurposeEntry: PlatformStatesPurposeEntry = {
        PK: primaryKey,
        state: itemState.inactive,
        purposeVersionId: generateId(),
        purposeEserviceId: generateId(),
        purposeConsumerId: generateId(),
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformPurposeEntry(
        dynamoDBClient,
        previousPlatformPurposeEntry
      );
      await deletePlatformPurposeEntry(dynamoDBClient, primaryKey);
      const retrievedPlatformPurposeEntry = await readPlatformPurposeEntry(
        dynamoDBClient,
        primaryKey
      );

      expect(retrievedPlatformPurposeEntry).toBeUndefined();
    });
  });

  describe("readTokenEntriesByGSIPKPurposeId", async () => {
    it("should return empty array if entries do not exist", async () => {
      const purposeId: PurposeId = generateId();
      const result = await readTokenEntriesByGSIPKPurposeId(
        dynamoDBClient,
        purposeId
      );
      expect(result).toEqual({
        tokenStateEntries: [],
        lastEvaluatedKey: undefined,
      });
    });

    it("should return entries if they exist (no need for pagination)", async () => {
      const purposeId = generateId<PurposeId>();
      const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId,
      });
      const tokenStateEntry1: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK1),
        GSIPK_purposeId: purposeId,
        purposeState: itemState.inactive,
        purposeVersionId: generateId<PurposeVersionId>(),
      };
      await writeTokenStateEntry(tokenStateEntry1, dynamoDBClient);

      const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId,
      });
      const tokenStateEntry2: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK2),
        GSIPK_purposeId: purposeId,
        purposeState: itemState.inactive,
        purposeVersionId: generateId<PurposeVersionId>(),
      };
      await writeTokenStateEntry(tokenStateEntry2, dynamoDBClient);

      const result = await readTokenEntriesByGSIPKPurposeId(
        dynamoDBClient,
        purposeId
      );

      expect(result.tokenStateEntries).toEqual(
        expect.arrayContaining([tokenStateEntry1, tokenStateEntry2])
      );
      expect(result.lastEvaluatedKey).toBeUndefined();
    });

    it("should return the first page of entries if they exist (with pagination)", async () => {
      const purposeId = generateId<PurposeId>();
      const tokenEntriesLength = 2000;

      for (let i = 0; i < tokenEntriesLength; i++) {
        const tokenStateEntryPK = makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId,
        });
        const tokenStateEntry: TokenGenerationStatesClientPurposeEntry = {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK),
          GSIPK_purposeId: purposeId,
          purposeState: itemState.inactive,
          purposeVersionId: generateId<PurposeVersionId>(),
        };
        await writeTokenStateEntry(tokenStateEntry, dynamoDBClient);
      }
      vi.spyOn(dynamoDBClient, "send");
      const result = await readTokenEntriesByGSIPKPurposeId(
        dynamoDBClient,
        purposeId
      );

      expect(dynamoDBClient.send).toHaveBeenCalledTimes(1);
      expect(result.tokenStateEntries.length).toBeLessThan(tokenEntriesLength);
      expect(result.lastEvaluatedKey).toBeDefined();
    });
  });

  describe("readAllTokenEntriesByGSIPKPurposeId", async () => {
    it("should return empty array if entries do not exist", async () => {
      const purposeId: PurposeId = generateId();
      const tokenEntries = await readAllTokenEntriesByGSIPKPurposeId(
        dynamoDBClient,
        purposeId
      );
      expect(tokenEntries).toEqual([]);
    });

    it("should return entries if they exist (no need for pagination)", async () => {
      const purposeId = generateId<PurposeId>();
      const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId,
      });
      const tokenStateEntry1: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK1),
        GSIPK_purposeId: purposeId,
        purposeState: itemState.inactive,
        purposeVersionId: generateId<PurposeVersionId>(),
      };
      await writeTokenStateEntry(tokenStateEntry1, dynamoDBClient);

      const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId,
      });
      const tokenStateEntry2: TokenGenerationStatesClientPurposeEntry = {
        ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK2),
        GSIPK_purposeId: purposeId,
        purposeState: itemState.inactive,
        purposeVersionId: generateId<PurposeVersionId>(),
      };
      await writeTokenStateEntry(tokenStateEntry2, dynamoDBClient);

      const tokenEntries = await readAllTokenEntriesByGSIPKPurposeId(
        dynamoDBClient,
        purposeId
      );

      expect(tokenEntries).toEqual(
        expect.arrayContaining([tokenStateEntry1, tokenStateEntry2])
      );
    });

    it("should return all entries if they exist (with pagination)", async () => {
      const purposeId = generateId<PurposeId>();
      const tokenEntriesLength = 2000;

      const writtenEntries: TokenGenerationStatesClientPurposeEntry[] = [];
      for (let i = 0; i < tokenEntriesLength; i++) {
        const tokenStateEntryPK = makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId,
        });
        const tokenStateEntry: TokenGenerationStatesClientPurposeEntry = {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK),
          GSIPK_purposeId: purposeId,
          purposeState: itemState.inactive,
          purposeVersionId: generateId<PurposeVersionId>(),
        };
        await writeTokenStateEntry(tokenStateEntry, dynamoDBClient);
        // eslint-disable-next-line functional/immutable-data
        writtenEntries.push(tokenStateEntry);
      }
      vi.spyOn(dynamoDBClient, "send");
      const tokenEntries = await readAllTokenEntriesByGSIPKPurposeId(
        dynamoDBClient,
        purposeId
      );

      expect(dynamoDBClient.send).toHaveBeenCalledTimes(2);
      expect(tokenEntries).toHaveLength(tokenEntriesLength);
      expect(tokenEntries).toEqual(expect.arrayContaining(writtenEntries));
    });
  });

  describe("readPlatformAgreementEntryByGSIPKConsumerIdEServiceId", async () => {
    it("should return undefined if entry doesn't exist", async () => {
      const gsiPKConsumerIdEServiceId = makeGSIPKConsumerIdEServiceId({
        consumerId: generateId(),
        eserviceId: generateId(),
      });
      const platformAgreementEntry =
        await readPlatformAgreementEntryByGSIPKConsumerIdEServiceId(
          dynamoDBClient,
          gsiPKConsumerIdEServiceId
        );
      expect(platformAgreementEntry).toBeUndefined();
    });

    it("should return entry if it exists", async () => {
      const gsiPKConsumerIdEServiceId = makeGSIPKConsumerIdEServiceId({
        consumerId: generateId(),
        eserviceId: generateId(),
      });
      const previousPlatformAgreementEntry: PlatformStatesAgreementEntry = {
        PK: makePlatformStatesAgreementPK(generateId()),
        state: itemState.inactive,
        GSIPK_consumerId_eserviceId: gsiPKConsumerIdEServiceId,
        GSISK_agreementTimestamp: new Date().toISOString(),
        agreementDescriptorId: generateId(),
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writeAgreementEntry(previousPlatformAgreementEntry, dynamoDBClient);
      const retrievedPlatformAgreementEntry =
        await readPlatformAgreementEntryByGSIPKConsumerIdEServiceId(
          dynamoDBClient,
          gsiPKConsumerIdEServiceId
        );

      expect(retrievedPlatformAgreementEntry).toEqual(
        previousPlatformAgreementEntry
      );
    });
  });

  describe("updatePurposeDataInPlatformStatesEntry", async () => {
    it("should throw error if previous entry doesn't exist", async () => {
      const purposeId = generateId<PurposeId>();
      const primaryKey = makePlatformStatesPurposePK(purposeId);
      expect(
        updatePurposeDataInPlatformStatesEntry({
          dynamoDBClient,
          primaryKey,
          purposeState: itemState.active,
          version: 2,
          purposeVersionId: generateId<PurposeVersionId>(),
        })
      ).rejects.toThrowError(ConditionalCheckFailedException);
      const platformPurposeEntry = await readPlatformPurposeEntry(
        dynamoDBClient,
        primaryKey
      );
      expect(platformPurposeEntry).toBeUndefined();
    });

    it("should update state if previous entries exist", async () => {
      const purposeId = generateId<PurposeId>();
      const primaryKey = makePlatformStatesPurposePK(purposeId);
      const previousPlatformPurposeEntry: PlatformStatesPurposeEntry = {
        PK: primaryKey,
        state: itemState.inactive,
        purposeVersionId: generateId(),
        purposeEserviceId: generateId(),
        purposeConsumerId: generateId(),
        version: 1,
        updatedAt: new Date().toISOString(),
      };

      expect(
        await readPlatformPurposeEntry(dynamoDBClient, primaryKey)
      ).toBeUndefined();
      await writePlatformPurposeEntry(
        dynamoDBClient,
        previousPlatformPurposeEntry
      );
      await updatePurposeDataInPlatformStatesEntry({
        dynamoDBClient,
        primaryKey,
        purposeState: itemState.active,
        version: 2,
      });

      const retrievedPlatformPurposeEntry = await readPlatformPurposeEntry(
        dynamoDBClient,
        primaryKey
      );
      const expectedPlatformPurposeEntry: PlatformStatesPurposeEntry = {
        ...previousPlatformPurposeEntry,
        state: itemState.active,
        version: 2,
        updatedAt: new Date().toISOString(),
      };

      expect(retrievedPlatformPurposeEntry).toEqual(
        expectedPlatformPurposeEntry
      );
    });

    it("should update state and purpose version id if previous entries exist", async () => {
      const purposeId = generateId<PurposeId>();
      const primaryKey = makePlatformStatesPurposePK(purposeId);
      const previousPlatformPurposeEntry: PlatformStatesPurposeEntry = {
        PK: primaryKey,
        state: itemState.inactive,
        purposeVersionId: generateId(),
        purposeEserviceId: generateId(),
        purposeConsumerId: generateId(),
        version: 1,
        updatedAt: new Date().toISOString(),
      };

      expect(
        await readPlatformPurposeEntry(dynamoDBClient, primaryKey)
      ).toBeUndefined();
      await writePlatformPurposeEntry(
        dynamoDBClient,
        previousPlatformPurposeEntry
      );
      const newPurposeVersionId = generateId<PurposeVersionId>();
      await updatePurposeDataInPlatformStatesEntry({
        dynamoDBClient,
        primaryKey,
        purposeState: itemState.active,
        version: 2,
        purposeVersionId: newPurposeVersionId,
      });

      const retrievedPlatformPurposeEntry = await readPlatformPurposeEntry(
        dynamoDBClient,
        primaryKey
      );
      const expectedPlatformPurposeEntry: PlatformStatesPurposeEntry = {
        ...previousPlatformPurposeEntry,
        state: itemState.active,
        purposeVersionId: newPurposeVersionId,
        version: 2,
        updatedAt: new Date().toISOString(),
      };

      expect(retrievedPlatformPurposeEntry).toEqual(
        expectedPlatformPurposeEntry
      );
    });
  });

  describe("updatePurposeDataInTokenGenerationStatesTable", async () => {
    it("should do nothing if previous entries don't exist", async () => {
      const tokenStateEntries = await readAllTokenStateItems(dynamoDBClient);
      expect(tokenStateEntries).toEqual([]);
      const purpose: Purpose = {
        ...getMockPurpose(),
        versions: [getMockPurposeVersion()],
      };

      expect(
        updatePurposeDataInTokenGenerationStatesTable({
          dynamoDBClient,
          purposeId: purpose.id,
          purposeState: itemState.inactive,
          purposeVersionId: purpose.versions[0].id,
        })
      ).resolves.not.toThrowError();
      const tokenStateEntriesAfterUpdate = await readAllTokenStateItems(
        dynamoDBClient
      );
      expect(tokenStateEntriesAfterUpdate).toEqual([]);
    });

    it("should update state if previous entries exist", async () => {
      const purpose: Purpose = {
        ...getMockPurpose(),
        versions: [getMockPurposeVersion()],
      };

      const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: purpose.id,
      });
      const previousTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK1),
          GSIPK_purposeId: purpose.id,
          purposeState: itemState.inactive,
        };
      await writeTokenStateEntry(previousTokenStateEntry1, dynamoDBClient);

      const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: purpose.id,
      });
      const previousTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK2),
          GSIPK_purposeId: purpose.id,
          purposeState: itemState.inactive,
        };
      await writeTokenStateEntry(previousTokenStateEntry2, dynamoDBClient);
      await updatePurposeDataInTokenGenerationStatesTable({
        dynamoDBClient,
        purposeId: purpose.id,
        purposeState: itemState.active,
        // purposeVersionId: purpose.versions[0].id,
      });
      const retrievedTokenStateEntries =
        await readAllTokenEntriesByGSIPKPurposeId(dynamoDBClient, purpose.id);
      const expectedTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
        {
          ...previousTokenStateEntry1,
          purposeState: itemState.active,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
        {
          ...previousTokenStateEntry2,
          purposeState: itemState.active,
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

    it("should update state and purpose version id if previous entries exist", async () => {
      const purpose: Purpose = {
        ...getMockPurpose(),
        versions: [getMockPurposeVersion()],
      };

      const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: purpose.id,
      });
      const previousTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK1),
          GSIPK_purposeId: purpose.id,
          purposeState: itemState.inactive,
          purposeVersionId: purpose.versions[0].id,
        };
      await writeTokenStateEntry(previousTokenStateEntry1, dynamoDBClient);

      const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: purpose.id,
      });
      const previousTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK2),
          GSIPK_purposeId: purpose.id,
          purposeState: itemState.inactive,
          purposeVersionId: purpose.versions[0].id,
        };
      await writeTokenStateEntry(previousTokenStateEntry2, dynamoDBClient);
      const newPurposeVersionId = generateId<PurposeVersionId>();
      await updatePurposeDataInTokenGenerationStatesTable({
        dynamoDBClient,
        purposeId: purpose.id,
        purposeState: itemState.active,
        purposeVersionId: newPurposeVersionId,
      });
      const retrievedTokenStateEntries =
        await readAllTokenEntriesByGSIPKPurposeId(dynamoDBClient, purpose.id);
      const expectedTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
        {
          ...previousTokenStateEntry1,
          purposeState: itemState.active,
          purposeVersionId: newPurposeVersionId,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
        {
          ...previousTokenStateEntry2,
          purposeState: itemState.active,
          purposeVersionId: newPurposeVersionId,
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

  describe("updatePurposeEntriesInTokenGenerationStatesTable", async () => {
    it("should do nothing if previous entries don't exist", async () => {
      const tokenStateEntries = await readAllTokenStateItems(dynamoDBClient);
      expect(tokenStateEntries).toEqual([]);
      const purpose: Purpose = {
        ...getMockPurpose(),
        versions: [getMockPurposeVersion()],
      };

      expect(
        updatePurposeEntriesInTokenGenerationStatesTable(
          dynamoDBClient,
          purpose,
          itemState.inactive,
          purpose.versions[0].id
        )
      ).resolves.not.toThrowError();
      const tokenStateEntriesAfterUpdate = await readAllTokenStateItems(
        dynamoDBClient
      );
      expect(tokenStateEntriesAfterUpdate).toEqual([]);
    });

    it("should update entries with purpose state and version id if corresponding platform states entries don't exist", async () => {
      const purpose: Purpose = {
        ...getMockPurpose(),
        versions: [getMockPurposeVersion()],
      };

      // token-generation-states
      const purposeId = purpose.id;
      const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId,
      });
      const previousTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK1),
          GSIPK_purposeId: purposeId,
          purposeState: itemState.inactive,
          GSIPK_consumerId_eserviceId: undefined,
          agreementId: undefined,
          agreementState: undefined,
          GSIPK_eserviceId_descriptorId: undefined,
          descriptorState: undefined,
          descriptorAudience: undefined,
          descriptorVoucherLifespan: undefined,
        };
      await writeTokenStateEntry(previousTokenStateEntry1, dynamoDBClient);

      const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId,
      });
      const previousTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK2),
          GSIPK_purposeId: purposeId,
          purposeState: itemState.inactive,
          GSIPK_consumerId_eserviceId: undefined,
          agreementId: undefined,
          agreementState: undefined,
          GSIPK_eserviceId_descriptorId: undefined,
          descriptorState: undefined,
          descriptorAudience: undefined,
          descriptorVoucherLifespan: undefined,
          updatedAt: new Date().toISOString(),
        };
      await writeTokenStateEntry(previousTokenStateEntry2, dynamoDBClient);

      const newPurposeVersionId = generateId<PurposeVersionId>();
      await updatePurposeEntriesInTokenGenerationStatesTable(
        dynamoDBClient,
        purpose,
        itemState.active,
        newPurposeVersionId
      );

      const retrievedTokenStateEntries =
        await readAllTokenEntriesByGSIPKPurposeId(dynamoDBClient, purposeId);

      const expectedTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
        {
          ...previousTokenStateEntry1,
          purposeState: itemState.active,
          purposeVersionId: newPurposeVersionId,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
        {
          ...previousTokenStateEntry2,
          purposeState: itemState.active,
          purposeVersionId: newPurposeVersionId,
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

    it("should update entries with purpose state, version id and agreement data if platform agreement entry exists", async () => {
      const purpose: Purpose = {
        ...getMockPurpose(),
        versions: [getMockPurposeVersion()],
      };

      // platform-states
      const mockDescriptor = getMockDescriptor();
      const mockAgreement = {
        ...getMockAgreement(purpose.eserviceId, purpose.consumerId),
        descriptorId: mockDescriptor.id,
      };
      const catalogAgreementEntryPK = makePlatformStatesAgreementPK(
        mockAgreement.id
      );
      const gsiPKConsumerIdEServiceId = makeGSIPKConsumerIdEServiceId({
        consumerId: mockAgreement.consumerId,
        eserviceId: mockAgreement.eserviceId,
      });
      const previousAgreementEntry: PlatformStatesAgreementEntry = {
        PK: catalogAgreementEntryPK,
        state: itemState.active,
        GSIPK_consumerId_eserviceId: gsiPKConsumerIdEServiceId,
        GSISK_agreementTimestamp: new Date().toISOString(),
        agreementDescriptorId: mockAgreement.descriptorId,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      await writeAgreementEntry(previousAgreementEntry, dynamoDBClient);

      // token-generation-states
      const purposeId = purpose.id;
      const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId,
      });
      const previousTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK1),
          GSIPK_purposeId: purposeId,
          purposeState: itemState.inactive,
          GSIPK_consumerId_eserviceId: undefined,
          agreementId: undefined,
          agreementState: undefined,
        };
      await writeTokenStateEntry(previousTokenStateEntry1, dynamoDBClient);

      const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId,
      });
      const previousTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK2),
          GSIPK_purposeId: purposeId,
          purposeState: itemState.inactive,
          GSIPK_consumerId_eserviceId: undefined,
          agreementId: undefined,
          agreementState: undefined,
        };
      await writeTokenStateEntry(previousTokenStateEntry2, dynamoDBClient);

      const newPurposeVersionId = generateId<PurposeVersionId>();
      await updatePurposeEntriesInTokenGenerationStatesTable(
        dynamoDBClient,
        purpose,
        itemState.active,
        newPurposeVersionId
      );

      const retrievedTokenStateEntries =
        await readAllTokenEntriesByGSIPKPurposeId(dynamoDBClient, purposeId);
      const expectedTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
        {
          ...previousTokenStateEntry1,
          purposeState: itemState.active,
          purposeVersionId: newPurposeVersionId,
          GSIPK_consumerId_eserviceId: gsiPKConsumerIdEServiceId,
          agreementId: mockAgreement.id,
          agreementState: previousAgreementEntry.state,
        };
      const expectedTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
        {
          ...previousTokenStateEntry2,
          purposeState: itemState.active,
          purposeVersionId: newPurposeVersionId,
          GSIPK_consumerId_eserviceId: gsiPKConsumerIdEServiceId,
          agreementId: mockAgreement.id,
          agreementState: previousAgreementEntry.state,
        };
      expect(retrievedTokenStateEntries).toHaveLength(2);
      expect(retrievedTokenStateEntries).toEqual(
        expect.arrayContaining([
          expectedTokenStateEntry1,
          expectedTokenStateEntry2,
        ])
      );
    });

    it("should update entries with purpose state, version id and descriptor data if platform agreement and descriptor entry exist", async () => {
      const purpose: Purpose = {
        ...getMockPurpose(),
        versions: [getMockPurposeVersion()],
      };

      // platform-states
      const mockDescriptor = getMockDescriptor();
      const mockAgreement = {
        ...getMockAgreement(purpose.eserviceId, purpose.consumerId),
        descriptorId: mockDescriptor.id,
      };
      const catalogAgreementEntryPK = makePlatformStatesAgreementPK(
        mockAgreement.id
      );
      const gsiPKConsumerIdEServiceId = makeGSIPKConsumerIdEServiceId({
        consumerId: mockAgreement.consumerId,
        eserviceId: mockAgreement.eserviceId,
      });
      const previousAgreementEntry: PlatformStatesAgreementEntry = {
        PK: catalogAgreementEntryPK,
        state: itemState.active,
        GSIPK_consumerId_eserviceId: gsiPKConsumerIdEServiceId,
        GSISK_agreementTimestamp: new Date().toISOString(),
        agreementDescriptorId: mockAgreement.descriptorId,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      await writeAgreementEntry(previousAgreementEntry, dynamoDBClient);

      const catalogEntryPK = makePlatformStatesEServiceDescriptorPK({
        eserviceId: purpose.eserviceId,
        descriptorId: mockDescriptor.id,
      });
      const previousDescriptorEntry: PlatformStatesCatalogEntry = {
        PK: catalogEntryPK,
        state: itemState.active,
        descriptorAudience: ["pagopa.it"],
        descriptorVoucherLifespan: mockDescriptor.voucherLifespan,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      await writeCatalogEntry(dynamoDBClient, previousDescriptorEntry);

      // token-generation-states
      const purposeId = purpose.id;
      const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId,
      });
      const previousTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK1),
          GSIPK_purposeId: purposeId,
          purposeState: itemState.inactive,
          GSIPK_eserviceId_descriptorId: undefined,
          descriptorState: undefined,
          descriptorAudience: undefined,
          descriptorVoucherLifespan: undefined,
        };
      await writeTokenStateEntry(previousTokenStateEntry1, dynamoDBClient);

      const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId,
      });
      const previousTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK2),
          GSIPK_purposeId: purposeId,
          purposeState: itemState.inactive,
          GSIPK_eserviceId_descriptorId: undefined,
          descriptorState: undefined,
          descriptorAudience: undefined,
          descriptorVoucherLifespan: undefined,
          updatedAt: new Date().toISOString(),
        };
      await writeTokenStateEntry(previousTokenStateEntry2, dynamoDBClient);

      const newPurposeVersionId = generateId<PurposeVersionId>();
      await updatePurposeEntriesInTokenGenerationStatesTable(
        dynamoDBClient,
        purpose,
        itemState.active,
        newPurposeVersionId
      );

      const retrievedTokenStateEntries =
        await readAllTokenEntriesByGSIPKPurposeId(dynamoDBClient, purposeId);

      const gsiPKEserviceIdDescriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: purpose.eserviceId,
        descriptorId: mockDescriptor.id,
      });
      const expectedTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
        {
          ...previousTokenStateEntry1,
          purposeState: itemState.active,
          purposeVersionId: newPurposeVersionId,
          GSIPK_eserviceId_descriptorId: gsiPKEserviceIdDescriptorId,
          descriptorState: previousDescriptorEntry.state,
          descriptorAudience: previousDescriptorEntry.descriptorAudience,
          descriptorVoucherLifespan:
            previousDescriptorEntry.descriptorVoucherLifespan,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
        {
          ...previousTokenStateEntry2,
          purposeState: itemState.active,
          purposeVersionId: newPurposeVersionId,
          GSIPK_eserviceId_descriptorId: gsiPKEserviceIdDescriptorId,
          descriptorState: previousDescriptorEntry.state,
          descriptorAudience: previousDescriptorEntry.descriptorAudience,
          descriptorVoucherLifespan:
            previousDescriptorEntry.descriptorVoucherLifespan,
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

    it("should update entries with purpose state, version id, agreement and descriptor data if platform agreement and descriptor entry exist", async () => {
      const purpose: Purpose = {
        ...getMockPurpose(),
        versions: [getMockPurposeVersion()],
      };

      // platform-states
      const mockDescriptor = getMockDescriptor();
      const mockAgreement = {
        ...getMockAgreement(purpose.eserviceId, purpose.consumerId),
        descriptorId: mockDescriptor.id,
      };
      const catalogAgreementEntryPK = makePlatformStatesAgreementPK(
        mockAgreement.id
      );
      const gsiPKConsumerIdEServiceId = makeGSIPKConsumerIdEServiceId({
        consumerId: mockAgreement.consumerId,
        eserviceId: mockAgreement.eserviceId,
      });
      const previousAgreementEntry: PlatformStatesAgreementEntry = {
        PK: catalogAgreementEntryPK,
        state: itemState.active,
        GSIPK_consumerId_eserviceId: gsiPKConsumerIdEServiceId,
        GSISK_agreementTimestamp: new Date().toISOString(),
        agreementDescriptorId: mockAgreement.descriptorId,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      await writeAgreementEntry(previousAgreementEntry, dynamoDBClient);

      const catalogEntryPK = makePlatformStatesEServiceDescriptorPK({
        eserviceId: purpose.eserviceId,
        descriptorId: mockDescriptor.id,
      });
      const previousDescriptorEntry: PlatformStatesCatalogEntry = {
        PK: catalogEntryPK,
        state: itemState.active,
        descriptorAudience: ["pagopa.it"],
        descriptorVoucherLifespan: mockDescriptor.voucherLifespan,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      await writeCatalogEntry(dynamoDBClient, previousDescriptorEntry);

      // token-generation-states
      const purposeId = purpose.id;
      const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId,
      });
      const previousTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK1),
          GSIPK_purposeId: purposeId,
          purposeState: itemState.inactive,
          GSIPK_consumerId_eserviceId: undefined,
          agreementId: undefined,
          agreementState: undefined,
          GSIPK_eserviceId_descriptorId: undefined,
          descriptorState: undefined,
          descriptorAudience: undefined,
          descriptorVoucherLifespan: undefined,
        };
      await writeTokenStateEntry(previousTokenStateEntry1, dynamoDBClient);

      const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId,
      });
      const previousTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
        {
          ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK2),
          GSIPK_purposeId: purposeId,
          purposeState: itemState.inactive,
          GSIPK_consumerId_eserviceId: undefined,
          agreementId: undefined,
          agreementState: undefined,
          GSIPK_eserviceId_descriptorId: undefined,
          descriptorState: undefined,
          descriptorAudience: undefined,
          descriptorVoucherLifespan: undefined,
          updatedAt: new Date().toISOString(),
        };
      await writeTokenStateEntry(previousTokenStateEntry2, dynamoDBClient);

      const newPurposeVersionId = generateId<PurposeVersionId>();
      await updatePurposeEntriesInTokenGenerationStatesTable(
        dynamoDBClient,
        purpose,
        itemState.active,
        newPurposeVersionId
      );

      const retrievedTokenStateEntries =
        await readAllTokenEntriesByGSIPKPurposeId(dynamoDBClient, purposeId);

      const gsiPKEserviceIdDescriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: purpose.eserviceId,
        descriptorId: mockDescriptor.id,
      });
      const expectedTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
        {
          ...previousTokenStateEntry1,
          purposeState: itemState.active,
          purposeVersionId: newPurposeVersionId,
          GSIPK_consumerId_eserviceId: gsiPKConsumerIdEServiceId,
          agreementId: mockAgreement.id,
          agreementState: previousAgreementEntry.state,
          GSIPK_eserviceId_descriptorId: gsiPKEserviceIdDescriptorId,
          descriptorState: previousDescriptorEntry.state,
          descriptorAudience: previousDescriptorEntry.descriptorAudience,
          descriptorVoucherLifespan:
            previousDescriptorEntry.descriptorVoucherLifespan,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
        {
          ...previousTokenStateEntry2,
          purposeState: itemState.active,
          purposeVersionId: newPurposeVersionId,
          GSIPK_consumerId_eserviceId: gsiPKConsumerIdEServiceId,
          agreementId: mockAgreement.id,
          agreementState: previousAgreementEntry.state,
          GSIPK_eserviceId_descriptorId: gsiPKEserviceIdDescriptorId,
          descriptorState: previousDescriptorEntry.state,
          descriptorAudience: previousDescriptorEntry.descriptorAudience,
          descriptorVoucherLifespan:
            previousDescriptorEntry.descriptorVoucherLifespan,
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

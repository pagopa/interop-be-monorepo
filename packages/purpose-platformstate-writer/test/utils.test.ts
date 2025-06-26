/* eslint-disable functional/no-let */
import crypto from "crypto";
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
  TokenGenerationStatesConsumerClient,
  generateId,
  itemState,
  makeGSIPKConsumerIdEServiceId,
  makeGSIPKEServiceIdDescriptorId,
  makePlatformStatesAgreementPK,
  makePlatformStatesEServiceDescriptorPK,
  makePlatformStatesPurposePK,
  makeTokenGenerationStatesClientKidPurposePK,
  purposeVersionState,
  TokenGenStatesConsumerClientGSIPurpose,
  Agreement,
} from "pagopa-interop-models";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import {
  buildDynamoDBTables,
  deleteDynamoDBTables,
  getMockPurposeVersion,
  writeTokenGenStatesConsumerClient,
  getMockTokenGenStatesConsumerClient,
  readAllTokenGenStatesItems,
  getMockPurpose,
  getMockDescriptor,
  getMockAgreement,
  writePlatformAgreementEntry,
  writePlatformCatalogEntry,
  writePlatformPurposeEntry,
} from "pagopa-interop-commons-test";
import { genericLogger } from "pagopa-interop-commons";
import {
  deletePlatformPurposeEntry,
  getPurposeStateFromPurposeVersions,
  readPlatformPurposeEntry,
  readTokenGenStatesEntriesByGSIPKPurposeId,
  updatePurposeDataInPlatformStatesEntry,
  updatePurposeDataInTokenGenStatesEntries,
  updateTokenGenStatesEntriesWithPurposeAndPlatformStatesData,
  upsertPlatformStatesPurposeEntry,
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
        previousPlatformPurposeEntry,
        dynamoDBClient
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

  describe("upsertPlatformStatesPurposeEntry", async () => {
    it("should update the entry if the previous entry exists", async () => {
      const primaryKey = makePlatformStatesPurposePK(generateId());
      const wrongPlatformStatesPurposeEntry: PlatformStatesPurposeEntry = {
        PK: primaryKey,
        state: itemState.inactive,
        purposeVersionId: generateId(),
        purposeEserviceId: generateId(),
        purposeConsumerId: generateId(),
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await upsertPlatformStatesPurposeEntry(
        dynamoDBClient,
        wrongPlatformStatesPurposeEntry,
        genericLogger
      );

      const correctPlatformStatesPurposeEntry: PlatformStatesPurposeEntry = {
        PK: primaryKey,
        state: itemState.active,
        purposeVersionId: generateId(),
        purposeEserviceId: generateId(),
        purposeConsumerId: generateId(),
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await upsertPlatformStatesPurposeEntry(
        dynamoDBClient,
        correctPlatformStatesPurposeEntry,
        genericLogger
      );

      const retrievedPlatformStatesPurposeEntry =
        await readPlatformPurposeEntry(dynamoDBClient, primaryKey);
      expect(retrievedPlatformStatesPurposeEntry).toEqual(
        correctPlatformStatesPurposeEntry
      );
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
      await upsertPlatformStatesPurposeEntry(
        dynamoDBClient,
        platformPurposeEntry,
        genericLogger
      );
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
      await expect(
        deletePlatformPurposeEntry(dynamoDBClient, primaryKey, genericLogger)
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
        previousPlatformPurposeEntry,
        dynamoDBClient
      );
      await deletePlatformPurposeEntry(
        dynamoDBClient,
        primaryKey,
        genericLogger
      );
      const retrievedPlatformPurposeEntry = await readPlatformPurposeEntry(
        dynamoDBClient,
        primaryKey
      );

      expect(retrievedPlatformPurposeEntry).toBeUndefined();
    });
  });

  describe("readTokenGenStatesEntriesByGSIPKPurposeId", async () => {
    it("should return empty array if entries do not exist", async () => {
      const purposeId: PurposeId = generateId();
      const result = await readTokenGenStatesEntriesByGSIPKPurposeId(
        dynamoDBClient,
        purposeId
      );
      expect(result).toEqual({
        tokenGenStatesEntries: [],
        lastEvaluatedKey: undefined,
      });
    });

    it("should return entries if they exist (no need for pagination)", async () => {
      const purposeId = generateId<PurposeId>();
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId,
        });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          GSIPK_purposeId: purposeId,
          purposeState: itemState.inactive,
          purposeVersionId: generateId<PurposeVersionId>(),
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId,
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          GSIPK_purposeId: purposeId,
          purposeState: itemState.inactive,
          purposeVersionId: generateId<PurposeVersionId>(),
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      const result = await readTokenGenStatesEntriesByGSIPKPurposeId(
        dynamoDBClient,
        purposeId
      );

      expect(result.tokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          TokenGenStatesConsumerClientGSIPurpose.parse(
            tokenGenStatesConsumerClient1
          ),
          TokenGenStatesConsumerClientGSIPurpose.parse(
            tokenGenStatesConsumerClient2
          ),
        ])
      );
      expect(result.lastEvaluatedKey).toBeUndefined();
    });

    it("should return the first page of entries if they exist (with pagination)", async () => {
      const purposeId = generateId<PurposeId>();
      const tokenEntriesLength = 10;

      for (let i = 0; i < tokenEntriesLength; i++) {
        const tokenGenStatesEntryPK =
          makeTokenGenerationStatesClientKidPurposePK({
            clientId: generateId(),
            kid: `kid ${Math.random()}`,
            purposeId,
          });
        const tokenGenStatesConsumerClient: TokenGenerationStatesConsumerClient =
          {
            ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK),
            GSIPK_purposeId: purposeId,
            purposeState: itemState.inactive,
            purposeVersionId: generateId<PurposeVersionId>(),
            publicKey: crypto.randomBytes(100000).toString("hex"),
          };
        await writeTokenGenStatesConsumerClient(
          tokenGenStatesConsumerClient,
          dynamoDBClient
        );
      }
      vi.spyOn(dynamoDBClient, "send");
      const result = await readTokenGenStatesEntriesByGSIPKPurposeId(
        dynamoDBClient,
        purposeId
      );

      expect(dynamoDBClient.send).toHaveBeenCalledTimes(1);
      expect(result.tokenGenStatesEntries.length).toBeLessThan(
        tokenEntriesLength
      );
      expect(result.lastEvaluatedKey).toBeDefined();
    });
  });

  describe("updatePurposeDataInPlatformStatesEntry", async () => {
    it("should throw error if previous entry doesn't exist", async () => {
      const purposeId = generateId<PurposeId>();
      const primaryKey = makePlatformStatesPurposePK(purposeId);
      await expect(
        updatePurposeDataInPlatformStatesEntry({
          dynamoDBClient,
          primaryKey,
          purposeState: itemState.active,
          version: 2,
          purposeVersionId: generateId<PurposeVersionId>(),
          logger: genericLogger,
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
      const purposeVersionId = generateId<PurposeVersionId>();
      const previousPlatformPurposeEntry: PlatformStatesPurposeEntry = {
        PK: primaryKey,
        state: itemState.inactive,
        purposeVersionId,
        purposeEserviceId: generateId(),
        purposeConsumerId: generateId(),
        version: 1,
        updatedAt: new Date().toISOString(),
      };

      expect(
        await readPlatformPurposeEntry(dynamoDBClient, primaryKey)
      ).toBeUndefined();
      await writePlatformPurposeEntry(
        previousPlatformPurposeEntry,
        dynamoDBClient
      );
      await updatePurposeDataInPlatformStatesEntry({
        dynamoDBClient,
        primaryKey,
        purposeState: itemState.active,
        purposeVersionId,
        version: 2,
        logger: genericLogger,
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
        previousPlatformPurposeEntry,
        dynamoDBClient
      );
      const newPurposeVersionId = generateId<PurposeVersionId>();
      await updatePurposeDataInPlatformStatesEntry({
        dynamoDBClient,
        primaryKey,
        purposeState: itemState.active,
        version: 2,
        purposeVersionId: newPurposeVersionId,
        logger: genericLogger,
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
      const tokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );
      expect(tokenGenStatesEntries).toEqual([]);
      const purpose: Purpose = {
        ...getMockPurpose(),
        versions: [getMockPurposeVersion()],
      };

      await expect(
        updatePurposeDataInTokenGenStatesEntries({
          dynamoDBClient,
          purposeId: purpose.id,
          purposeState: itemState.inactive,
          purposeVersionId: purpose.versions[0].id,
          purposeConsumerId: purpose.consumerId,
          logger: genericLogger,
        })
      ).resolves.not.toThrowError();
      const tokenGenStatesEntriesAfterUpdate = await readAllTokenGenStatesItems(
        dynamoDBClient
      );
      expect(tokenGenStatesEntriesAfterUpdate).toEqual([]);
    });

    it("should update state and purpose version id if previous entries exist", async () => {
      const purpose: Purpose = {
        ...getMockPurpose(),
        versions: [getMockPurposeVersion()],
      };

      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: purpose.id,
        });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          GSIPK_purposeId: purpose.id,
          purposeState: itemState.inactive,
          purposeVersionId: purpose.versions[0].id,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: purpose.id,
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          GSIPK_purposeId: purpose.id,
          purposeState: itemState.inactive,
          purposeVersionId: purpose.versions[0].id,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );
      const newPurposeVersionId = generateId<PurposeVersionId>();
      await updatePurposeDataInTokenGenStatesEntries({
        dynamoDBClient,
        purposeId: purpose.id,
        purposeState: itemState.active,
        purposeVersionId: newPurposeVersionId,
        purposeConsumerId: purpose.consumerId,
        logger: genericLogger,
      });
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );
      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          consumerId: purpose.consumerId,
          purposeState: itemState.active,
          purposeVersionId: newPurposeVersionId,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          consumerId: purpose.consumerId,
          purposeState: itemState.active,
          purposeVersionId: newPurposeVersionId,
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

  describe("updatePurposeEntriesInTokenGenerationStatesTable", async () => {
    it("should do nothing if previous entries don't exist", async () => {
      const tokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );
      expect(tokenGenStatesEntries).toEqual([]);
      const purpose: Purpose = {
        ...getMockPurpose(),
        versions: [getMockPurposeVersion()],
      };

      await expect(
        updateTokenGenStatesEntriesWithPurposeAndPlatformStatesData(
          dynamoDBClient,
          purpose,
          itemState.inactive,
          purpose.versions[0].id,
          genericLogger
        )
      ).resolves.not.toThrowError();
      const tokenGenStatesEntriesAfterUpdate = await readAllTokenGenStatesItems(
        dynamoDBClient
      );
      expect(tokenGenStatesEntriesAfterUpdate).toEqual([]);
    });

    it("should update entries with just purpose state and version id, if descriptor and agreement platform states entries don't exist", async () => {
      const purpose: Purpose = {
        ...getMockPurpose(),
        versions: [getMockPurposeVersion()],
      };

      // token-generation-states
      const purposeId = purpose.id;
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId,
        });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
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
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId,
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
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
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      const newPurposeVersionId = generateId<PurposeVersionId>();
      await updateTokenGenStatesEntriesWithPurposeAndPlatformStatesData(
        dynamoDBClient,
        purpose,
        itemState.active,
        newPurposeVersionId,
        genericLogger
      );

      const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
        consumerId: purpose.consumerId,
        eserviceId: purpose.eserviceId,
      });
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );

      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          consumerId: purpose.consumerId,
          GSIPK_consumerId_eserviceId,
          purposeState: itemState.active,
          purposeVersionId: newPurposeVersionId,
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          consumerId: purpose.consumerId,
          GSIPK_consumerId_eserviceId,
          purposeState: itemState.active,
          purposeVersionId: newPurposeVersionId,
        };
      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          expectedTokenGenStatesConsumeClient1,
          expectedTokenGenStatesConsumeClient2,
        ])
      );
    });

    it("should update entries with purpose state, version id and agreement data if platform-states agreement entry exists", async () => {
      const purpose: Purpose = {
        ...getMockPurpose(),
        versions: [getMockPurposeVersion()],
      };

      // platform-states
      const mockDescriptor = getMockDescriptor();
      const mockAgreement: Agreement = {
        ...getMockAgreement(purpose.eserviceId, purpose.consumerId),
        descriptorId: mockDescriptor.id,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const catalogAgreementEntryPK = makePlatformStatesAgreementPK({
        consumerId: purpose.consumerId,
        eserviceId: purpose.eserviceId,
      });
      const gsiPKConsumerIdEServiceId = makeGSIPKConsumerIdEServiceId({
        consumerId: mockAgreement.consumerId,
        eserviceId: mockAgreement.eserviceId,
      });
      const platformStatesAgreementEntry: PlatformStatesAgreementEntry = {
        PK: catalogAgreementEntryPK,
        state: itemState.active,
        agreementId: mockAgreement.id,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        agreementTimestamp: mockAgreement.stamps.activation!.when.toISOString(),
        agreementDescriptorId: mockAgreement.descriptorId,
        producerId: mockAgreement.producerId,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformAgreementEntry(
        platformStatesAgreementEntry,
        dynamoDBClient
      );

      // token-generation-states
      const purposeId = purpose.id;
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId,
        });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          GSIPK_purposeId: purposeId,
          purposeState: itemState.inactive,
          GSIPK_consumerId_eserviceId: undefined,
          agreementId: undefined,
          agreementState: undefined,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId,
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          GSIPK_purposeId: purposeId,
          purposeState: itemState.inactive,
          GSIPK_consumerId_eserviceId: undefined,
          agreementId: undefined,
          agreementState: undefined,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      const newPurposeVersionId = generateId<PurposeVersionId>();
      await updateTokenGenStatesEntriesWithPurposeAndPlatformStatesData(
        dynamoDBClient,
        purpose,
        itemState.active,
        newPurposeVersionId,
        genericLogger
      );

      const GSIPK_eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: purpose.eserviceId,
        descriptorId: mockDescriptor.id,
      });
      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );
      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          consumerId: purpose.consumerId,
          GSIPK_eserviceId_descriptorId,
          purposeState: itemState.active,
          purposeVersionId: newPurposeVersionId,
          GSIPK_consumerId_eserviceId: gsiPKConsumerIdEServiceId,
          agreementId: mockAgreement.id,
          agreementState: platformStatesAgreementEntry.state,
          producerId: platformStatesAgreementEntry.producerId,
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          consumerId: purpose.consumerId,
          GSIPK_eserviceId_descriptorId,
          purposeState: itemState.active,
          purposeVersionId: newPurposeVersionId,
          GSIPK_consumerId_eserviceId: gsiPKConsumerIdEServiceId,
          agreementId: mockAgreement.id,
          agreementState: platformStatesAgreementEntry.state,
          producerId: platformStatesAgreementEntry.producerId,
        };
      expect(retrievedTokenGenStatesEntries).toHaveLength(2);
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          expectedTokenGenStatesConsumeClient1,
          expectedTokenGenStatesConsumeClient2,
        ])
      );
    });

    it("should update entries with purpose state, version id, agreement and descriptor data if platform-states agreement and descriptor entries exist", async () => {
      const purpose: Purpose = {
        ...getMockPurpose(),
        versions: [getMockPurposeVersion()],
      };

      // platform-states
      const mockDescriptor = getMockDescriptor();
      const mockAgreement: Agreement = {
        ...getMockAgreement(purpose.eserviceId, purpose.consumerId),
        descriptorId: mockDescriptor.id,
        stamps: {
          activation: {
            when: new Date(),
            who: generateId(),
          },
        },
      };
      const catalogAgreementEntryPK = makePlatformStatesAgreementPK({
        consumerId: purpose.consumerId,
        eserviceId: purpose.eserviceId,
      });
      const gsiPKConsumerIdEServiceId = makeGSIPKConsumerIdEServiceId({
        consumerId: mockAgreement.consumerId,
        eserviceId: mockAgreement.eserviceId,
      });
      const platformStatesAgreementEntry: PlatformStatesAgreementEntry = {
        PK: catalogAgreementEntryPK,
        state: itemState.active,
        agreementId: mockAgreement.id,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        agreementTimestamp: mockAgreement.stamps.activation!.when.toISOString(),
        agreementDescriptorId: mockAgreement.descriptorId,
        producerId: mockAgreement.producerId,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformAgreementEntry(
        platformStatesAgreementEntry,
        dynamoDBClient
      );

      const catalogEntryPK = makePlatformStatesEServiceDescriptorPK({
        eserviceId: purpose.eserviceId,
        descriptorId: mockDescriptor.id,
      });
      const platformStatesDescriptorEntry: PlatformStatesCatalogEntry = {
        PK: catalogEntryPK,
        state: itemState.active,
        descriptorAudience: ["pagopa.it"],
        descriptorVoucherLifespan: mockDescriptor.voucherLifespan,
        version: 2,
        updatedAt: new Date().toISOString(),
      };
      await writePlatformCatalogEntry(
        platformStatesDescriptorEntry,
        dynamoDBClient
      );

      // token-generation-states
      const purposeId = purpose.id;
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId,
        });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          GSIPK_purposeId: purposeId,
          purposeState: itemState.inactive,
          GSIPK_consumerId_eserviceId: undefined,
          agreementId: undefined,
          agreementState: undefined,
          producerId: undefined,
          GSIPK_eserviceId_descriptorId: undefined,
          descriptorState: undefined,
          descriptorAudience: undefined,
          descriptorVoucherLifespan: undefined,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient1,
        dynamoDBClient
      );

      const tokenGenStatesEntryPK2 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId,
        });
      const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
          GSIPK_purposeId: purposeId,
          purposeState: itemState.inactive,
          GSIPK_consumerId_eserviceId: undefined,
          agreementId: undefined,
          agreementState: undefined,
          producerId: undefined,
          GSIPK_eserviceId_descriptorId: undefined,
          descriptorState: undefined,
          descriptorAudience: undefined,
          descriptorVoucherLifespan: undefined,
          updatedAt: new Date().toISOString(),
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      const newPurposeVersionId = generateId<PurposeVersionId>();
      await updateTokenGenStatesEntriesWithPurposeAndPlatformStatesData(
        dynamoDBClient,
        purpose,
        itemState.active,
        newPurposeVersionId,
        genericLogger
      );

      const retrievedTokenGenStatesEntries = await readAllTokenGenStatesItems(
        dynamoDBClient
      );

      const gsiPKEserviceIdDescriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: purpose.eserviceId,
        descriptorId: mockDescriptor.id,
      });
      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          consumerId: purpose.consumerId,
          purposeState: itemState.active,
          purposeVersionId: newPurposeVersionId,
          GSIPK_consumerId_eserviceId: gsiPKConsumerIdEServiceId,
          agreementId: mockAgreement.id,
          agreementState: platformStatesAgreementEntry.state,
          producerId: platformStatesAgreementEntry.producerId,
          GSIPK_eserviceId_descriptorId: gsiPKEserviceIdDescriptorId,
          descriptorState: platformStatesDescriptorEntry.state,
          descriptorAudience: platformStatesDescriptorEntry.descriptorAudience,
          descriptorVoucherLifespan:
            platformStatesDescriptorEntry.descriptorVoucherLifespan,
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          consumerId: purpose.consumerId,
          purposeState: itemState.active,
          purposeVersionId: newPurposeVersionId,
          GSIPK_consumerId_eserviceId: gsiPKConsumerIdEServiceId,
          agreementId: mockAgreement.id,
          agreementState: platformStatesAgreementEntry.state,
          producerId: platformStatesAgreementEntry.producerId,
          GSIPK_eserviceId_descriptorId: gsiPKEserviceIdDescriptorId,
          descriptorState: platformStatesDescriptorEntry.state,
          descriptorAudience: platformStatesDescriptorEntry.descriptorAudience,
          descriptorVoucherLifespan:
            platformStatesDescriptorEntry.descriptorVoucherLifespan,
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

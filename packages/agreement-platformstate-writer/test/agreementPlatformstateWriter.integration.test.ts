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
  AgreementId,
  AgreementUnsuspendedByProducerV2,
  DescriptorId,
  PlatformStatesAgreementEntry,
  PlatformStatesCatalogEntry,
  TokenGenerationStatesClientPurposeEntry,
  agreementState,
  descriptorState,
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
  ConditionalCheckFailedException,
  CreateTableCommand,
  CreateTableInput,
  DeleteTableCommand,
  DeleteTableInput,
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import {
  getMockTokenStatesClientPurposeEntry,
  getMockAgreement,
} from "pagopa-interop-commons-test";
import {
  agreementStateToItemState,
  deleteAgreementEntry,
  readAgreementEntry,
  readTokenStateEntriesByConsumerIdEserviceId,
  updateAgreementStateInPlatformStatesEntry,
  updateAgreementStateInTokenGenerationStatesTable,
  writeAgreementEntry,
} from "../src/utils.js";
import { handleMessageV2 } from "../src/consumerServiceV2.js";
import {
  config,
  getMockAgreementEntry,
  readAllTokenStateItems,
  sleep,
  writeCatalogEntry,
  writeTokenStateEntry,
} from "./utils.js";

describe("integration tests", async () => {
  if (!config) {
    fail();
  }
  const dynamoDBClient = new DynamoDBClient({
    credentials: { accessKeyId: "key", secretAccessKey: "secret" },
    region: "eu-central-1",
    endpoint: `http://${config.tokenGenerationReadModelDbHost}:${config.tokenGenerationReadModelDbPort}`,
  });
  beforeEach(async () => {
    if (!config) {
      // to do: why is this needed?
      fail();
    }
    const platformTableDefinition: CreateTableInput = {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      TableName: config.tokenGenerationReadModelTableNamePlatform,
      AttributeDefinitions: [{ AttributeName: "PK", AttributeType: "S" }],
      KeySchema: [{ AttributeName: "PK", KeyType: "HASH" }],
      BillingMode: "PAY_PER_REQUEST",
    };
    const command1 = new CreateTableCommand(platformTableDefinition);
    await dynamoDBClient.send(command1);

    const tokenGenerationTableDefinition: CreateTableInput = {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
      AttributeDefinitions: [
        { AttributeName: "PK", AttributeType: "S" },
        { AttributeName: "GSIPK_eserviceId_descriptorId", AttributeType: "S" },
      ],
      KeySchema: [{ AttributeName: "PK", KeyType: "HASH" }],
      BillingMode: "PAY_PER_REQUEST",
      GlobalSecondaryIndexes: [
        {
          IndexName: "GSIPK_eserviceId_descriptorId",
          KeySchema: [
            {
              AttributeName: "GSIPK_eserviceId_descriptorId",
              KeyType: "HASH",
            },
          ],
          Projection: {
            NonKeyAttributes: [],
            ProjectionType: "ALL",
          },
          // ProvisionedThroughput: {
          //   ReadCapacityUnits: 5,
          //   WriteCapacityUnits: 5,
          // },
        },
      ],
    };
    const command2 = new CreateTableCommand(tokenGenerationTableDefinition);
    await dynamoDBClient.send(command2);
  });
  afterEach(async () => {
    if (!config) {
      fail();
    }
    const tableToDelete1: DeleteTableInput = {
      TableName: config.tokenGenerationReadModelTableNamePlatform,
    };
    const tableToDelete2: DeleteTableInput = {
      TableName: config.tokenGenerationReadModelTableNameTokenGeneration,
    };
    const command1 = new DeleteTableCommand(tableToDelete1);
    await dynamoDBClient.send(command1);
    const command2 = new DeleteTableCommand(tableToDelete2);
    await dynamoDBClient.send(command2);
  });
  const mockDate = new Date();
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  describe("utils", async () => {
    // TODO: move this to other test file after improving table setup
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
        const catalogEntry = await readAgreementEntry(
          primaryKey,
          dynamoDBClient
        );
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
          const tokenStateEntryPK = makeTokenGenerationStatesClientKidPurposePK(
            {
              clientId: generateId(),
              kid: `kid ${Math.random()}`,
              purposeId: generateId(),
            }
          );
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

  describe("Events V2", async () => {
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
        // const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
        //   clientId: generateId(),
        //   kid: `kid ${Math.random()}`,
        //   purposeId: generateId(),
        // });
        // const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        //   eserviceId: eservice.id,
        //   descriptorId: publishedDescriptor.id,
        // });
        // const previousTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
        //   {
        //     ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK1),
        //     descriptorState: itemState.inactive,
        //     descriptorAudience: publishedDescriptor.audience[0],
        //     GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        //   };
        // await writeTokenStateEntry(previousTokenStateEntry1, dynamoDBClient);

        // const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
        //   clientId: generateId(),
        //   kid: `kid ${Math.random()}`,
        //   purposeId: generateId(),
        // });
        // const previousTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
        //   {
        //     ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK2),
        //     descriptorState: itemState.inactive,
        //     descriptorAudience: publishedDescriptor.audience[0],
        //     GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        //   };
        // await writeTokenStateEntry(previousTokenStateEntry2, dynamoDBClient);

        await sleep(1000, mockDate);
        await handleMessageV2(message, dynamoDBClient);

        // platform-states
        const retrievedAgreementEntry = await readAgreementEntry(
          agreementEntryPrimaryKey,
          dynamoDBClient
        );

        expect(retrievedAgreementEntry).toEqual(previousStateEntry);

        // token-generation-states
        // const retrievedTokenStateEntries =
        //   await readTokenStateEntriesByEserviceIdAndDescriptorId(
        //     eserviceId_descriptorId,
        //     dynamoDBClient
        //   );

        // expect(retrievedTokenStateEntries).toHaveLength(2);
        // expect(retrievedTokenStateEntries).toEqual(
        //   expect.arrayContaining([
        //     previousTokenStateEntry1,
        //     previousTokenStateEntry2,
        //   ])
        // );
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
          consumerId: generateId(),
          eserviceId: generateId(),
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
            descriptorState: itemState.active,
            updatedAt: new Date().toISOString(),
          };
        const expectedTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
          {
            ...previousTokenStateEntry2,
            descriptorState: itemState.active,
            updatedAt: new Date().toISOString(),
          };

        // // TODO: this works, but arrayContaining must have the exact objects
        // expect.arrayContaining([expectedTokenStateEntry2, expectedTokenStateEntry2]) also passes the test
        expect(retrievedTokenStateEntries).toHaveLength(2);
        expect(retrievedTokenStateEntries).toEqual(
          expect.arrayContaining([
            expectedTokenStateEntry2,
            expectedTokenStateEntry1,
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
          version: 1,
          updatedAt: new Date().toISOString(),
        };

        await writeCatalogEntry(catalogEntry, dynamoDBClient);

        // token-generation-states
        // const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
        //   clientId: generateId(),
        //   kid: `kid ${Math.random()}`,
        //   purposeId: generateId(),
        // });
        // const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        //   eserviceId: eservice.id,
        //   descriptorId: publishedDescriptor.id,
        // });
        // const previousTokenStateEntry1: TokenGenerationStatesClientPurposeEntry =
        //   {
        //     ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK1),
        //     descriptorState: itemState.inactive,
        //     descriptorAudience: publishedDescriptor.audience[0],
        //     GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        //   };
        // await writeTokenStateEntry(previousTokenStateEntry1, dynamoDBClient);

        // const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
        //   clientId: generateId(),
        //   kid: `kid ${Math.random()}`,
        //   purposeId: generateId(),
        // });
        // const previousTokenStateEntry2: TokenGenerationStatesClientPurposeEntry =
        //   {
        //     ...getMockTokenStatesClientPurposeEntry(tokenStateEntryPK2),
        //     descriptorState: itemState.inactive,
        //     descriptorAudience: publishedDescriptor.audience[0],
        //     GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        //   };
        // await writeTokenStateEntry(previousTokenStateEntry2, dynamoDBClient);

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
      });
    });

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
      it("should update the entry (agreement is not the latest -> no operation on token states)", () => {});
      it("should update the entry (agreement is the latest -> update in token states)", async () => {
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
        const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
          consumerId: generateId(),
          eserviceId: generateId(),
        });
        const agreementStateEntry: PlatformStatesAgreementEntry = {
          ...getMockAgreementEntry(agreementEntryPrimaryKey),
          state: itemState.inactive,
          GSIPK_consumerId_eserviceId,
          GSISK_agreementTimestamp:
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            agreement.stamps.activation!.when.toISOString(),
        };

        // TODO add a previous agreement
        await writeAgreementEntry(agreementStateEntry, dynamoDBClient);
        await sleep(1000, mockDate);
        await handleMessageV2(message, dynamoDBClient);

        const expectedAgreementStateEntry: PlatformStatesAgreementEntry = {
          ...agreementStateEntry,
          state: itemState.active,
          updatedAt: new Date().toISOString(),
          GSISK_agreementTimestamp:
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            agreement.stamps.activation!.when.toISOString(),
        };

        const retrievedEntry = await readAgreementEntry(
          agreementEntryPrimaryKey,
          dynamoDBClient
        );
        expect(retrievedEntry).toEqual(expectedAgreementStateEntry);
      });
    });

    describe("AgreementUpgraded", async () => {});

    it("AgreementArchivedByUpgrade", async () => {
      const agreement: Agreement = {
        ...getMockAgreement(),
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
        consumerId: generateId(),
        eserviceId: generateId(),
      });
      const agreementStateEntry: PlatformStatesAgreementEntry = {
        ...getMockAgreementEntry(agreementEntryPrimaryKey),
        state: itemState.inactive,
        GSIPK_consumerId_eserviceId,
      };
      await writeAgreementEntry(agreementStateEntry, dynamoDBClient);
      await sleep(1000, mockDate);
      await handleMessageV2(message, dynamoDBClient);

      const retrievedEntry = await readAgreementEntry(
        agreementEntryPrimaryKey,
        dynamoDBClient
      );
      expect(retrievedEntry).toBeUndefined();
    });

    describe("AgreementArchivedByConsumer", () => {
      it("agreement is the latest (includes operation on token states)", async () => {
        const agreement: Agreement = {
          ...getMockAgreement(),
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
        const payload: AgreementArchivedByConsumerV2 = {
          agreement: toAgreementV2(agreement),
        };
        const message: AgreementEventEnvelope = {
          sequence_num: 1,
          stream_id: agreement.id,
          version: 1,
          type: "AgreementArchivedByConsumer",
          event_version: 2,
          data: payload,
          log_date: new Date(),
        };
        const agreementEntryPrimaryKey = makePlatformStatesAgreementPK(
          agreement.id
        );
        const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
          consumerId: generateId(),
          eserviceId: generateId(),
        });
        const agreementStateEntry: PlatformStatesAgreementEntry = {
          ...getMockAgreementEntry(agreementEntryPrimaryKey),
          state: itemState.inactive,
          GSIPK_consumerId_eserviceId,
          GSISK_agreementTimestamp:
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            agreement.stamps.activation!.when.toISOString(),
        };

        // TODO add a previous agreement
        await writeAgreementEntry(agreementStateEntry, dynamoDBClient);
        await sleep(1000, mockDate);
        await handleMessageV2(message, dynamoDBClient);

        const retrievedEntry = await readAgreementEntry(
          agreementEntryPrimaryKey,
          dynamoDBClient
        );
        expect(retrievedEntry).toBeUndefined();
      });
      it("agreement is not the latest (no operation on token states)", async () => {
        const sixHoursAgo = new Date();
        sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

        const agreement: Agreement = {
          ...getMockAgreement(),
          state: agreementState.archived,
          stamps: {
            activation: {
              when: sixHoursAgo,
              who: generateId(),
            },
            archiving: {
              when: sixHoursAgo,
              who: generateId(),
            },
          },
        };
        const payload: AgreementArchivedByConsumerV2 = {
          agreement: toAgreementV2(agreement),
        };
        const message: AgreementEventEnvelope = {
          sequence_num: 1,
          stream_id: agreement.id,
          version: 1,
          type: "AgreementArchivedByConsumer",
          event_version: 2,
          data: payload,
          log_date: new Date(),
        };
        const agreementEntryPrimaryKey = makePlatformStatesAgreementPK(
          agreement.id
        );
        const GSIPK_consumerId_eserviceId = makeGSIPKConsumerIdEServiceId({
          consumerId: generateId(),
          eserviceId: generateId(),
        });
        const agreementStateEntry: PlatformStatesAgreementEntry = {
          ...getMockAgreementEntry(agreementEntryPrimaryKey),

          state: itemState.inactive,
          GSIPK_consumerId_eserviceId,
          GSISK_agreementTimestamp:
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            agreement.stamps.activation!.when.toISOString(),
        };

        const latestAgreementEntryPrimaryKey = makePlatformStatesAgreementPK(
          generateId()
        );
        const latestAgreementStateEntry: PlatformStatesAgreementEntry = {
          ...getMockAgreementEntry(latestAgreementEntryPrimaryKey),
          state: itemState.inactive,
          GSIPK_consumerId_eserviceId,
          GSISK_agreementTimestamp: new Date().toISOString(),
        };

        await writeAgreementEntry(agreementStateEntry, dynamoDBClient);
        await writeAgreementEntry(latestAgreementStateEntry, dynamoDBClient);

        await sleep(1000, mockDate);
        await handleMessageV2(message, dynamoDBClient);

        const retrievedEntry = await readAgreementEntry(
          agreementEntryPrimaryKey,
          dynamoDBClient
        );
        expect(retrievedEntry).toBeUndefined();

        // TODO how to test "no operation" on token states
      });
    });
  });
});

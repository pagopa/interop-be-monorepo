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
  Descriptor,
  EService,
  EServiceDescriptorUpdatedV1,
  EServiceEventEnvelope,
  PlatformStatesCatalogEntry,
  TokenGenerationStatesConsumerClient,
  descriptorState,
  generateId,
  itemState,
  makeGSIPKEServiceIdDescriptorId,
  makePlatformStatesEServiceDescriptorPK,
  makeTokenGenerationStatesClientKidPurposePK,
} from "pagopa-interop-models";
import {
  toDescriptorV1,
  getMockDescriptor,
  getMockEService,
  getMockDocument,
  getMockTokenStatesConsumerClient,
  buildDynamoDBTables,
  deleteDynamoDBTables,
  readTokenStatesEntriesByGSIPKEServiceIdDescriptorId,
} from "pagopa-interop-commons-test";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { writeTokenStatesConsumerClient } from "pagopa-interop-commons-test";
import { handleMessageV1 } from "../src/consumerServiceV1.js";
import { readCatalogEntry, writeCatalogEntry } from "../src/utils.js";
import { config, sleep } from "./utils.js";
describe("V1 events", async () => {
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

  describe("Events V1", async () => {
    describe("EServiceDescriptorUpdated", () => {
      it("(draft -> published) should add the entry if it doesn't exist", async () => {
        const publishedDescriptor: Descriptor = {
          ...getMockDescriptor(),
          audience: ["pagopa.it/test1", "pagopa.it/test2"],
          interface: getMockDocument(),
          publishedAt: new Date(),
          state: descriptorState.published,
        };
        const eservice: EService = {
          ...getMockEService(),
          descriptors: [publishedDescriptor],
        };

        const payload: EServiceDescriptorUpdatedV1 = {
          eserviceId: eservice.id,
          eserviceDescriptor: toDescriptorV1(publishedDescriptor),
        };
        const message: EServiceEventEnvelope = {
          sequence_num: 1,
          stream_id: eservice.id,
          version: 2,
          type: "EServiceDescriptorUpdated",
          event_version: 1,
          data: payload,
          log_date: new Date(),
        };

        // token-generation-states
        const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
        const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
          eserviceId: eservice.id,
          descriptorId: publishedDescriptor.id,
        });
        const previousTokenStateEntry1: TokenGenerationStatesConsumerClient = {
          ...getMockTokenStatesConsumerClient(tokenStateEntryPK1),
          descriptorState: itemState.inactive,
          descriptorAudience: publishedDescriptor.audience,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
        await writeTokenStatesConsumerClient(
          previousTokenStateEntry1,
          dynamoDBClient
        );

        const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
        const previousTokenStateEntry2: TokenGenerationStatesConsumerClient = {
          ...getMockTokenStatesConsumerClient(tokenStateEntryPK2),
          descriptorState: itemState.inactive,
          descriptorAudience: publishedDescriptor.audience,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
        await writeTokenStatesConsumerClient(
          previousTokenStateEntry2,
          dynamoDBClient
        );

        await handleMessageV1(message, dynamoDBClient);
        await sleep(1000, mockDate);

        const primaryKey = makePlatformStatesEServiceDescriptorPK({
          eserviceId: eservice.id,
          descriptorId: publishedDescriptor.id,
        });
        const retrievedEntry = await readCatalogEntry(
          primaryKey,
          dynamoDBClient
        );
        const expectedEntry: PlatformStatesCatalogEntry = {
          PK: primaryKey,
          state: itemState.active,
          descriptorAudience: publishedDescriptor.audience,
          descriptorVoucherLifespan: publishedDescriptor.voucherLifespan,
          version: 2,
          updatedAt: new Date().toISOString(),
        };
        expect(retrievedEntry).toEqual(expectedEntry);

        // token-generation-states
        const retrievedTokenStateEntries =
          await readTokenStatesEntriesByGSIPKEServiceIdDescriptorId(
            eserviceId_descriptorId,
            dynamoDBClient
          );
        const expectedTokenStateEntry1: TokenGenerationStatesConsumerClient = {
          ...previousTokenStateEntry1,
          descriptorState: itemState.active,
          updatedAt: new Date().toISOString(),
        };
        const expectedTokenStateEntry2: TokenGenerationStatesConsumerClient = {
          ...previousTokenStateEntry2,
          descriptorState: itemState.active,
          updatedAt: new Date().toISOString(),
        };
        expect(retrievedTokenStateEntries).toEqual(
          expect.arrayContaining([
            expectedTokenStateEntry1,
            expectedTokenStateEntry2,
          ])
        );
      });
      it("(suspended -> published) should update the entry if incoming version is more recent than existing table entry", async () => {
        const publishedDescriptor: Descriptor = {
          ...getMockDescriptor(),
          audience: ["pagopa.it/test1", "pagopa.it/test2"],
          interface: getMockDocument(),
          publishedAt: new Date(),
          suspendedAt: undefined,
          state: descriptorState.published,
        };
        const eservice: EService = {
          ...getMockEService(),
          descriptors: [publishedDescriptor],
        };

        const payload: EServiceDescriptorUpdatedV1 = {
          eserviceId: eservice.id,
          eserviceDescriptor: toDescriptorV1(publishedDescriptor),
        };
        const message: EServiceEventEnvelope = {
          sequence_num: 1,
          stream_id: eservice.id,
          version: 2,
          type: "EServiceDescriptorUpdated",
          event_version: 1,
          data: payload,
          log_date: new Date(),
        };
        const primaryKey = makePlatformStatesEServiceDescriptorPK({
          eserviceId: eservice.id,
          descriptorId: publishedDescriptor.id,
        });
        const previousStateEntry: PlatformStatesCatalogEntry = {
          PK: primaryKey,
          state: itemState.inactive,
          descriptorAudience: publishedDescriptor.audience,
          descriptorVoucherLifespan: publishedDescriptor.voucherLifespan,
          version: 1,
          updatedAt: new Date().toISOString(),
        };
        await writeCatalogEntry(previousStateEntry, dynamoDBClient);

        // token-generation-states
        const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
        const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
          eserviceId: eservice.id,
          descriptorId: publishedDescriptor.id,
        });
        const previousTokenStateEntry1: TokenGenerationStatesConsumerClient = {
          ...getMockTokenStatesConsumerClient(tokenStateEntryPK1),
          descriptorState: itemState.inactive,
          descriptorAudience: publishedDescriptor.audience,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
        await writeTokenStatesConsumerClient(
          previousTokenStateEntry1,
          dynamoDBClient
        );

        const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
        const previousTokenStateEntry2: TokenGenerationStatesConsumerClient = {
          ...getMockTokenStatesConsumerClient(tokenStateEntryPK2),
          descriptorState: itemState.inactive,
          descriptorAudience: publishedDescriptor.audience,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
        await writeTokenStatesConsumerClient(
          previousTokenStateEntry2,
          dynamoDBClient
        );

        await handleMessageV1(message, dynamoDBClient);
        await sleep(1000, mockDate);

        const retrievedCatalogEntry = await readCatalogEntry(
          primaryKey,
          dynamoDBClient
        );
        const expectedCatalogEntry: PlatformStatesCatalogEntry = {
          ...previousStateEntry,
          state: itemState.active,
          version: 2,
        };
        expect(retrievedCatalogEntry).toEqual(expectedCatalogEntry);

        // token-generation-states
        const retrievedTokenStateEntries =
          await readTokenStatesEntriesByGSIPKEServiceIdDescriptorId(
            eserviceId_descriptorId,
            dynamoDBClient
          );
        const expectedTokenStateEntry1: TokenGenerationStatesConsumerClient = {
          ...previousTokenStateEntry1,
          descriptorState: itemState.active,
          updatedAt: new Date().toISOString(),
        };
        const expectedTokenStateEntry2: TokenGenerationStatesConsumerClient = {
          ...previousTokenStateEntry2,
          descriptorState: itemState.active,
          updatedAt: new Date().toISOString(),
        };
        expect(retrievedTokenStateEntries).toEqual(
          expect.arrayContaining([
            expectedTokenStateEntry1,
            expectedTokenStateEntry2,
          ])
        );
      });

      it("(published) should do no operation if existing table entry is more recent than incoming version", async () => {
        const publishedDescriptor: Descriptor = {
          ...getMockDescriptor(),
          audience: ["pagopa.it/test1", "pagopa.it/test2"],
          interface: getMockDocument(),
          state: descriptorState.published,
          publishedAt: new Date(),
          suspendedAt: new Date(),
        };
        const eservice: EService = {
          ...getMockEService(),
          descriptors: [publishedDescriptor],
        };

        const payload: EServiceDescriptorUpdatedV1 = {
          eserviceId: eservice.id,
          eserviceDescriptor: toDescriptorV1(publishedDescriptor),
        };
        const message: EServiceEventEnvelope = {
          sequence_num: 1,
          stream_id: eservice.id,
          version: 1,
          type: "EServiceDescriptorUpdated",
          event_version: 1,
          data: payload,
          log_date: new Date(),
        };
        const catalogPrimaryKey = makePlatformStatesEServiceDescriptorPK({
          eserviceId: eservice.id,
          descriptorId: publishedDescriptor.id,
        });
        const previousCatalogStateEntry: PlatformStatesCatalogEntry = {
          PK: catalogPrimaryKey,
          state: itemState.inactive,
          descriptorAudience: publishedDescriptor.audience,
          descriptorVoucherLifespan: publishedDescriptor.voucherLifespan,
          version: 2,
          updatedAt: new Date().toISOString(),
        };
        await writeCatalogEntry(previousCatalogStateEntry, dynamoDBClient);

        // token-generation-states
        const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
        const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
          eserviceId: eservice.id,
          descriptorId: publishedDescriptor.id,
        });
        const previousTokenStateEntry1: TokenGenerationStatesConsumerClient = {
          ...getMockTokenStatesConsumerClient(tokenStateEntryPK1),
          descriptorState: itemState.inactive,
          descriptorAudience: publishedDescriptor.audience,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
        await writeTokenStatesConsumerClient(
          previousTokenStateEntry1,
          dynamoDBClient
        );

        const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
        const previousTokenStateEntry2: TokenGenerationStatesConsumerClient = {
          ...getMockTokenStatesConsumerClient(tokenStateEntryPK2),
          descriptorState: itemState.inactive,
          descriptorAudience: publishedDescriptor.audience,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
        await writeTokenStatesConsumerClient(
          previousTokenStateEntry2,
          dynamoDBClient
        );

        await handleMessageV1(message, dynamoDBClient);
        await sleep(1000, mockDate);

        const retrievedCatalogEntry = await readCatalogEntry(
          catalogPrimaryKey,
          dynamoDBClient
        );
        expect(retrievedCatalogEntry).toEqual(previousCatalogStateEntry);

        // token-generation-states
        const retrievedTokenStateEntries =
          await readTokenStatesEntriesByGSIPKEServiceIdDescriptorId(
            eserviceId_descriptorId,
            dynamoDBClient
          );
        expect(retrievedTokenStateEntries).toEqual(
          expect.arrayContaining([
            previousTokenStateEntry1,
            previousTokenStateEntry2,
          ])
        );
      });

      describe("(published -> suspended)", () => {
        it("should update the entry if msg.version >= existing version", async () => {
          const suspendedDescriptor: Descriptor = {
            ...getMockDescriptor(),
            audience: ["pagopa.it/test1", "pagopa.it/test2"],
            interface: getMockDocument(),
            publishedAt: new Date(),
            suspendedAt: new Date(),
            state: descriptorState.suspended,
          };

          const eservice: EService = {
            ...getMockEService(),
            descriptors: [suspendedDescriptor],
          };

          const payload: EServiceDescriptorUpdatedV1 = {
            eserviceId: eservice.id,
            eserviceDescriptor: toDescriptorV1(suspendedDescriptor),
          };
          const message: EServiceEventEnvelope = {
            sequence_num: 1,
            stream_id: eservice.id,
            version: 2,
            type: "EServiceDescriptorUpdated",
            event_version: 1,
            data: payload,
            log_date: new Date(),
          };
          const primaryKey = makePlatformStatesEServiceDescriptorPK({
            eserviceId: eservice.id,
            descriptorId: suspendedDescriptor.id,
          });
          const previousStateEntry: PlatformStatesCatalogEntry = {
            PK: primaryKey,
            state: itemState.active,
            descriptorAudience: suspendedDescriptor.audience,
            descriptorVoucherLifespan: suspendedDescriptor.voucherLifespan,
            version: 1,
            updatedAt: new Date().toISOString(),
          };
          await writeCatalogEntry(previousStateEntry, dynamoDBClient);

          // token-generation-states
          const tokenStateEntryPK1 =
            makeTokenGenerationStatesClientKidPurposePK({
              clientId: generateId(),
              kid: `kid ${Math.random()}`,
              purposeId: generateId(),
            });
          const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
            eserviceId: eservice.id,
            descriptorId: suspendedDescriptor.id,
          });
          const previousTokenStateEntry1: TokenGenerationStatesConsumerClient =
            {
              ...getMockTokenStatesConsumerClient(tokenStateEntryPK1),
              descriptorState: itemState.active,
              descriptorAudience: suspendedDescriptor.audience,
              GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
            };
          await writeTokenStatesConsumerClient(
            previousTokenStateEntry1,
            dynamoDBClient
          );

          const tokenStateEntryPK2 =
            makeTokenGenerationStatesClientKidPurposePK({
              clientId: generateId(),
              kid: `kid ${Math.random()}`,
              purposeId: generateId(),
            });
          const previousTokenStateEntry2: TokenGenerationStatesConsumerClient =
            {
              ...getMockTokenStatesConsumerClient(tokenStateEntryPK2),
              descriptorState: itemState.active,
              descriptorAudience: suspendedDescriptor.audience,
              GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
            };
          await writeTokenStatesConsumerClient(
            previousTokenStateEntry2,
            dynamoDBClient
          );
          await handleMessageV1(message, dynamoDBClient);
          await sleep(1000, mockDate);

          const retrievedEntry = await readCatalogEntry(
            primaryKey,
            dynamoDBClient
          );
          const expectedEntry: PlatformStatesCatalogEntry = {
            ...previousStateEntry,
            state: itemState.inactive,
            version: 2,
          };
          expect(retrievedEntry).toEqual(expectedEntry);

          // token-generation-states
          const retrievedTokenStateEntries =
            await readTokenStatesEntriesByGSIPKEServiceIdDescriptorId(
              eserviceId_descriptorId,
              dynamoDBClient
            );
          const expectedTokenStateEntry1: TokenGenerationStatesConsumerClient =
            {
              ...previousTokenStateEntry1,
              descriptorState: itemState.inactive,
              updatedAt: new Date().toISOString(),
            };
          const expectedTokenStateEntry2: TokenGenerationStatesConsumerClient =
            {
              ...previousTokenStateEntry2,
              descriptorState: itemState.inactive,
              updatedAt: new Date().toISOString(),
            };
          expect(retrievedTokenStateEntries).toEqual(
            expect.arrayContaining([
              expectedTokenStateEntry1,
              expectedTokenStateEntry2,
            ])
          );
        });

        it("should do no operation if msg.version < existing version", async () => {
          const suspendedDescriptor: Descriptor = {
            ...getMockDescriptor(),
            audience: ["pagopa.it/test1", "pagopa.it/test2"],
            interface: getMockDocument(),
            publishedAt: new Date(),
            suspendedAt: new Date(),
            state: descriptorState.suspended,
          };
          const eservice: EService = {
            ...getMockEService(),
            descriptors: [suspendedDescriptor],
          };

          const payload: EServiceDescriptorUpdatedV1 = {
            eserviceId: eservice.id,
            eserviceDescriptor: toDescriptorV1(suspendedDescriptor),
          };
          const message: EServiceEventEnvelope = {
            sequence_num: 1,
            stream_id: eservice.id,
            version: 2,
            type: "EServiceDescriptorUpdated",
            event_version: 1,
            data: payload,
            log_date: new Date(),
          };
          const primaryKey = makePlatformStatesEServiceDescriptorPK({
            eserviceId: eservice.id,
            descriptorId: suspendedDescriptor.id,
          });
          const previousStateEntry: PlatformStatesCatalogEntry = {
            PK: primaryKey,
            state: itemState.active,
            descriptorAudience: suspendedDescriptor.audience,
            descriptorVoucherLifespan: suspendedDescriptor.voucherLifespan,
            version: 3,
            updatedAt: new Date().toISOString(),
          };

          await writeCatalogEntry(previousStateEntry, dynamoDBClient);

          // token-generation-states
          const tokenStateEntryPK1 =
            makeTokenGenerationStatesClientKidPurposePK({
              clientId: generateId(),
              kid: `kid ${Math.random()}`,
              purposeId: generateId(),
            });
          const tokenStateEntryPK2 =
            makeTokenGenerationStatesClientKidPurposePK({
              clientId: generateId(),
              kid: `kid ${Math.random()}`,
              purposeId: generateId(),
            });
          const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
            eserviceId: eservice.id,
            descriptorId: suspendedDescriptor.id,
          });
          const previousTokenStateEntry1: TokenGenerationStatesConsumerClient =
            {
              ...getMockTokenStatesConsumerClient(tokenStateEntryPK1),
              descriptorState: itemState.active,
              descriptorAudience: suspendedDescriptor.audience,
              GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
            };
          await writeTokenStatesConsumerClient(
            previousTokenStateEntry1,
            dynamoDBClient
          );
          const previousTokenStateEntry2: TokenGenerationStatesConsumerClient =
            {
              ...getMockTokenStatesConsumerClient(tokenStateEntryPK2),
              descriptorState: itemState.active,
              descriptorAudience: suspendedDescriptor.audience,
              GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
            };
          await writeTokenStatesConsumerClient(
            previousTokenStateEntry2,
            dynamoDBClient
          );

          await handleMessageV1(message, dynamoDBClient);
          await sleep(1000, mockDate);

          const retrievedEntry = await readCatalogEntry(
            primaryKey,
            dynamoDBClient
          );
          expect(retrievedEntry).toEqual(previousStateEntry);

          // token-generation-states
          const retrievedTokenStateEntries =
            await readTokenStatesEntriesByGSIPKEServiceIdDescriptorId(
              eserviceId_descriptorId,
              dynamoDBClient
            );
          expect(retrievedTokenStateEntries).toEqual(
            expect.arrayContaining([
              previousTokenStateEntry1,
              previousTokenStateEntry2,
            ])
          );
        });

        it("should do no operation if previous entry doesn't exist", async () => {
          const suspendedDescriptor: Descriptor = {
            ...getMockDescriptor(),
            audience: ["pagopa.it/test1", "pagopa.it/test2"],
            interface: getMockDocument(),
            publishedAt: new Date(),
            suspendedAt: new Date(),
            state: descriptorState.suspended,
          };

          const eservice: EService = {
            ...getMockEService(),
            descriptors: [suspendedDescriptor],
          };

          const payload: EServiceDescriptorUpdatedV1 = {
            eserviceId: eservice.id,
            eserviceDescriptor: toDescriptorV1(suspendedDescriptor),
          };
          const message: EServiceEventEnvelope = {
            sequence_num: 1,
            stream_id: eservice.id,
            version: 2,
            type: "EServiceDescriptorUpdated",
            event_version: 1,
            data: payload,
            log_date: new Date(),
          };

          await handleMessageV1(message, dynamoDBClient);

          const primaryKey = makePlatformStatesEServiceDescriptorPK({
            eserviceId: eservice.id,
            descriptorId: suspendedDescriptor.id,
          });

          const retrievedEntry = await readCatalogEntry(
            primaryKey,
            dynamoDBClient
          );
          expect(retrievedEntry).toBeUndefined();
        });
      });
    });

    it("(published -> archived) should remove the entry from platform states and update the entry in token generation states", async () => {
      const archivedDescriptor: Descriptor = {
        ...getMockDescriptor(),
        audience: ["pagopa.it/test1", "pagopa.it/test2"],
        interface: getMockDocument(),
        publishedAt: new Date(),
        archivedAt: new Date(),
        state: descriptorState.archived,
      };

      const eservice: EService = {
        ...getMockEService(),
        descriptors: [archivedDescriptor],
      };
      const payload: EServiceDescriptorUpdatedV1 = {
        eserviceId: eservice.id,
        eserviceDescriptor: toDescriptorV1(archivedDescriptor),
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: eservice.id,
        version: 2,
        type: "EServiceDescriptorUpdated",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };
      const primaryKey = makePlatformStatesEServiceDescriptorPK({
        eserviceId: eservice.id,
        descriptorId: archivedDescriptor.id,
      });
      const previousStateEntry: PlatformStatesCatalogEntry = {
        PK: primaryKey,
        state: itemState.inactive,
        descriptorAudience: archivedDescriptor.audience,
        descriptorVoucherLifespan: archivedDescriptor.voucherLifespan,
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await writeCatalogEntry(previousStateEntry, dynamoDBClient);

      // token-generation-states
      const tokenStateEntryPK1 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: eservice.id,
        descriptorId: archivedDescriptor.id,
      });
      const previousTokenStateEntry1: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesConsumerClient(tokenStateEntryPK1),
        descriptorState: itemState.active,
        descriptorAudience: archivedDescriptor.audience,
        GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
      };
      await writeTokenStatesConsumerClient(
        previousTokenStateEntry1,
        dynamoDBClient
      );

      const tokenStateEntryPK2 = makeTokenGenerationStatesClientKidPurposePK({
        clientId: generateId(),
        kid: `kid ${Math.random()}`,
        purposeId: generateId(),
      });
      const previousTokenStateEntry2: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesConsumerClient(tokenStateEntryPK2),
        descriptorState: itemState.active,
        descriptorAudience: archivedDescriptor.audience,
        GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
      };
      await writeTokenStatesConsumerClient(
        previousTokenStateEntry2,
        dynamoDBClient
      );

      await handleMessageV1(message, dynamoDBClient);
      await sleep(1000, mockDate);

      const retrievedEntry = await readCatalogEntry(primaryKey, dynamoDBClient);
      expect(retrievedEntry).toBeUndefined();

      // token-generation-states
      const retrievedTokenStateEntries =
        await readTokenStatesEntriesByGSIPKEServiceIdDescriptorId(
          eserviceId_descriptorId,
          dynamoDBClient
        );
      const expectedTokenStateEntry1: TokenGenerationStatesConsumerClient = {
        ...previousTokenStateEntry1,
        descriptorState: itemState.inactive,
        updatedAt: new Date().toISOString(),
      };
      const expectedTokenStateEntry2: TokenGenerationStatesConsumerClient = {
        ...previousTokenStateEntry2,
        descriptorState: itemState.inactive,
        updatedAt: new Date().toISOString(),
      };
      expect(retrievedTokenStateEntries).toEqual(
        expect.arrayContaining([
          expectedTokenStateEntry1,
          expectedTokenStateEntry2,
        ])
      );
    });
  });
});

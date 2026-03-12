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
  getMockTokenGenStatesConsumerClient,
  buildDynamoDBTables,
  deleteDynamoDBTables,
  readAllTokenGenStatesItems,
  writePlatformCatalogEntry,
} from "pagopa-interop-commons-test";
import { writeTokenGenStatesConsumerClient } from "pagopa-interop-commons-test";
import { genericLogger } from "pagopa-interop-commons";
import { handleMessageV1 } from "../src/consumerServiceV1.js";
import { readCatalogEntry } from "../src/utils.js";
import { dynamoDBClient } from "./utils.js";

describe("V1 events", async () => {
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
        const tokenGenStatesEntryPK1 =
          makeTokenGenerationStatesClientKidPurposePK({
            clientId: generateId(),
            kid: `kid ${Math.random()}`,
            purposeId: generateId(),
          });
        const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
          eserviceId: eservice.id,
          descriptorId: publishedDescriptor.id,
        });
        const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
          {
            ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
            descriptorState: itemState.inactive,
            descriptorAudience: publishedDescriptor.audience,
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
            descriptorAudience: publishedDescriptor.audience,
            GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
          };
        await writeTokenGenStatesConsumerClient(
          tokenGenStatesConsumerClient2,
          dynamoDBClient
        );

        await handleMessageV1(message, dynamoDBClient, genericLogger);

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
        expect(retrievedTokenGenStatesEntries).toEqual(
          expect.arrayContaining([
            expectedTokenGenStatesConsumeClient1,
            expectedTokenGenStatesConsumeClient2,
          ])
        );
      });
      it.each([descriptorState.published, descriptorState.deprecated])(
        "(suspended -> %s) should update the entry if the incoming version is more recent than the existing table entry",
        async (state) => {
          const publishedDescriptor: Descriptor = {
            ...getMockDescriptor(),
            audience: ["pagopa.it/test1", "pagopa.it/test2"],
            interface: getMockDocument(),
            publishedAt: new Date(),
            suspendedAt: undefined,
            state,
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
          await writePlatformCatalogEntry(previousStateEntry, dynamoDBClient);

          // token-generation-states
          const tokenGenStatesEntryPK1 =
            makeTokenGenerationStatesClientKidPurposePK({
              clientId: generateId(),
              kid: `kid ${Math.random()}`,
              purposeId: generateId(),
            });
          const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
            eserviceId: eservice.id,
            descriptorId: publishedDescriptor.id,
          });
          const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
            {
              ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
              descriptorState: itemState.inactive,
              descriptorAudience: publishedDescriptor.audience,
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
              descriptorAudience: publishedDescriptor.audience,
              GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
            };
          await writeTokenGenStatesConsumerClient(
            tokenGenStatesConsumerClient2,
            dynamoDBClient
          );

          await handleMessageV1(message, dynamoDBClient, genericLogger);

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
          expect(retrievedTokenGenStatesEntries).toEqual(
            expect.arrayContaining([
              expectedTokenGenStatesConsumeClient1,
              expectedTokenGenStatesConsumeClient2,
            ])
          );
        }
      );

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
        await writePlatformCatalogEntry(
          previousCatalogStateEntry,
          dynamoDBClient
        );

        // token-generation-states
        const tokenGenStatesEntryPK1 =
          makeTokenGenerationStatesClientKidPurposePK({
            clientId: generateId(),
            kid: `kid ${Math.random()}`,
            purposeId: generateId(),
          });
        const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
          eserviceId: eservice.id,
          descriptorId: publishedDescriptor.id,
        });
        const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
          {
            ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
            descriptorState: itemState.inactive,
            descriptorAudience: publishedDescriptor.audience,
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
            descriptorAudience: publishedDescriptor.audience,
            GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
          };
        await writeTokenGenStatesConsumerClient(
          tokenGenStatesConsumerClient2,
          dynamoDBClient
        );

        await handleMessageV1(message, dynamoDBClient, genericLogger);

        const retrievedCatalogEntry = await readCatalogEntry(
          catalogPrimaryKey,
          dynamoDBClient
        );
        expect(retrievedCatalogEntry).toEqual(previousCatalogStateEntry);

        // token-generation-states
        const retrievedTokenGenStatesEntries =
          await readAllTokenGenStatesItems(dynamoDBClient);
        expect(retrievedTokenGenStatesEntries).toEqual(
          expect.arrayContaining([
            tokenGenStatesConsumerClient1,
            tokenGenStatesConsumerClient2,
          ])
        );
      });

      describe("(published -> suspended)", () => {
        it("should update the entry if the incoming version is more recent than the existing table entry", async () => {
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
          await writePlatformCatalogEntry(previousStateEntry, dynamoDBClient);

          // token-generation-states
          const tokenGenStatesEntryPK1 =
            makeTokenGenerationStatesClientKidPurposePK({
              clientId: generateId(),
              kid: `kid ${Math.random()}`,
              purposeId: generateId(),
            });
          const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
            eserviceId: eservice.id,
            descriptorId: suspendedDescriptor.id,
          });
          const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
            {
              ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
              descriptorState: itemState.active,
              descriptorAudience: suspendedDescriptor.audience,
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
              descriptorState: itemState.active,
              descriptorAudience: suspendedDescriptor.audience,
              GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
            };
          await writeTokenGenStatesConsumerClient(
            tokenGenStatesConsumerClient2,
            dynamoDBClient
          );
          await handleMessageV1(message, dynamoDBClient, genericLogger);

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
          const retrievedTokenGenStatesEntries =
            await readAllTokenGenStatesItems(dynamoDBClient);
          const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
            {
              ...tokenGenStatesConsumerClient1,
              descriptorState: itemState.inactive,
              updatedAt: new Date().toISOString(),
            };
          const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
            {
              ...tokenGenStatesConsumerClient2,
              descriptorState: itemState.inactive,
              updatedAt: new Date().toISOString(),
            };
          expect(retrievedTokenGenStatesEntries).toEqual(
            expect.arrayContaining([
              expectedTokenGenStatesConsumeClient1,
              expectedTokenGenStatesConsumeClient2,
            ])
          );
        });

        it("should do no operation if the existing table entry is more recent", async () => {
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

          await writePlatformCatalogEntry(previousStateEntry, dynamoDBClient);

          // token-generation-states
          const tokenGenStatesEntryPK1 =
            makeTokenGenerationStatesClientKidPurposePK({
              clientId: generateId(),
              kid: `kid ${Math.random()}`,
              purposeId: generateId(),
            });
          const tokenGenStatesEntryPK2 =
            makeTokenGenerationStatesClientKidPurposePK({
              clientId: generateId(),
              kid: `kid ${Math.random()}`,
              purposeId: generateId(),
            });
          const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
            eserviceId: eservice.id,
            descriptorId: suspendedDescriptor.id,
          });
          const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
            {
              ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
              descriptorState: itemState.active,
              descriptorAudience: suspendedDescriptor.audience,
              GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
            };
          await writeTokenGenStatesConsumerClient(
            tokenGenStatesConsumerClient1,
            dynamoDBClient
          );
          const tokenGenStatesConsumerClient2: TokenGenerationStatesConsumerClient =
            {
              ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK2),
              descriptorState: itemState.active,
              descriptorAudience: suspendedDescriptor.audience,
              GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
            };
          await writeTokenGenStatesConsumerClient(
            tokenGenStatesConsumerClient2,
            dynamoDBClient
          );

          await handleMessageV1(message, dynamoDBClient, genericLogger);

          const retrievedEntry = await readCatalogEntry(
            primaryKey,
            dynamoDBClient
          );
          expect(retrievedEntry).toEqual(previousStateEntry);

          // token-generation-states
          const retrievedTokenGenStatesEntries =
            await readAllTokenGenStatesItems(dynamoDBClient);
          expect(retrievedTokenGenStatesEntries).toEqual(
            expect.arrayContaining([
              tokenGenStatesConsumerClient1,
              tokenGenStatesConsumerClient2,
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

          await handleMessageV1(message, dynamoDBClient, genericLogger);

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
      await writePlatformCatalogEntry(previousStateEntry, dynamoDBClient);

      // token-generation-states
      const tokenGenStatesEntryPK1 =
        makeTokenGenerationStatesClientKidPurposePK({
          clientId: generateId(),
          kid: `kid ${Math.random()}`,
          purposeId: generateId(),
        });
      const eserviceId_descriptorId = makeGSIPKEServiceIdDescriptorId({
        eserviceId: eservice.id,
        descriptorId: archivedDescriptor.id,
      });
      const tokenGenStatesConsumerClient1: TokenGenerationStatesConsumerClient =
        {
          ...getMockTokenGenStatesConsumerClient(tokenGenStatesEntryPK1),
          descriptorState: itemState.active,
          descriptorAudience: archivedDescriptor.audience,
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
          descriptorState: itemState.active,
          descriptorAudience: archivedDescriptor.audience,
          GSIPK_eserviceId_descriptorId: eserviceId_descriptorId,
        };
      await writeTokenGenStatesConsumerClient(
        tokenGenStatesConsumerClient2,
        dynamoDBClient
      );

      await handleMessageV1(message, dynamoDBClient, genericLogger);

      const retrievedEntry = await readCatalogEntry(primaryKey, dynamoDBClient);
      expect(retrievedEntry).toBeUndefined();

      // token-generation-states
      const retrievedTokenGenStatesEntries =
        await readAllTokenGenStatesItems(dynamoDBClient);
      const expectedTokenGenStatesConsumeClient1: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient1,
          descriptorState: itemState.inactive,
          updatedAt: new Date().toISOString(),
        };
      const expectedTokenGenStatesConsumeClient2: TokenGenerationStatesConsumerClient =
        {
          ...tokenGenStatesConsumerClient2,
          descriptorState: itemState.inactive,
          updatedAt: new Date().toISOString(),
        };
      expect(retrievedTokenGenStatesEntries).toEqual(
        expect.arrayContaining([
          expectedTokenGenStatesConsumeClient1,
          expectedTokenGenStatesConsumeClient2,
        ])
      );
    });
  });
});

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-floating-promises */
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
  AgreementCollection,
  AttributeCollection,
  AuthData,
  EServiceCollection,
  FileManager,
  ReadModelRepository,
  TenantCollection,
  initDB,
  initFileManager,
  userRoles,
} from "pagopa-interop-commons";
import { IDatabase } from "pg-promise";
import {
  Attribute,
  ClonedEServiceAddedV1,
  Descriptor,
  Document,
  EService,
  EServiceAddedV1,
  EServiceDeletedV1,
  EServiceDescriptorAddedV1,
  EServiceDescriptorUpdatedV1,
  EServiceDocumentAddedV1,
  EServiceDocumentDeletedV1,
  EServiceDocumentUpdatedV1,
  EServiceId,
  EServiceUpdatedV1,
  EServiceWithDescriptorsDeletedV1,
  Tenant,
  TenantId,
  agreementState,
  descriptorState,
  eserviceMode,
  generateId,
  operationForbidden,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  TEST_MINIO_PORT,
  TEST_MONGO_DB_PORT,
  TEST_POSTGRES_DB_PORT,
  decodeProtobufPayload,
  minioContainer,
  mongoDBContainer,
  postgreSQLContainer,
} from "pagopa-interop-commons-test";
import { StartedTestContainer } from "testcontainers";
import { config } from "../src/utilities/config.js";
import {
  toDescriptorV1,
  toDocumentV1,
  toEServiceV1,
} from "../src/model/domain/toEvent.js";
import {
  EServiceDescriptorSeed,
  UpdateEServiceDescriptorQuotasSeed,
} from "../src/model/domain/models.js";
import {
  ReadModelService,
  readModelServiceBuilder,
} from "../src/services/readModelService.js";
import {
  CatalogService,
  catalogServiceBuilder,
} from "../src/services/catalogService.js";
import {
  attributeNotFound,
  dailyCallsCannotBeDecreased,
  draftDescriptorAlreadyExists,
  eServiceCannotBeDeleted,
  eServiceCannotBeUpdated,
  eServiceDescriptorNotFound,
  eServiceDescriptorWithoutInterface,
  eServiceDocumentNotFound,
  eServiceDuplicate,
  eServiceNotFound,
  inconsistentDailyCalls,
  interfaceAlreadyExists,
  notValidDescriptor,
  originNotCompliant,
} from "../src/model/domain/errors.js";
import { formatClonedEServiceDate } from "../src/utilities/date.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  buildDescriptorSeed,
  getMockAgreement,
  getMockAuthData,
  getMockDescriptor,
  getMockDocument,
  getMockEService,
  buildInterfaceSeed,
  getMockTenant,
  readLastEventByStreamId,
  addOneAttribute,
  getMockEServiceAttributes,
} from "./utils.js";

const mockEService = getMockEService();
const mockDescriptor = getMockDescriptor();
const mockDocument = getMockDocument();

describe("database test", async () => {
  let eservices: EServiceCollection;
  let agreements: AgreementCollection;
  let attributes: AttributeCollection;
  let tenants: TenantCollection;
  let readModelService: ReadModelService;
  let catalogService: CatalogService;
  let postgresDB: IDatabase<unknown>;
  let startedPostgreSqlContainer: StartedTestContainer;
  let startedMongodbContainer: StartedTestContainer;
  let startedMinioContainer: StartedTestContainer;
  let fileManager: FileManager;

  beforeAll(async () => {
    startedPostgreSqlContainer = await postgreSQLContainer(config).start();
    startedMongodbContainer = await mongoDBContainer(config).start();
    startedMinioContainer = await minioContainer(config).start();

    config.eventStoreDbPort = startedPostgreSqlContainer.getMappedPort(
      TEST_POSTGRES_DB_PORT
    );
    config.readModelDbPort =
      startedMongodbContainer.getMappedPort(TEST_MONGO_DB_PORT);
    config.s3ServerPort = startedMinioContainer.getMappedPort(TEST_MINIO_PORT);

    const readModelRepository = ReadModelRepository.init(config);
    eservices = readModelRepository.eservices;
    agreements = readModelRepository.agreements;
    tenants = readModelRepository.tenants;
    attributes = readModelRepository.attributes;
    readModelService = readModelServiceBuilder(readModelRepository);
    postgresDB = initDB({
      username: config.eventStoreDbUsername,
      password: config.eventStoreDbPassword,
      host: config.eventStoreDbHost,
      port: config.eventStoreDbPort,
      database: config.eventStoreDbName,
      schema: config.eventStoreDbSchema,
      useSSL: config.eventStoreDbUseSSL,
    });
    fileManager = initFileManager(config);
    catalogService = catalogServiceBuilder(
      postgresDB,
      readModelService,
      fileManager
    );
  });

  afterEach(async () => {
    await eservices.deleteMany({});
    await agreements.deleteMany({});
    await tenants.deleteMany({});
    await attributes.deleteMany({});

    await postgresDB.none("TRUNCATE TABLE catalog.events RESTART IDENTITY");
    await postgresDB.none("TRUNCATE TABLE agreement.events RESTART IDENTITY");
  });

  afterAll(async () => {
    await startedPostgreSqlContainer.stop();
    await startedMongodbContainer.stop();
    await startedMinioContainer.stop();
  });

  describe("Catalog service", () => {
    describe("create eService", () => {
      it("should write on event-store for the creation of an eService", async () => {
        const id = await catalogService.createEService(
          {
            name: mockEService.name,
            description: mockEService.description,
            technology: "REST",
            mode: "DELIVER",
          },
          getMockAuthData(mockEService.producerId)
        );

        expect(id).toBeDefined();
        const writtenEvent = await readLastEventByStreamId(id, postgresDB);
        expect(writtenEvent.stream_id).toBe(id);
        expect(writtenEvent.version).toBe("0");
        expect(writtenEvent.type).toBe("EServiceAdded");
        expect(writtenEvent.event_version).toBe(1);
        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceAddedV1,
          payload: writtenEvent.data,
        });

        const eService: EService = {
          ...mockEService,
          createdAt: new Date(Number(writtenPayload.eService?.createdAt)),
          id,
        };

        expect(writtenPayload.eService).toEqual(toEServiceV1(eService));
      });

      it("should throw eServiceDuplicate if an eService with the same name already exists", async () => {
        await addOneEService(mockEService, postgresDB, eservices);
        expect(
          catalogService.createEService(
            {
              name: mockEService.name,
              description: mockEService.description,
              technology: "REST",
              mode: "DELIVER",
            },
            getMockAuthData(mockEService.producerId)
          )
        ).rejects.toThrowError(eServiceDuplicate(mockEService.name));
      });

      it("should throw originNotCompliant if the requester externalId origin is not IPA", async () => {
        expect(
          catalogService.createEService(
            {
              name: mockEService.name,
              description: mockEService.description,
              technology: "REST",
              mode: "DELIVER",
            },
            {
              ...getMockAuthData(mockEService.producerId),
              externalId: { ...getMockAuthData().externalId, origin: "" },
            }
          )
        ).rejects.toThrowError(originNotCompliant("IPA"));
      });
    });

    describe("update eService", () => {
      it("should write on event-store for the update of an eService (no technology change)", async () => {
        const deleteFile = vi.spyOn(fileManager, "delete");
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
          interface: mockDocument,
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        const updatedName = "eService new name";
        await addOneEService(eservice, postgresDB, eservices);
        await catalogService.updateEService(
          mockEService.id,
          {
            name: updatedName,
            description: mockEService.description,
            technology: "REST",
            mode: "DELIVER",
          },
          getMockAuthData(mockEService.producerId)
        );

        const updatedEService: EService = {
          ...eservice,
          name: updatedName,
        };

        const writtenEvent = await readLastEventByStreamId(
          mockEService.id,
          postgresDB
        );
        expect(writtenEvent.stream_id).toBe(mockEService.id);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceUpdated");
        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceUpdatedV1,
          payload: writtenEvent.data,
        });

        expect(writtenPayload.eService).toEqual(toEServiceV1(updatedEService));
        expect(deleteFile).not.toHaveBeenCalled();
      });

      it("should write on event-store for the update of an eService (technology change: interface has to be deleted)", async () => {
        const deleteFile = vi.spyOn(fileManager, "delete");
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
          interface: mockDocument,
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        const updatedName = "eService new name";
        await addOneEService(eservice, postgresDB, eservices);
        await catalogService.updateEService(
          mockEService.id,
          {
            name: updatedName,
            description: mockEService.description,
            technology: "SOAP",
            mode: "RECEIVE",
          },
          getMockAuthData(mockEService.producerId)
        );

        const updatedEService: EService = {
          ...eservice,
          name: updatedName,
          technology: "Soap",
        };

        const writtenEvent = await readLastEventByStreamId(
          mockEService.id,
          postgresDB
        );
        expect(writtenEvent.stream_id).toBe(mockEService.id);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceUpdated");
        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceUpdatedV1,
          payload: writtenEvent.data,
        });

        expect(writtenPayload.eService).toEqual(toEServiceV1(updatedEService));
        expect(deleteFile).toHaveBeenCalledWith(
          config.s3Bucket,
          mockDocument.path
        );
      });

      it("should write on event-store for the update of an eService (update description only)", async () => {
        const updatedDescription = "eService new description";
        await addOneEService(mockEService, postgresDB, eservices);
        await catalogService.updateEService(
          mockEService.id,
          {
            name: mockEService.name,
            description: updatedDescription,
            technology: "REST",
            mode: "DELIVER",
          },
          getMockAuthData(mockEService.producerId)
        );

        const updatedEService: EService = {
          ...mockEService,
          description: updatedDescription,
        };

        const writtenEvent = await readLastEventByStreamId(
          mockEService.id,
          postgresDB
        );
        expect(writtenEvent.stream_id).toBe(mockEService.id);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceUpdated");
        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceUpdatedV1,
          payload: writtenEvent.data,
        });

        expect(writtenPayload.eService).toEqual(toEServiceV1(updatedEService));
      });

      it("should throw eServiceNotFound if the eService doesn't exist", async () => {
        expect(
          catalogService.updateEService(
            mockEService.id,
            {
              name: "eService new name",
              description: "eService description",
              technology: "REST",
              mode: "DELIVER",
            },
            getMockAuthData(mockEService.producerId)
          )
        ).rejects.toThrowError(eServiceNotFound(mockEService.id));
      });

      it("should throw operationForbidden if the requester is not the producer", async () => {
        await addOneEService(mockEService, postgresDB, eservices);

        expect(
          catalogService.updateEService(
            mockEService.id,
            {
              name: "eService new name",
              description: "eService description",
              technology: "REST",
              mode: "DELIVER",
            },
            getMockAuthData()
          )
        ).rejects.toThrowError(operationForbidden);
      });

      it("should throw eServiceDuplicate if the updated name is already in use", async () => {
        const eService1: EService = {
          ...mockEService,
          id: generateId(),
          descriptors: [],
        };
        const eService2: EService = {
          ...mockEService,
          id: generateId(),
          name: "eService name already in use",
          descriptors: [],
        };
        await addOneEService(eService1, postgresDB, eservices);
        await addOneEService(eService2, postgresDB, eservices);

        expect(
          catalogService.updateEService(
            eService1.id,
            {
              name: "eService name already in use",
              description: "eService description",
              technology: "REST",
              mode: "DELIVER",
            },
            getMockAuthData(eService1.producerId)
          )
        ).rejects.toThrowError(
          eServiceDuplicate("eService name already in use")
        );
      });

      it("should throw eServiceCannotBeUpdated if the eService descriptor is in published state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.published,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.updateEService(
            eService.id,
            {
              name: "eService new name",
              description: "eService description",
              technology: "REST",
              mode: "DELIVER",
            },
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(eServiceCannotBeUpdated(eService.id));
      });

      it("should throw eServiceCannotBeUpdated if the eService descriptor is in archived state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.archived,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.updateEService(
            eService.id,
            {
              name: "eService new name",
              description: "eService description",
              technology: "REST",
              mode: "DELIVER",
            },
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(eServiceCannotBeUpdated(eService.id));
      });

      it("should throw eServiceCannotBeUpdated if the eService descriptor is in suspended state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.suspended,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.updateEService(
            eService.id,
            {
              name: "eService new name",
              description: "eService description",
              technology: "REST",
              mode: "DELIVER",
            },
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(eServiceCannotBeUpdated(eService.id));
      });

      it("should throw eServiceCannotBeUpdated if the eService descriptor is in deprecated state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.deprecated,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.updateEService(
            eService.id,
            {
              name: "eService new name",
              description: "eService description",
              technology: "REST",
              mode: "DELIVER",
            },
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(eServiceCannotBeUpdated(eService.id));
      });
    });

    describe("delete eService", () => {
      it("should write on event-store for the deletion of an eService", async () => {
        await addOneEService(mockEService, postgresDB, eservices);
        await catalogService.deleteEService(
          mockEService.id,
          getMockAuthData(mockEService.producerId)
        );
        const writtenEvent = await readLastEventByStreamId(
          mockEService.id,
          postgresDB
        );
        expect(writtenEvent.stream_id).toBe(mockEService.id);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceDeleted");
        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceDeletedV1,
          payload: writtenEvent.data,
        });
        expect(writtenPayload.eServiceId).toBe(mockEService.id);
      });

      it("should throw eServiceNotFound if the eService doesn't exist", () => {
        expect(
          catalogService.deleteEService(
            mockEService.id,
            getMockAuthData(mockEService.producerId)
          )
        ).rejects.toThrowError(eServiceNotFound(mockEService.id));
      });

      it("should throw operationForbidden if the requester is not the producer", async () => {
        await addOneEService(mockEService, postgresDB, eservices);
        expect(
          catalogService.deleteEService(mockEService.id, getMockAuthData())
        ).rejects.toThrowError(operationForbidden);
      });

      it("should throw eServiceCannotBeDeleted if the eService has a descriptor", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.published,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.deleteEService(
            eService.id,
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(eServiceCannotBeDeleted(eService.id));
      });
    });

    describe("create descriptor", async () => {
      it("should write on event-store for the creation of a descriptor", async () => {
        const attribute: Attribute = {
          name: "Attribute name",
          id: generateId(),
          kind: "Declared",
          description: "Attribute Description",
          creationTime: new Date(),
        };
        await addOneAttribute(attribute, attributes);
        const descriptorSeed: EServiceDescriptorSeed = {
          ...buildDescriptorSeed(mockDescriptor),
          attributes: {
            certified: [],
            declared: [
              [{ id: attribute.id, explicitAttributeVerification: false }],
            ],
            verified: [],
          },
        };
        await addOneEService(mockEService, postgresDB, eservices);
        await catalogService.createDescriptor(
          mockEService.id,
          descriptorSeed,
          getMockAuthData(mockEService.producerId)
        );
        const writtenEvent = await readLastEventByStreamId(
          mockEService.id,
          postgresDB
        );
        expect(writtenEvent.stream_id).toBe(mockEService.id);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceDescriptorAdded");
        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceDescriptorAddedV1,
          payload: writtenEvent.data,
        });

        const descriptor: Descriptor = {
          ...mockDescriptor,
          createdAt: new Date(
            Number(writtenPayload.eServiceDescriptor?.createdAt)
          ),
          id: unsafeBrandId(writtenPayload.eServiceDescriptor!.id),
          serverUrls: [],
          attributes: {
            certified: [],
            declared: [
              [{ id: attribute.id, explicitAttributeVerification: false }],
            ],
            verified: [],
          },
        };

        expect(writtenPayload.eServiceId).toEqual(mockEService.id);
        expect(writtenPayload.eServiceDescriptor).toEqual(
          toDescriptorV1(descriptor)
        );
      });

      it("should throw draftDescriptorAlreadyExists if a draft descriptor already exists", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };

        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.createDescriptor(
            eService.id,
            buildDescriptorSeed(descriptor),
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(draftDescriptorAlreadyExists(eService.id));
      });

      it("should throw eServiceNotFound if the eService doesn't exist", async () => {
        expect(
          catalogService.createDescriptor(
            mockEService.id,
            buildDescriptorSeed(mockDescriptor),
            getMockAuthData(mockEService.producerId)
          )
        ).rejects.toThrowError(eServiceNotFound(mockEService.id));
      });
      it("should throw attributeNotFound if at least one of the attributes don't exist", async () => {
        const eService: EService = {
          ...mockEService,
          descriptors: [],
        };
        await addOneEService(eService, postgresDB, eservices);

        const attribute: Attribute = {
          name: "Attribute name",
          id: generateId(),
          kind: "Declared",
          description: "Attribute Description",
          creationTime: new Date(),
        };
        await addOneAttribute(attribute, attributes);
        const notExistingId1 = generateId();
        const notExistingId2 = generateId();
        const descriptorSeed = {
          ...buildDescriptorSeed(mockDescriptor),
          attributes: {
            certified: [],
            declared: [
              [
                { id: attribute.id, explicitAttributeVerification: false },
                {
                  id: notExistingId1,
                  explicitAttributeVerification: false,
                },
                {
                  id: notExistingId2,
                  explicitAttributeVerification: false,
                },
              ],
            ],
            verified: [],
          },
        };

        expect(
          catalogService.createDescriptor(
            eService.id,
            descriptorSeed,
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(attributeNotFound(notExistingId1));
      });
      it("should throw operationForbidden if the requester is not the producer", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.published,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.createDescriptor(
            eService.id,
            buildDescriptorSeed(descriptor),
            getMockAuthData()
          )
        ).rejects.toThrowError(operationForbidden);
      });
      it("should throw inconsistentDailyCalls if dailyCallsPerConsumer is greater than dailyCallsTotal", async () => {
        const descriptorSeed: EServiceDescriptorSeed = {
          ...buildDescriptorSeed(mockDescriptor),
          dailyCallsPerConsumer: 100,
          dailyCallsTotal: 50,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [],
        };

        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.createDescriptor(
            eService.id,
            descriptorSeed,
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(inconsistentDailyCalls());
      });
    });

    describe("update draft descriptor", () => {
      it("should write on event-store for the update of a draft descriptor", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);

        const updatedDescriptorSeed: EServiceDescriptorSeed = {
          ...buildDescriptorSeed(descriptor),
          dailyCallsTotal: 200,
        };

        const updatedEService: EService = {
          ...eService,
          descriptors: [
            {
              ...descriptor,
              dailyCallsTotal: 200,
            },
          ],
        };
        await catalogService.updateDraftDescriptor(
          eService.id,
          descriptor.id,
          updatedDescriptorSeed,
          getMockAuthData(eService.producerId)
        );
        const writtenEvent = await readLastEventByStreamId(
          eService.id,
          postgresDB
        );
        expect(writtenEvent.stream_id).toBe(eService.id);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceUpdated");
        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceUpdatedV1,
          payload: writtenEvent.data,
        });
        expect(writtenPayload.eService).toEqual(toEServiceV1(updatedEService));
      });

      it("should throw eServiceNotFound if the eService doesn't exist", () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.published,
        };
        expect(
          catalogService.updateDraftDescriptor(
            mockEService.id,
            descriptor.id,
            buildDescriptorSeed(descriptor),
            getMockAuthData(mockEService.producerId)
          )
        ).rejects.toThrowError(eServiceNotFound(mockEService.id));
      });

      it("should throw eServiceDescriptorNotFound if the descriptor doesn't exist", async () => {
        const eService: EService = {
          ...mockEService,
          descriptors: [],
        };
        await addOneEService(eService, postgresDB, eservices);

        expect(
          catalogService.updateDraftDescriptor(
            mockEService.id,
            mockDescriptor.id,
            buildDescriptorSeed(mockDescriptor),
            getMockAuthData(mockEService.producerId)
          )
        ).rejects.toThrowError(
          eServiceDescriptorNotFound(eService.id, mockDescriptor.id)
        );
      });

      it("should throw notValidDescriptor if the descriptor is in published state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.published,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);

        expect(
          catalogService.updateDraftDescriptor(
            eService.id,
            descriptor.id,
            buildDescriptorSeed(descriptor),
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(
          notValidDescriptor(mockDescriptor.id, descriptorState.published)
        );
      });

      it("should throw notValidDescriptor if the descriptor is in deprecated state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.deprecated,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);

        expect(
          catalogService.updateDraftDescriptor(
            eService.id,
            descriptor.id,
            buildDescriptorSeed(descriptor),
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(
          notValidDescriptor(mockDescriptor.id, descriptorState.deprecated)
        );
      });

      it("should throw notValidDescriptor if the descriptor is in suspended state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.suspended,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);

        expect(
          catalogService.updateDraftDescriptor(
            eService.id,
            descriptor.id,
            buildDescriptorSeed(descriptor),
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(
          notValidDescriptor(mockDescriptor.id, descriptorState.suspended)
        );
      });

      it("should throw notValidDescriptor if the descriptor is in archived state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.archived,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);

        expect(
          catalogService.updateDraftDescriptor(
            eService.id,
            descriptor.id,
            buildDescriptorSeed(descriptor),
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(
          notValidDescriptor(mockDescriptor.id, descriptorState.archived)
        );
      });

      it("should throw operationForbidden if the requester is not the producer", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);

        const updatedDescriptor = {
          ...descriptor,
          dailyCallsTotal: 200,
        };
        expect(
          catalogService.updateDraftDescriptor(
            eService.id,
            descriptor.id,
            buildDescriptorSeed(updatedDescriptor),
            getMockAuthData()
          )
        ).rejects.toThrowError(operationForbidden);
      });
      it("should throw inconsistentDailyCalls if dailyCallsPerConsumer is greater than dailyCallsTotal", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);

        const updatedDescriptor: Descriptor = {
          ...descriptor,
          dailyCallsPerConsumer: 100,
          dailyCallsTotal: 50,
        };
        expect(
          catalogService.updateDraftDescriptor(
            eService.id,
            descriptor.id,
            buildDescriptorSeed(updatedDescriptor),
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(inconsistentDailyCalls());
      });
    });

    describe("delete draft descriptor", () => {
      it("should write on event-store for the deletion of a draft descriptor (no interface nor documents to delete)", async () => {
        vi.spyOn(fileManager, "delete");
        const descriptor: Descriptor = {
          ...mockDescriptor,
          docs: [document1, document2],
          interface: interfaceDocument,
          state: descriptorState.draft,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);

        await fileManager.storeBytes(
          config.s3Bucket,
          config.eserviceDocumentsPath,
          interfaceDocument.id,
          interfaceDocument.name,
          Buffer.from("testtest")
        );

        await fileManager.storeBytes(
          config.s3Bucket,
          config.eserviceDocumentsPath,
          document1.id,
          document1.name,
          Buffer.from("testtest")
        );

        await fileManager.storeBytes(
          config.s3Bucket,
          config.eserviceDocumentsPath,
          document2.id,
          document2.name,
          Buffer.from("testtest")
        );

        expect(await fileManager.listFiles(config.s3Bucket)).toContain(
          interfaceDocument.path
        );
        expect(await fileManager.listFiles(config.s3Bucket)).toContain(
          document1.path
        );
        expect(await fileManager.listFiles(config.s3Bucket)).toContain(
          document2.path
        );

        await catalogService.deleteDraftDescriptor(
          eService.id,
          descriptor.id,
          getMockAuthData(eService.producerId)
        );

        const writtenEvent = await readLastEventByStreamId(
          eService.id,
          postgresDB
        );
        expect(writtenEvent.stream_id).toBe(eService.id);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceWithDescriptorsDeleted");
        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceWithDescriptorsDeletedV1,
          payload: writtenEvent.data,
        });
        expect(writtenPayload.eService).toEqual(toEServiceV1(eService));
        expect(writtenPayload.descriptorId).toEqual(descriptor.id);
        expect(fileManager.delete).not.toHaveBeenCalled();
      });

      it("should write on event-store for the deletion of a draft descriptor (with interface and document to delete), and delete documents and interface files from the bucket", async () => {
        vi.spyOn(fileManager, "delete");

        const document1 = {
          ...mockDocument,
          name: `${mockDocument.name}_1`,
          path: `${config.eserviceDocumentsPath}/${mockDocument.id}/${mockDocument.name}_1`,
        };
        const document2 = {
          ...mockDocument,
          name: `${mockDocument.name}_2`,
          path: `${config.eserviceDocumentsPath}/${mockDocument.id}/${mockDocument.name}_2`,
        };
        const interfaceDocument = {
          ...mockDocument,
          name: `${mockDocument.name}_interface`,
          path: `${config.eserviceDocumentsPath}/${mockDocument.id}/${mockDocument.name}_interface`,
        };

        const descriptor: Descriptor = {
          ...mockDescriptor,
          docs: [document1, document2],
          interface: interfaceDocument,
          state: descriptorState.draft,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);

        await fileManager.storeBytes(
          config.s3Bucket,
          config.eserviceDocumentsPath,
          interfaceDocument.id,
          interfaceDocument.name,
          Buffer.from("testtest")
        );

        await fileManager.storeBytes(
          config.s3Bucket,
          config.eserviceDocumentsPath,
          document1.id,
          document1.name,
          Buffer.from("testtest")
        );

        await fileManager.storeBytes(
          config.s3Bucket,
          config.eserviceDocumentsPath,
          document2.id,
          document2.name,
          Buffer.from("testtest")
        );

        expect(await fileManager.listFiles(config.s3Bucket)).toContain(
          interfaceDocument.path
        );
        expect(await fileManager.listFiles(config.s3Bucket)).toContain(
          document1.path
        );
        expect(await fileManager.listFiles(config.s3Bucket)).toContain(
          document2.path
        );

        await catalogService.deleteDraftDescriptor(
          eService.id,
          descriptor.id,
          getMockAuthData(eService.producerId)
        );

        const writtenEvent = await readLastEventByStreamId(
          eService.id,
          postgresDB
        );
        expect(writtenEvent.stream_id).toBe(eService.id);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceWithDescriptorsDeleted");
        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceWithDescriptorsDeletedV1,
          payload: writtenEvent.data,
        });
        expect(writtenPayload.eService).toEqual(toEServiceV1(eService));
        expect(writtenPayload.descriptorId).toEqual(descriptor.id);

        expect(fileManager.delete).toHaveBeenCalledWith(
          config.s3Bucket,
          interfaceDocument.path
        );
        expect(fileManager.delete).toHaveBeenCalledWith(
          config.s3Bucket,
          document1.path
        );
        expect(fileManager.delete).toHaveBeenCalledWith(
          config.s3Bucket,
          document2.path
        );

        expect(await fileManager.listFiles(config.s3Bucket)).not.toContain(
          interfaceDocument.path
        );
        expect(await fileManager.listFiles(config.s3Bucket)).not.toContain(
          document1.path
        );
        expect(await fileManager.listFiles(config.s3Bucket)).not.toContain(
          document2.path
        );
      });

      it("should fail if one of the file deletions fails", async () => {
        vi.spyOn(fileManager, "delete").mockRejectedValueOnce(
          new Error("Failed to delete file")
        );

        const descriptor: Descriptor = {
          ...mockDescriptor,
          docs: [mockDocument, mockDocument],
          state: descriptorState.draft,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);

        await expect(
          catalogService.deleteDraftDescriptor(
            eService.id,
            descriptor.id,
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError("Failed to delete file");
      });

      it("should throw eServiceNotFound if the eService doesn't exist", () => {
        expect(
          catalogService.deleteDraftDescriptor(
            mockEService.id,
            mockDescriptor.id,
            getMockAuthData(mockEService.producerId)
          )
        ).rejects.toThrowError(eServiceNotFound(mockEService.id));
      });

      it("should throw eServiceDescriptorNotFound if the descriptor doesn't exist", async () => {
        const eService: EService = {
          ...mockEService,
          descriptors: [],
        };
        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.deleteDraftDescriptor(
            mockEService.id,
            mockDescriptor.id,
            getMockAuthData(mockEService.producerId)
          )
        ).rejects.toThrowError(
          eServiceDescriptorNotFound(eService.id, mockDescriptor.id)
        );
      });

      it("should throw operationForbidden if the requester is not the producer", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.deleteDraftDescriptor(
            eService.id,
            descriptor.id,
            getMockAuthData()
          )
        ).rejects.toThrowError(operationForbidden);
      });
    });

    describe("publish descriptor", () => {
      it("should write on event-store for the publication of a descriptor", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
          interface: {
            name: "interface name",
            path: "pagopa.it",
            id: generateId(),
            prettyName: "",
            contentType: "json",
            checksum: generateId(),
            uploadDate: new Date(),
          },
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);
        await catalogService.publishDescriptor(
          eService.id,
          descriptor.id,
          getMockAuthData(eService.producerId)
        );

        const writtenEvent = await readLastEventByStreamId(
          eService.id,
          postgresDB
        );
        expect(writtenEvent.stream_id).toBe(eService.id);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceDescriptorUpdated");
        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceDescriptorUpdatedV1,
          payload: writtenEvent.data,
        });

        const updatedDescriptor: Descriptor = {
          ...descriptor,
          publishedAt: new Date(
            Number(writtenPayload.eServiceDescriptor?.publishedAt)
          ),
          state: descriptorState.published,
        };

        const expectedDescriptorV1 = toDescriptorV1(updatedDescriptor);
        expect(writtenPayload.eServiceId).toEqual(eService.id);
        expect(writtenPayload.eServiceDescriptor).toEqual(expectedDescriptorV1);
      });

      it("should throw eServiceNotFound if the eService doesn't exist", async () => {
        await expect(
          catalogService.publishDescriptor(
            mockEService.id,
            mockDescriptor.id,
            getMockAuthData(mockEService.producerId)
          )
        ).rejects.toThrowError(eServiceNotFound(mockEService.id));
      });

      it("should throw eServiceDescriptorNotFound if the descriptor doesn't exist", async () => {
        const eService: EService = {
          ...mockEService,
          descriptors: [],
        };
        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.publishDescriptor(
            eService.id,
            mockDescriptor.id,
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(
          eServiceDescriptorNotFound(eService.id, mockDescriptor.id)
        );
      });

      it("should throw operationForbidden if the requester is not the producer", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.publishDescriptor(
            eService.id,
            descriptor.id,
            getMockAuthData()
          )
        ).rejects.toThrowError(operationForbidden);
      });

      it("should throw notValidDescriptor if the descriptor is in published state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.published,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.publishDescriptor(
            eService.id,
            descriptor.id,
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(
          notValidDescriptor(descriptor.id, descriptorState.published)
        );
      });

      it("should throw notValidDescriptor if the descriptor is in deprecated state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.deprecated,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.publishDescriptor(
            eService.id,
            descriptor.id,
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(
          notValidDescriptor(descriptor.id, descriptorState.deprecated)
        );
      });

      it("should throw notValidDescriptor if the descriptor is in suspended state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.suspended,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.publishDescriptor(
            eService.id,
            descriptor.id,
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(
          notValidDescriptor(descriptor.id, descriptorState.suspended)
        );
      });

      it("should throw notValidDescriptor if the descriptor is in archived state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.archived,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.publishDescriptor(
            eService.id,
            descriptor.id,
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(
          notValidDescriptor(descriptor.id, descriptorState.archived)
        );
      });

      it("should throw eServiceDescriptorWithoutInterface if the descriptor doesn't have an interface", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);

        expect(
          catalogService.publishDescriptor(
            eService.id,
            descriptor.id,
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(
          eServiceDescriptorWithoutInterface(descriptor.id)
        );
      });
    });

    describe("suspend descriptor", () => {
      it("should write on event-store for the suspension of a descriptor", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.published,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);
        await catalogService.suspendDescriptor(
          eService.id,
          descriptor.id,
          getMockAuthData(eService.producerId)
        );

        const writtenEvent = await readLastEventByStreamId(
          eService.id,
          postgresDB
        );
        expect(writtenEvent.stream_id).toBe(eService.id);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceDescriptorUpdated");
        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceDescriptorUpdatedV1,
          payload: writtenEvent.data,
        });

        const updatedDescriptor = {
          ...descriptor,
          state: descriptorState.suspended,
          suspendedAt: new Date(
            Number(writtenPayload.eServiceDescriptor?.suspendedAt)
          ),
        };

        expect(writtenPayload.eServiceId).toEqual(eService.id);
        expect(writtenPayload.eServiceDescriptor).toEqual(
          toDescriptorV1(updatedDescriptor)
        );
      });

      it("should throw eServiceNotFound if the eService doesn't exist", () => {
        expect(
          catalogService.suspendDescriptor(
            mockEService.id,
            mockDescriptor.id,
            getMockAuthData(mockEService.producerId)
          )
        ).rejects.toThrowError(eServiceNotFound(mockEService.id));
      });

      it("should throw operationForbidden if the requester is not the producer", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.published,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.suspendDescriptor(
            eService.id,
            descriptor.id,
            getMockAuthData()
          )
        ).rejects.toThrowError(operationForbidden);
      });

      it("should throw eServiceDescriptorNotFound if the descriptor doesn't exist", async () => {
        const eService: EService = {
          ...mockEService,
          descriptors: [],
        };
        await addOneEService(eService, postgresDB, eservices);

        expect(
          catalogService.suspendDescriptor(
            eService.id,
            mockDescriptor.id,
            getMockAuthData(mockEService.producerId)
          )
        ).rejects.toThrowError(
          eServiceDescriptorNotFound(eService.id, mockDescriptor.id)
        );
      });

      it("should throw notValidDescriptor if the descriptor is in draft state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.suspendDescriptor(
            eService.id,
            descriptor.id,
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(
          notValidDescriptor(descriptor.id, descriptorState.draft)
        );
      });

      it("should throw notValidDescriptor if the descriptor is in suspended state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.suspended,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.suspendDescriptor(
            eService.id,
            descriptor.id,
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(
          notValidDescriptor(descriptor.id, descriptorState.suspended)
        );
      });

      it("should throw notValidDescriptor if the descriptor is in archived state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.archived,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.suspendDescriptor(
            eService.id,
            descriptor.id,
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(
          notValidDescriptor(descriptor.id, descriptorState.archived)
        );
      });
    });

    describe("activate descriptor", () => {
      it("should write on event-store for the activation of a descriptor", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.suspended,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);
        await catalogService.activateDescriptor(
          eService.id,
          descriptor.id,
          getMockAuthData(eService.producerId)
        );

        const updatedDescriptor = {
          ...descriptor,
          state: descriptorState.published,
        };

        const writtenEvent = await readLastEventByStreamId(
          eService.id,
          postgresDB
        );
        expect(writtenEvent.stream_id).toBe(eService.id);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceDescriptorUpdated");
        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceDescriptorUpdatedV1,
          payload: writtenEvent.data,
        });
        expect(writtenPayload.eServiceDescriptor).toEqual(
          toDescriptorV1(updatedDescriptor)
        );
        expect(writtenPayload.eServiceId).toEqual(eService.id);
      });

      it("should throw eServiceNotFound if the eService doesn't exist", () => {
        expect(
          catalogService.activateDescriptor(
            mockEService.id,
            mockDescriptor.id,
            getMockAuthData(mockEService.producerId)
          )
        ).rejects.toThrowError(eServiceNotFound(mockEService.id));
      });

      it("should throw eServiceDescriptorNotFound if the descriptor doesn't exist", async () => {
        const eService: EService = {
          ...mockEService,
          descriptors: [],
        };
        await addOneEService(eService, postgresDB, eservices);

        expect(
          catalogService.activateDescriptor(
            eService.id,
            mockDescriptor.id,
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(
          eServiceDescriptorNotFound(eService.id, mockDescriptor.id)
        );
      });

      it("should throw operationForbidden if the requester is not the producer", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.suspended,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.activateDescriptor(
            eService.id,
            descriptor.id,
            getMockAuthData()
          )
        ).rejects.toThrowError(operationForbidden);
      });

      it("should throw notValidDescriptor if the descriptor is in draft state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.activateDescriptor(
            mockEService.id,
            mockDescriptor.id,
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(
          notValidDescriptor(descriptor.id, descriptorState.draft)
        );
      });

      it("should throw notValidDescriptor if the descriptor is in published state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.published,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.activateDescriptor(
            mockEService.id,
            mockDescriptor.id,
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(
          notValidDescriptor(descriptor.id, descriptorState.published)
        );
      });

      it("should throw notValidDescriptor if the descriptor is in deprecated state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.deprecated,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.activateDescriptor(
            mockEService.id,
            mockDescriptor.id,
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(
          notValidDescriptor(descriptor.id, descriptorState.deprecated)
        );
      });

      it("should throw notValidDescriptor if the descriptor is in archived state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.archived,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.activateDescriptor(
            mockEService.id,
            mockDescriptor.id,
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(
          notValidDescriptor(descriptor.id, descriptorState.archived)
        );
      });
    });

    describe("clone descriptor", () => {
      beforeAll(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date());
      });
      afterAll(() => {
        vi.useRealTimers();
      });
      it("should write on event-store for the cloning of a descriptor, and clone the descriptor docs and interface files", async () => {
        vi.spyOn(fileManager, "copy");

        const document1 = {
          ...mockDocument,
          name: `${mockDocument.name}_1`,
          path: `${config.eserviceDocumentsPath}/${mockDocument.id}/${mockDocument.name}_1`,
        };
        const document2 = {
          ...mockDocument,
          name: `${mockDocument.name}_2`,
          path: `${config.eserviceDocumentsPath}/${mockDocument.id}/${mockDocument.name}_2`,
        };
        const interfaceDocument = {
          ...mockDocument,
          name: `${mockDocument.name}_interface`,
          path: `${config.eserviceDocumentsPath}/${mockDocument.id}/${mockDocument.name}_interface`,
        };

        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
          interface: interfaceDocument,
          docs: [document1, document2],
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);

        await fileManager.storeBytes(
          config.s3Bucket,
          config.eserviceDocumentsPath,
          interfaceDocument.id,
          interfaceDocument.name,
          Buffer.from("testtest")
        );

        await fileManager.storeBytes(
          config.s3Bucket,
          config.eserviceDocumentsPath,
          document1.id,
          document1.name,
          Buffer.from("testtest")
        );

        await fileManager.storeBytes(
          config.s3Bucket,
          config.eserviceDocumentsPath,
          document2.id,
          document2.name,
          Buffer.from("testtest")
        );
        expect(await fileManager.listFiles(config.s3Bucket)).toContain(
          interfaceDocument.path
        );
        expect(await fileManager.listFiles(config.s3Bucket)).toContain(
          document1.path
        );
        expect(await fileManager.listFiles(config.s3Bucket)).toContain(
          document2.path
        );

        const cloneTimestamp = new Date();
        const newEService = await catalogService.cloneDescriptor(
          eService.id,
          descriptor.id,
          getMockAuthData(eService.producerId)
        );

        const writtenEvent = await readLastEventByStreamId(
          newEService.id,
          postgresDB
        );
        expect(writtenEvent.stream_id).toBe(newEService.id);
        expect(writtenEvent.version).toBe("0");
        expect(writtenEvent.type).toBe("ClonedEServiceAdded");
        const writtenPayload = decodeProtobufPayload({
          messageType: ClonedEServiceAddedV1,
          payload: writtenEvent.data,
        });

        const expectedInterface: Document = {
          ...interfaceDocument,
          id: unsafeBrandId(
            writtenPayload.eService!.descriptors[0].interface!.id
          ),
          uploadDate: new Date(
            writtenPayload.eService!.descriptors[0].interface!.uploadDate
          ),
          path: writtenPayload.eService!.descriptors[0].interface!.path,
        };
        const expectedDocument1: Document = {
          ...document1,
          id: unsafeBrandId(writtenPayload.eService!.descriptors[0].docs[0].id),
          uploadDate: new Date(
            writtenPayload.eService!.descriptors[0].docs[0].uploadDate
          ),
          path: writtenPayload.eService!.descriptors[0].docs[0].path,
        };
        const expectedDocument2: Document = {
          ...document2,
          id: unsafeBrandId(writtenPayload.eService!.descriptors[0].docs[1].id),
          uploadDate: new Date(
            writtenPayload.eService!.descriptors[0].docs[1].uploadDate
          ),
          path: writtenPayload.eService!.descriptors[0].docs[1].path,
        };

        const expectedDescriptor: Descriptor = {
          ...descriptor,
          id: unsafeBrandId(writtenPayload.eService!.descriptors[0].id),
          version: "1",
          interface: expectedInterface,
          createdAt: new Date(
            Number(writtenPayload.eService?.descriptors[0].createdAt)
          ),
          docs: [expectedDocument1, expectedDocument2],
        };

        const expectedEService: EService = {
          ...eService,
          id: unsafeBrandId(writtenPayload.eService!.id),
          name: `${eService.name} - clone - ${formatClonedEServiceDate(
            cloneTimestamp
          )}`,
          descriptors: [expectedDescriptor],
          createdAt: new Date(Number(writtenPayload.eService?.createdAt)),
        };
        expect(writtenPayload.eService).toEqual(toEServiceV1(expectedEService));

        expect(fileManager.copy).toHaveBeenCalledWith(
          config.s3Bucket,
          interfaceDocument.path,
          config.eserviceDocumentsPath,
          expectedInterface.id,
          expectedInterface.name
        );
        expect(fileManager.copy).toHaveBeenCalledWith(
          config.s3Bucket,
          document1.path,
          config.eserviceDocumentsPath,
          expectedDocument1.id,
          expectedDocument1.name
        );
        expect(fileManager.copy).toHaveBeenCalledWith(
          config.s3Bucket,
          document2.path,
          config.eserviceDocumentsPath,
          expectedDocument2.id,
          expectedDocument2.name
        );
        expect(await fileManager.listFiles(config.s3Bucket)).toContain(
          expectedInterface.path
        );
        expect(await fileManager.listFiles(config.s3Bucket)).toContain(
          expectedDocument1.path
        );
        expect(await fileManager.listFiles(config.s3Bucket)).toContain(
          expectedDocument2.path
        );
      });
      it("should fail if one of the file copy fails", async () => {
        vi.spyOn(fileManager, "copy").mockRejectedValueOnce(
          new Error("Failed to copy file")
        );

        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
          interface: mockDocument,
          docs: [mockDocument],
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);

        await expect(
          catalogService.cloneDescriptor(
            eService.id,
            descriptor.id,
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError("Failed to copy file");
      });
      it("should throw eServiceDuplicate if an eService with the same name already exists", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
          interface: mockDocument,
          docs: [mockDocument],
        };
        const eService1: EService = {
          ...mockEService,
          id: generateId(),
          descriptors: [descriptor],
        };
        await addOneEService(eService1, postgresDB, eservices);

        const cloneTimestamp = new Date();
        const conflictEServiceName = `${
          eService1.name
        } - clone - ${formatClonedEServiceDate(cloneTimestamp)}`;

        const eService2: EService = {
          ...mockEService,
          id: generateId(),
          name: conflictEServiceName,
          descriptors: [descriptor],
        };
        await addOneEService(eService2, postgresDB, eservices);

        expect(
          catalogService.cloneDescriptor(
            eService1.id,
            descriptor.id,
            getMockAuthData(eService1.producerId)
          )
        ).rejects.toThrowError(eServiceDuplicate(conflictEServiceName));
      });
      it("should throw eServiceNotFound if the eService doesn't exist", () => {
        expect(
          catalogService.cloneDescriptor(
            mockEService.id,
            mockDescriptor.id,
            getMockAuthData()
          )
        ).rejects.toThrowError(eServiceNotFound(mockEService.id));
      });
      it("should throw operationForbidden if the requester is not the producer", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.cloneDescriptor(
            eService.id,
            descriptor.id,
            getMockAuthData()
          )
        ).rejects.toThrowError(operationForbidden);
      });
      it("should throw eServiceDescriptorNotFound if the descriptor doesn't exist", async () => {
        const eService: EService = {
          ...mockEService,
          descriptors: [],
        };
        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.cloneDescriptor(
            mockEService.id,
            mockDescriptor.id,
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(
          eServiceDescriptorNotFound(eService.id, mockDescriptor.id)
        );
      });
    });

    describe("archive descriptor", () => {
      it("should write on event-store for the archiving of a descriptor", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.suspended,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);
        await catalogService.archiveDescriptor(
          eService.id,
          descriptor.id,
          getMockAuthData(eService.producerId)
        );

        const writtenEvent = await readLastEventByStreamId(
          eService.id,
          postgresDB
        );
        expect(writtenEvent.stream_id).toBe(eService.id);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceDescriptorUpdated");
        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceDescriptorUpdatedV1,
          payload: writtenEvent.data,
        });

        const updatedDescriptor = {
          ...descriptor,
          state: descriptorState.archived,
          archivedAt: new Date(
            Number(writtenPayload.eServiceDescriptor?.archivedAt)
          ),
        };

        expect(writtenPayload.eServiceDescriptor).toEqual(
          toDescriptorV1(updatedDescriptor)
        );
        expect(writtenPayload.eServiceId).toEqual(eService.id);
      });

      it("should throw eServiceNotFound if the eService doesn't exist", () => {
        expect(
          catalogService.archiveDescriptor(
            mockEService.id,
            mockDescriptor.id,
            getMockAuthData(mockEService.producerId)
          )
        ).rejects.toThrowError(eServiceNotFound(mockEService.id));
      });

      it("should throw eServiceDescriptorNotFound if the descriptor doesn't exist", async () => {
        const eService: EService = {
          ...mockEService,
          descriptors: [],
        };
        await addOneEService(eService, postgresDB, eservices);

        expect(
          catalogService.archiveDescriptor(
            eService.id,
            mockDescriptor.id,
            getMockAuthData(mockEService.producerId)
          )
        ).rejects.toThrowError(
          eServiceDescriptorNotFound(eService.id, mockDescriptor.id)
        );
      });

      it("should throw operationForbidden if the requester is not the producer", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.archiveDescriptor(
            eService.id,
            descriptor.id,
            getMockAuthData()
          )
        ).rejects.toThrowError(operationForbidden);
      });
    });

    describe("update descriptor", () => {
      it("should write on event-store for the update of a published descriptor", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
          interface: mockDocument,
          publishedAt: new Date(),
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);

        const updatedDescriptorQuotasSeed: UpdateEServiceDescriptorQuotasSeed =
          {
            voucherLifespan: 1000,
            dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer + 10,
            dailyCallsTotal: descriptor.dailyCallsTotal + 10,
          };

        const updatedEService: EService = {
          ...eservice,
          descriptors: [
            {
              ...descriptor,
              voucherLifespan: 1000,
              dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer + 10,
              dailyCallsTotal: descriptor.dailyCallsTotal + 10,
            },
          ],
        };
        await catalogService.updateDescriptor(
          eservice.id,
          descriptor.id,
          updatedDescriptorQuotasSeed,
          getMockAuthData(eservice.producerId)
        );
        const writtenEvent = await readLastEventByStreamId(
          eservice.id,
          postgresDB
        );
        expect(writtenEvent).toMatchObject({
          stream_id: eservice.id,
          version: "1",
          type: "EServiceUpdated",
        });
        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceUpdatedV1,
          payload: writtenEvent.data,
        });
        expect(writtenPayload.eService).toEqual(toEServiceV1(updatedEService));
      });

      it("should write on event-store for the update of a suspended descriptor", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.suspended,
          interface: mockDocument,
          publishedAt: new Date(),
          suspendedAt: new Date(),
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);

        const updatedDescriptorQuotasSeed: UpdateEServiceDescriptorQuotasSeed =
          {
            voucherLifespan: 1000,
            dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer + 10,
            dailyCallsTotal: descriptor.dailyCallsTotal + 10,
          };

        const updatedEService: EService = {
          ...eservice,
          descriptors: [
            {
              ...descriptor,
              voucherLifespan: 1000,
              dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer + 10,
              dailyCallsTotal: descriptor.dailyCallsTotal + 10,
            },
          ],
        };
        await catalogService.updateDescriptor(
          eservice.id,
          descriptor.id,
          updatedDescriptorQuotasSeed,
          getMockAuthData(eservice.producerId)
        );
        const writtenEvent = await readLastEventByStreamId(
          eservice.id,
          postgresDB
        );
        expect(writtenEvent).toMatchObject({
          stream_id: eservice.id,
          version: "1",
          type: "EServiceUpdated",
        });
        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceUpdatedV1,
          payload: writtenEvent.data,
        });
        expect(writtenPayload.eService).toEqual(toEServiceV1(updatedEService));
      });

      it("should write on event-store for the update of an deprecated descriptor", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.deprecated,
          interface: mockDocument,
          publishedAt: new Date(),
          deprecatedAt: new Date(),
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);

        const updatedDescriptorQuotasSeed: UpdateEServiceDescriptorQuotasSeed =
          {
            voucherLifespan: 1000,
            dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer + 10,
            dailyCallsTotal: descriptor.dailyCallsTotal + 10,
          };

        const updatedEService: EService = {
          ...eservice,
          descriptors: [
            {
              ...descriptor,
              voucherLifespan: 1000,
              dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer + 10,
              dailyCallsTotal: descriptor.dailyCallsTotal + 10,
            },
          ],
        };
        await catalogService.updateDescriptor(
          eservice.id,
          descriptor.id,
          updatedDescriptorQuotasSeed,
          getMockAuthData(eservice.producerId)
        );
        const writtenEvent = await readLastEventByStreamId(
          eservice.id,
          postgresDB
        );
        expect(writtenEvent).toMatchObject({
          stream_id: eservice.id,
          version: "1",
          type: "EServiceUpdated",
        });
        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceUpdatedV1,
          payload: writtenEvent.data,
        });
        expect(writtenPayload.eService).toEqual(toEServiceV1(updatedEService));
      });

      it("should throw eServiceNotFound if the eService doesn't exist", () => {
        const updatedDescriptorQuotasSeed: UpdateEServiceDescriptorQuotasSeed =
          {
            voucherLifespan: 1000,
            dailyCallsPerConsumer: mockDescriptor.dailyCallsPerConsumer + 10,
            dailyCallsTotal: mockDescriptor.dailyCallsTotal + 10,
          };
        expect(
          catalogService.updateDescriptor(
            mockEService.id,
            mockDescriptor.id,
            updatedDescriptorQuotasSeed,
            getMockAuthData(mockEService.producerId)
          )
        ).rejects.toThrowError(eServiceNotFound(mockEService.id));
      });

      it("should throw eServiceDescriptorNotFound if the descriptor doesn't exist", async () => {
        const eservice: EService = {
          ...mockEService,
          descriptors: [],
        };
        await addOneEService(eservice, postgresDB, eservices);

        const updatedDescriptorQuotasSeed: UpdateEServiceDescriptorQuotasSeed =
          {
            voucherLifespan: 1000,
            dailyCallsPerConsumer: mockDescriptor.dailyCallsPerConsumer + 10,
            dailyCallsTotal: mockDescriptor.dailyCallsTotal + 10,
          };

        expect(
          catalogService.updateDescriptor(
            mockEService.id,
            mockDescriptor.id,
            updatedDescriptorQuotasSeed,
            getMockAuthData(mockEService.producerId)
          )
        ).rejects.toThrowError(
          eServiceDescriptorNotFound(eservice.id, mockDescriptor.id)
        );
      });

      it("should throw notValidDescriptor if the descriptor is in draft state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.draft,
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);
        const updatedDescriptorQuotasSeed: UpdateEServiceDescriptorQuotasSeed =
          {
            voucherLifespan: 1000,
            dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer + 10,
            dailyCallsTotal: descriptor.dailyCallsTotal + 10,
          };

        expect(
          catalogService.updateDescriptor(
            eservice.id,
            descriptor.id,
            updatedDescriptorQuotasSeed,
            getMockAuthData(eservice.producerId)
          )
        ).rejects.toThrowError(
          notValidDescriptor(mockDescriptor.id, descriptorState.draft)
        );
      });

      it("should throw notValidDescriptor if the descriptor is in archived state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.archived,
          archivedAt: new Date(),
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);

        const updatedDescriptorQuotasSeed: UpdateEServiceDescriptorQuotasSeed =
          {
            voucherLifespan: 1000,
            dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer + 10,
            dailyCallsTotal: descriptor.dailyCallsTotal + 10,
          };
        expect(
          catalogService.updateDescriptor(
            eservice.id,
            descriptor.id,
            updatedDescriptorQuotasSeed,
            getMockAuthData(eservice.producerId)
          )
        ).rejects.toThrowError(
          notValidDescriptor(mockDescriptor.id, descriptorState.archived)
        );
      });

      it("should throw operationForbidden if the requester is not the producer", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);

        const updatedDescriptorQuotasSeed: UpdateEServiceDescriptorQuotasSeed =
          {
            voucherLifespan: 1000,
            dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer + 10,
            dailyCallsTotal: descriptor.dailyCallsTotal + 10,
          };
        expect(
          catalogService.updateDescriptor(
            eservice.id,
            descriptor.id,
            updatedDescriptorQuotasSeed,
            getMockAuthData()
          )
        ).rejects.toThrowError(operationForbidden);
      });

      it("should throw inconsistentDailyCalls if dailyCallsPerConsumer is greater than dailyCallsTotal", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
          interface: mockDocument,
          publishedAt: new Date(),
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);

        const updatedDescriptorQuotasSeed: UpdateEServiceDescriptorQuotasSeed =
          {
            voucherLifespan: 1000,
            dailyCallsPerConsumer: descriptor.dailyCallsTotal + 11,
            dailyCallsTotal: descriptor.dailyCallsTotal + 10,
          };
        expect(
          catalogService.updateDescriptor(
            eservice.id,
            descriptor.id,
            updatedDescriptorQuotasSeed,
            getMockAuthData(eservice.producerId)
          )
        ).rejects.toThrowError(inconsistentDailyCalls());
      });

      it("should throw dailyCallsCannotBeDecreased if dailyCallsPerConsumer or dailyCallsTotal get decreased", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
          interface: mockDocument,
          publishedAt: new Date(),
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);

        const updatedDescriptorQuotasSeed: UpdateEServiceDescriptorQuotasSeed =
          {
            voucherLifespan: 1000,
            dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer - 1,
            dailyCallsTotal: descriptor.dailyCallsTotal - 1,
          };
        expect(
          catalogService.updateDescriptor(
            eservice.id,
            descriptor.id,
            updatedDescriptorQuotasSeed,
            getMockAuthData(eservice.producerId)
          )
        ).rejects.toThrowError(dailyCallsCannotBeDecreased());
      });
    });

    describe("upload Document", () => {
      it("should write on event-store for the upload of a document", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);

        await catalogService.uploadDocument(
          eService.id,
          descriptor.id,
          buildInterfaceSeed(),
          getMockAuthData(eService.producerId)
        );

        const writtenEvent = await readLastEventByStreamId(
          eService.id,
          postgresDB
        );
        expect(writtenEvent.stream_id).toBe(eService.id);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceDocumentAdded");
        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceDocumentAddedV1,
          payload: writtenEvent.data,
        });

        expect(writtenPayload.eServiceId).toEqual(eService.id);
        expect(writtenPayload.descriptorId).toEqual(descriptor.id);
        expect(writtenPayload.isInterface).toEqual(true);
        expect(writtenPayload.serverUrls).toEqual(
          buildInterfaceSeed().serverUrls
        );

        const expectedDocument: Document = {
          ...mockDocument,
          id: unsafeBrandId(writtenPayload.document!.id),
          checksum: writtenPayload.document!.checksum,
          uploadDate: new Date(writtenPayload.document!.uploadDate),
        };
        expect(writtenPayload.document).toEqual(toDocumentV1(expectedDocument));
      });
      it("should throw eServiceNotFound if the eService doesn't exist", () => {
        expect(
          catalogService.uploadDocument(
            mockEService.id,
            mockDescriptor.id,
            buildInterfaceSeed(),
            getMockAuthData()
          )
        ).rejects.toThrowError(eServiceNotFound(mockEService.id));
      });
      it("should throw operationForbidden if the requester is not the producer", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);

        expect(
          catalogService.uploadDocument(
            eService.id,
            descriptor.id,
            buildInterfaceSeed(),
            getMockAuthData()
          )
        ).rejects.toThrowError(operationForbidden);
      });
      it("should throw eServiceDescriptorNotFound if the descriptor doesn't exist", async () => {
        const eService: EService = {
          ...mockEService,
          descriptors: [],
        };
        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.uploadDocument(
            eService.id,
            mockDescriptor.id,
            buildInterfaceSeed(),
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(
          eServiceDescriptorNotFound(eService.id, mockDescriptor.id)
        );
      });
      it("should throw notValidDescriptor if the descriptor is in published state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.uploadDocument(
            eService.id,
            descriptor.id,
            buildInterfaceSeed(),
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(
          notValidDescriptor(descriptor.id, descriptorState.published)
        );
      });
      it("should throw notValidDescriptor if the descriptor is in deprecated state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.deprecated,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.uploadDocument(
            eService.id,
            descriptor.id,
            buildInterfaceSeed(),
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(
          notValidDescriptor(descriptor.id, descriptorState.deprecated)
        );
      });
      it("should throw notValidDescriptor if the descriptor is in archived state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.archived,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.uploadDocument(
            eService.id,
            descriptor.id,
            buildInterfaceSeed(),
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(
          notValidDescriptor(descriptor.id, descriptorState.archived)
        );
      });
      it("should throw notValidDescriptor if the descriptor is in suspended state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.suspended,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.uploadDocument(
            eService.id,
            descriptor.id,
            buildInterfaceSeed(),
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(
          notValidDescriptor(descriptor.id, descriptorState.suspended)
        );
      });
      it("should throw interfaceAlreadyExists if the descriptor already contains an interface", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.draft,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.uploadDocument(
            eService.id,
            descriptor.id,
            buildInterfaceSeed(),
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(interfaceAlreadyExists(descriptor.id));
      });
    });

    describe("delete Document", () => {
      it("should write on event-store for the deletion of a document, and delete the file from the bucket", async () => {
        vi.spyOn(fileManager, "delete");

        const document = {
          ...mockDocument,
          path: `${config.eserviceDocumentsPath}/${mockDocument.id}/${mockDocument.name}`,
        };
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
          docs: [document],
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };

        await addOneEService(eService, postgresDB, eservices);

        await fileManager.storeBytes(
          config.s3Bucket,
          config.eserviceDocumentsPath,
          document.id,
          document.name,
          Buffer.from("testtest")
        );
        expect(await fileManager.listFiles(config.s3Bucket)).toContain(
          document.path
        );

        await catalogService.deleteDocument(
          eService.id,
          descriptor.id,
          document.id,
          getMockAuthData(eService.producerId)
        );
        const writtenEvent = await readLastEventByStreamId(
          eService.id,
          postgresDB
        );
        expect(writtenEvent.stream_id).toBe(eService.id);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceDocumentDeleted");
        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceDocumentDeletedV1,
          payload: writtenEvent.data,
        });

        expect(writtenPayload.eServiceId).toEqual(eService.id);
        expect(writtenPayload.descriptorId).toEqual(descriptor.id);
        expect(writtenPayload.documentId).toEqual(document.id);

        expect(fileManager.delete).toHaveBeenCalledWith(
          config.s3Bucket,
          document.path
        );
        expect(await fileManager.listFiles(config.s3Bucket)).not.toContain(
          document.path
        );
      });

      it("should write on event-store for the deletion of a document that is the descriptor interface, and delete the file from the bucket", async () => {
        vi.spyOn(fileManager, "delete");

        const interfaceDocument = {
          ...mockDocument,
          path: `${config.eserviceDocumentsPath}/${mockDocument.id}/${mockDocument.name}`,
        };
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
          interface: interfaceDocument,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };

        await addOneEService(eService, postgresDB, eservices);

        await fileManager.storeBytes(
          config.s3Bucket,
          config.eserviceDocumentsPath,
          interfaceDocument.id,
          interfaceDocument.name,
          Buffer.from("testtest")
        );
        expect(await fileManager.listFiles(config.s3Bucket)).toContain(
          interfaceDocument.path
        );

        await catalogService.deleteDocument(
          eService.id,
          descriptor.id,
          interfaceDocument.id,
          getMockAuthData(eService.producerId)
        );
        const writtenEvent = await readLastEventByStreamId(
          eService.id,
          postgresDB
        );
        expect(writtenEvent.stream_id).toBe(eService.id);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceDocumentDeleted");
        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceDocumentDeletedV1,
          payload: writtenEvent.data,
        });

        expect(writtenPayload.eServiceId).toEqual(eService.id);
        expect(writtenPayload.descriptorId).toEqual(descriptor.id);
        expect(writtenPayload.documentId).toEqual(interfaceDocument.id);

        expect(fileManager.delete).toHaveBeenCalledWith(
          config.s3Bucket,
          interfaceDocument.path
        );
        expect(await fileManager.listFiles(config.s3Bucket)).not.toContain(
          interfaceDocument.path
        );
      });

      it("should fail if the file deletion fails", async () => {
        vi.spyOn(fileManager, "delete").mockRejectedValueOnce(
          new Error("Failed to delete file")
        );

        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
          docs: [mockDocument],
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };

        await addOneEService(eService, postgresDB, eservices);
        await expect(
          catalogService.deleteDocument(
            eService.id,
            descriptor.id,
            mockDocument.id,
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError("Failed to delete file");
      });
      it("should throw eServiceNotFound if the eService doesn't exist", async () => {
        expect(
          catalogService.deleteDocument(
            mockEService.id,
            mockDescriptor.id,
            mockDocument.id,
            getMockAuthData()
          )
        ).rejects.toThrowError(eServiceNotFound(mockEService.id));
      });
      it("should throw operationForbidden if the requester is not the producer", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
          docs: [mockDocument],
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.deleteDocument(
            eService.id,
            descriptor.id,
            mockDocument.id,
            getMockAuthData()
          )
        ).rejects.toThrowError(operationForbidden);
      });
      it("should throw eServiceDescriptorNotFound if the descriptor doesn't exist", async () => {
        const eService: EService = {
          ...mockEService,
          descriptors: [],
        };
        await addOneEService(eService, postgresDB, eservices);

        expect(
          catalogService.deleteDocument(
            eService.id,
            mockDescriptor.id,
            mockDocument.id,
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(
          eServiceDescriptorNotFound(eService.id, mockDescriptor.id)
        );
      });
      it("should throw notValidDescriptor if the descriptor is in published state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
          docs: [mockDocument],
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.deleteDocument(
            eService.id,
            descriptor.id,
            mockDocument.id,
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(
          notValidDescriptor(descriptor.id, descriptorState.published)
        );
      });
      it("should throw notValidDescriptor if the descriptor is in deprecated state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.deprecated,
          docs: [mockDocument],
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.deleteDocument(
            eService.id,
            descriptor.id,
            mockDocument.id,
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(
          notValidDescriptor(descriptor.id, descriptorState.deprecated)
        );
      });
      it("should throw notValidDescriptor if the descriptor is in archived state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.archived,
          docs: [mockDocument],
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.deleteDocument(
            eService.id,
            descriptor.id,
            mockDocument.id,
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(
          notValidDescriptor(descriptor.id, descriptorState.archived)
        );
      });
      it("should throw notValidDescriptor if the descriptor is in suspended state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.suspended,
          docs: [mockDocument],
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.deleteDocument(
            eService.id,
            descriptor.id,
            mockDocument.id,
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(
          notValidDescriptor(descriptor.id, descriptorState.suspended)
        );
      });
      it("should throw eServiceDocumentNotFound if the document doesn't exist", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
          docs: [],
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);

        expect(
          catalogService.deleteDocument(
            eService.id,
            descriptor.id,
            mockDocument.id,
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(
          eServiceDocumentNotFound(eService.id, descriptor.id, mockDocument.id)
        );
      });
    });

    describe("update Document", () => {
      it("should write on event-store for the update of a document", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
          docs: [mockDocument],
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);
        await catalogService.updateDocument(
          eService.id,
          descriptor.id,
          mockDocument.id,
          { prettyName: "updated prettyName" },
          getMockAuthData(eService.producerId)
        );
        const writtenEvent = await readLastEventByStreamId(
          eService.id,
          postgresDB
        );
        expect(writtenEvent.stream_id).toBe(eService.id);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceDocumentUpdated");
        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceDocumentUpdatedV1,
          payload: writtenEvent.data,
        });

        expect(writtenPayload.eServiceId).toEqual(eService.id);
        expect(writtenPayload.descriptorId).toEqual(descriptor.id);
        expect(writtenPayload.documentId).toEqual(mockDocument.id);
        expect(writtenPayload.serverUrls).toEqual(
          buildInterfaceSeed().serverUrls
        );

        const expectedDocument = {
          ...mockDocument,
          prettyName: "updated prettyName",
        };
        expect(writtenPayload.updatedDocument).toEqual(
          toDocumentV1(expectedDocument)
        );
      });
      it("should throw eServiceNotFound if the eService doesn't exist", async () => {
        expect(
          catalogService.updateDocument(
            mockEService.id,
            mockDescriptor.id,
            mockDocument.id,
            { prettyName: "updated prettyName" },
            getMockAuthData()
          )
        ).rejects.toThrowError(eServiceNotFound(mockEService.id));
      });
      it("should throw operationForbidden if the requester is not the producer", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
          docs: [mockDocument],
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.updateDocument(
            eService.id,
            descriptor.id,
            mockDocument.id,
            { prettyName: "updated prettyName" },
            getMockAuthData()
          )
        ).rejects.toThrowError(operationForbidden);
      });
      it("should throw eServiceDescriptorNotFound if the descriptor doesn't exist", async () => {
        const eService: EService = {
          ...mockEService,
          descriptors: [],
        };
        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.updateDocument(
            eService.id,
            mockDescriptor.id,
            generateId(),
            { prettyName: "updated prettyName" },
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(
          eServiceDescriptorNotFound(eService.id, mockDescriptor.id)
        );
      });
      it("should throw notValidDescriptor if the descriptor is in Published state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.published,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.updateDocument(
            eService.id,
            descriptor.id,
            generateId(),
            { prettyName: "updated prettyName" },
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(
          notValidDescriptor(descriptor.id, descriptorState.published)
        );
      });
      it("should throw notValidDescriptor if the descriptor is in Suspended state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.suspended,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.updateDocument(
            eService.id,
            descriptor.id,
            generateId(),
            { prettyName: "updated prettyName" },
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(
          notValidDescriptor(descriptor.id, descriptorState.suspended)
        );
      });
      it("should throw notValidDescriptor if the descriptor is in Archived state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.archived,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.updateDocument(
            eService.id,
            descriptor.id,
            generateId(),
            { prettyName: "updated prettyName" },
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(
          notValidDescriptor(descriptor.id, descriptorState.archived)
        );
      });
      it("should throw notValidDescriptor if the descriptor is in Deprecated state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.deprecated,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.updateDocument(
            eService.id,
            descriptor.id,
            generateId(),
            { prettyName: "updated prettyName" },
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(
          notValidDescriptor(descriptor.id, descriptorState.deprecated)
        );
      });
      it("should throw eServiceDocumentNotFound if the document doesn't exist", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
          docs: [],
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService, postgresDB, eservices);
        expect(
          catalogService.updateDocument(
            eService.id,
            descriptor.id,
            mockDocument.id,
            { prettyName: "updated prettyName" },
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(
          eServiceDocumentNotFound(eService.id, descriptor.id, mockDocument.id)
        );
      });
    });
  });

  describe("ReadModel Service", () => {
    describe("getEservices", () => {
      let organizationId1: TenantId;
      let organizationId2: TenantId;
      let organizationId3: TenantId;
      let eService1: EService;
      let eService2: EService;
      let eService3: EService;
      let eService4: EService;
      let eService5: EService;
      let eService6: EService;
      const attributesForDescriptor1and2 = getMockEServiceAttributes();
      const attributesForDescriptor3 = getMockEServiceAttributes();
      const attributesForDescriptor4 = getMockEServiceAttributes();

      beforeEach(async () => {
        organizationId1 = generateId();
        organizationId2 = generateId();
        organizationId3 = generateId();

        const descriptor1: Descriptor = {
          ...mockDescriptor,
          id: generateId(),
          interface: mockDocument,
          state: descriptorState.published,
          attributes: attributesForDescriptor1and2,
        };
        eService1 = {
          ...mockEService,
          id: generateId(),
          name: "eService 001 test",
          descriptors: [descriptor1],
          producerId: organizationId1,
        };
        await addOneEService(eService1, postgresDB, eservices);

        const descriptor2: Descriptor = {
          ...mockDescriptor,
          id: generateId(),
          interface: mockDocument,
          state: descriptorState.published,
          attributes: attributesForDescriptor1and2,
        };
        eService2 = {
          ...mockEService,
          id: generateId(),
          name: "eService 002 test",
          descriptors: [descriptor2],
          producerId: organizationId1,
        };
        await addOneEService(eService2, postgresDB, eservices);

        const descriptor3: Descriptor = {
          ...mockDescriptor,
          id: generateId(),
          interface: mockDocument,
          state: descriptorState.published,
          attributes: attributesForDescriptor3,
        };
        eService3 = {
          ...mockEService,
          id: generateId(),
          name: "eService 003 test",
          descriptors: [descriptor3],
          producerId: organizationId1,
        };
        await addOneEService(eService3, postgresDB, eservices);

        const descriptor4: Descriptor = {
          ...mockDescriptor,
          id: generateId(),
          interface: mockDocument,
          state: descriptorState.archived,
          attributes: attributesForDescriptor4,
        };
        eService4 = {
          ...mockEService,
          id: generateId(),
          name: "eService 004 test",
          producerId: organizationId2,
          descriptors: [descriptor4],
        };
        await addOneEService(eService4, postgresDB, eservices);

        const descriptor5: Descriptor = {
          ...mockDescriptor,
          id: generateId(),
          interface: mockDocument,
          state: descriptorState.published,
        };
        eService5 = {
          ...mockEService,
          id: generateId(),
          name: "eService 005 test",
          producerId: organizationId2,
          descriptors: [descriptor5],
        };
        await addOneEService(eService5, postgresDB, eservices);

        const descriptor6: Descriptor = {
          ...mockDescriptor,
          id: generateId(),
          interface: mockDocument,
          state: descriptorState.archived,
        };
        eService6 = {
          ...mockEService,
          id: generateId(),
          name: "eService 006",
          producerId: organizationId2,
          descriptors: [descriptor6],
          mode: eserviceMode.receive,
        };
        await addOneEService(eService6, postgresDB, eservices);

        const tenant: Tenant = {
          ...getMockTenant(),
          id: organizationId3,
        };
        await addOneTenant(tenant, tenants);
        const agreement1 = getMockAgreement({
          eserviceId: eService1.id,
          descriptorId: descriptor1.id,
          producerId: eService1.producerId,
          consumerId: tenant.id,
        });
        await addOneAgreement(agreement1, agreements);
        const agreement2 = getMockAgreement({
          eserviceId: eService3.id,
          descriptorId: descriptor3.id,
          producerId: eService3.producerId,
          consumerId: tenant.id,
        });
        await addOneAgreement(agreement2, agreements);
        const agreement3 = {
          ...getMockAgreement({
            eserviceId: eService4.id,
            descriptorId: descriptor4.id,
            producerId: eService4.producerId,
            consumerId: tenant.id,
          }),
          state: agreementState.draft,
        };
        await addOneAgreement(agreement3, agreements);
      });
      it("should get the eServices if they exist (parameters: eservicesIds)", async () => {
        const result = await catalogService.getEServices(
          getMockAuthData(),
          {
            eservicesIds: [eService1.id, eService2.id],
            producersIds: [],
            states: [],
            agreementStates: [],
            attributesIds: [],
          },
          0,
          50
        );
        expect(result.totalCount).toBe(2);
        expect(result.results).toEqual([eService1, eService2]);
      });
      it("should get the eServices if they exist (parameters: producersIds)", async () => {
        const result = await catalogService.getEServices(
          getMockAuthData(),
          {
            eservicesIds: [],
            producersIds: [organizationId1],
            states: [],
            agreementStates: [],
            attributesIds: [],
          },
          0,
          50
        );
        expect(result.totalCount).toBe(3);
        expect(result.results).toEqual([eService1, eService2, eService3]);
      });
      it("should get the eServices if they exist (parameters: states)", async () => {
        const result = await catalogService.getEServices(
          getMockAuthData(),
          {
            eservicesIds: [],
            producersIds: [],
            states: ["Published"],
            agreementStates: [],
            attributesIds: [],
          },
          0,
          50
        );
        expect(result.totalCount).toBe(4);
        expect(result.results).toEqual([
          eService1,
          eService2,
          eService3,
          eService5,
        ]);
      });
      it("should get the eServices if they exist (parameters: agreementStates)", async () => {
        const result1 = await readModelService.getEServices(
          getMockAuthData(organizationId3),
          {
            eservicesIds: [],
            producersIds: [],
            states: [],
            agreementStates: ["Active"],
            attributesIds: [],
          },
          0,
          50
        );

        const result2 = await readModelService.getEServices(
          getMockAuthData(organizationId3),
          {
            eservicesIds: [],
            producersIds: [],
            states: [],
            agreementStates: ["Active", "Draft"],
            attributesIds: [],
          },
          0,
          50
        );

        expect(result1.totalCount).toBe(2);
        expect(result1.results).toEqual([eService1, eService3]);
        expect(result2.totalCount).toBe(3);
        expect(result2.results).toEqual([eService1, eService3, eService4]);
      });
      it("should get the eServices if they exist (parameters: name)", async () => {
        const result = await catalogService.getEServices(
          getMockAuthData(),
          {
            eservicesIds: [],
            producersIds: [],
            states: [],
            agreementStates: [],
            name: "test",
            attributesIds: [],
          },
          0,
          50
        );
        expect(result.totalCount).toBe(5);
        expect(result.results).toEqual([
          eService1,
          eService2,
          eService3,
          eService4,
          eService5,
        ]);
      });
      it("should get the eServices if they exist (parameters: states, agreementStates, name)", async () => {
        const result = await catalogService.getEServices(
          getMockAuthData(organizationId3),
          {
            eservicesIds: [],
            producersIds: [],
            states: ["Published"],
            agreementStates: ["Active"],
            name: "test",
            attributesIds: [],
          },
          0,
          50
        );
        expect(result.totalCount).toBe(2);
        expect(result.results).toEqual([eService1, eService3]);
      });
      it("should not get the eServices if they don't exist (parameters: states, agreementStates, name)", async () => {
        const result = await catalogService.getEServices(
          getMockAuthData(),
          {
            eservicesIds: [],
            producersIds: [],
            states: ["Archived"],
            agreementStates: ["Active"],
            name: "test",
            attributesIds: [],
          },
          0,
          50
        );
        expect(result.totalCount).toBe(0);
        expect(result.results).toEqual([]);
      });
      it("should get the eServices if they exist (parameters: producersIds, states, name)", async () => {
        const result = await catalogService.getEServices(
          getMockAuthData(),
          {
            eservicesIds: [],
            producersIds: [organizationId2],
            states: ["Published"],
            agreementStates: [],
            name: "test",
            attributesIds: [],
          },
          0,
          50
        );
        expect(result.totalCount).toBe(1);
        expect(result.results).toEqual([eService5]);
      });
      it("should not get the eServices if they don't exist (parameters: producersIds, states, name)", async () => {
        const result = await catalogService.getEServices(
          getMockAuthData(),
          {
            eservicesIds: [],
            producersIds: [organizationId2],
            states: ["Published"],
            agreementStates: [],
            name: "not-existing",
            attributesIds: [],
          },
          0,
          50
        );
        expect(result.totalCount).toBe(0);
        expect(result.results).toEqual([]);
      });
      it("should get the eServices if they exist (pagination: limit)", async () => {
        const result = await catalogService.getEServices(
          getMockAuthData(),
          {
            eservicesIds: [],
            producersIds: [],
            states: [],
            agreementStates: [],
            attributesIds: [],
          },
          0,
          5
        );
        expect(result.totalCount).toBe(6);
        expect(result.results.length).toBe(5);
      });
      it("should get the eServices if they exist (pagination: offset, limit)", async () => {
        const result = await catalogService.getEServices(
          getMockAuthData(),
          {
            eservicesIds: [],
            producersIds: [],
            states: [],
            agreementStates: [],
            attributesIds: [],
          },
          5,
          5
        );
        expect(result.totalCount).toBe(6);
        expect(result.results.length).toBe(1);
      });
      it("should get the eServices if they exist (parameters: attributesIds)", async () => {
        const result = await readModelService.getEServices(
          getMockAuthData(),
          {
            eservicesIds: [],
            producersIds: [],
            states: [],
            agreementStates: [],
            attributesIds: [
              attributesForDescriptor1and2.certified[0][0].id,
              attributesForDescriptor3.declared[0][1].id,
              attributesForDescriptor4.verified[0][1].id,
            ],
          },
          0,
          50
        );
        expect(result.totalCount).toBe(4);
        expect(result.results).toEqual([
          eService1,
          eService2,
          eService3,
          eService4,
        ]);
      });

      it("should get the eServices if they exist (parameters: mode)", async () => {
        const result = await readModelService.getEServices(
          getMockAuthData(),
          {
            eservicesIds: [],
            producersIds: [],
            states: [],
            agreementStates: [],
            attributesIds: [],
            mode: eserviceMode.receive,
          },
          0,
          50
        );
        expect(result.totalCount).toBe(1);
        expect(result.results).toEqual([eService6]);
      });

      it("should not get the eServices if they don't exist  (parameters: attributesIds)", async () => {
        const result = await readModelService.getEServices(
          getMockAuthData(),
          {
            eservicesIds: [],
            producersIds: [],
            states: [],
            agreementStates: [],
            attributesIds: [generateId()],
          },
          0,
          50
        );
        expect(result.totalCount).toBe(0);
        expect(result.results).toEqual([]);
      });

      it("should get the eServices if they exist (parameters: attributesIds, name)", async () => {
        const result = await readModelService.getEServices(
          getMockAuthData(),
          {
            eservicesIds: [],
            producersIds: [],
            states: [],
            agreementStates: [],
            name: eService1.name.slice(-6),
            attributesIds: [attributesForDescriptor1and2.verified[0][1].id],
          },
          0,
          50
        );
        expect(result.totalCount).toBe(1);
        expect(result.results).toEqual([eService1]);
      });

      it("should get the eServices if they exist (parameters: attributesIds, states)", async () => {
        const result = await readModelService.getEServices(
          getMockAuthData(),
          {
            eservicesIds: [],
            producersIds: [],
            states: ["Archived"],
            agreementStates: [],
            attributesIds: [
              attributesForDescriptor1and2.certified[0][0].id,
              attributesForDescriptor4.verified[0][1].id,
            ],
          },
          0,
          50
        );

        expect(result.totalCount).toBe(1);
        expect(result.results).toEqual([eService4]);
      });

      it("should get the eServices if they exist (parameters: attributesIds, agreementStates, producersIds)", async () => {
        const result = await readModelService.getEServices(
          getMockAuthData(organizationId3),
          {
            eservicesIds: [],
            producersIds: [organizationId1],
            states: [],
            agreementStates: ["Active"],
            attributesIds: [attributesForDescriptor1and2.certified[0][0].id],
          },
          0,
          50
        );
        expect(result.totalCount).toBe(1);
        expect(result.results).toEqual([eService1]);
      });

      it("should get the eServices if they exist (parameters: attributesIds, agreementStates, eservicesIds)", async () => {
        const result = await readModelService.getEServices(
          getMockAuthData(organizationId3),
          {
            eservicesIds: [eService1.id, eService4.id],
            producersIds: [organizationId1, organizationId2],
            states: [],
            agreementStates: ["Active", "Draft"],
            attributesIds: [
              attributesForDescriptor1and2.certified[0][0].id,
              attributesForDescriptor4.verified[0][1].id,
            ],
          },
          0,
          50
        );
        expect(result.totalCount).toBe(2);
        expect(result.results).toEqual([eService1, eService4]);
      });

      it("should not get the eServices if they don't exist (parameters: attributesIds, agreementStates)", async () => {
        const result = await readModelService.getEServices(
          getMockAuthData(organizationId3),
          {
            eservicesIds: [],
            producersIds: [],
            states: [],
            agreementStates: ["Draft"],
            attributesIds: [attributesForDescriptor1and2.certified[0][0].id],
          },
          0,
          50
        );
        expect(result.totalCount).toBe(0);
        expect(result.results).toEqual([]);
      });

      it("should include eservices with no descriptors (requester is the producer, admin)", async () => {
        const eService7: EService = {
          ...mockEService,
          id: generateId(),
          name: "eService 007",
          producerId: organizationId1,
          descriptors: [],
        };
        const authData: AuthData = {
          ...getMockAuthData(organizationId1),
          userRoles: [userRoles.ADMIN_ROLE],
        };
        await addOneEService(eService7, postgresDB, eservices);
        const result = await catalogService.getEServices(
          authData,
          {
            eservicesIds: [],
            producersIds: [],
            states: [],
            agreementStates: [],
            attributesIds: [],
          },
          0,
          50
        );
        expect(result.totalCount).toBe(7);
        expect(result.results).toEqual([
          eService1,
          eService2,
          eService3,
          eService4,
          eService5,
          eService6,
          eService7,
        ]);
      });
      it("should not include eservices with no descriptors (requester is the producer, not admin nor api)", async () => {
        const eService7: EService = {
          ...mockEService,
          id: generateId(),
          name: "eService 007",
          producerId: organizationId1,
          descriptors: [],
        };
        const authData: AuthData = {
          ...getMockAuthData(organizationId1),
          userRoles: [userRoles.SUPPORT_ROLE],
        };
        await addOneEService(eService7, postgresDB, eservices);
        const result = await catalogService.getEServices(
          authData,
          {
            eservicesIds: [],
            producersIds: [],
            states: [],
            agreementStates: [],
            attributesIds: [],
          },
          0,
          50
        );
        expect(result.totalCount).toBe(6);
        expect(result.results).toEqual([
          eService1,
          eService2,
          eService3,
          eService4,
          eService5,
          eService6,
        ]);
      });
      it("should not include eservices with no descriptors (requester is not the producer)", async () => {
        const eService7: EService = {
          ...mockEService,
          id: generateId(),
          producerId: organizationId1,
          name: "eService 007",
          descriptors: [],
        };
        const authData: AuthData = {
          ...getMockAuthData(),
          userRoles: [userRoles.ADMIN_ROLE],
        };
        await addOneEService(eService7, postgresDB, eservices);
        const result = await catalogService.getEServices(
          authData,
          {
            eservicesIds: [],
            producersIds: [],
            states: [],
            agreementStates: [],
            attributesIds: [],
          },
          0,
          50
        );
        expect(result.totalCount).toBe(6);
        expect(result.results).toEqual([
          eService1,
          eService2,
          eService3,
          eService4,
          eService5,
          eService6,
        ]);
      });
      it("should include eservices whose only descriptor is draft (requester is the producer, admin)", async () => {
        const descriptor8: Descriptor = {
          ...mockDescriptor,
          id: generateId(),
          state: descriptorState.draft,
        };
        const eService8: EService = {
          ...mockEService,
          id: generateId(),
          name: "eService 008",
          producerId: organizationId1,
          descriptors: [descriptor8],
        };
        const authData: AuthData = {
          ...getMockAuthData(organizationId1),
          userRoles: [userRoles.ADMIN_ROLE],
        };
        await addOneEService(eService8, postgresDB, eservices);
        const result = await catalogService.getEServices(
          authData,
          {
            eservicesIds: [],
            producersIds: [],
            states: [],
            agreementStates: [],
            attributesIds: [],
          },
          0,
          50
        );
        expect(result.totalCount).toBe(7);
        expect(result.results).toEqual([
          eService1,
          eService2,
          eService3,
          eService4,
          eService5,
          eService6,
          eService8,
        ]);
      });
      it("should not include eservices whose only descriptor is draft (requester is the producer, not admin nor api)", async () => {
        const descriptor8: Descriptor = {
          ...mockDescriptor,
          id: generateId(),
          state: descriptorState.draft,
        };
        const eService8: EService = {
          ...mockEService,
          id: generateId(),
          name: "eService 008",
          producerId: organizationId1,
          descriptors: [descriptor8],
        };
        const authData: AuthData = {
          ...getMockAuthData(organizationId1),
          userRoles: [userRoles.SUPPORT_ROLE],
        };
        await addOneEService(eService8, postgresDB, eservices);
        const result = await catalogService.getEServices(
          authData,
          {
            eservicesIds: [],
            producersIds: [],
            states: [],
            agreementStates: [],
            attributesIds: [],
          },
          0,
          50
        );
        expect(result.totalCount).toBe(6);
        expect(result.results).toEqual([
          eService1,
          eService2,
          eService3,
          eService4,
          eService5,
          eService6,
        ]);
      });
      it("should not include eservices whose only descriptor is draft (requester is not the producer)", async () => {
        const descriptor8: Descriptor = {
          ...mockDescriptor,
          id: generateId(),
          state: descriptorState.draft,
        };
        const eService8: EService = {
          ...mockEService,
          id: generateId(),
          name: "eService 008",
          producerId: organizationId1,
          descriptors: [descriptor8],
        };
        const authData: AuthData = {
          ...getMockAuthData(),
          userRoles: [userRoles.ADMIN_ROLE],
        };
        await addOneEService(eService8, postgresDB, eservices);
        const result = await catalogService.getEServices(
          authData,
          {
            eservicesIds: [],
            producersIds: [],
            states: [],
            agreementStates: [],
            attributesIds: [],
          },
          0,
          50
        );
        expect(result.totalCount).toBe(6);
        expect(result.results).toEqual([
          eService1,
          eService2,
          eService3,
          eService4,
          eService5,
          eService6,
        ]);
      });
      it("should not filter out draft descriptors if the eService has both draft and non-draft ones (requester is the producer, admin)", async () => {
        const descriptor9a: Descriptor = {
          ...mockDescriptor,
          id: generateId(),
          interface: mockDocument,
          publishedAt: new Date(),
          state: descriptorState.published,
        };
        const descriptor9b: Descriptor = {
          ...mockDescriptor,
          id: generateId(),
          version: "2",
          state: descriptorState.draft,
        };
        const eService9: EService = {
          ...mockEService,
          id: generateId(),
          name: "eService 008",
          producerId: organizationId1,
          descriptors: [descriptor9a, descriptor9b],
        };
        const authData: AuthData = {
          ...getMockAuthData(organizationId1),
          userRoles: [userRoles.ADMIN_ROLE],
        };
        await addOneEService(eService9, postgresDB, eservices);
        const result = await catalogService.getEServices(
          authData,
          {
            eservicesIds: [],
            producersIds: [],
            states: [],
            agreementStates: [],
            attributesIds: [],
          },
          0,
          50
        );
        expect(result.totalCount).toBe(7);
        expect(result.results).toEqual([
          eService1,
          eService2,
          eService3,
          eService4,
          eService5,
          eService6,
          eService9,
        ]);
      });
      it("should filter out draft descriptors if the eService has both draft and non-draft ones (requester is the producer, but not admin nor api)", async () => {
        const descriptor9a: Descriptor = {
          ...mockDescriptor,
          id: generateId(),
          interface: mockDocument,
          publishedAt: new Date(),
          state: descriptorState.published,
        };
        const descriptor9b: Descriptor = {
          ...mockDescriptor,
          id: generateId(),
          version: "2",
          state: descriptorState.draft,
        };
        const eService9: EService = {
          ...mockEService,
          id: generateId(),
          name: "eService 008",
          producerId: organizationId1,
          descriptors: [descriptor9a, descriptor9b],
        };
        const authData: AuthData = {
          ...getMockAuthData(organizationId1),
          userRoles: [userRoles.SUPPORT_ROLE],
        };
        await addOneEService(eService9, postgresDB, eservices);
        const result = await catalogService.getEServices(
          authData,
          {
            eservicesIds: [],
            producersIds: [],
            states: [],
            agreementStates: [],
            attributesIds: [],
          },
          0,
          50
        );
        expect(result.totalCount).toBe(7);
        expect(result.results).toEqual([
          eService1,
          eService2,
          eService3,
          eService4,
          eService5,
          eService6,
          { ...eService9, descriptors: [descriptor9a] },
        ]);
      });
      it("should filter out draft descriptors if the eService has both draft and non-draft ones (requester is not the producer)", async () => {
        const descriptor9a: Descriptor = {
          ...mockDescriptor,
          id: generateId(),
          interface: mockDocument,
          publishedAt: new Date(),
          state: descriptorState.published,
        };
        const descriptor9b: Descriptor = {
          ...mockDescriptor,
          id: generateId(),
          version: "2",
          state: descriptorState.draft,
        };
        const eService9: EService = {
          ...mockEService,
          id: generateId(),
          name: "eService 008",
          producerId: organizationId1,
          descriptors: [descriptor9a, descriptor9b],
        };
        const authData: AuthData = {
          ...getMockAuthData(),
          userRoles: [userRoles.ADMIN_ROLE],
        };
        await addOneEService(eService9, postgresDB, eservices);
        const result = await catalogService.getEServices(
          authData,
          {
            eservicesIds: [],
            producersIds: [],
            states: [],
            agreementStates: [],
            attributesIds: [],
          },
          0,
          50
        );
        expect(result.totalCount).toBe(7);
        expect(result.results).toEqual([
          eService1,
          eService2,
          eService3,
          eService4,
          eService5,
          eService6,
          { ...eService9, descriptors: [descriptor9a] },
        ]);
      });
    });

    describe("getEServiceByNameAndProducerId", () => {
      it("should get the eService if it matches the name and the producerId", async () => {
        const organizationId1: TenantId = generateId();
        const organizationId2: TenantId = generateId();
        const eService1: EService = {
          ...mockEService,
          id: generateId(),
          name: "eService 001",
          producerId: organizationId1,
        };
        await addOneEService(eService1, postgresDB, eservices);

        const eService2: EService = {
          ...mockEService,
          id: generateId(),
          name: "eService 002",
          producerId: organizationId1,
        };
        await addOneEService(eService2, postgresDB, eservices);

        const eService3: EService = {
          ...mockEService,
          id: generateId(),
          name: "eService 001",
          producerId: organizationId2,
        };
        await addOneEService(eService3, postgresDB, eservices);

        const result = await readModelService.getEServiceByNameAndProducerId({
          name: "eService 001",
          producerId: organizationId1,
        });
        expect(result?.data).toEqual(eService1);
      });
      it("should not get the eService if it doesn't exist", async () => {
        const organizationId: TenantId = generateId();
        const eService1: EService = {
          ...mockEService,
          id: generateId(),
          name: "eService 001",
          producerId: organizationId,
        };
        await addOneEService(eService1, postgresDB, eservices);

        const eService2: EService = {
          ...mockEService,
          id: generateId(),
          name: "eService 002",
          producerId: organizationId,
        };
        await addOneEService(eService2, postgresDB, eservices);

        const result = await readModelService.getEServiceByNameAndProducerId({
          name: "not-existing",
          producerId: organizationId,
        });
        expect(result).toBeUndefined();
      });
    });

    describe("getEServiceById", () => {
      it("should get the eService if it exists (requester is the producer, admin)", async () => {
        const descriptor1: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.published,
        };
        const eService1: EService = {
          ...mockEService,
          id: generateId(),
          name: "eService 001",
          descriptors: [descriptor1],
        };
        await addOneEService(eService1, postgresDB, eservices);
        const authData: AuthData = {
          ...getMockAuthData(eService1.producerId),
          userRoles: [userRoles.ADMIN_ROLE],
        };

        const descriptor2: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.published,
        };
        const eService2: EService = {
          ...mockEService,
          id: generateId(),
          name: "eService 002",
          descriptors: [descriptor2],
        };
        await addOneEService(eService2, postgresDB, eservices);

        const descriptor3: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.published,
        };
        const eService3: EService = {
          ...mockEService,
          id: generateId(),
          name: "eService 003",
          descriptors: [descriptor3],
        };
        await addOneEService(eService3, postgresDB, eservices);

        const result = await catalogService.getEServiceById(
          eService1.id,
          authData
        );
        expect(result).toEqual(eService1);
      });

      it("should throw eServiceNotFound if the eService doesn't exist", async () => {
        await addOneEService(mockEService, postgresDB, eservices);
        const notExistingId: EServiceId = generateId();
        expect(
          catalogService.getEServiceById(notExistingId, getMockAuthData())
        ).rejects.toThrowError(eServiceNotFound(notExistingId));
      });

      it("should throw eServiceNotFound if there is only a draft descriptor (requester is not the producer)", async () => {
        const descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(mockEService, postgresDB, eservices);
        expect(
          catalogService.getEServiceById(eservice.id, getMockAuthData())
        ).rejects.toThrowError(eServiceNotFound(eservice.id));
      });
      it("should throw eServiceNotFound if there is only a draft descriptor (requester is the producer but not admin nor api)", async () => {
        const descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        const authData: AuthData = {
          ...getMockAuthData(),
          userRoles: [userRoles.SUPPORT_ROLE],
        };
        await addOneEService(mockEService, postgresDB, eservices);
        expect(
          catalogService.getEServiceById(eservice.id, authData)
        ).rejects.toThrowError(eServiceNotFound(eservice.id));
      });
      it("should throw eServiceNotFound if there are no descriptors (requester is not the producer)", async () => {
        const eservice: EService = {
          ...mockEService,
          descriptors: [],
        };
        await addOneEService(mockEService, postgresDB, eservices);
        expect(
          catalogService.getEServiceById(eservice.id, getMockAuthData())
        ).rejects.toThrowError(eServiceNotFound(eservice.id));
      });
      it("should throw eServiceNotFound if there are no descriptors (requester is the producer but not admin nor api)", async () => {
        const descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        const authData: AuthData = {
          ...getMockAuthData(eservice.producerId),
          userRoles: [userRoles.SUPPORT_ROLE],
        };
        await addOneEService(mockEService, postgresDB, eservices);
        expect(
          catalogService.getEServiceById(eservice.id, authData)
        ).rejects.toThrowError(eServiceNotFound(eservice.id));
      });
      it("should filter out the draft descriptors if the eService has both draft and non-draft ones (requester is not the producer)", async () => {
        const descriptorA: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
        };
        const descriptorB: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
          interface: mockDocument,
          publishedAt: new Date(),
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptorA, descriptorB],
        };
        const authData: AuthData = {
          ...getMockAuthData(),
          userRoles: [userRoles.ADMIN_ROLE],
        };
        await addOneEService(eservice, postgresDB, eservices);
        const result = await catalogService.getEServiceById(
          eservice.id,
          authData
        );
        expect(result.descriptors).toEqual([descriptorB]);
      });
      it("should filter out the draft descriptors if the eService has both draft and non-draft ones (requester is the producer but not admin nor api)", async () => {
        const descriptorA: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
        };
        const descriptorB: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
          interface: mockDocument,
          publishedAt: new Date(),
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptorA, descriptorB],
        };
        const authData: AuthData = {
          ...getMockAuthData(eservice.producerId),
          userRoles: [userRoles.SUPPORT_ROLE],
        };
        await addOneEService(eservice, postgresDB, eservices);
        const result = await catalogService.getEServiceById(
          eservice.id,
          authData
        );
        expect(result.descriptors).toEqual([descriptorB]);
      });
    });

    describe("getEserviceConsumers", () => {
      it("should get the consumers of the given eService", async () => {
        const descriptor1: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.published,
        };
        const eService1: EService = {
          ...mockEService,
          descriptors: [descriptor1],
        };
        await addOneEService(eService1, postgresDB, eservices);
        const tenant = getMockTenant();
        await addOneTenant(tenant, tenants);
        const agreement = getMockAgreement({
          eserviceId: eService1.id,
          descriptorId: descriptor1.id,
          producerId: eService1.producerId,
          consumerId: tenant.id,
        });
        await addOneAgreement(agreement, agreements);

        const result = await readModelService.getEServiceConsumers(
          eService1.id,
          0,
          50
        );
        expect(result.totalCount).toBe(1);
        expect(result.results[0].consumerName).toBe(tenant.name);
      });

      it("should not get any consumers, if no one is using the given eService", async () => {
        const descriptor1: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.published,
        };
        const eService1: EService = {
          ...mockEService,
          descriptors: [descriptor1],
        };
        await addOneEService(eService1, postgresDB, eservices);

        const consumers = await readModelService.getEServiceConsumers(
          eService1.id,
          0,
          50
        );
        expect(consumers.results).toStrictEqual([]);
        expect(consumers.totalCount).toBe(0);
      });
    });

    describe("getDocumentById", () => {
      it("should get the document if it exists (requester is the producer, admin)", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          docs: [mockDocument],
        };
        const eService: EService = {
          ...mockEService,
          id: generateId(),
          name: "eService 001",
          descriptors: [descriptor],
        };
        const authData: AuthData = {
          ...getMockAuthData(eService.producerId),
          userRoles: [userRoles.ADMIN_ROLE],
        };
        await addOneEService(eService, postgresDB, eservices);
        const result = await catalogService.getDocumentById({
          eserviceId: eService.id,
          descriptorId: descriptor.id,
          documentId: mockDocument.id,
          authData,
        });
        expect(result).toEqual(mockDocument);
      });

      it("should throw eServiceNotFound if the eService doesn't exist", async () => {
        const authData: AuthData = {
          ...getMockAuthData(),
          userRoles: [userRoles.ADMIN_ROLE],
        };
        expect(
          catalogService.getDocumentById({
            eserviceId: mockEService.id,
            descriptorId: mockDescriptor.id,
            documentId: mockDocument.id,
            authData,
          })
        ).rejects.toThrowError(eServiceNotFound(mockEService.id));
      });

      it("should throw eServiceDescriptorNotFound if the descriptor doesn't exist (requester is the producer, admin)", async () => {
        const eservice: EService = {
          ...mockEService,
          id: generateId(),
          descriptors: [],
        };
        await addOneEService(eservice, postgresDB, eservices);
        const authData: AuthData = {
          ...getMockAuthData(),
          userRoles: [userRoles.ADMIN_ROLE],
        };
        expect(
          catalogService.getDocumentById({
            eserviceId: eservice.id,
            descriptorId: mockDescriptor.id,
            documentId: mockDocument.id,
            authData,
          })
        ).rejects.toThrowError(
          eServiceDescriptorNotFound(eservice.id, mockDescriptor.id)
        );
      });

      it("should throw eServiceDocumentNotFound if the document doesn't exist (requester is the producer, admin)", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
          docs: [],
        };
        const eservice: EService = {
          ...mockEService,
          id: generateId(),
          name: "eService 001",
          descriptors: [descriptor],
        };
        const authData: AuthData = {
          ...getMockAuthData(eservice.producerId),
          userRoles: [userRoles.ADMIN_ROLE],
        };
        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.getDocumentById({
            eserviceId: eservice.id,
            descriptorId: mockDescriptor.id,
            documentId: mockDocument.id,
            authData,
          })
        ).rejects.toThrowError(
          eServiceDocumentNotFound(
            eservice.id,
            mockDescriptor.id,
            mockDocument.id
          )
        );
      });
      it("should throw eServiceNotFound if the document belongs to a draft descriptor (requester is not the producer)", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
          docs: [mockDocument],
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        const authData: AuthData = {
          ...getMockAuthData(),
          userRoles: [userRoles.ADMIN_ROLE],
        };
        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.getDocumentById({
            eserviceId: eservice.id,
            descriptorId: descriptor.id,
            documentId: mockDocument.id,
            authData,
          })
        ).rejects.toThrowError(eServiceNotFound(eservice.id));
      });
      it("should throw eServiceNotFound if the document belongs to a draft descriptor (requester is the producer but not admin nor api)", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
          docs: [mockDocument],
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        const authData: AuthData = {
          ...getMockAuthData(eservice.producerId),
          userRoles: [userRoles.SUPPORT_ROLE],
        };
        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.getDocumentById({
            eserviceId: eservice.id,
            descriptorId: descriptor.id,
            documentId: mockDocument.id,
            authData,
          })
        ).rejects.toThrowError(eServiceNotFound(eservice.id));
      });
      it("should throw eServiceNotFound if the document belongs to a draft descriptor (requester is not the producer)", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
          docs: [mockDocument],
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        const authData: AuthData = {
          ...getMockAuthData(),
          userRoles: [userRoles.ADMIN_ROLE],
        };
        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.getDocumentById({
            eserviceId: eservice.id,
            descriptorId: descriptor.id,
            documentId: mockDocument.id,
            authData,
          })
        ).rejects.toThrowError(eServiceNotFound(eservice.id));
      });
    });
  });
});

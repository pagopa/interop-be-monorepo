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
  Descriptor,
  Document,
  DraftEServiceUpdatedV2,
  EService,
  EServiceAddedV2,
  EServiceClonedV2,
  EServiceDeletedV1,
  EServiceDescriptorActivatedV2,
  EServiceDescriptorAddedV2,
  EServiceDescriptorDeletedV2,
  EServiceDescriptorDocumentDeletedV2,
  EServiceDescriptorDocumentUpdatedV2,
  EServiceDescriptorInterfaceDeletedV2,
  EServiceDescriptorPublishedV2,
  EServiceDescriptorSuspendedV2,
  EServiceId,
  Tenant,
  TenantId,
  agreementState,
  descriptorState,
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
import { toEServiceV2 } from "../src/model/domain/toEvent.js";
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
    describe("create eservice", () => {
      it("should write on event-store for the creation of an eservice", async () => {
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
        expect(writtenEvent.event_version).toBe(2);
        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceAddedV2,
          payload: writtenEvent.data,
        });

        const eservice: EService = {
          ...mockEService,
          createdAt: new Date(Number(writtenPayload.eservice!.createdAt)),
          id,
        };

        expect(writtenPayload.eservice).toEqual(toEServiceV2(eservice));
      });

      it("should throw eServiceDuplicate if an eservice with the same name already exists", async () => {
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
        vi.spyOn(fileManager, "delete");

        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
          interface: mockDocument,
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        const updatedName = "eservice new name";
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
        expect(writtenEvent.type).toBe("DraftEServiceUpdated");
        expect(writtenEvent.event_version).toBe(2);
        const writtenPayload = decodeProtobufPayload({
          messageType: DraftEServiceUpdatedV2,
          payload: writtenEvent.data,
        });

        expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
        expect(fileManager.delete).not.toHaveBeenCalled();
      });

      it("should write on event-store for the update of an eService (technology change: interface has to be deleted)", async () => {
        vi.spyOn(fileManager, "delete");

        const interfaceDocument = {
          ...mockDocument,
          name: `${mockDocument.name}`,
          path: `${config.eserviceDocumentsPath}/${mockDocument.id}/${mockDocument.name}`,
        };

        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
          interface: interfaceDocument,
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        const updatedName = "eservice new name";
        await addOneEService(eservice, postgresDB, eservices);

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
        expect(writtenEvent.type).toBe("DraftEServiceUpdated");
        expect(writtenEvent.event_version).toBe(2);

        const writtenPayload = decodeProtobufPayload({
          messageType: DraftEServiceUpdatedV2,
          payload: writtenEvent.data,
        });

        expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
        expect(fileManager.delete).toHaveBeenCalledWith(
          config.s3Bucket,
          interfaceDocument.path
        );
        expect(await fileManager.listFiles(config.s3Bucket)).not.toContain(
          interfaceDocument.path
        );
      });

      it("should fail if the file deletion fails when interface file has to be deleted on technology change", async () => {
        vi.spyOn(fileManager, "delete").mockRejectedValueOnce(
          new Error("Failed to delete file")
        );
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

        expect(
          catalogService.updateEService(
            mockEService.id,
            {
              name: updatedName,
              description: mockEService.description,
              technology: "SOAP",
              mode: "DELIVER",
            },
            getMockAuthData(mockEService.producerId)
          )
        ).rejects.toThrowError("Failed to delete file");
      });
      it("should write on event-store for the update of an eService (update description only)", async () => {
        const updatedDescription = "eservice new description";
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
        expect(writtenEvent.type).toBe("DraftEServiceUpdated");
        expect(writtenEvent.event_version).toBe(2);
        const writtenPayload = decodeProtobufPayload({
          messageType: DraftEServiceUpdatedV2,
          payload: writtenEvent.data,
        });

        expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
      });

      it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
        expect(
          catalogService.updateEService(
            mockEService.id,
            {
              name: "eservice new name",
              description: "eservice description",
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
              name: "eservice new name",
              description: "eservice description",
              technology: "REST",
              mode: "DELIVER",
            },
            getMockAuthData()
          )
        ).rejects.toThrowError(operationForbidden);
      });

      it("should throw eServiceDuplicate if the updated name is already in use", async () => {
        const eservice1: EService = {
          ...mockEService,
          id: generateId(),
          descriptors: [],
        };
        const eservice2: EService = {
          ...mockEService,
          id: generateId(),
          name: "eservice name already in use",
          descriptors: [],
        };
        await addOneEService(eservice1, postgresDB, eservices);
        await addOneEService(eservice2, postgresDB, eservices);

        expect(
          catalogService.updateEService(
            eservice1.id,
            {
              name: "eservice name already in use",
              description: "eservice description",
              technology: "REST",
              mode: "DELIVER",
            },
            getMockAuthData(eservice1.producerId)
          )
        ).rejects.toThrowError(
          eServiceDuplicate("eservice name already in use")
        );
      });

      it("should throw eServiceCannotBeUpdated if the eservice descriptor is in published state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.published,
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.updateEService(
            eservice.id,
            {
              name: "eservice new name",
              description: "eservice description",
              technology: "REST",
              mode: "DELIVER",
            },
            getMockAuthData(eservice.producerId)
          )
        ).rejects.toThrowError(eServiceCannotBeUpdated(eservice.id));
      });

      it("should throw eServiceCannotBeUpdated if the eservice descriptor is in archived state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.archived,
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.updateEService(
            eservice.id,
            {
              name: "eservice new name",
              description: "eservice description",
              technology: "REST",
              mode: "DELIVER",
            },
            getMockAuthData(eservice.producerId)
          )
        ).rejects.toThrowError(eServiceCannotBeUpdated(eservice.id));
      });

      it("should throw eServiceCannotBeUpdated if the eservice descriptor is in suspended state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.suspended,
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.updateEService(
            eservice.id,
            {
              name: "eservice new name",
              description: "eservice description",
              technology: "REST",
              mode: "DELIVER",
            },
            getMockAuthData(eservice.producerId)
          )
        ).rejects.toThrowError(eServiceCannotBeUpdated(eservice.id));
      });

      it("should throw eServiceCannotBeUpdated if the eservice descriptor is in deprecated state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.deprecated,
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.updateEService(
            eservice.id,
            {
              name: "eservice new name",
              description: "eservice description",
              technology: "REST",
              mode: "DELIVER",
            },
            getMockAuthData(eservice.producerId)
          )
        ).rejects.toThrowError(eServiceCannotBeUpdated(eservice.id));
      });
    });

    describe("delete eservice", () => {
      it("should write on event-store for the deletion of an eservice", async () => {
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
        expect(writtenEvent.event_version).toBe(2);
        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceDeletedV1,
          payload: writtenEvent.data,
        });
        expect(writtenPayload.eserviceId).toBe(mockEService.id);
      });

      it("should throw eServiceNotFound if the eservice doesn't exist", () => {
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

      it("should throw eServiceCannotBeDeleted if the eservice has a descriptor", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.published,
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.deleteEService(
            eservice.id,
            getMockAuthData(eservice.producerId)
          )
        ).rejects.toThrowError(eServiceCannotBeDeleted(eservice.id));
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
        expect(writtenEvent.event_version).toBe(2);
        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceDescriptorAddedV2,
          payload: writtenEvent.data,
        });

        const expectedEservice = toEServiceV2({
          ...mockEService,
          descriptors: [
            {
              ...mockDescriptor,
              createdAt: new Date(
                Number(writtenPayload.eservice!.descriptors[0]!.createdAt)
              ),
              id: unsafeBrandId(writtenPayload.eservice!.descriptors[0]!.id),
              serverUrls: [],
              attributes: {
                certified: [],
                declared: [
                  [{ id: attribute.id, explicitAttributeVerification: false }],
                ],
                verified: [],
              },
            },
          ],
        });

        expect(writtenPayload.descriptorId).toEqual(
          expectedEservice.descriptors[0].id
        );
        expect(writtenPayload.eservice).toEqual(expectedEservice);
      });

      it("should throw draftDescriptorAlreadyExists if a draft descriptor already exists", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };

        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.createDescriptor(
            eservice.id,
            buildDescriptorSeed(descriptor),
            getMockAuthData(eservice.producerId)
          )
        ).rejects.toThrowError(draftDescriptorAlreadyExists(eservice.id));
      });

      it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
        expect(
          catalogService.createDescriptor(
            mockEService.id,
            buildDescriptorSeed(mockDescriptor),
            getMockAuthData(mockEService.producerId)
          )
        ).rejects.toThrowError(eServiceNotFound(mockEService.id));
      });
      it("should throw attributeNotFound if at least one of the attributes don't exist", async () => {
        const eservice: EService = {
          ...mockEService,
          descriptors: [],
        };
        await addOneEService(eservice, postgresDB, eservices);

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
            eservice.id,
            descriptorSeed,
            getMockAuthData(eservice.producerId)
          )
        ).rejects.toThrowError(attributeNotFound(notExistingId1));
      });
      it("should throw operationForbidden if the requester is not the producer", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.published,
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.createDescriptor(
            eservice.id,
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [],
        };

        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.createDescriptor(
            eservice.id,
            descriptorSeed,
            getMockAuthData(eservice.producerId)
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);

        const updatedDescriptorSeed: EServiceDescriptorSeed = {
          ...buildDescriptorSeed(descriptor),
          dailyCallsTotal: 200,
        };

        const updatedEService: EService = {
          ...eservice,
          descriptors: [
            {
              ...descriptor,
              dailyCallsTotal: 200,
            },
          ],
        };
        await catalogService.updateDraftDescriptor(
          eservice.id,
          descriptor.id,
          updatedDescriptorSeed,
          getMockAuthData(eservice.producerId)
        );
        const writtenEvent = await readLastEventByStreamId(
          eservice.id,
          postgresDB
        );
        expect(writtenEvent.stream_id).toBe(eservice.id);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("DraftEServiceUpdated");
        expect(writtenEvent.event_version).toBe(2);
        const writtenPayload = decodeProtobufPayload({
          messageType: DraftEServiceUpdatedV2,
          payload: writtenEvent.data,
        });
        expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
      });

      it("should throw eServiceNotFound if the eservice doesn't exist", () => {
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [],
        };
        await addOneEService(eservice, postgresDB, eservices);

        expect(
          catalogService.updateDraftDescriptor(
            mockEService.id,
            mockDescriptor.id,
            buildDescriptorSeed(mockDescriptor),
            getMockAuthData(mockEService.producerId)
          )
        ).rejects.toThrowError(
          eServiceDescriptorNotFound(eservice.id, mockDescriptor.id)
        );
      });

      it("should throw notValidDescriptor if the descriptor is in published state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.published,
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);

        expect(
          catalogService.updateDraftDescriptor(
            eservice.id,
            descriptor.id,
            buildDescriptorSeed(descriptor),
            getMockAuthData(eservice.producerId)
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);

        expect(
          catalogService.updateDraftDescriptor(
            eservice.id,
            descriptor.id,
            buildDescriptorSeed(descriptor),
            getMockAuthData(eservice.producerId)
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);

        expect(
          catalogService.updateDraftDescriptor(
            eservice.id,
            descriptor.id,
            buildDescriptorSeed(descriptor),
            getMockAuthData(eservice.producerId)
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);

        expect(
          catalogService.updateDraftDescriptor(
            eservice.id,
            descriptor.id,
            buildDescriptorSeed(descriptor),
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

        const updatedDescriptor = {
          ...descriptor,
          dailyCallsTotal: 200,
        };
        expect(
          catalogService.updateDraftDescriptor(
            eservice.id,
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);

        const updatedDescriptor: Descriptor = {
          ...descriptor,
          dailyCallsPerConsumer: 100,
          dailyCallsTotal: 50,
        };
        expect(
          catalogService.updateDraftDescriptor(
            eservice.id,
            descriptor.id,
            buildDescriptorSeed(updatedDescriptor),
            getMockAuthData(eservice.producerId)
          )
        ).rejects.toThrowError(inconsistentDailyCalls());
      });
    });

    describe("delete draft descriptor", () => {
      it("should write on event-store for the deletion of a draft descriptor (no interface nor documents to delete)", async () => {
        vi.spyOn(fileManager, "delete");
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);

        await catalogService.deleteDraftDescriptor(
          eservice.id,
          descriptor.id,
          getMockAuthData(eservice.producerId)
        );

        const writtenEvent = await readLastEventByStreamId(
          eservice.id,
          postgresDB
        );
        expect(writtenEvent.stream_id).toBe(eservice.id);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceDescriptorDeleted");
        expect(writtenEvent.event_version).toBe(2);

        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceDescriptorDeletedV2,
          payload: writtenEvent.data,
        });

        const expectedEservice = toEServiceV2({
          ...eservice,
          descriptors: [],
        });

        expect(writtenPayload.eservice).toEqual(expectedEservice);
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);

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
          eservice.id,
          descriptor.id,
          getMockAuthData(eservice.producerId)
        );

        const writtenEvent = await readLastEventByStreamId(
          eservice.id,
          postgresDB
        );
        expect(writtenEvent.stream_id).toBe(eservice.id);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceDescriptorDeleted");
        expect(writtenEvent.event_version).toBe(2);
        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceDescriptorDeletedV2,
          payload: writtenEvent.data,
        });

        const expectedEservice = toEServiceV2({
          ...eservice,
          descriptors: [],
        });

        expect(writtenPayload.eservice).toEqual(expectedEservice);
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);

        await expect(
          catalogService.deleteDraftDescriptor(
            eservice.id,
            descriptor.id,
            getMockAuthData(eservice.producerId)
          )
        ).rejects.toThrowError("Failed to delete file");
      });

      it("should throw eServiceNotFound if the eservice doesn't exist", () => {
        expect(
          catalogService.deleteDraftDescriptor(
            mockEService.id,
            mockDescriptor.id,
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
        expect(
          catalogService.deleteDraftDescriptor(
            mockEService.id,
            mockDescriptor.id,
            getMockAuthData(mockEService.producerId)
          )
        ).rejects.toThrowError(
          eServiceDescriptorNotFound(eservice.id, mockDescriptor.id)
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
        expect(
          catalogService.deleteDraftDescriptor(
            eservice.id,
            descriptor.id,
            getMockAuthData()
          )
        ).rejects.toThrowError(operationForbidden);
      });
    });

    describe("publish descriptor", () => {
      beforeAll(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date());
      });
      afterAll(() => {
        vi.useRealTimers();
      });
      it("should write on event-store for the publication of a descriptor", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
          interface: mockDocument,
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);
        await catalogService.publishDescriptor(
          eservice.id,
          descriptor.id,
          getMockAuthData(eservice.producerId)
        );

        const writtenEvent = await readLastEventByStreamId(
          eservice.id,
          postgresDB
        );
        expect(writtenEvent).toMatchObject({
          stream_id: eservice.id,
          version: "1",
          type: "EServiceDescriptorPublished",
          event_version: 2,
        });
        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceDescriptorPublishedV2,
          payload: writtenEvent.data,
        });

        const expectedEservice = toEServiceV2({
          ...eservice,
          descriptors: [
            {
              ...descriptor,
              publishedAt: new Date(),
              state: descriptorState.published,
            },
          ],
        });

        expect(writtenPayload.descriptorId).toEqual(descriptor.id);
        expect(writtenPayload.eservice).toEqual(expectedEservice);
      });

      it("should also archive the previously published descriptor", async () => {
        const descriptor1: Descriptor = {
          ...mockDescriptor,
          id: generateId(),
          state: descriptorState.published,
          publishedAt: new Date(),
          interface: mockDocument,
        };
        const descriptor2: Descriptor = {
          ...mockDescriptor,
          id: generateId(),
          state: descriptorState.draft,
          interface: mockDocument,
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor1, descriptor2],
        };
        await addOneEService(eservice, postgresDB, eservices);
        await catalogService.publishDescriptor(
          eservice.id,
          descriptor2.id,
          getMockAuthData(eservice.producerId)
        );
        const writtenEvent = await readLastEventByStreamId(
          eservice.id,
          postgresDB
        );

        expect(writtenEvent).toMatchObject({
          stream_id: eservice.id,
          version: "1",
          type: "EServiceDescriptorPublished",
          event_version: 2,
        });

        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceDescriptorPublishedV2,
          payload: writtenEvent.data,
        });

        const updatedDescriptor1: Descriptor = {
          ...descriptor1,
          archivedAt: new Date(),
          state: descriptorState.archived,
        };
        const updatedDescriptor2: Descriptor = {
          ...descriptor2,
          publishedAt: new Date(),
          state: descriptorState.published,
        };

        const expectedEservice: EService = {
          ...eservice,
          descriptors: [updatedDescriptor1, updatedDescriptor2],
        };
        expect(writtenPayload).toEqual({
          eservice: toEServiceV2(expectedEservice),
          descriptorId: descriptor2.id,
        });
      });

      it("should also write deprecate the previously published descriptor if there was a valid agreement", async () => {
        const descriptor1: Descriptor = {
          ...mockDescriptor,
          id: generateId(),
          state: descriptorState.published,
          publishedAt: new Date(),
          interface: mockDocument,
        };
        const descriptor2: Descriptor = {
          ...mockDescriptor,
          id: generateId(),
          state: descriptorState.draft,
          interface: mockDocument,
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor1, descriptor2],
        };
        await addOneEService(eservice, postgresDB, eservices);
        const tenant: Tenant = {
          ...getMockTenant(),
        };
        await addOneTenant(tenant, tenants);
        const agreement = getMockAgreement({
          eserviceId: eservice.id,
          descriptorId: descriptor1.id,
          producerId: eservice.producerId,
          consumerId: tenant.id,
        });
        await addOneAgreement(agreement, agreements);
        await catalogService.publishDescriptor(
          eservice.id,
          descriptor2.id,
          getMockAuthData(eservice.producerId)
        );
        const writtenEvent = await readLastEventByStreamId(
          eservice.id,
          postgresDB
        );

        expect(writtenEvent).toMatchObject({
          stream_id: eservice.id,
          version: "1",
          type: "EServiceDescriptorPublished",
          event_version: 2,
        });

        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceDescriptorPublishedV2,
          payload: writtenEvent.data,
        });

        const updatedDescriptor1: Descriptor = {
          ...descriptor1,
          deprecatedAt: new Date(),
          state: descriptorState.deprecated,
        };
        const updatedDescriptor2: Descriptor = {
          ...descriptor2,
          publishedAt: new Date(),
          state: descriptorState.published,
        };

        const expectedEservice: EService = {
          ...eservice,
          descriptors: [updatedDescriptor1, updatedDescriptor2],
        };
        expect(writtenPayload).toEqual({
          eservice: toEServiceV2(expectedEservice),
          descriptorId: descriptor2.id,
        });
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [],
        };
        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.publishDescriptor(
            eservice.id,
            mockDescriptor.id,
            getMockAuthData(eservice.producerId)
          )
        ).rejects.toThrowError(
          eServiceDescriptorNotFound(eservice.id, mockDescriptor.id)
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
        expect(
          catalogService.publishDescriptor(
            eservice.id,
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.publishDescriptor(
            eservice.id,
            descriptor.id,
            getMockAuthData(eservice.producerId)
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.publishDescriptor(
            eservice.id,
            descriptor.id,
            getMockAuthData(eservice.producerId)
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.publishDescriptor(
            eservice.id,
            descriptor.id,
            getMockAuthData(eservice.producerId)
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.publishDescriptor(
            eservice.id,
            descriptor.id,
            getMockAuthData(eservice.producerId)
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);

        expect(
          catalogService.publishDescriptor(
            eservice.id,
            descriptor.id,
            getMockAuthData(eservice.producerId)
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);
        await catalogService.suspendDescriptor(
          eservice.id,
          descriptor.id,
          getMockAuthData(eservice.producerId)
        );

        const writtenEvent = await readLastEventByStreamId(
          eservice.id,
          postgresDB
        );
        expect(writtenEvent.stream_id).toBe(eservice.id);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceDescriptorSuspended");
        expect(writtenEvent.event_version).toBe(2);
        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceDescriptorSuspendedV2,
          payload: writtenEvent.data,
        });

        const expectedEservice = toEServiceV2({
          ...eservice,
          descriptors: [
            {
              ...descriptor,
              state: descriptorState.suspended,
              suspendedAt: new Date(
                Number(writtenPayload.eservice!.descriptors[0]!.suspendedAt)
              ),
            },
          ],
        });

        expect(writtenPayload.descriptorId).toEqual(descriptor.id);
        expect(writtenPayload.eservice).toEqual(expectedEservice);
      });

      it("should throw eServiceNotFound if the eservice doesn't exist", () => {
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.suspendDescriptor(
            eservice.id,
            descriptor.id,
            getMockAuthData()
          )
        ).rejects.toThrowError(operationForbidden);
      });

      it("should throw eServiceDescriptorNotFound if the descriptor doesn't exist", async () => {
        const eservice: EService = {
          ...mockEService,
          descriptors: [],
        };
        await addOneEService(eservice, postgresDB, eservices);

        expect(
          catalogService.suspendDescriptor(
            eservice.id,
            mockDescriptor.id,
            getMockAuthData(mockEService.producerId)
          )
        ).rejects.toThrowError(
          eServiceDescriptorNotFound(eservice.id, mockDescriptor.id)
        );
      });

      it("should throw notValidDescriptor if the descriptor is in draft state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.suspendDescriptor(
            eservice.id,
            descriptor.id,
            getMockAuthData(eservice.producerId)
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.suspendDescriptor(
            eservice.id,
            descriptor.id,
            getMockAuthData(eservice.producerId)
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.suspendDescriptor(
            eservice.id,
            descriptor.id,
            getMockAuthData(eservice.producerId)
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);
        await catalogService.activateDescriptor(
          eservice.id,
          descriptor.id,
          getMockAuthData(eservice.producerId)
        );

        const updatedDescriptor = {
          ...descriptor,
          state: descriptorState.published,
        };

        const writtenEvent = await readLastEventByStreamId(
          eservice.id,
          postgresDB
        );
        expect(writtenEvent.stream_id).toBe(eservice.id);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceDescriptorActivated");
        expect(writtenEvent.event_version).toBe(2);
        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceDescriptorActivatedV2,
          payload: writtenEvent.data,
        });

        const expectedEservice = toEServiceV2({
          ...eservice,
          descriptors: [updatedDescriptor],
        });
        expect(writtenPayload.eservice).toEqual(expectedEservice);
        expect(writtenPayload.descriptorId).toEqual(descriptor.id);
      });

      it("should throw eServiceNotFound if the eservice doesn't exist", () => {
        expect(
          catalogService.activateDescriptor(
            mockEService.id,
            mockDescriptor.id,
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

        expect(
          catalogService.activateDescriptor(
            eservice.id,
            mockDescriptor.id,
            getMockAuthData(eservice.producerId)
          )
        ).rejects.toThrowError(
          eServiceDescriptorNotFound(eservice.id, mockDescriptor.id)
        );
      });

      it("should throw operationForbidden if the requester is not the producer", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.suspended,
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.activateDescriptor(
            eservice.id,
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.activateDescriptor(
            mockEService.id,
            mockDescriptor.id,
            getMockAuthData(eservice.producerId)
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.activateDescriptor(
            mockEService.id,
            mockDescriptor.id,
            getMockAuthData(eservice.producerId)
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.activateDescriptor(
            mockEService.id,
            mockDescriptor.id,
            getMockAuthData(eservice.producerId)
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.activateDescriptor(
            mockEService.id,
            mockDescriptor.id,
            getMockAuthData(eservice.producerId)
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);

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
          eservice.id,
          descriptor.id,
          getMockAuthData(eservice.producerId)
        );

        const writtenEvent = await readLastEventByStreamId(
          newEService.id,
          postgresDB
        );
        expect(writtenEvent.stream_id).toBe(newEService.id);
        expect(writtenEvent.version).toBe("0");
        expect(writtenEvent.type).toBe("EServiceCloned");
        expect(writtenEvent.event_version).toBe(2);
        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceClonedV2,
          payload: writtenEvent.data,
        });

        const expectedInterface: Document = {
          ...interfaceDocument,
          id: unsafeBrandId(
            writtenPayload.clonedEservice!.descriptors[0].interface!.id
          ),
          uploadDate: new Date(
            writtenPayload.clonedEservice!.descriptors[0].interface!.uploadDate
          ),
          path: writtenPayload.clonedEservice!.descriptors[0].interface!.path,
        };
        const expectedDocument1: Document = {
          ...document1,
          id: unsafeBrandId(
            writtenPayload.clonedEservice!.descriptors[0].docs[0].id
          ),
          uploadDate: new Date(
            writtenPayload.clonedEservice!.descriptors[0].docs[0].uploadDate
          ),
          path: writtenPayload.clonedEservice!.descriptors[0].docs[0].path,
        };
        const expectedDocument2: Document = {
          ...document2,
          id: unsafeBrandId(
            writtenPayload.clonedEservice!.descriptors[0].docs[1].id
          ),
          uploadDate: new Date(
            writtenPayload.clonedEservice!.descriptors[0].docs[1].uploadDate
          ),
          path: writtenPayload.clonedEservice!.descriptors[0].docs[1].path,
        };

        const expectedDescriptor: Descriptor = {
          ...descriptor,
          id: unsafeBrandId(writtenPayload.clonedEservice!.descriptors[0].id),
          version: "1",
          interface: expectedInterface,
          createdAt: new Date(
            Number(writtenPayload.clonedEservice?.descriptors[0].createdAt)
          ),
          docs: [expectedDocument1, expectedDocument2],
        };

        const expectedEService: EService = {
          ...eservice,
          id: unsafeBrandId(writtenPayload.clonedEservice!.id),
          name: `${eservice.name} - clone - ${formatClonedEServiceDate(
            cloneTimestamp
          )}`,
          descriptors: [expectedDescriptor],
          createdAt: new Date(Number(writtenPayload.clonedEservice?.createdAt)),
        };
        expect(writtenPayload.clonedEservice).toEqual(
          toEServiceV2(expectedEService)
        );

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
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);

        await expect(
          catalogService.cloneDescriptor(
            eservice.id,
            descriptor.id,
            getMockAuthData(eservice.producerId)
          )
        ).rejects.toThrowError("Failed to copy file");
      });
      it("should throw eServiceDuplicate if an eservice with the same name already exists", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
          interface: mockDocument,
          docs: [mockDocument],
        };
        const eservice1: EService = {
          ...mockEService,
          id: generateId(),
          descriptors: [descriptor],
        };
        await addOneEService(eservice1, postgresDB, eservices);

        const cloneTimestamp = new Date();
        const conflictEServiceName = `${
          eservice1.name
        } - clone - ${formatClonedEServiceDate(cloneTimestamp)}`;

        const eservice2: EService = {
          ...mockEService,
          id: generateId(),
          name: conflictEServiceName,
          descriptors: [descriptor],
        };
        await addOneEService(eservice2, postgresDB, eservices);

        expect(
          catalogService.cloneDescriptor(
            eservice1.id,
            descriptor.id,
            getMockAuthData(eservice1.producerId)
          )
        ).rejects.toThrowError(eServiceDuplicate(conflictEServiceName));
      });
      it("should throw eServiceNotFound if the eservice doesn't exist", () => {
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.cloneDescriptor(
            eservice.id,
            descriptor.id,
            getMockAuthData()
          )
        ).rejects.toThrowError(operationForbidden);
      });
      it("should throw eServiceDescriptorNotFound if the descriptor doesn't exist", async () => {
        const eservice: EService = {
          ...mockEService,
          descriptors: [],
        };
        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.cloneDescriptor(
            mockEService.id,
            mockDescriptor.id,
            getMockAuthData(eservice.producerId)
          )
        ).rejects.toThrowError(
          eServiceDescriptorNotFound(eservice.id, mockDescriptor.id)
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);
        await catalogService.archiveDescriptor(
          eservice.id,
          descriptor.id,
          getMockAuthData(eservice.producerId)
        );

        const writtenEvent = await readLastEventByStreamId(
          eservice.id,
          postgresDB
        );
        expect(writtenEvent.stream_id).toBe(eservice.id);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceDescriptorActivated");
        expect(writtenEvent.event_version).toBe(2);
        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceDescriptorActivatedV2,
          payload: writtenEvent.data,
        });

        const updatedDescriptor = {
          ...descriptor,
          state: descriptorState.archived,
          archivedAt: new Date(
            Number(writtenPayload.eservice!.descriptors[0]!.archivedAt)
          ),
        };

        const expectedEService = toEServiceV2({
          ...eservice,
          descriptors: [updatedDescriptor],
        });
        expect(writtenPayload.eservice).toEqual(expectedEService);
        expect(writtenPayload.descriptorId).toEqual(descriptor.id);
      });

      it("should throw eServiceNotFound if the eservice doesn't exist", () => {
        expect(
          catalogService.archiveDescriptor(
            mockEService.id,
            mockDescriptor.id,
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

        expect(
          catalogService.archiveDescriptor(
            eservice.id,
            mockDescriptor.id,
            getMockAuthData(mockEService.producerId)
          )
        ).rejects.toThrowError(
          eServiceDescriptorNotFound(eservice.id, mockDescriptor.id)
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
        expect(
          catalogService.archiveDescriptor(
            eservice.id,
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
          type: "DraftEServiceUpdated",
          event_version: 2,
        });
        const writtenPayload = decodeProtobufPayload({
          messageType: DraftEServiceUpdatedV2,
          payload: writtenEvent.data,
        });
        expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
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
          type: "DraftEServiceUpdated",
          event_version: 2,
        });
        const writtenPayload = decodeProtobufPayload({
          messageType: DraftEServiceUpdatedV2,
          payload: writtenEvent.data,
        });
        expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
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
          type: "DraftEServiceUpdated",
          event_version: 2,
        });
        const writtenPayload = decodeProtobufPayload({
          messageType: DraftEServiceUpdatedV2,
          payload: writtenEvent.data,
        });
        expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
      });

      it("should throw eServiceNotFound if the eservice doesn't exist", () => {
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);

        await catalogService.uploadDocument(
          eservice.id,
          descriptor.id,
          buildInterfaceSeed(),
          getMockAuthData(eservice.producerId)
        );

        const writtenEvent = await readLastEventByStreamId(
          eservice.id,
          postgresDB
        );
        expect(writtenEvent.stream_id).toBe(eservice.id);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceDescriptorInterfaceAdded");
        expect(writtenEvent.event_version).toBe(2);
        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceDescriptorInterfaceDeletedV2,
          payload: writtenEvent.data,
        });

        const expectedEservice = toEServiceV2({
          ...eservice,
          descriptors: [
            {
              ...descriptor,
              interface: {
                ...mockDocument,
                id: unsafeBrandId(
                  writtenPayload.eservice!.descriptors[0]!.interface!.id
                ),
                checksum:
                  writtenPayload.eservice!.descriptors[0]!.interface!.checksum,
                uploadDate: new Date(
                  writtenPayload.eservice!.descriptors[0]!.interface!.uploadDate
                ),
              },
            },
          ],
        });

        expect(writtenPayload.descriptorId).toEqual(descriptor.id);
        expect(writtenPayload.eservice).toEqual(expectedEservice);
      });
      it("should throw eServiceNotFound if the eservice doesn't exist", () => {
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);

        expect(
          catalogService.uploadDocument(
            eservice.id,
            descriptor.id,
            buildInterfaceSeed(),
            getMockAuthData()
          )
        ).rejects.toThrowError(operationForbidden);
      });
      it("should throw eServiceDescriptorNotFound if the descriptor doesn't exist", async () => {
        const eservice: EService = {
          ...mockEService,
          descriptors: [],
        };
        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.uploadDocument(
            eservice.id,
            mockDescriptor.id,
            buildInterfaceSeed(),
            getMockAuthData(eservice.producerId)
          )
        ).rejects.toThrowError(
          eServiceDescriptorNotFound(eservice.id, mockDescriptor.id)
        );
      });
      it("should throw notValidDescriptor if the descriptor is in published state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.uploadDocument(
            eservice.id,
            descriptor.id,
            buildInterfaceSeed(),
            getMockAuthData(eservice.producerId)
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.uploadDocument(
            eservice.id,
            descriptor.id,
            buildInterfaceSeed(),
            getMockAuthData(eservice.producerId)
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.uploadDocument(
            eservice.id,
            descriptor.id,
            buildInterfaceSeed(),
            getMockAuthData(eservice.producerId)
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.uploadDocument(
            eservice.id,
            descriptor.id,
            buildInterfaceSeed(),
            getMockAuthData(eservice.producerId)
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.uploadDocument(
            eservice.id,
            descriptor.id,
            buildInterfaceSeed(),
            getMockAuthData(eservice.producerId)
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };

        await addOneEService(eservice, postgresDB, eservices);

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
          eservice.id,
          descriptor.id,
          document.id,
          getMockAuthData(eservice.producerId)
        );
        const writtenEvent = await readLastEventByStreamId(
          eservice.id,
          postgresDB
        );
        expect(writtenEvent.stream_id).toBe(eservice.id);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceDescriptorDocumentDeleted");
        expect(writtenEvent.event_version).toBe(2);
        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceDescriptorDocumentDeletedV2,
          payload: writtenEvent.data,
        });

        const expectedEservice = toEServiceV2({
          ...eservice,
          descriptors: [
            {
              ...descriptor,
              docs: [],
            },
          ],
        });

        expect(writtenPayload.descriptorId).toEqual(descriptor.id);
        expect(writtenPayload.documentId).toEqual(document.id);
        expect(writtenPayload.eservice).toEqual(expectedEservice);

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
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };

        await addOneEService(eservice, postgresDB, eservices);

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
          eservice.id,
          descriptor.id,
          interfaceDocument.id,
          getMockAuthData(eservice.producerId)
        );
        const writtenEvent = await readLastEventByStreamId(
          eservice.id,
          postgresDB
        );
        expect(writtenEvent.stream_id).toBe(eservice.id);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceDescriptorInterfaceDeleted");
        expect(writtenEvent.event_version).toBe(2);
        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceDescriptorInterfaceDeletedV2,
          payload: writtenEvent.data,
        });

        const expectedEservice = toEServiceV2({
          ...eservice,
          descriptors: [
            {
              ...descriptor,
              interface: undefined,
            },
          ],
        });

        expect(writtenPayload.descriptorId).toEqual(descriptor.id);
        expect(writtenPayload.documentId).toEqual(interfaceDocument.id);
        expect(writtenPayload.eservice).toEqual(expectedEservice);

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
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };

        await addOneEService(eservice, postgresDB, eservices);
        await expect(
          catalogService.deleteDocument(
            eservice.id,
            descriptor.id,
            mockDocument.id,
            getMockAuthData(eservice.producerId)
          )
        ).rejects.toThrowError("Failed to delete file");
      });
      it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.deleteDocument(
            eservice.id,
            descriptor.id,
            mockDocument.id,
            getMockAuthData()
          )
        ).rejects.toThrowError(operationForbidden);
      });
      it("should throw eServiceDescriptorNotFound if the descriptor doesn't exist", async () => {
        const eservice: EService = {
          ...mockEService,
          descriptors: [],
        };
        await addOneEService(eservice, postgresDB, eservices);

        expect(
          catalogService.deleteDocument(
            eservice.id,
            mockDescriptor.id,
            mockDocument.id,
            getMockAuthData(eservice.producerId)
          )
        ).rejects.toThrowError(
          eServiceDescriptorNotFound(eservice.id, mockDescriptor.id)
        );
      });
      it("should throw notValidDescriptor if the descriptor is in published state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
          docs: [mockDocument],
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.deleteDocument(
            eservice.id,
            descriptor.id,
            mockDocument.id,
            getMockAuthData(eservice.producerId)
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.deleteDocument(
            eservice.id,
            descriptor.id,
            mockDocument.id,
            getMockAuthData(eservice.producerId)
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.deleteDocument(
            eservice.id,
            descriptor.id,
            mockDocument.id,
            getMockAuthData(eservice.producerId)
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.deleteDocument(
            eservice.id,
            descriptor.id,
            mockDocument.id,
            getMockAuthData(eservice.producerId)
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);

        expect(
          catalogService.deleteDocument(
            eservice.id,
            descriptor.id,
            mockDocument.id,
            getMockAuthData(eservice.producerId)
          )
        ).rejects.toThrowError(
          eServiceDocumentNotFound(eservice.id, descriptor.id, mockDocument.id)
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);
        await catalogService.updateDocument(
          eservice.id,
          descriptor.id,
          mockDocument.id,
          { prettyName: "updated prettyName" },
          getMockAuthData(eservice.producerId)
        );
        const writtenEvent = await readLastEventByStreamId(
          eservice.id,
          postgresDB
        );
        const expectedEservice = toEServiceV2({
          ...eservice,
          descriptors: [
            {
              ...descriptor,
              docs: [
                {
                  ...mockDocument,
                  prettyName: "updated prettyName",
                },
              ],
            },
          ],
        });

        expect(writtenEvent.stream_id).toBe(eservice.id);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceDescriptorDocumentUpdated");
        expect(writtenEvent.event_version).toBe(2);
        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceDescriptorDocumentUpdatedV2,
          payload: writtenEvent.data,
        });

        expect(writtenPayload.descriptorId).toEqual(descriptor.id);
        expect(writtenPayload.documentId).toEqual(mockDocument.id);
        expect(writtenPayload.eservice).toEqual(expectedEservice);
      });
      it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.updateDocument(
            eservice.id,
            descriptor.id,
            mockDocument.id,
            { prettyName: "updated prettyName" },
            getMockAuthData()
          )
        ).rejects.toThrowError(operationForbidden);
      });
      it("should throw eServiceDescriptorNotFound if the descriptor doesn't exist", async () => {
        const eservice: EService = {
          ...mockEService,
          descriptors: [],
        };
        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.updateDocument(
            eservice.id,
            mockDescriptor.id,
            generateId(),
            { prettyName: "updated prettyName" },
            getMockAuthData(eservice.producerId)
          )
        ).rejects.toThrowError(
          eServiceDescriptorNotFound(eservice.id, mockDescriptor.id)
        );
      });
      it("should throw notValidDescriptor if the descriptor is in Published state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.published,
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.updateDocument(
            eservice.id,
            descriptor.id,
            generateId(),
            { prettyName: "updated prettyName" },
            getMockAuthData(eservice.producerId)
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.updateDocument(
            eservice.id,
            descriptor.id,
            generateId(),
            { prettyName: "updated prettyName" },
            getMockAuthData(eservice.producerId)
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.updateDocument(
            eservice.id,
            descriptor.id,
            generateId(),
            { prettyName: "updated prettyName" },
            getMockAuthData(eservice.producerId)
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.updateDocument(
            eservice.id,
            descriptor.id,
            generateId(),
            { prettyName: "updated prettyName" },
            getMockAuthData(eservice.producerId)
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.updateDocument(
            eservice.id,
            descriptor.id,
            mockDocument.id,
            { prettyName: "updated prettyName" },
            getMockAuthData(eservice.producerId)
          )
        ).rejects.toThrowError(
          eServiceDocumentNotFound(eservice.id, descriptor.id, mockDocument.id)
        );
      });
    });
  });

  describe("ReadModel Service", () => {
    describe("getEservices", () => {
      let organizationId1: TenantId;
      let organizationId2: TenantId;
      let organizationId3: TenantId;
      let eservice1: EService;
      let eservice2: EService;
      let eservice3: EService;
      let eservice4: EService;
      let eservice5: EService;
      let eservice6: EService;
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
        eservice1 = {
          ...mockEService,
          id: generateId(),
          name: "eservice 001 test",
          descriptors: [descriptor1],
          producerId: organizationId1,
        };
        await addOneEService(eservice1, postgresDB, eservices);

        const descriptor2: Descriptor = {
          ...mockDescriptor,
          id: generateId(),
          interface: mockDocument,
          state: descriptorState.published,
          attributes: attributesForDescriptor1and2,
        };
        eservice2 = {
          ...mockEService,
          id: generateId(),
          name: "eservice 002 test",
          descriptors: [descriptor2],
          producerId: organizationId1,
        };
        await addOneEService(eservice2, postgresDB, eservices);

        const descriptor3: Descriptor = {
          ...mockDescriptor,
          id: generateId(),
          interface: mockDocument,
          state: descriptorState.published,
          attributes: attributesForDescriptor3,
        };
        eservice3 = {
          ...mockEService,
          id: generateId(),
          name: "eservice 003 test",
          descriptors: [descriptor3],
          producerId: organizationId1,
        };
        await addOneEService(eservice3, postgresDB, eservices);

        const descriptor4: Descriptor = {
          ...mockDescriptor,
          id: generateId(),
          interface: mockDocument,
          state: descriptorState.archived,
          attributes: attributesForDescriptor4,
        };
        eservice4 = {
          ...mockEService,
          id: generateId(),
          name: "eservice 004 test",
          producerId: organizationId2,
          descriptors: [descriptor4],
        };
        await addOneEService(eservice4, postgresDB, eservices);

        const descriptor5: Descriptor = {
          ...mockDescriptor,
          id: generateId(),
          interface: mockDocument,
          state: descriptorState.published,
        };
        eservice5 = {
          ...mockEService,
          id: generateId(),
          name: "eservice 005 test",
          producerId: organizationId2,
          descriptors: [descriptor5],
        };
        await addOneEService(eservice5, postgresDB, eservices);

        const descriptor6: Descriptor = {
          ...mockDescriptor,
          id: generateId(),
          interface: mockDocument,
          state: descriptorState.archived,
        };
        eservice6 = {
          ...mockEService,
          id: generateId(),
          name: "eservice 006",
          producerId: organizationId2,
          descriptors: [descriptor6],
        };
        await addOneEService(eservice6, postgresDB, eservices);

        const tenant: Tenant = {
          ...getMockTenant(),
          id: organizationId3,
        };
        await addOneTenant(tenant, tenants);
        const agreement1 = getMockAgreement({
          eserviceId: eservice1.id,
          descriptorId: descriptor1.id,
          producerId: eservice1.producerId,
          consumerId: tenant.id,
        });
        await addOneAgreement(agreement1, agreements);
        const agreement2 = getMockAgreement({
          eserviceId: eservice3.id,
          descriptorId: descriptor3.id,
          producerId: eservice3.producerId,
          consumerId: tenant.id,
        });
        await addOneAgreement(agreement2, agreements);
        const agreement3 = {
          ...getMockAgreement({
            eserviceId: eservice4.id,
            descriptorId: descriptor4.id,
            producerId: eservice4.producerId,
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
            eservicesIds: [eservice1.id, eservice2.id],
            producersIds: [],
            states: [],
            agreementStates: [],
            attributesIds: [],
          },
          0,
          50
        );
        expect(result.totalCount).toBe(2);
        expect(result.results).toEqual([eservice1, eservice2]);
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
        expect(result.results).toEqual([eservice1, eservice2, eservice3]);
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
          eservice1,
          eservice2,
          eservice3,
          eservice5,
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
        expect(result1.results).toEqual([eservice1, eservice3]);
        expect(result2.totalCount).toBe(3);
        expect(result2.results).toEqual([eservice1, eservice3, eservice4]);
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
          eservice1,
          eservice2,
          eservice3,
          eservice4,
          eservice5,
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
        expect(result.results).toEqual([eservice1, eservice3]);
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
        expect(result.results).toEqual([eservice5]);
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
          eservice1,
          eservice2,
          eservice3,
          eservice4,
        ]);
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
            name: eservice1.name.slice(-6),
            attributesIds: [attributesForDescriptor1and2.verified[0][1].id],
          },
          0,
          50
        );
        expect(result.totalCount).toBe(1);
        expect(result.results).toEqual([eservice1]);
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
        expect(result.results).toEqual([eservice4]);
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
        expect(result.results).toEqual([eservice1]);
      });

      it("should get the eServices if they exist (parameters: attributesIds, agreementStates, eservicesIds)", async () => {
        const result = await readModelService.getEServices(
          getMockAuthData(organizationId3),
          {
            eservicesIds: [eservice1.id, eservice4.id],
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
        expect(result.results).toEqual([eservice1, eservice4]);
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
        const eservice7: EService = {
          ...mockEService,
          id: generateId(),
          name: "eservice 007",
          producerId: organizationId1,
          descriptors: [],
        };
        const authData: AuthData = {
          ...getMockAuthData(organizationId1),
          userRoles: [userRoles.ADMIN_ROLE],
        };
        await addOneEService(eservice7, postgresDB, eservices);
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
          eservice1,
          eservice2,
          eservice3,
          eservice4,
          eservice5,
          eservice6,
          eservice7,
        ]);
      });
      it("should not include eservices with no descriptors (requester is the producer, not admin nor api)", async () => {
        const eservice7: EService = {
          ...mockEService,
          id: generateId(),
          name: "eservice 007",
          producerId: organizationId1,
          descriptors: [],
        };
        const authData: AuthData = {
          ...getMockAuthData(organizationId1),
          userRoles: [userRoles.SUPPORT_ROLE],
        };
        await addOneEService(eservice7, postgresDB, eservices);
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
          eservice1,
          eservice2,
          eservice3,
          eservice4,
          eservice5,
          eservice6,
        ]);
      });
      it("should not include eservices with no descriptors (requester is not the producer)", async () => {
        const eservice7: EService = {
          ...mockEService,
          id: generateId(),
          producerId: organizationId1,
          name: "eservice 007",
          descriptors: [],
        };
        const authData: AuthData = {
          ...getMockAuthData(),
          userRoles: [userRoles.ADMIN_ROLE],
        };
        await addOneEService(eservice7, postgresDB, eservices);
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
          eservice1,
          eservice2,
          eservice3,
          eservice4,
          eservice5,
          eservice6,
        ]);
      });
      it("should include eservices whose only descriptor is draft (requester is the producer, admin)", async () => {
        const descriptor8: Descriptor = {
          ...mockDescriptor,
          id: generateId(),
          state: descriptorState.draft,
        };
        const eservice8: EService = {
          ...mockEService,
          id: generateId(),
          name: "eservice 008",
          producerId: organizationId1,
          descriptors: [descriptor8],
        };
        const authData: AuthData = {
          ...getMockAuthData(organizationId1),
          userRoles: [userRoles.ADMIN_ROLE],
        };
        await addOneEService(eservice8, postgresDB, eservices);
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
          eservice1,
          eservice2,
          eservice3,
          eservice4,
          eservice5,
          eservice6,
          eservice8,
        ]);
      });
      it("should not include eservices whose only descriptor is draft (requester is the producer, not admin nor api)", async () => {
        const descriptor8: Descriptor = {
          ...mockDescriptor,
          id: generateId(),
          state: descriptorState.draft,
        };
        const eservice8: EService = {
          ...mockEService,
          id: generateId(),
          name: "eservice 008",
          producerId: organizationId1,
          descriptors: [descriptor8],
        };
        const authData: AuthData = {
          ...getMockAuthData(organizationId1),
          userRoles: [userRoles.SUPPORT_ROLE],
        };
        await addOneEService(eservice8, postgresDB, eservices);
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
          eservice1,
          eservice2,
          eservice3,
          eservice4,
          eservice5,
          eservice6,
        ]);
      });
      it("should not include eservices whose only descriptor is draft (requester is not the producer)", async () => {
        const descriptor8: Descriptor = {
          ...mockDescriptor,
          id: generateId(),
          state: descriptorState.draft,
        };
        const eservice8: EService = {
          ...mockEService,
          id: generateId(),
          name: "eservice 008",
          producerId: organizationId1,
          descriptors: [descriptor8],
        };
        const authData: AuthData = {
          ...getMockAuthData(),
          userRoles: [userRoles.ADMIN_ROLE],
        };
        await addOneEService(eservice8, postgresDB, eservices);
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
          eservice1,
          eservice2,
          eservice3,
          eservice4,
          eservice5,
          eservice6,
        ]);
      });
      it("should not filter out draft descriptors if the eservice has both draft and non-draft ones (requester is the producer, admin)", async () => {
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
        const eservice9: EService = {
          ...mockEService,
          id: generateId(),
          name: "eservice 008",
          producerId: organizationId1,
          descriptors: [descriptor9a, descriptor9b],
        };
        const authData: AuthData = {
          ...getMockAuthData(organizationId1),
          userRoles: [userRoles.ADMIN_ROLE],
        };
        await addOneEService(eservice9, postgresDB, eservices);
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
          eservice1,
          eservice2,
          eservice3,
          eservice4,
          eservice5,
          eservice6,
          eservice9,
        ]);
      });
      it("should filter out draft descriptors if the eservice has both draft and non-draft ones (requester is the producer, but not admin nor api)", async () => {
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
        const eservice9: EService = {
          ...mockEService,
          id: generateId(),
          name: "eservice 008",
          producerId: organizationId1,
          descriptors: [descriptor9a, descriptor9b],
        };
        const authData: AuthData = {
          ...getMockAuthData(organizationId1),
          userRoles: [userRoles.SUPPORT_ROLE],
        };
        await addOneEService(eservice9, postgresDB, eservices);
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
          eservice1,
          eservice2,
          eservice3,
          eservice4,
          eservice5,
          eservice6,
          { ...eservice9, descriptors: [descriptor9a] },
        ]);
      });
      it("should filter out draft descriptors if the eservice has both draft and non-draft ones (requester is not the producer)", async () => {
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
        const eservice9: EService = {
          ...mockEService,
          id: generateId(),
          name: "eservice 008",
          producerId: organizationId1,
          descriptors: [descriptor9a, descriptor9b],
        };
        const authData: AuthData = {
          ...getMockAuthData(),
          userRoles: [userRoles.ADMIN_ROLE],
        };
        await addOneEService(eservice9, postgresDB, eservices);
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
          eservice1,
          eservice2,
          eservice3,
          eservice4,
          eservice5,
          eservice6,
          { ...eservice9, descriptors: [descriptor9a] },
        ]);
      });
    });

    describe("getEServiceByNameAndProducerId", () => {
      it("should get the eservice if it matches the name and the producerId", async () => {
        const organizationId1: TenantId = generateId();
        const organizationId2: TenantId = generateId();
        const eservice1: EService = {
          ...mockEService,
          id: generateId(),
          name: "eservice 001",
          producerId: organizationId1,
        };
        await addOneEService(eservice1, postgresDB, eservices);

        const eservice2: EService = {
          ...mockEService,
          id: generateId(),
          name: "eservice 002",
          producerId: organizationId1,
        };
        await addOneEService(eservice2, postgresDB, eservices);

        const eservice3: EService = {
          ...mockEService,
          id: generateId(),
          name: "eservice 001",
          producerId: organizationId2,
        };
        await addOneEService(eservice3, postgresDB, eservices);

        const result = await readModelService.getEServiceByNameAndProducerId({
          name: "eservice 001",
          producerId: organizationId1,
        });
        expect(result?.data).toEqual(eservice1);
      });
      it("should not get the eservice if it doesn't exist", async () => {
        const organizationId: TenantId = generateId();
        const eservice1: EService = {
          ...mockEService,
          id: generateId(),
          name: "eservice 001",
          producerId: organizationId,
        };
        await addOneEService(eservice1, postgresDB, eservices);

        const eservice2: EService = {
          ...mockEService,
          id: generateId(),
          name: "eservice 002",
          producerId: organizationId,
        };
        await addOneEService(eservice2, postgresDB, eservices);

        const result = await readModelService.getEServiceByNameAndProducerId({
          name: "not-existing",
          producerId: organizationId,
        });
        expect(result).toBeUndefined();
      });
    });

    describe("getEServiceById", () => {
      it("should get the eservice if it exists (requester is the producer, admin)", async () => {
        const descriptor1: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.published,
        };
        const eservice1: EService = {
          ...mockEService,
          id: generateId(),
          name: "eservice 001",
          descriptors: [descriptor1],
        };
        await addOneEService(eservice1, postgresDB, eservices);
        const authData: AuthData = {
          ...getMockAuthData(eservice1.producerId),
          userRoles: [userRoles.ADMIN_ROLE],
        };

        const descriptor2: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.published,
        };
        const eservice2: EService = {
          ...mockEService,
          id: generateId(),
          name: "eservice 002",
          descriptors: [descriptor2],
        };
        await addOneEService(eservice2, postgresDB, eservices);

        const descriptor3: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.published,
        };
        const eservice3: EService = {
          ...mockEService,
          id: generateId(),
          name: "eservice 003",
          descriptors: [descriptor3],
        };
        await addOneEService(eservice3, postgresDB, eservices);

        const result = await catalogService.getEServiceById(
          eservice1.id,
          authData
        );
        expect(result).toEqual(eservice1);
      });

      it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
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
      it("should filter out the draft descriptors if the eservice has both draft and non-draft ones (requester is not the producer)", async () => {
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
      it("should filter out the draft descriptors if the eservice has both draft and non-draft ones (requester is the producer but not admin nor api)", async () => {
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
      it("should get the consumers of the given eservice", async () => {
        const descriptor1: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.published,
        };
        const eservice1: EService = {
          ...mockEService,
          descriptors: [descriptor1],
        };
        await addOneEService(eservice1, postgresDB, eservices);
        const tenant = getMockTenant();
        await addOneTenant(tenant, tenants);
        const agreement = getMockAgreement({
          eserviceId: eservice1.id,
          descriptorId: descriptor1.id,
          producerId: eservice1.producerId,
          consumerId: tenant.id,
        });
        await addOneAgreement(agreement, agreements);

        const result = await readModelService.getEServiceConsumers(
          eservice1.id,
          0,
          50
        );
        expect(result.totalCount).toBe(1);
        expect(result.results[0].consumerName).toBe(tenant.name);
      });

      it("should not get any consumers, if no one is using the given eservice", async () => {
        const descriptor1: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.published,
        };
        const eservice1: EService = {
          ...mockEService,
          descriptors: [descriptor1],
        };
        await addOneEService(eservice1, postgresDB, eservices);

        const consumers = await readModelService.getEServiceConsumers(
          eservice1.id,
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
        const eservice: EService = {
          ...mockEService,
          id: generateId(),
          name: "eservice 001",
          descriptors: [descriptor],
        };
        const authData: AuthData = {
          ...getMockAuthData(eservice.producerId),
          userRoles: [userRoles.ADMIN_ROLE],
        };
        await addOneEService(eservice, postgresDB, eservices);
        const result = await catalogService.getDocumentById({
          eserviceId: eservice.id,
          descriptorId: descriptor.id,
          documentId: mockDocument.id,
          authData,
        });
        expect(result).toEqual(mockDocument);
      });

      it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
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
          name: "eservice 001",
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

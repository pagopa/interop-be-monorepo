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
  FileManagerError,
  ReadModelRepository,
  TenantCollection,
  fileManagerDeleteError,
  initDB,
  initFileManager,
  unexpectedFieldError,
  unexpectedFieldValueError,
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
  EServiceDescriptorDocumentDeletedV2,
  EServiceDescriptorDocumentUpdatedV2,
  EServiceDescriptorInterfaceDeletedV2,
  EServiceDescriptorPublishedV2,
  EServiceDescriptorQuotasUpdatedV2,
  EServiceDescriptorSuspendedV2,
  EServiceDraftDescriptorDeletedV2,
  EServiceDraftDescriptorUpdatedV2,
  EServiceId,
  EServiceRiskAnalysisAddedV2,
  EServiceRiskAnalysisUpdatedV2,
  RiskAnalysisFormId,
  RiskAnalysisId,
  RiskAnalysisMultiAnswerId,
  EServiceRiskAnalysisDeletedV2,
  RiskAnalysisSingleAnswerId,
  Tenant,
  TenantId,
  TenantKind,
  agreementState,
  descriptorState,
  eserviceMode,
  generateId,
  operationForbidden,
  tenantKind,
  unsafeBrandId,
  toEServiceV2,
} from "pagopa-interop-models";
import {
  TEST_MINIO_PORT,
  TEST_MONGO_DB_PORT,
  TEST_POSTGRES_DB_PORT,
  decodeProtobufPayload,
  getMockValidRiskAnalysis,
  minioContainer,
  mongoDBContainer,
  postgreSQLContainer,
  randomArrayItem,
} from "pagopa-interop-commons-test";
import { StartedTestContainer } from "testcontainers";
import { v4 as uuidv4 } from "uuid";
import { config } from "../src/utilities/config.js";
import {
  EServiceDescriptorSeed,
  EServiceRiskAnalysisSeed,
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
  draftDescriptorAlreadyExists,
  eServiceDescriptorNotFound,
  eServiceDescriptorWithoutInterface,
  eServiceDocumentNotFound,
  eServiceDuplicate,
  eServiceNotFound,
  eServiceRiskAnalysisIsRequired,
  eServiceRiskAnalysisNotFound,
  eserviceNotInDraftState,
  eserviceNotInReceiveMode,
  inconsistentDailyCalls,
  interfaceAlreadyExists,
  notValidDescriptor,
  originNotCompliant,
  riskAnalysisNotValid,
  riskAnalysisValidationFailed,
  tenantKindNotFound,
  tenantNotFound,
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
  readLastEserviceEvent,
  addOneAttribute,
  getMockEServiceAttributes,
  buildRiskAnalysisSeed,
  getMockAuthDataInternal,
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
  const s3OriginalBucket = config.s3Bucket;

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

    // Some tests change the bucket name, so we need to reset it
    config.s3Bucket = s3OriginalBucket;
  });

  afterAll(async () => {
    await startedPostgreSqlContainer.stop();
    await startedMongodbContainer.stop();
    await startedMinioContainer.stop();
  });

  describe("Catalog service", () => {
    describe("create eservice", () => {
      it("should write on event-store for the creation of an eservice", async () => {
        const eservice = await catalogService.createEService(
          {
            name: mockEService.name,
            description: mockEService.description,
            technology: "REST",
            mode: "DELIVER",
          },
          getMockAuthData(mockEService.producerId),
          uuidv4()
        );

        expect(eservice).toBeDefined();
        const writtenEvent = await readLastEserviceEvent(
          eservice.id,
          postgresDB
        );
        expect(writtenEvent).toMatchObject({
          stream_id: eservice.id,
          version: "0",
          type: "EServiceAdded",
          event_version: 2,
        });
        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceAddedV2,
          payload: writtenEvent.data,
        });

        const expectedEservice: EService = {
          ...mockEService,
          createdAt: new Date(Number(writtenPayload.eservice!.createdAt)),
          id: eservice.id,
        };

        expect(writtenPayload.eservice).toEqual(toEServiceV2(expectedEservice));
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
            getMockAuthData(mockEService.producerId),
            uuidv4()
          )
        ).rejects.toThrowError(eServiceDuplicate(mockEService.name));
      });

      it("should throw originNotCompliant if the requester externalId origin is not allowed", async () => {
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
              externalId: {
                value: "123456",
                origin: "not-allowed-origin",
              },
            },
            uuidv4()
          )
        ).rejects.toThrowError(originNotCompliant("not-allowed-origin"));
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
          getMockAuthData(mockEService.producerId),
          uuidv4()
        );

        const updatedEService: EService = {
          ...eservice,
          name: updatedName,
        };

        const writtenEvent = await readLastEserviceEvent(
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
          eservice.id,
          {
            name: updatedName,
            description: eservice.description,
            technology: "SOAP",
            mode: "DELIVER",
          },
          getMockAuthData(eservice.producerId),
          uuidv4()
        );

        const updatedEService: EService = {
          ...eservice,
          name: updatedName,
          technology: "Soap",
          descriptors: eservice.descriptors.map((d) => ({
            ...d,
            interface: undefined,
          })),
        };

        const writtenEvent = await readLastEserviceEvent(
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
        expect(fileManager.delete).toHaveBeenCalledWith(
          config.s3Bucket,
          interfaceDocument.path
        );
        expect(await fileManager.listFiles(config.s3Bucket)).not.toContain(
          interfaceDocument.path
        );
      });

      it("should fail if the file deletion fails when interface file has to be deleted on technology change", async () => {
        config.s3Bucket = "invalid-bucket"; // configure an invalid bucket to force a failure

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
            getMockAuthData(mockEService.producerId),
            uuidv4()
          )
        ).rejects.toThrowError(
          fileManagerDeleteError(
            mockDocument.path,
            config.s3Bucket,
            new Error("The specified bucket does not exist")
          )
        );
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
          getMockAuthData(mockEService.producerId),
          uuidv4()
        );

        const updatedEService: EService = {
          ...mockEService,
          description: updatedDescription,
        };

        const writtenEvent = await readLastEserviceEvent(
          mockEService.id,
          postgresDB
        );
        expect(writtenEvent).toMatchObject({
          stream_id: mockEService.id,
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

      it("should write on event-store for the update of an eService (update mode to DELIVER so risk analysis has to be deleted)", async () => {
        const riskAnalysis = getMockValidRiskAnalysis("PA");
        const eservice: EService = {
          ...mockEService,
          descriptors: [],
          riskAnalysis: [riskAnalysis],
          mode: "Receive",
        };
        await addOneEService(eservice, postgresDB, eservices);

        await catalogService.updateEService(
          eservice.id,
          {
            name: eservice.name,
            description: eservice.description,
            technology: "REST",
            mode: "DELIVER",
          },
          getMockAuthData(eservice.producerId),
          uuidv4()
        );

        const expectedEservice: EService = {
          ...eservice,
          mode: eserviceMode.deliver,
          riskAnalysis: [],
        };

        const writtenEvent = await readLastEserviceEvent(
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

        expect(writtenPayload.eservice).toEqual(toEServiceV2(expectedEservice));
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
            getMockAuthData(mockEService.producerId),
            uuidv4()
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
            getMockAuthData(),
            uuidv4()
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
            getMockAuthData(eservice1.producerId),
            uuidv4()
          )
        ).rejects.toThrowError(
          eServiceDuplicate("eservice name already in use")
        );
      });

      it("should throw eserviceNotInDraftState if the eservice descriptor is in published state", async () => {
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
            getMockAuthData(eservice.producerId),
            uuidv4()
          )
        ).rejects.toThrowError(eserviceNotInDraftState(eservice.id));
      });

      it("should throw eserviceNotInDraftState if the eservice descriptor is in archived state", async () => {
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
            getMockAuthData(eservice.producerId),
            uuidv4()
          )
        ).rejects.toThrowError(eserviceNotInDraftState(eservice.id));
      });

      it("should throw eserviceNotInDraftState if the eservice descriptor is in suspended state", async () => {
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
            getMockAuthData(eservice.producerId),
            uuidv4()
          )
        ).rejects.toThrowError(eserviceNotInDraftState(eservice.id));
      });

      it("should throw eserviceNotInDraftState if the eservice descriptor is in deprecated state", async () => {
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
            getMockAuthData(eservice.producerId),
            uuidv4()
          )
        ).rejects.toThrowError(eserviceNotInDraftState(eservice.id));
      });
    });

    describe("delete eservice", () => {
      it("should write on event-store for the deletion of an eservice (eservice with no descriptors)", async () => {
        const eservice: EService = {
          ...mockEService,
          descriptors: [],
        };
        await addOneEService(eservice, postgresDB, eservices);
        await catalogService.deleteEService(
          eservice.id,
          getMockAuthData(eservice.producerId),
          uuidv4()
        );
        const writtenEvent = await readLastEserviceEvent(
          eservice.id,
          postgresDB
        );
        expect(writtenEvent).toMatchObject({
          stream_id: eservice.id,
          version: "1",
          type: "EServiceDeleted",
          event_version: 2,
        });
        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceDeletedV1,
          payload: writtenEvent.data,
        });
        expect(writtenPayload.eserviceId).toBe(eservice.id);
      });

      it("should write on event-store for the deletion of an eservice (eservice with a draft descriptor only)", async () => {
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
        await catalogService.deleteEService(
          eservice.id,
          getMockAuthData(eservice.producerId),
          uuidv4()
        );
        const writtenEvent = await readLastEserviceEvent(
          eservice.id,
          postgresDB
        );
        expect(writtenEvent).toMatchObject({
          stream_id: eservice.id,
          version: "1",
          type: "EServiceDeleted",
          event_version: 2,
        });
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
            getMockAuthData(mockEService.producerId),
            uuidv4()
          )
        ).rejects.toThrowError(eServiceNotFound(mockEService.id));
      });

      it("should throw operationForbidden if the requester is not the producer", async () => {
        await addOneEService(mockEService, postgresDB, eservices);
        expect(
          catalogService.deleteEService(
            mockEService.id,
            getMockAuthData(),
            uuidv4()
          )
        ).rejects.toThrowError(operationForbidden);
      });

      it("should throw eserviceNotInDraftState if the eservice has both draft and non-draft descriptors", async () => {
        const descriptor1: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.published,
          publishedAt: new Date(),
        };
        const descriptor2: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.draft,
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor1, descriptor2],
        };
        await addOneEService(eservice, postgresDB, eservices);
        expect(
          catalogService.deleteEService(
            eservice.id,
            getMockAuthData(eservice.producerId),
            uuidv4()
          )
        ).rejects.toThrowError(eserviceNotInDraftState(eservice.id));
      });
    });

    describe("create descriptor", async () => {
      it("should write on event-store for the creation of a descriptor (eservice had no descriptors)", async () => {
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
        const eservice: EService = {
          ...mockEService,
          descriptors: [],
        };
        await addOneEService(eservice, postgresDB, eservices);
        const newDescriptorId = (
          await catalogService.createDescriptor(
            eservice.id,
            descriptorSeed,
            getMockAuthData(eservice.producerId),
            uuidv4()
          )
        ).id;
        const writtenEvent = await readLastEserviceEvent(
          eservice.id,
          postgresDB
        );
        expect(writtenEvent).toMatchObject({
          stream_id: eservice.id,
          version: "1",
          type: "EServiceDescriptorAdded",
          event_version: 2,
        });
        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceDescriptorAddedV2,
          payload: writtenEvent.data,
        });

        const expectedEservice = toEServiceV2({
          ...eservice,
          descriptors: [
            {
              ...mockDescriptor,
              version: "1",
              createdAt: new Date(
                Number(writtenPayload.eservice!.descriptors[0]!.createdAt)
              ),
              id: newDescriptorId,
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

        expect(writtenPayload).toEqual({
          descriptorId: newDescriptorId,
          eservice: expectedEservice,
        });
      });

      it("should write on event-store for the creation of a descriptor (eservice already had one descriptor)", async () => {
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
        const newDescriptorId = (
          await catalogService.createDescriptor(
            eservice.id,
            descriptorSeed,
            getMockAuthData(eservice.producerId),
            uuidv4()
          )
        ).id;
        const writtenEvent = await readLastEserviceEvent(
          eservice.id,
          postgresDB
        );
        expect(writtenEvent).toMatchObject({
          stream_id: eservice.id,
          version: "1",
          type: "EServiceDescriptorAdded",
          event_version: 2,
        });
        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceDescriptorAddedV2,
          payload: writtenEvent.data,
        });

        const newDescriptor: Descriptor = {
          ...mockDescriptor,
          version: "2",
          createdAt: new Date(
            Number(writtenPayload.eservice!.descriptors[1]!.createdAt)
          ),
          id: newDescriptorId,
          serverUrls: [],
          attributes: {
            certified: [],
            declared: [
              [{ id: attribute.id, explicitAttributeVerification: false }],
            ],
            verified: [],
          },
        };

        const expectedEservice = toEServiceV2({
          ...eservice,
          descriptors: [...eservice.descriptors, newDescriptor],
        });

        expect(writtenPayload).toEqual({
          descriptorId: newDescriptorId,
          eservice: expectedEservice,
        });
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
            getMockAuthData(eservice.producerId),
            uuidv4()
          )
        ).rejects.toThrowError(draftDescriptorAlreadyExists(eservice.id));
      });

      it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
        expect(
          catalogService.createDescriptor(
            mockEService.id,
            buildDescriptorSeed(mockDescriptor),
            getMockAuthData(mockEService.producerId),
            uuidv4()
          )
        ).rejects.toThrowError(eServiceNotFound(mockEService.id));
      });
      it("should throw attributeNotFound if at least one of the attributes doesn't exist", async () => {
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
            getMockAuthData(eservice.producerId),
            uuidv4()
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
            getMockAuthData(),
            uuidv4()
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
            getMockAuthData(eservice.producerId),
            uuidv4()
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
        const attribute: Attribute = {
          name: "Attribute name",
          id: generateId(),
          kind: "Declared",
          description: "Attribute Description",
          creationTime: new Date(),
        };
        await addOneAttribute(attribute, attributes);

        const updatedDescriptorSeed: EServiceDescriptorSeed = {
          ...buildDescriptorSeed(descriptor),
          dailyCallsTotal: 200,
          attributes: {
            certified: [],
            declared: [
              [{ id: attribute.id, explicitAttributeVerification: false }],
            ],
            verified: [],
          },
        };

        const updatedEService: EService = {
          ...eservice,
          descriptors: [
            {
              ...descriptor,
              dailyCallsTotal: 200,
              attributes: {
                certified: [],
                declared: [
                  [{ id: attribute.id, explicitAttributeVerification: false }],
                ],
                verified: [],
              },
            },
          ],
        };
        await catalogService.updateDraftDescriptor(
          eservice.id,
          descriptor.id,
          updatedDescriptorSeed,
          getMockAuthData(eservice.producerId),
          uuidv4()
        );
        const writtenEvent = await readLastEserviceEvent(
          eservice.id,
          postgresDB
        );
        expect(writtenEvent).toMatchObject({
          stream_id: eservice.id,
          version: "1",
          type: "EServiceDraftDescriptorUpdated",
          event_version: 2,
        });
        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceDraftDescriptorUpdatedV2,
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
            getMockAuthData(mockEService.producerId),
            uuidv4()
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
            getMockAuthData(mockEService.producerId),
            uuidv4()
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
            getMockAuthData(eservice.producerId),
            uuidv4()
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
            getMockAuthData(eservice.producerId),
            uuidv4()
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
            getMockAuthData(eservice.producerId),
            uuidv4()
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
            getMockAuthData(eservice.producerId),
            uuidv4()
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
            getMockAuthData(),
            uuidv4()
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
            getMockAuthData(eservice.producerId),
            uuidv4()
          )
        ).rejects.toThrowError(inconsistentDailyCalls());
      });

      it("should throw attributeNotFound if at least one of the attributes doesn't exist", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
          attributes: {
            certified: [],
            declared: [],
            verified: [],
          },
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
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
          catalogService.updateDraftDescriptor(
            eservice.id,
            descriptor.id,
            descriptorSeed,
            getMockAuthData(eservice.producerId),
            uuidv4()
          )
        ).rejects.toThrowError(attributeNotFound(notExistingId1));
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
          getMockAuthData(eservice.producerId),
          uuidv4()
        );

        const writtenEvent = await readLastEserviceEvent(
          eservice.id,
          postgresDB
        );
        expect(writtenEvent).toMatchObject({
          stream_id: eservice.id,
          version: "1",
          type: "EServiceDraftDescriptorDeleted",
          event_version: 2,
        });

        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceDraftDescriptorDeletedV2,
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
          getMockAuthData(eservice.producerId),
          uuidv4()
        );

        const writtenEvent = await readLastEserviceEvent(
          eservice.id,
          postgresDB
        );
        expect(writtenEvent).toMatchObject({
          stream_id: eservice.id,
          version: "1",
          type: "EServiceDraftDescriptorDeleted",
          event_version: 2,
        });
        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceDraftDescriptorDeletedV2,
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
        config.s3Bucket = "invalid-bucket"; // configure an invalid bucket to force a failure

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
            getMockAuthData(eservice.producerId),
            uuidv4()
          )
        ).rejects.toThrowError(
          fileManagerDeleteError(
            mockDocument.path,
            config.s3Bucket,
            new Error("The specified bucket does not exist")
          )
        );
      });

      it("should throw eServiceNotFound if the eservice doesn't exist", () => {
        expect(
          catalogService.deleteDraftDescriptor(
            mockEService.id,
            mockDescriptor.id,
            getMockAuthData(mockEService.producerId),
            uuidv4()
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
            getMockAuthData(mockEService.producerId),
            uuidv4()
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
            getMockAuthData(),
            uuidv4()
          )
        ).rejects.toThrowError(operationForbidden);
      });

      it("should throw notValidDescriptor if the eservice is in published state", async () => {
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
          catalogService.deleteDraftDescriptor(
            eservice.id,
            descriptor.id,
            getMockAuthData(eservice.producerId),
            uuidv4()
          )
        ).rejects.toThrowError(
          notValidDescriptor(descriptor.id, descriptorState.published)
        );
      });
      it("should throw notValidDescriptor if the eservice is in deprecated state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.deprecated,
          publishedAt: new Date(),
          deprecatedAt: new Date(),
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
            getMockAuthData(eservice.producerId),
            uuidv4()
          )
        ).rejects.toThrowError(
          notValidDescriptor(descriptor.id, descriptorState.deprecated)
        );
      });
      it("should throw notValidDescriptor if the eservice is in suspended state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.suspended,
          publishedAt: new Date(),
          suspendedAt: new Date(),
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
            getMockAuthData(eservice.producerId),
            uuidv4()
          )
        ).rejects.toThrowError(
          notValidDescriptor(descriptor.id, descriptorState.suspended)
        );
      });
      it("should throw notValidDescriptor if the eservice is in archived state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
          state: descriptorState.archived,
          publishedAt: new Date(),
          archivedAt: new Date(),
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
            getMockAuthData(eservice.producerId),
            uuidv4()
          )
        ).rejects.toThrowError(
          notValidDescriptor(descriptor.id, descriptorState.archived)
        );
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
      it("should write on event-store for the publication of a descriptor with mode Deliver", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
          interface: mockDocument,
        };
        const eservice: EService = {
          ...mockEService,
          mode: eserviceMode.deliver,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);
        await catalogService.publishDescriptor(
          eservice.id,
          descriptor.id,
          getMockAuthData(eservice.producerId),
          uuidv4()
        );

        const writtenEvent = await readLastEserviceEvent(
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

      it("should write on event-store for the publication of a descriptor with mode Receive", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
          interface: mockDocument,
        };

        const producerTenantKind: TenantKind = randomArrayItem(
          Object.values(tenantKind)
        );
        const producer: Tenant = {
          ...getMockTenant(),
          kind: producerTenantKind,
        };

        const riskAnalysis = getMockValidRiskAnalysis(producerTenantKind);

        const eservice: EService = {
          ...mockEService,
          producerId: producer.id,
          mode: eserviceMode.receive,
          descriptors: [descriptor],
          riskAnalysis: [riskAnalysis],
        };

        await addOneTenant(producer, tenants);
        await addOneEService(eservice, postgresDB, eservices);

        await catalogService.publishDescriptor(
          eservice.id,
          descriptor.id,
          getMockAuthData(eservice.producerId),
          uuidv4()
        );

        const writtenEvent = await readLastEserviceEvent(
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
          getMockAuthData(eservice.producerId),
          uuidv4()
        );
        const writtenEvent = await readLastEserviceEvent(
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
          getMockAuthData(eservice.producerId),
          uuidv4()
        );
        const writtenEvent = await readLastEserviceEvent(
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
            getMockAuthData(mockEService.producerId),
            uuidv4()
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
            getMockAuthData(eservice.producerId),
            uuidv4()
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
            getMockAuthData(),
            uuidv4()
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
            getMockAuthData(eservice.producerId),
            uuidv4()
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
            getMockAuthData(eservice.producerId),
            uuidv4()
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
            getMockAuthData(eservice.producerId),
            uuidv4()
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
            getMockAuthData(eservice.producerId),
            uuidv4()
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
            getMockAuthData(eservice.producerId),
            uuidv4()
          )
        ).rejects.toThrowError(
          eServiceDescriptorWithoutInterface(descriptor.id)
        );
      });

      it("should throw tenantNotFound if the eService has mode Receive and the producer tenant doesn't exist", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
          interface: mockDocument,
        };

        const eservice: EService = {
          ...mockEService,
          producerId: generateId(),
          mode: eserviceMode.receive,
          descriptors: [descriptor],
        };
        await addOneEService(eservice, postgresDB, eservices);

        expect(
          catalogService.publishDescriptor(
            eservice.id,
            descriptor.id,
            getMockAuthData(eservice.producerId),
            uuidv4()
          )
        ).rejects.toThrowError(tenantNotFound(eservice.producerId));
      });

      it("should throw tenantKindNotFound if the eService has mode Receive and the producer tenant kind doesn't exist", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
          interface: mockDocument,
        };

        const producer: Tenant = {
          ...getMockTenant(),
          kind: undefined,
        };

        const eservice: EService = {
          ...mockEService,
          producerId: producer.id,
          mode: eserviceMode.receive,
          descriptors: [descriptor],
        };

        await addOneTenant(producer, tenants);
        await addOneEService(eservice, postgresDB, eservices);

        expect(
          catalogService.publishDescriptor(
            eservice.id,
            descriptor.id,
            getMockAuthData(eservice.producerId),
            uuidv4()
          )
        ).rejects.toThrowError(tenantKindNotFound(producer.id));
      });

      it("should throw eServiceRiskAnalysisIsRequired if the eService has mode Receive and no risk analysis", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
          interface: mockDocument,
        };

        const producerTenantKind: TenantKind = randomArrayItem(
          Object.values(tenantKind)
        );
        const producer: Tenant = {
          ...getMockTenant(),
          kind: producerTenantKind,
        };

        const eservice: EService = {
          ...mockEService,
          producerId: producer.id,
          mode: eserviceMode.receive,
          descriptors: [descriptor],
          riskAnalysis: [],
        };

        await addOneTenant(producer, tenants);
        await addOneEService(eservice, postgresDB, eservices);

        expect(
          catalogService.publishDescriptor(
            eservice.id,
            descriptor.id,
            getMockAuthData(eservice.producerId),
            uuidv4()
          )
        ).rejects.toThrowError(eServiceRiskAnalysisIsRequired(eservice.id));
      });

      it("should throw riskAnalysisNotValid if the eService has mode Receive and one of the risk analyses is not valid", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
          interface: mockDocument,
        };

        const producerTenantKind: TenantKind = randomArrayItem(
          Object.values(tenantKind)
        );
        const producer: Tenant = {
          ...getMockTenant(),
          kind: producerTenantKind,
        };

        const validRiskAnalysis = getMockValidRiskAnalysis(producerTenantKind);
        const riskAnalysis1 = validRiskAnalysis;
        const riskAnalysis2 = {
          ...validRiskAnalysis,
          riskAnalysisForm: {
            ...validRiskAnalysis.riskAnalysisForm,
            singleAnswers: [],
            // ^ validation here is schema only: it checks for missing expected fields, so this is invalid
          },
        };

        const eservice: EService = {
          ...mockEService,
          producerId: producer.id,
          mode: eserviceMode.receive,
          descriptors: [descriptor],
          riskAnalysis: [riskAnalysis1, riskAnalysis2],
        };

        await addOneTenant(producer, tenants);
        await addOneEService(eservice, postgresDB, eservices);

        expect(
          catalogService.publishDescriptor(
            eservice.id,
            descriptor.id,
            getMockAuthData(eservice.producerId),
            uuidv4()
          )
        ).rejects.toThrowError(riskAnalysisNotValid());
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
          getMockAuthData(eservice.producerId),
          uuidv4()
        );

        const writtenEvent = await readLastEserviceEvent(
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
            getMockAuthData(mockEService.producerId),
            uuidv4()
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
            getMockAuthData(),
            uuidv4()
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
            getMockAuthData(mockEService.producerId),
            uuidv4()
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
            getMockAuthData(eservice.producerId),
            uuidv4()
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
            getMockAuthData(eservice.producerId),
            uuidv4()
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
            getMockAuthData(eservice.producerId),
            uuidv4()
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
          getMockAuthData(eservice.producerId),
          uuidv4()
        );

        const updatedDescriptor = {
          ...descriptor,
          state: descriptorState.published,
        };

        const writtenEvent = await readLastEserviceEvent(
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
            getMockAuthData(mockEService.producerId),
            uuidv4()
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
            getMockAuthData(eservice.producerId),
            uuidv4()
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
            getMockAuthData(),
            uuidv4()
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
            getMockAuthData(eservice.producerId),
            uuidv4()
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
            getMockAuthData(eservice.producerId),
            uuidv4()
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
            getMockAuthData(eservice.producerId),
            uuidv4()
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
            getMockAuthData(eservice.producerId),
            uuidv4()
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
          getMockAuthData(eservice.producerId),
          uuidv4()
        );

        const writtenEvent = await readLastEserviceEvent(
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
            writtenPayload.eservice!.descriptors[0].interface!.id
          ),
          uploadDate: new Date(
            writtenPayload.eservice!.descriptors[0].interface!.uploadDate
          ),
          path: writtenPayload.eservice!.descriptors[0].interface!.path,
        };
        const expectedDocument1: Document = {
          ...document1,
          id: unsafeBrandId(writtenPayload.eservice!.descriptors[0].docs[0].id),
          uploadDate: new Date(
            writtenPayload.eservice!.descriptors[0].docs[0].uploadDate
          ),
          path: writtenPayload.eservice!.descriptors[0].docs[0].path,
        };
        const expectedDocument2: Document = {
          ...document2,
          id: unsafeBrandId(writtenPayload.eservice!.descriptors[0].docs[1].id),
          uploadDate: new Date(
            writtenPayload.eservice!.descriptors[0].docs[1].uploadDate
          ),
          path: writtenPayload.eservice!.descriptors[0].docs[1].path,
        };

        const expectedDescriptor: Descriptor = {
          ...descriptor,
          id: unsafeBrandId(writtenPayload.eservice!.descriptors[0].id),
          version: "1",
          interface: expectedInterface,
          createdAt: new Date(
            Number(writtenPayload.eservice?.descriptors[0].createdAt)
          ),
          docs: [expectedDocument1, expectedDocument2],
        };

        const expectedEService: EService = {
          ...eservice,
          id: unsafeBrandId(writtenPayload.eservice!.id),
          name: `${eservice.name} - clone - ${formatClonedEServiceDate(
            cloneTimestamp
          )}`,
          descriptors: [expectedDescriptor],
          createdAt: new Date(Number(writtenPayload.eservice?.createdAt)),
        };
        expect(writtenPayload.eservice).toEqual(toEServiceV2(expectedEService));

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
            getMockAuthData(eservice.producerId),
            uuidv4()
          )
        ).rejects.toThrowError(FileManagerError);
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
            getMockAuthData(eservice1.producerId),
            uuidv4()
          )
        ).rejects.toThrowError(eServiceDuplicate(conflictEServiceName));
      });
      it("should throw eServiceNotFound if the eservice doesn't exist", () => {
        expect(
          catalogService.cloneDescriptor(
            mockEService.id,
            mockDescriptor.id,
            getMockAuthData(),
            uuidv4()
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
            getMockAuthData(),
            uuidv4()
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
            getMockAuthData(eservice.producerId),
            uuidv4()
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
          getMockAuthDataInternal(),
          uuidv4()
        );

        const writtenEvent = await readLastEserviceEvent(
          eservice.id,
          postgresDB
        );
        expect(writtenEvent.stream_id).toBe(eservice.id);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceDescriptorArchived");
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
            getMockAuthDataInternal(),
            uuidv4()
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
            getMockAuthDataInternal(),
            uuidv4()
          )
        ).rejects.toThrowError(
          eServiceDescriptorNotFound(eservice.id, mockDescriptor.id)
        );
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
          getMockAuthData(eservice.producerId),
          uuidv4()
        );
        const writtenEvent = await readLastEserviceEvent(
          eservice.id,
          postgresDB
        );
        expect(writtenEvent).toMatchObject({
          stream_id: eservice.id,
          version: "1",
          type: "EServiceDescriptorQuotasUpdated",
          event_version: 2,
        });
        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceDescriptorQuotasUpdatedV2,
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
          getMockAuthData(eservice.producerId),
          uuidv4()
        );
        const writtenEvent = await readLastEserviceEvent(
          eservice.id,
          postgresDB
        );
        expect(writtenEvent).toMatchObject({
          stream_id: eservice.id,
          version: "1",
          type: "EServiceDescriptorQuotasUpdated",
          event_version: 2,
        });
        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceDescriptorQuotasUpdatedV2,
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
          getMockAuthData(eservice.producerId),
          uuidv4()
        );
        const writtenEvent = await readLastEserviceEvent(
          eservice.id,
          postgresDB
        );
        expect(writtenEvent).toMatchObject({
          stream_id: eservice.id,
          version: "1",
          type: "EServiceDescriptorQuotasUpdated",
          event_version: 2,
        });
        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceDescriptorQuotasUpdatedV2,
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
            getMockAuthData(mockEService.producerId),
            uuidv4()
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
            getMockAuthData(mockEService.producerId),
            uuidv4()
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
            getMockAuthData(eservice.producerId),
            uuidv4()
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
            getMockAuthData(eservice.producerId),
            uuidv4()
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
            getMockAuthData(),
            uuidv4()
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
            getMockAuthData(eservice.producerId),
            uuidv4()
          )
        ).rejects.toThrowError(inconsistentDailyCalls());
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
          getMockAuthData(eservice.producerId),
          uuidv4()
        );

        const writtenEvent = await readLastEserviceEvent(
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
            getMockAuthData(),
            uuidv4()
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
            getMockAuthData(),
            uuidv4()
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
            getMockAuthData(eservice.producerId),
            uuidv4()
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
            getMockAuthData(eservice.producerId),
            uuidv4()
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
            getMockAuthData(eservice.producerId),
            uuidv4()
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
            getMockAuthData(eservice.producerId),
            uuidv4()
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
            getMockAuthData(eservice.producerId),
            uuidv4()
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
            getMockAuthData(eservice.producerId),
            uuidv4()
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
          getMockAuthData(eservice.producerId),
          uuidv4()
        );
        const writtenEvent = await readLastEserviceEvent(
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
          getMockAuthData(eservice.producerId),
          uuidv4()
        );
        const writtenEvent = await readLastEserviceEvent(
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
        config.s3Bucket = "invalid-bucket"; // configure an invalid bucket to force a failure

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
            getMockAuthData(eservice.producerId),
            uuidv4()
          )
        ).rejects.toThrowError(
          fileManagerDeleteError(
            mockDocument.path,
            config.s3Bucket,
            new Error("The specified bucket does not exist")
          )
        );
      });
      it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
        expect(
          catalogService.deleteDocument(
            mockEService.id,
            mockDescriptor.id,
            mockDocument.id,
            getMockAuthData(),
            uuidv4()
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
            getMockAuthData(),
            uuidv4()
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
            getMockAuthData(eservice.producerId),
            uuidv4()
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
            getMockAuthData(eservice.producerId),
            uuidv4()
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
            getMockAuthData(eservice.producerId),
            uuidv4()
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
            getMockAuthData(eservice.producerId),
            uuidv4()
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
            getMockAuthData(eservice.producerId),
            uuidv4()
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
            getMockAuthData(eservice.producerId),
            uuidv4()
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
          getMockAuthData(eservice.producerId),
          uuidv4()
        );
        const writtenEvent = await readLastEserviceEvent(
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
            getMockAuthData(),
            uuidv4()
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
            getMockAuthData(),
            uuidv4()
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
            getMockAuthData(eservice.producerId),
            uuidv4()
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
            getMockAuthData(eservice.producerId),
            uuidv4()
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
            getMockAuthData(eservice.producerId),
            uuidv4()
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
            getMockAuthData(eservice.producerId),
            uuidv4()
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
            getMockAuthData(eservice.producerId),
            uuidv4()
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
            getMockAuthData(eservice.producerId),
            uuidv4()
          )
        ).rejects.toThrowError(
          eServiceDocumentNotFound(eservice.id, descriptor.id, mockDocument.id)
        );
      });
    });

    describe("create risk analysis", () => {
      it("should write on event-store for the creation of a risk analysis", async () => {
        const producerTenantKind: TenantKind = randomArrayItem(
          Object.values(tenantKind)
        );
        const producer: Tenant = {
          ...getMockTenant(),
          kind: producerTenantKind,
        };

        const mockValidRiskAnalysis =
          getMockValidRiskAnalysis(producerTenantKind);
        const riskAnalysisSeed: EServiceRiskAnalysisSeed =
          buildRiskAnalysisSeed(mockValidRiskAnalysis);

        const eservice: EService = {
          ...mockEService,
          producerId: producer.id,
          mode: eserviceMode.receive,
          descriptors: [
            {
              ...mockDescriptor,
              state: descriptorState.draft,
            },
          ],
        };

        await addOneTenant(producer, tenants);
        await addOneEService(eservice, postgresDB, eservices);

        await catalogService.createRiskAnalysis(
          eservice.id,
          riskAnalysisSeed,
          getMockAuthData(producer.id),
          uuidv4()
        );

        const writtenEvent = await readLastEserviceEvent(
          eservice.id,
          postgresDB
        );

        expect(writtenEvent.stream_id).toBe(eservice.id);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceRiskAnalysisAdded");
        expect(writtenEvent.event_version).toBe(2);
        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceRiskAnalysisAddedV2,
          payload: writtenEvent.data,
        });

        const expectedEservice = toEServiceV2({
          ...eservice,
          riskAnalysis: [
            {
              ...mockValidRiskAnalysis,
              id: unsafeBrandId(writtenPayload.eservice!.riskAnalysis[0]!.id),
              createdAt: new Date(
                Number(writtenPayload.eservice!.riskAnalysis[0]!.createdAt)
              ),
              riskAnalysisForm: {
                ...mockValidRiskAnalysis.riskAnalysisForm,
                id: unsafeBrandId(
                  writtenPayload.eservice!.riskAnalysis[0]!.riskAnalysisForm!.id
                ),
                singleAnswers:
                  mockValidRiskAnalysis.riskAnalysisForm.singleAnswers.map(
                    (singleAnswer) => ({
                      ...singleAnswer,
                      id: unsafeBrandId(
                        writtenPayload.eservice!.riskAnalysis[0]!.riskAnalysisForm!.singleAnswers.find(
                          (sa) => sa.key === singleAnswer.key
                        )!.id
                      ),
                    })
                  ),
                multiAnswers:
                  mockValidRiskAnalysis.riskAnalysisForm.multiAnswers.map(
                    (multiAnswer) => ({
                      ...multiAnswer,
                      id: unsafeBrandId(
                        writtenPayload.eservice!.riskAnalysis[0]!.riskAnalysisForm!.multiAnswers.find(
                          (ma) => ma.key === multiAnswer.key
                        )!.id
                      ),
                    })
                  ),
              },
            },
          ],
        });

        expect(writtenPayload.riskAnalysisId).toEqual(
          expectedEservice.riskAnalysis[0].id
        );
        expect(writtenPayload.eservice).toEqual(expectedEservice);
      });
      it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
        expect(
          catalogService.createRiskAnalysis(
            mockEService.id,
            buildRiskAnalysisSeed(getMockValidRiskAnalysis(tenantKind.PA)),
            getMockAuthData(mockEService.producerId),
            uuidv4()
          )
        ).rejects.toThrowError(eServiceNotFound(mockEService.id));
      });
      it("should throw operationForbidden if the requester is not the producer", async () => {
        await addOneEService(mockEService, postgresDB, eservices);
        expect(
          catalogService.createRiskAnalysis(
            mockEService.id,
            buildRiskAnalysisSeed(getMockValidRiskAnalysis(tenantKind.PA)),
            getMockAuthData(),
            uuidv4()
          )
        ).rejects.toThrowError(operationForbidden);
      });
      it("should throw eserviceNotInDraftState if the eservice is not in draft state", async () => {
        const eservice: EService = {
          ...mockEService,
          descriptors: [
            {
              ...mockDescriptor,
              state: descriptorState.published,
            },
          ],
        };
        await addOneEService(eservice, postgresDB, eservices);

        expect(
          catalogService.createRiskAnalysis(
            eservice.id,
            buildRiskAnalysisSeed(getMockValidRiskAnalysis(tenantKind.PA)),
            getMockAuthData(eservice.producerId),
            uuidv4()
          )
        ).rejects.toThrowError(eserviceNotInDraftState(eservice.id));
      });
      it("should throw eserviceNotInReceiveMode if the eservice is not in receive mode", async () => {
        const eservice: EService = {
          ...mockEService,
          mode: eserviceMode.deliver,
          descriptors: [
            {
              ...mockDescriptor,
              state: descriptorState.draft,
            },
          ],
        };
        await addOneEService(eservice, postgresDB, eservices);

        expect(
          catalogService.createRiskAnalysis(
            eservice.id,
            buildRiskAnalysisSeed(getMockValidRiskAnalysis(tenantKind.PA)),
            getMockAuthData(eservice.producerId),
            uuidv4()
          )
        ).rejects.toThrowError(eserviceNotInReceiveMode(eservice.id));
      });
      it("should throw tenantNotFound if the producer tenant doesn't exist", async () => {
        const eservice: EService = {
          ...mockEService,
          mode: eserviceMode.receive,
          descriptors: [
            {
              ...mockDescriptor,
              state: descriptorState.draft,
            },
          ],
        };
        await addOneEService(eservice, postgresDB, eservices);

        expect(
          catalogService.createRiskAnalysis(
            eservice.id,
            buildRiskAnalysisSeed(getMockValidRiskAnalysis(tenantKind.PA)),
            getMockAuthData(eservice.producerId),
            uuidv4()
          )
        ).rejects.toThrowError(tenantNotFound(eservice.producerId));
      });
      it("should throw tenantKindNotFound if the producer tenant kind doesn't exist", async () => {
        const producer: Tenant = {
          ...getMockTenant(),
          kind: undefined,
        };

        const eservice: EService = {
          ...mockEService,
          producerId: producer.id,
          mode: eserviceMode.receive,
          descriptors: [
            {
              ...mockDescriptor,
              state: descriptorState.draft,
            },
          ],
        };

        await addOneTenant(producer, tenants);
        await addOneEService(eservice, postgresDB, eservices);

        expect(
          catalogService.createRiskAnalysis(
            eservice.id,
            buildRiskAnalysisSeed(getMockValidRiskAnalysis(tenantKind.PA)),
            getMockAuthData(producer.id),
            uuidv4()
          )
        ).rejects.toThrowError(tenantKindNotFound(producer.id));
      });

      it("should throw riskAnalysisValidationFailed if the risk analysis is not valid", async () => {
        const producerTenantKind: TenantKind = randomArrayItem(
          Object.values(tenantKind)
        );
        const producer: Tenant = {
          ...getMockTenant(),
          kind: producerTenantKind,
        };

        const mockValidRiskAnalysis =
          getMockValidRiskAnalysis(producerTenantKind);

        const riskAnalysisSeed: EServiceRiskAnalysisSeed = {
          ...buildRiskAnalysisSeed(mockValidRiskAnalysis),
        };

        const invalidRiskAnalysisSeed = {
          ...riskAnalysisSeed,
          riskAnalysisForm: {
            ...riskAnalysisSeed.riskAnalysisForm,
            answers: {
              purpose: ["invalid purpose"], // "purpose" is field expected for all tenant kinds
              unexpectedField: ["updated other purpose"],
              /*
              This risk analysis form has an unexpected field and an invalid value for the purpose field.
              The validation on create is schemaOnly: it does not check missing required fields or dependencies.
              However, it checks for unexpected fields and invalid values.
              So, the validation should fail with just two errors corresponding to the two invalid fields.
             */
            },
          },
        };

        const eservice: EService = {
          ...mockEService,
          producerId: producer.id,
          mode: eserviceMode.receive,
          descriptors: [
            {
              ...mockDescriptor,
              state: descriptorState.draft,
            },
          ],
        };

        await addOneTenant(producer, tenants);
        await addOneEService(eservice, postgresDB, eservices);

        expect(
          catalogService.createRiskAnalysis(
            eservice.id,
            invalidRiskAnalysisSeed,
            getMockAuthData(producer.id),
            uuidv4()
          )
        ).rejects.toThrowError(
          riskAnalysisValidationFailed([
            unexpectedFieldValueError(
              "purpose",
              new Set(["INSTITUTIONAL", "OTHER"])
            ),
            unexpectedFieldError("unexpectedField"),
          ])
        );
      });
    });
    describe("update risk analysis", () => {
      it("should write on event-store for the update of a risk analysis", async () => {
        const producerTenantKind: TenantKind = randomArrayItem(
          Object.values(tenantKind)
        );
        const producer: Tenant = {
          ...getMockTenant(),
          kind: producerTenantKind,
        };

        const riskAnalysis = getMockValidRiskAnalysis(producerTenantKind);

        const eservice: EService = {
          ...mockEService,
          producerId: producer.id,
          mode: eserviceMode.receive,
          descriptors: [
            {
              ...mockDescriptor,
              state: descriptorState.draft,
            },
          ],
          riskAnalysis: [riskAnalysis],
        };

        await addOneTenant(producer, tenants);
        await addOneEService(eservice, postgresDB, eservices);

        const riskAnalysisSeed: EServiceRiskAnalysisSeed =
          buildRiskAnalysisSeed(riskAnalysis);

        const riskAnalysisUpdatedSeed: EServiceRiskAnalysisSeed = {
          ...riskAnalysisSeed,
          riskAnalysisForm: {
            ...riskAnalysisSeed.riskAnalysisForm,
            answers: {
              ...riskAnalysisSeed.riskAnalysisForm.answers,
              purpose: ["OTHER"], // we modify the purpose field, present in the mock for all tenant kinds
              otherPurpose: ["updated other purpose"], // we add a new field
              ruleOfLawText: [], // we remove the ruleOfLawText field, present in the mock for all tenant kinds
            },
          },
        };

        await catalogService.updateRiskAnalysis(
          eservice.id,
          riskAnalysis.id,
          riskAnalysisUpdatedSeed,
          getMockAuthData(producer.id),
          uuidv4()
        );

        const writtenEvent = await readLastEserviceEvent(
          eservice.id,
          postgresDB
        );
        expect(writtenEvent).toMatchObject({
          stream_id: eservice.id,
          version: "1",
          type: "EServiceRiskAnalysisUpdated",
          event_version: 2,
        });
        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceRiskAnalysisUpdatedV2,
          payload: writtenEvent.data,
        });

        const updatedEservice: EService = {
          ...eservice,
          riskAnalysis: [
            {
              ...riskAnalysis,
              name: riskAnalysisUpdatedSeed.name,
              riskAnalysisForm: {
                ...riskAnalysis.riskAnalysisForm,
                id: unsafeBrandId<RiskAnalysisFormId>(
                  writtenPayload.eservice!.riskAnalysis[0]!.riskAnalysisForm!.id
                ),
                multiAnswers: riskAnalysis.riskAnalysisForm.multiAnswers.map(
                  (multiAnswer) => ({
                    ...multiAnswer,
                    id: unsafeBrandId<RiskAnalysisMultiAnswerId>(
                      writtenPayload.eservice!.riskAnalysis[0]!.riskAnalysisForm!.multiAnswers.find(
                        (ma) => ma.key === multiAnswer.key
                      )!.id
                    ),
                  })
                ),
                singleAnswers: riskAnalysis.riskAnalysisForm.singleAnswers
                  .filter(
                    (singleAnswer) => singleAnswer.key !== "ruleOfLawText"
                  )
                  .map((singleAnswer) => ({
                    ...singleAnswer,
                    id: unsafeBrandId<RiskAnalysisSingleAnswerId>(
                      writtenPayload.eservice!.riskAnalysis[0]!.riskAnalysisForm!.singleAnswers.find(
                        (sa) => sa.key === singleAnswer.key
                      )!.id
                    ),
                    value:
                      singleAnswer.key === "purpose"
                        ? "OTHER"
                        : singleAnswer.value,
                  }))
                  .concat([
                    {
                      key: "otherPurpose",
                      value: "updated other purpose",
                      id: unsafeBrandId<RiskAnalysisSingleAnswerId>(
                        writtenPayload.eservice!.riskAnalysis[0]!.riskAnalysisForm!.singleAnswers.find(
                          (sa) => sa.key === "otherPurpose"
                        )!.id
                      ),
                    },
                  ]),
              },
            },
          ],
        };

        expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEservice));
      });
      it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
        expect(
          catalogService.updateRiskAnalysis(
            mockEService.id,
            generateId(),
            buildRiskAnalysisSeed(getMockValidRiskAnalysis(tenantKind.PA)),
            getMockAuthData(mockEService.producerId),
            uuidv4()
          )
        ).rejects.toThrowError(eServiceNotFound(mockEService.id));
      });
      it("should throw operationForbidden if the requester is not the producer", async () => {
        await addOneEService(mockEService, postgresDB, eservices);
        expect(
          catalogService.updateRiskAnalysis(
            mockEService.id,
            generateId(),
            buildRiskAnalysisSeed(getMockValidRiskAnalysis(tenantKind.PA)),
            getMockAuthData(),
            uuidv4()
          )
        ).rejects.toThrowError(operationForbidden);
      });
      it("should throw eserviceNotInDraftState if the eservice is not in draft state", async () => {
        const eservice: EService = {
          ...mockEService,
          descriptors: [
            {
              ...mockDescriptor,
              state: descriptorState.published,
            },
          ],
        };
        await addOneEService(eservice, postgresDB, eservices);

        expect(
          catalogService.updateRiskAnalysis(
            eservice.id,
            generateId(),
            buildRiskAnalysisSeed(getMockValidRiskAnalysis(tenantKind.PA)),
            getMockAuthData(eservice.producerId),
            uuidv4()
          )
        ).rejects.toThrowError(eserviceNotInDraftState(eservice.id));
      });
      it("should throw eserviceNotInReceiveMode if the eservice is not in receive mode", async () => {
        const eservice: EService = {
          ...mockEService,
          mode: eserviceMode.deliver,
          descriptors: [
            {
              ...mockDescriptor,
              state: descriptorState.draft,
            },
          ],
        };
        await addOneEService(eservice, postgresDB, eservices);

        expect(
          catalogService.updateRiskAnalysis(
            eservice.id,
            generateId(),
            buildRiskAnalysisSeed(getMockValidRiskAnalysis(tenantKind.PA)),
            getMockAuthData(eservice.producerId),
            uuidv4()
          )
        ).rejects.toThrowError(eserviceNotInReceiveMode(eservice.id));
      });
      it("should throw tenantNotFound if the producer tenant doesn't exist", async () => {
        const eservice: EService = {
          ...mockEService,
          mode: eserviceMode.receive,
          descriptors: [
            {
              ...mockDescriptor,
              state: descriptorState.draft,
            },
          ],
        };
        await addOneEService(eservice, postgresDB, eservices);

        expect(
          catalogService.updateRiskAnalysis(
            eservice.id,
            generateId(),
            buildRiskAnalysisSeed(getMockValidRiskAnalysis(tenantKind.PA)),
            getMockAuthData(eservice.producerId),
            uuidv4()
          )
        ).rejects.toThrowError(tenantNotFound(eservice.producerId));
      });
      it("should throw tenantKindNotFound if the producer tenant kind doesn't exist", async () => {
        const producer: Tenant = {
          ...getMockTenant(),
          kind: undefined,
        };

        const eservice: EService = {
          ...mockEService,
          producerId: producer.id,
          mode: eserviceMode.receive,
          descriptors: [
            {
              ...mockDescriptor,
              state: descriptorState.draft,
            },
          ],
        };

        await addOneTenant(producer, tenants);
        await addOneEService(eservice, postgresDB, eservices);

        expect(
          catalogService.updateRiskAnalysis(
            eservice.id,
            generateId(),
            buildRiskAnalysisSeed(getMockValidRiskAnalysis(tenantKind.PA)),
            getMockAuthData(producer.id),
            uuidv4()
          )
        ).rejects.toThrowError(tenantKindNotFound(producer.id));
      });
      it("should throw eServiceRiskAnalysisNotFound if the risk analysis doesn't exist", async () => {
        const producerTenantKind: TenantKind = randomArrayItem(
          Object.values(tenantKind)
        );
        const producer: Tenant = {
          ...getMockTenant(),
          kind: producerTenantKind,
        };

        const eservice: EService = {
          ...mockEService,
          producerId: producer.id,
          mode: eserviceMode.receive,
          descriptors: [
            {
              ...mockDescriptor,
              state: descriptorState.draft,
            },
          ],
        };

        await addOneTenant(producer, tenants);
        await addOneEService(eservice, postgresDB, eservices);

        const riskAnalysisId = generateId<RiskAnalysisId>();
        expect(
          catalogService.updateRiskAnalysis(
            eservice.id,
            riskAnalysisId,
            buildRiskAnalysisSeed(getMockValidRiskAnalysis(tenantKind.PA)),
            getMockAuthData(producer.id),
            uuidv4()
          )
        ).rejects.toThrowError(
          eServiceRiskAnalysisNotFound(eservice.id, riskAnalysisId)
        );
      });
      it("should throw riskAnalysisValidationFailed if the risk analysis is not valid", async () => {
        const producerTenantKind: TenantKind = randomArrayItem(
          Object.values(tenantKind)
        );
        const producer: Tenant = {
          ...getMockTenant(),
          kind: producerTenantKind,
        };

        const riskAnalysis = getMockValidRiskAnalysis(producerTenantKind);

        const eservice: EService = {
          ...mockEService,
          producerId: producer.id,
          mode: eserviceMode.receive,
          descriptors: [
            {
              ...mockDescriptor,
              state: descriptorState.draft,
            },
          ],
          riskAnalysis: [riskAnalysis],
        };

        await addOneTenant(producer, tenants);
        await addOneEService(eservice, postgresDB, eservices);

        const riskAnalysisSeed: EServiceRiskAnalysisSeed =
          buildRiskAnalysisSeed(riskAnalysis);

        const riskAnalysisUpdatedSeed: EServiceRiskAnalysisSeed = {
          ...riskAnalysisSeed,
          riskAnalysisForm: {
            ...riskAnalysisSeed.riskAnalysisForm,
            answers: {
              ...riskAnalysisSeed.riskAnalysisForm.answers,
              purpose: ["INVALID"], // "purpose" is field expected for all tenant kinds
              unexpectedField: ["unexpected field value"],
              /*
                This risk analysis form has an unexpected field and an invalid value for the purpose field.
                The validation on update is schemaOnly: it does not check missing required fields or dependencies.
                However, it checks for unexpected fields and invalid values.
                So, the validation should fail with just two errors corresponding to the two invalid fields.
             */
            },
          },
        };

        expect(
          catalogService.updateRiskAnalysis(
            eservice.id,
            riskAnalysis.id,
            riskAnalysisUpdatedSeed,
            getMockAuthData(producer.id),
            uuidv4()
          )
        ).rejects.toThrowError(
          riskAnalysisValidationFailed([
            unexpectedFieldValueError(
              "purpose",
              new Set(["INSTITUTIONAL", "OTHER"])
            ),
            unexpectedFieldError("unexpectedField"),
          ])
        );
      });
    });

    describe("delete risk analysis", () => {
      it("should write on event-store for the deletion of a risk analysis", async () => {
        const riskAnalysis = getMockValidRiskAnalysis("PA");
        const eservice: EService = {
          ...mockEService,
          descriptors: [],
          riskAnalysis: [riskAnalysis],
          mode: "Receive",
        };
        await addOneEService(eservice, postgresDB, eservices);

        await catalogService.deleteRiskAnalysis(
          eservice.id,
          riskAnalysis.id,
          getMockAuthData(eservice.producerId),
          uuidv4()
        );

        const writtenEvent = await readLastEserviceEvent(
          eservice.id,
          postgresDB
        );
        const expectedEservice = toEServiceV2({
          ...eservice,
          riskAnalysis: eservice.riskAnalysis.filter(
            (r) => r.id !== riskAnalysis.id
          ),
        });

        expect(writtenEvent).toMatchObject({
          stream_id: eservice.id,
          version: "1",
          type: "EServiceRiskAnalysisDeleted",
          event_version: 2,
        });
        const writtenPayload = decodeProtobufPayload({
          messageType: EServiceRiskAnalysisDeletedV2,
          payload: writtenEvent.data,
        });
        expect(writtenPayload).toEqual({
          riskAnalysisId: riskAnalysis.id,
          eservice: expectedEservice,
        });
      });
      it("should throw eServiceNotFound if the eservice doesn't exist", () => {
        expect(
          catalogService.deleteRiskAnalysis(
            mockEService.id,
            generateId<RiskAnalysisId>(),
            getMockAuthData(mockEService.producerId),
            uuidv4()
          )
        ).rejects.toThrowError(eServiceNotFound(mockEService.id));
      });
      it("should throw eServiceRiskAnalysisNotFound if the riskAnalysis doesn't exist", async () => {
        const eservice: EService = {
          ...mockEService,
          descriptors: [],
          riskAnalysis: [],
          mode: "Receive",
        };
        await addOneEService(eservice, postgresDB, eservices);

        const riskAnalysisId = generateId<RiskAnalysisId>();
        expect(
          catalogService.deleteRiskAnalysis(
            eservice.id,
            riskAnalysisId,
            getMockAuthData(eservice.producerId),
            uuidv4()
          )
        ).rejects.toThrowError(
          eServiceRiskAnalysisNotFound(eservice.id, riskAnalysisId)
        );
      });
      it("should throw eserviceNotInDraftState if the eservice has a non-draft descriptor", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
          interface: mockDocument,
          publishedAt: new Date(),
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
          riskAnalysis: [getMockValidRiskAnalysis("PA")],
          mode: "Receive",
        };
        await addOneEService(eservice, postgresDB, eservices);

        expect(
          catalogService.deleteRiskAnalysis(
            eservice.id,
            generateId<RiskAnalysisId>(),
            getMockAuthData(eservice.producerId),
            uuidv4()
          )
        ).rejects.toThrowError(eserviceNotInDraftState(eservice.id));
      });

      it("should throw operationForbidden if the requester is not the producer", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
          interface: mockDocument,
          publishedAt: new Date(),
        };
        const eservice: EService = {
          ...mockEService,
          descriptors: [descriptor],
          riskAnalysis: [getMockValidRiskAnalysis("PA")],
          mode: "Receive",
        };
        await addOneEService(eservice, postgresDB, eservices);

        expect(
          catalogService.deleteRiskAnalysis(
            eservice.id,
            generateId<RiskAnalysisId>(),
            getMockAuthData(),
            uuidv4()
          )
        ).rejects.toThrowError(operationForbidden);
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
          mode: eserviceMode.receive,
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
        expect(result).toEqual({
          totalCount: 1,
          results: [eservice6],
        });
      });

      it("should get the eServices if they exist (parameters: producerIds, mode)", async () => {
        const result = await readModelService.getEServices(
          getMockAuthData(),
          {
            eservicesIds: [],
            producersIds: [organizationId2],
            states: [],
            agreementStates: [],
            attributesIds: [],
            mode: eserviceMode.deliver,
          },
          0,
          50
        );
        expect(result).toEqual({
          totalCount: 2,
          results: [eservice4, eservice5],
        });
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

      it("should get the interface if it exists (requester is the producer, admin)", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          interface: mockDocument,
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

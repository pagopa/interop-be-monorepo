/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  AgreementCollection,
  EServiceCollection,
  ReadModelRepository,
  TenantCollection,
  initDB,
} from "pagopa-interop-commons";
import { IDatabase } from "pg-promise";
import {
  Agreement,
  Descriptor,
  EService,
  EServiceAddedV1,
  EServiceDeletedV1,
  EServiceDescriptorUpdatedV1,
  EServiceUpdatedV1,
  EServiceWithDescriptorsDeletedV1,
  Tenant,
  descriptorState,
  operationForbidden,
} from "pagopa-interop-models";
import { v4 as uuidv4 } from "uuid";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { GenericContainer } from "testcontainers";
import { config } from "../src/utilities/config.js";
import { toDescriptorV1, toEServiceV1 } from "../src/model/domain/toEvent.js";
import { EServiceDescriptorSeed } from "../src/model/domain/models.js";
import {
  ReadModelService,
  readModelServiceBuilder,
} from "../src/services/readModelService.js";
import {
  CatalogService,
  catalogServiceBuilder,
} from "../src/services/catalogService.js";
import {
  draftDescriptorAlreadyExists,
  eServiceCannotBeDeleted,
  eServiceCannotBeUpdated,
  eServiceDescriptorWithoutInterface,
  eServiceDuplicate,
  eServiceNotFound,
  notValidDescriptor,
} from "../src/model/domain/errors.js";
import {
  buildDescriptorSeed,
  decode,
  getMockAgreement,
  getMockAuthData,
  getMockDescriptor,
  getMockEService,
  getMockTenant,
  writeAgreementInReadmodel,
  writeEServiceInEventstore,
  writeEServiceInReadmodel,
  writeTenantInReadmodel,
} from "./utils.js";

const mockEService = getMockEService();
const mockDescriptor = getMockDescriptor();

describe("database test", async () => {
  let eservices: EServiceCollection;
  let agreements: AgreementCollection;
  let tenants: TenantCollection;
  let readModelService: ReadModelService;
  let catalogService: CatalogService;
  let postgresDB: IDatabase<unknown>;

  beforeAll(async () => {
    const postgreSqlContainer = await new PostgreSqlContainer("postgres:14")
      .withUsername(config.eventStoreDbUsername)
      .withPassword(config.eventStoreDbPassword)
      .withDatabase(config.eventStoreDbName)
      .withCopyFilesToContainer([
        {
          source: "../../docker/event-store-init.sql",
          target: "/docker-entrypoint-initdb.d/01-init.sql",
        },
      ])
      .withExposedPorts(5432)
      .start();

    const mongodbContainer = await new GenericContainer("mongo:4.0.0")
      .withEnvironment({
        MONGO_INITDB_DATABASE: config.readModelDbName,
        MONGO_INITDB_ROOT_USERNAME: config.readModelDbUsername,
        MONGO_INITDB_ROOT_PASSWORD: config.readModelDbPassword,
      })
      .withExposedPorts(27017)
      .start();

    config.eventStoreDbPort = postgreSqlContainer.getMappedPort(5432);
    config.readModelDbPort = mongodbContainer.getMappedPort(27017);

    const readModelRepository = ReadModelRepository.init(config);
    eservices = readModelRepository.eservices;
    agreements = readModelRepository.agreements;
    tenants = readModelRepository.tenants;
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
    catalogService = catalogServiceBuilder(postgresDB, readModelService);
  });

  afterEach(async () => {
    await eservices.deleteMany({});
    await agreements.deleteMany({});
    await tenants.deleteMany({});

    await postgresDB.none("TRUNCATE TABLE catalog.events RESTART IDENTITY");
    await postgresDB.none("TRUNCATE TABLE agreement.events RESTART IDENTITY");
  });

  describe("Catalog service", () => {
    describe("create eService", () => {
      it("should write on event-store for the creation of an eService", async () => {
        const id = await catalogService.createEService(
          {
            name: mockEService.name,
            description: mockEService.description,
            technology: "REST",
          },
          getMockAuthData(mockEService.producerId)
        );

        expect(id).toBeDefined();
        const writtenEvent = await readLastEventByStreamId(id);
        expect(writtenEvent.stream_id).toBe(id);
        expect(writtenEvent.version).toBe("0");
        expect(writtenEvent.type).toBe("EServiceAdded");
        const writtenPayload = decode({
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

      it("should throw eServiceDuplicate if the eService already exists", async () => {
        await addOneEService(mockEService);
        expect(
          catalogService.createEService(
            {
              name: mockEService.name,
              description: mockEService.description,
              technology: "REST",
            },
            getMockAuthData(mockEService.producerId)
          )
        ).rejects.toThrowError(eServiceDuplicate(mockEService.name));
      });
    });

    describe("update eService", () => {
      it("should write on event-store for the update of an eService", async () => {
        const updatedName = "eService new name";
        await addOneEService(mockEService);
        await catalogService.updateEService(
          mockEService.id,
          {
            name: updatedName,
            description: mockEService.description,
            technology: "REST",
          },
          getMockAuthData(mockEService.producerId)
        );

        const updatedEService = {
          ...mockEService,
          name: updatedName,
        };

        const writtenEvent = await readLastEventByStreamId(mockEService.id);
        expect(writtenEvent.stream_id).toBe(mockEService.id);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceUpdated");
        const writtenPayload = decode({
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
            },
            getMockAuthData(mockEService.producerId)
          )
        ).rejects.toThrowError(eServiceNotFound(mockEService.id));
      });

      it("should throw operationForbidden if the requester is not allowed", async () => {
        await addOneEService(mockEService);

        expect(
          catalogService.updateEService(
            mockEService.id,
            {
              name: "eService new name",
              description: "eService description",
              technology: "REST",
            },
            getMockAuthData()
          )
        ).rejects.toThrowError(operationForbidden);
      });

      it("should throw eServiceCannotBeUpdated if the eService's descriptor is not in draft state", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService);
        expect(
          catalogService.updateEService(
            eService.id,
            {
              name: "eService new name",
              description: "eService description",
              technology: "REST",
            },
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(eServiceCannotBeUpdated(eService.id));
      });
    });

    describe("delete eService", () => {
      it("should write on event-store for the deletion of an eService", async () => {
        await addOneEService(mockEService);
        await catalogService.deleteEService(
          mockEService.id,
          getMockAuthData(mockEService.producerId)
        );
        const writtenEvent = await readLastEventByStreamId(mockEService.id);
        expect(writtenEvent.stream_id).toBe(mockEService.id);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceDeleted");
        const writtenPayload = decode({
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

      it("should throw operationForbidden if the requester is not allowed", async () => {
        await addOneEService(mockEService);
        expect(
          catalogService.deleteEService(mockEService.id, getMockAuthData())
        ).rejects.toThrowError(operationForbidden);
      });

      it("should throw eServiceCannotBeDeleted if the eService has a descriptor", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService);
        expect(
          catalogService.deleteEService(
            eService.id,
            getMockAuthData(eService.producerId)
          )
        ).rejects.toThrowError(eServiceCannotBeDeleted(eService.id));
      });
    });

    describe("create descriptor", async () => {
      /*
      // TO DO check file manager thing
      it("should write on event-store for the creation of a descriptor", async () => {
        const { eServiceId, organizationId } = ids();
        const eService: EService = {
          ...mockEService,
          id: eServiceId,
          producerId: organizationId,
        };
        const descriptor = getMockDescriptor();
        await addOneEService(eService);
        await catalogService.createDescriptor(
          eServiceId,
          buildDescriptorSeed(descriptor),
          getMockAuthData(organizationId)
        );
      });
      */
      it("should throw draftDescriptorAlreadyExists if a draft descriptor already exists", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };

        await addOneEService(eService);
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

      it("should throw operationForbidden if the requester is not allowed", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService);
        expect(
          catalogService.createDescriptor(
            eService.id,
            buildDescriptorSeed(descriptor),
            getMockAuthData()
          )
        ).rejects.toThrowError(operationForbidden);
      });
    });

    describe("update descriptor", () => {
      it("should write on event-store for the update of a descriptor", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService);

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
        await catalogService.updateDescriptor(
          eService.id,
          descriptor.id,
          updatedDescriptorSeed,
          getMockAuthData(eService.producerId)
        );
        const writtenEvent = await readLastEventByStreamId(eService.id);
        expect(writtenEvent.stream_id).toBe(eService.id);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceUpdated");
        const writtenPayload = decode({
          messageType: EServiceUpdatedV1,
          payload: writtenEvent.data,
        });
        expect(writtenPayload.eService).toEqual(toEServiceV1(updatedEService));
      });

      it("should throw eServiceNotFound if the eService doesn't exist", () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };
        expect(
          catalogService.updateDescriptor(
            mockEService.id,
            descriptor.id,
            buildDescriptorSeed(descriptor),
            getMockAuthData(mockEService.producerId)
          )
        ).rejects.toThrowError(eServiceNotFound(mockEService.id));
      });

      it("should throw operationForbidden if the requester is not allowed", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService);

        const updatedDescriptor = {
          ...descriptor,
          dailyCallsTotal: 15,
        };
        expect(
          catalogService.updateDescriptor(
            eService.id,
            descriptor.id,
            buildDescriptorSeed(updatedDescriptor),
            getMockAuthData()
          )
        ).rejects.toThrowError(operationForbidden);
      });
    });

    describe("delete draft descriptor", () => {
      it("should write on event-store for the deletion of a draft descriptor", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService);

        await catalogService.deleteDraftDescriptor(
          eService.id,
          descriptor.id,
          getMockAuthData(eService.producerId)
        );

        const writtenEvent = await readLastEventByStreamId(eService.id);
        expect(writtenEvent.stream_id).toBe(eService.id);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceWithDescriptorsDeleted");
        const writtenPayload = decode({
          messageType: EServiceWithDescriptorsDeletedV1,
          payload: writtenEvent.data,
        });
        expect(writtenPayload.eService).toEqual(toEServiceV1(eService));
        expect(writtenPayload.descriptorId).toEqual(descriptor.id);
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

      it("should throw operationForbidden if the requester is not allowed", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService);
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
            id: uuidv4(),
            prettyName: "",
            contentType: "json",
            checksum: uuidv4(),
            uploadDate: new Date(),
          },
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService);
        await catalogService.publishDescriptor(
          eService.id,
          descriptor.id,
          getMockAuthData(eService.producerId)
        );

        const writtenEvent = await readLastEventByStreamId(eService.id);
        expect(writtenEvent.stream_id).toBe(eService.id);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceDescriptorUpdated");
        const writtenPayload = decode({
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

      it("should throw an eServiceNotFound if the eService doesn't exist", async () => {
        await expect(
          catalogService.publishDescriptor(
            mockEService.id,
            mockDescriptor.id,
            getMockAuthData(mockEService.producerId)
          )
        ).rejects.toThrowError(eServiceNotFound(mockEService.id));
      });

      it("should throw operationForbidden if the requester is not allowed", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService);
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
          state: descriptorState.published,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService);
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

      it("should throw eServiceDescriptorWithoutInterface if the descriptor doesn't have an interface", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.draft,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService);

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
          state: descriptorState.published,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService);
        await catalogService.suspendDescriptor(
          eService.id,
          descriptor.id,
          getMockAuthData(eService.producerId)
        );

        const writtenEvent = await readLastEventByStreamId(eService.id);
        expect(writtenEvent.stream_id).toBe(eService.id);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceDescriptorUpdated");
        const writtenPayload = decode({
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

      it("should throw operationForbidden if the requester is not allowed", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService);
        expect(
          catalogService.suspendDescriptor(
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
        await addOneEService(eService);
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
    });

    describe("activate descriptor", () => {
      it("should write on event-store for the activation of a descriptor", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.suspended,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService);
        await catalogService.activateDescriptor(
          eService.id,
          descriptor.id,
          getMockAuthData(eService.producerId)
        );

        const updatedDescriptor = {
          ...descriptor,
          state: descriptorState.published,
        };

        const writtenEvent = await readLastEventByStreamId(eService.id);
        expect(writtenEvent.stream_id).toBe(eService.id);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceDescriptorUpdated");
        const writtenPayload = decode({
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

      it("should throw operationForbidden if the requester is not allowed", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.suspended,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService);
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
        await addOneEService(eService);
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
    });

    describe("clone descriptor", () => {
      it("TO DO implement after understanding file manager", () => {
        expect(1).toBe(1);
      });
    });

    describe("archive descriptor", () => {
      it("should write on event-store for the archiving of a descriptor", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.suspended,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService);
        await catalogService.archiveDescriptor(
          eService.id,
          descriptor.id,
          getMockAuthData(eService.producerId)
        );

        const writtenEvent = await readLastEventByStreamId(eService.id);
        expect(writtenEvent.stream_id).toBe(eService.id);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceDescriptorUpdated");
        const writtenPayload = decode({
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

      it("should throw operationForbidden if the requester is not allowed", async () => {
        const descriptor: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.suspended,
        };
        const eService: EService = {
          ...mockEService,
          descriptors: [descriptor],
        };
        await addOneEService(eService);
        expect(
          catalogService.archiveDescriptor(
            eService.id,
            descriptor.id,
            getMockAuthData()
          )
        ).rejects.toThrowError(operationForbidden);
      });
    });

    describe("upload Document", () => {
      it("TO DO implement after understanding file manager", () => {
        expect(1).toBe(1);
      });
    });

    describe("delete Document", () => {
      it("TO DO implement after understanding file manager", () => {
        expect(1).toBe(1);
      });
    });

    describe("update Document", () => {
      it("TO DO implement after understanding file manager", () => {
        expect(1).toBe(1);
      });
    });
  });

  describe("ReadModel Service", () => {
    describe("getEservices", () => {
      it("Should get eServices based on the given parameters", async () => {
        const [organizationId1, organizationId2] = [uuidv4(), uuidv4()];
        const descriptor1: Descriptor = {
          ...mockDescriptor,
          id: uuidv4(),
          state: descriptorState.published,
        };
        const eService1: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "eService 001",
          descriptors: [descriptor1],
          producerId: organizationId1,
        };
        await addOneEService(eService1);

        const descriptor2: Descriptor = {
          ...mockDescriptor,
          id: uuidv4(),
          state: descriptorState.draft,
        };
        const eService2: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "eService 002",
          descriptors: [descriptor2],
          producerId: organizationId1,
        };
        await addOneEService(eService2);

        const descriptor3: Descriptor = {
          ...mockDescriptor,
          id: uuidv4(),
          state: descriptorState.published,
        };
        const eService3: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "eService 003",
          descriptors: [descriptor3],
          producerId: organizationId1,
        };
        await addOneEService(eService3);

        const descriptor4: Descriptor = {
          ...mockDescriptor,
          id: uuidv4(),
          state: descriptorState.draft,
        };
        const eService4: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "eService 004",
          producerId: organizationId2,
          descriptors: [descriptor4],
        };
        await addOneEService(eService4);

        const descriptor5: Descriptor = {
          ...mockDescriptor,
          id: uuidv4(),
          state: descriptorState.published,
        };
        const eService5: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "eService 005",
          producerId: organizationId2,
          descriptors: [descriptor5],
        };
        await addOneEService(eService5);

        const descriptor6: Descriptor = {
          ...mockDescriptor,
          id: uuidv4(),
          state: descriptorState.draft,
        };
        const eService6: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "eService 006",
          producerId: organizationId2,
          descriptors: [descriptor6],
        };
        await addOneEService(eService6);

        const result1 = await readModelService.getEServices(
          getMockAuthData(),
          {
            eservicesIds: [eService1.id, eService2.id],
            producersIds: [],
            states: [],
            agreementStates: [],
          },
          0,
          50
        );
        const result2 = await readModelService.getEServices(
          getMockAuthData(),
          {
            eservicesIds: [],
            producersIds: [organizationId1],
            states: [],
            agreementStates: [],
          },
          0,
          50
        );
        const result3 = await readModelService.getEServices(
          getMockAuthData(),
          {
            eservicesIds: [],
            producersIds: [],
            states: ["Draft"],
            agreementStates: [],
          },
          0,
          50
        );
        const result4 = await readModelService.getEServices(
          getMockAuthData(),
          {
            eservicesIds: [],
            producersIds: [organizationId2],
            states: ["Draft"],
            agreementStates: [],
          },
          0,
          50
        );
        // TO DO test with other parameters configuration
        expect(result1.totalCount).toBe(2);
        expect(result1.results).toEqual([eService1, eService2]);
        expect(result2.totalCount).toBe(3);
        expect(result2.results).toEqual([eService1, eService2, eService3]);
        expect(result3.totalCount).toBe(3);
        expect(result3.results).toEqual([eService2, eService4, eService6]);
        expect(result4.totalCount).toBe(2);
        expect(result4.results).toEqual([eService4, eService6]);
      });
    });

    describe("getEServiceById", () => {
      it("should get the eService if it exists", async () => {
        const descriptor1: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };
        const eService1: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "eService 001",
          descriptors: [descriptor1],
        };
        await addOneEService(eService1);

        const descriptor2: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };
        const eService2: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "eService 002",
          descriptors: [descriptor2],
        };
        await addOneEService(eService2);

        const descriptor3: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };
        const eService3: EService = {
          ...mockEService,
          id: uuidv4(),
          name: "eService 003",
          descriptors: [descriptor3],
        };
        await addOneEService(eService3);

        const eService = await readModelService.getEServiceById(eService1.id);
        expect(eService?.data).toEqual(eService1);
      });

      it("should not get the eService if it doesn't exist", async () => {
        await addOneEService(mockEService);

        const eService = await readModelService.getEServiceById(uuidv4());
        expect(eService).toBeUndefined();
      });
    });

    describe("getEserviceConsumers", () => {
      it("should get the consumers of the given eService", async () => {
        const descriptor1: Descriptor = {
          ...mockDescriptor,
          state: descriptorState.published,
        };
        const eService1: EService = {
          ...mockEService,
          descriptors: [descriptor1],
        };
        await addOneEService(eService1);
        const tenant = getMockTenant();
        await addOneTenant(tenant);
        const agreement = getMockAgreement({
          eServiceId: eService1.id,
          descriptorId: descriptor1.id,
          producerId: eService1.producerId,
          consumerId: tenant.id,
        });
        await addOneAgreement(agreement);

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
          state: descriptorState.published,
        };
        const eService1: EService = {
          ...mockEService,
          descriptors: [descriptor1],
        };
        await addOneEService(eService1);

        const consumers = await readModelService.getEServiceConsumers(
          eService1.id,
          0,
          50
        );
        expect(consumers.results).toStrictEqual([]);
        expect(consumers.totalCount).toBe(0);
      });
    });
  });

  const addOneEService = async (eService: EService): Promise<void> => {
    await writeEServiceInEventstore(eService, postgresDB);
    await writeEServiceInReadmodel(eService, eservices);
  };

  const addOneTenant = async (tenant: Tenant): Promise<void> => {
    await writeTenantInReadmodel(tenant, tenants);
  };

  const addOneAgreement = async (agreement: Agreement): Promise<void> => {
    await writeAgreementInReadmodel(agreement, agreements);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const readLastEventByStreamId = async (eServiceId: string): Promise<any> =>
    await postgresDB.one(
      "SELECT * FROM catalog.events WHERE stream_id = $1 ORDER BY sequence_num DESC LIMIT 1",
      [eServiceId]
    );
});

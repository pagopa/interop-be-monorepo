/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable no-underscore-dangle */
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  AgreementCollection,
  AuthData,
  EServiceCollection,
  ReadModelRepository,
  TenantCollection,
  initDB,
} from "pagopa-interop-commons";
import { IDatabase } from "pg-promise";
import { v4 as uuidv4 } from "uuid";
import {
  Agreement,
  Descriptor,
  EService,
  EServiceAddedV1,
  EServiceDeletedV1,
  EServiceDescriptorUpdatedV1,
  EServiceEvent,
  EServiceUpdatedV1,
  EServiceWithDescriptorsDeletedV1,
  Tenant,
  agreementState,
  catalogEventToBinaryData,
  descriptorState,
  operationForbidden,
  technology,
} from "pagopa-interop-models";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { GenericContainer } from "testcontainers";
import { generateMock } from "@anatine/zod-mock";
import { MessageType } from "@protobuf-ts/runtime";
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
  eServiceDuplicate,
  eServiceNotFound,
  notValidDescriptor,
} from "../src/model/domain/errors.js";

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
    readModelService = readModelServiceBuilder(config);
    catalogService = catalogServiceBuilder(config, readModelService);

    postgresDB = initDB({
      username: config.eventStoreDbUsername,
      password: config.eventStoreDbPassword,
      host: config.eventStoreDbHost,
      port: config.eventStoreDbPort,
      database: config.eventStoreDbName,
      schema: config.eventStoreDbSchema,
      useSSL: config.eventStoreDbUseSSL,
    });
  });

  afterEach(async () => {
    await eservices.deleteMany({});
    await agreements.deleteMany({});
    await tenants.deleteMany({});

    await postgresDB.none("TRUNCATE TABLE catalog.events RESTART IDENTITY");
    await postgresDB.none("TRUNCATE TABLE agreement.events RESTART IDENTITY");
  });

  describe("Catalog service", () => {
    let mockEService: EService;
    beforeEach(() => {
      mockEService = getMockEService();
    });
    describe("create eService", () => {
      it("should write on event-store for the creation of an eService", async () => {
        const { organizationId } = ids();
        const id = await catalogService.createEService(
          {
            name: mockEService.name,
            description: mockEService.description,
            technology: "REST",
          },
          buildAuthData(organizationId)
        );

        const eService: EService = {
          ...mockEService,
          id,
          technology: "Rest",
          producerId: organizationId,
        };

        expect(id).toBeDefined();
        const writtenEvent = await readLastEventByStreamId(id);
        expect(writtenEvent.stream_id).toBe(id);
        expect(writtenEvent.version).toBe("0");
        expect(writtenEvent.type).toBe("EServiceAdded");
        const writtenPayload = decode({
          messageType: EServiceAddedV1,
          payload: writtenEvent.data,
        });
        const expectedEServiceV1 = toEServiceV1(eService);
        expect(writtenPayload.eService?.name).toBe(expectedEServiceV1.name);
        expect(writtenPayload.eService?.description).toBe(
          expectedEServiceV1.description
        );
        expect(writtenPayload.eService?.technology).toBe(
          expectedEServiceV1.technology
        );
        expect(writtenPayload.eService?.producerId).toBe(organizationId);
      });
      it("should throw eServiceDuplicate if the eService already exists", async () => {
        const { eServiceId, organizationId } = ids();
        const eService: EService = {
          ...mockEService,
          id: eServiceId,
          producerId: organizationId,
        };
        await addOneEService(eService);
        expect(
          catalogService.createEService(
            {
              name: eService.name,
              description: eService.description,
              technology: "REST",
            },
            buildAuthData(organizationId)
          )
        ).rejects.toThrowError(eServiceDuplicate(eService.name));
      });
    });

    describe("update eService", () => {
      it("should write on event-store for the update of an eService", async () => {
        const { eServiceId, organizationId } = ids();
        const eService: EService = {
          ...mockEService,
          id: eServiceId,
          producerId: organizationId,
        };
        const updatedName = "eService new name";
        await addOneEService(eService);
        await catalogService.updateEService(
          eServiceId,
          {
            name: updatedName,
            description: mockEService.description,
            technology: "REST",
          },
          buildAuthData(organizationId)
        );

        const updatedEService = {
          ...eService,
          name: updatedName,
        };

        const writtenEvent = await readLastEventByStreamId(eServiceId);
        expect(writtenEvent.stream_id).toBe(eServiceId);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceUpdated");
        const writtenPayload = decode({
          messageType: EServiceUpdatedV1,
          payload: writtenEvent.data,
        });
        const expectedEServiceV1 = toEServiceV1(updatedEService);
        expect(writtenPayload.eService).toEqual(expectedEServiceV1);
      });
      it("should throw eServiceNotFound if the eService doesn't exist", async () => {
        const { eServiceId, organizationId } = ids();
        expect(
          catalogService.updateEService(
            eServiceId,
            {
              name: "eService new name",
              description: "eService description",
              technology: "REST",
            },
            buildAuthData(organizationId)
          )
        ).rejects.toThrowError(eServiceNotFound(eServiceId));
      });
      it("should throw operationForbidden if the requester is not allowed", async () => {
        const { eServiceId, organizationId, requesterId } = ids();
        const eService: EService = {
          ...mockEService,
          id: eServiceId,
          producerId: organizationId,
        };
        await addOneEService(eService);

        expect(
          catalogService.updateEService(
            eServiceId,
            {
              name: "eService new name",
              description: "eService description",
              technology: "REST",
            },
            buildAuthData(requesterId)
          )
        ).rejects.toThrowError(operationForbidden);
      });
      it("should throw eServiceCannotBeUpdated if the eService's descriptor is not in draft", async () => {
        const { eServiceId, organizationId } = ids();

        const descriptor: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.published,
        };
        const eService: EService = {
          ...mockEService,
          id: eServiceId,
          producerId: organizationId,
          descriptors: [descriptor],
        };
        await addOneEService(eService);
        expect(
          catalogService.updateEService(
            eServiceId,
            {
              name: "eService new name",
              description: "eService description",
              technology: "REST",
            },
            buildAuthData(organizationId)
          )
        ).rejects.toThrowError(eServiceCannotBeUpdated(eServiceId));
      });
    });

    describe("delete eService", () => {
      it("should write on event-store for the deletion of an eService", async () => {
        const { eServiceId, organizationId } = ids();
        const eService: EService = {
          ...mockEService,
          id: eServiceId,
          producerId: organizationId,
        };
        await addOneEService(eService);
        await catalogService.deleteEService(
          eServiceId,
          buildAuthData(organizationId)
        );
        const writtenEvent = await readLastEventByStreamId(eServiceId);
        expect(writtenEvent.stream_id).toBe(eServiceId);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceDeleted");
        const writtenPayload = decode({
          messageType: EServiceDeletedV1,
          payload: writtenEvent.data,
        });
        expect(writtenPayload.eServiceId).toBe(eServiceId);
      });
      it("should throw eServiceNotFound if the eService doesn't exist", () => {
        const { eServiceId, organizationId } = ids();
        expect(
          catalogService.deleteEService(
            eServiceId,
            buildAuthData(organizationId)
          )
        ).rejects.toThrowError(eServiceNotFound(eServiceId));
      });
      it("should throw operationForbidden if the requester is not allowed", async () => {
        const { eServiceId, organizationId, requesterId } = ids();
        const eService: EService = {
          ...mockEService,
          id: eServiceId,
          producerId: organizationId,
        };
        await addOneEService(eService);
        expect(
          catalogService.deleteEService(eServiceId, buildAuthData(requesterId))
        ).rejects.toThrowError(operationForbidden);
      });
      it("should throw eServiceCannotBeDeleted if the eService has a descriptor", async () => {
        const { eServiceId, organizationId } = ids();
        const descriptor: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.published,
        };
        const eService: EService = {
          ...mockEService,
          id: eServiceId,
          producerId: organizationId,
          descriptors: [descriptor],
        };
        await addOneEService(eService);
        expect(
          catalogService.deleteEService(
            eServiceId,
            buildAuthData(organizationId)
          )
        ).rejects.toThrowError(eServiceCannotBeDeleted(eServiceId));
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
          buildAuthData(organizationId)
        );
      });
      */
      it("should throw draftDescriptorAlreadyExists if a draft descriptor already exists", async () => {
        const { eServiceId, organizationId } = ids();
        const descriptor: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.draft,
        };
        const eService: EService = {
          ...mockEService,
          id: eServiceId,
          producerId: organizationId,
          descriptors: [descriptor],
        };

        await addOneEService(eService);
        expect(
          catalogService.createDescriptor(
            eServiceId,
            buildDescriptorSeed(descriptor),
            buildAuthData(organizationId)
          )
        ).rejects.toThrowError(draftDescriptorAlreadyExists(eServiceId));
      });
      it("should throw eServiceNotFound if the eService doesn't exist", async () => {
        const { eServiceId, organizationId } = ids();
        const descriptor = getMockDescriptor();
        expect(
          catalogService.createDescriptor(
            eServiceId,
            buildDescriptorSeed(descriptor),
            buildAuthData(organizationId)
          )
        ).rejects.toThrowError(eServiceNotFound(eServiceId));
      });
      it("should throw operationForbidden if the requester is not allowed", async () => {
        const { eServiceId, organizationId, requesterId } = ids();
        const descriptor: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.published,
        };
        const eService: EService = {
          ...mockEService,
          id: eServiceId,
          producerId: organizationId,
          descriptors: [descriptor],
        };
        await addOneEService(eService);
        expect(
          catalogService.createDescriptor(
            eServiceId,
            buildDescriptorSeed(descriptor),
            buildAuthData(requesterId)
          )
        ).rejects.toThrowError(operationForbidden);
      });
    });

    describe("update descriptor", () => {
      it("should write on event-store for the update of a descriptor", async () => {
        const { eServiceId, organizationId, descriptorId } = ids();

        const descriptor: Descriptor = {
          ...getMockDescriptor(descriptorId),
          state: descriptorState.draft,
        };
        const eService: EService = {
          ...mockEService,
          id: eServiceId,
          producerId: organizationId,
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
          eServiceId,
          descriptorId,
          updatedDescriptorSeed,
          buildAuthData(organizationId)
        );
        const writtenEvent = await readLastEventByStreamId(eServiceId);
        expect(writtenEvent.stream_id).toBe(eServiceId);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceUpdated");
        const writtenPayload = decode({
          messageType: EServiceUpdatedV1,
          payload: writtenEvent.data,
        });
        const expectedEServiceV1 = toEServiceV1(updatedEService);
        expect(writtenPayload.eService).toEqual(expectedEServiceV1);
      });
      it("should throw eServiceNotFound if the eService doesn't exist", () => {
        const { eServiceId, organizationId, descriptorId } = ids();
        const descriptor: Descriptor = {
          ...getMockDescriptor(descriptorId),
          state: descriptorState.published,
        };
        expect(
          catalogService.updateDescriptor(
            eServiceId,
            descriptorId,
            buildDescriptorSeed(descriptor),
            buildAuthData(organizationId)
          )
        ).rejects.toThrowError(eServiceNotFound(eServiceId));
      });
      it("should throw operationForbidden if the requester is not allowed", async () => {
        const { eServiceId, organizationId, requesterId, descriptorId } = ids();

        const descriptor: Descriptor = {
          ...getMockDescriptor(descriptorId),
          state: descriptorState.draft,
        };
        const eService: EService = {
          ...mockEService,
          id: eServiceId,
          producerId: organizationId,
          descriptors: [descriptor],
        };
        await addOneEService(eService);

        const updatedDescriptor = {
          ...descriptor,
          dailyCallsTotal: 15,
        };
        expect(
          catalogService.updateDescriptor(
            eServiceId,
            descriptorId,
            buildDescriptorSeed(updatedDescriptor),
            buildAuthData(requesterId)
          )
        ).rejects.toThrowError(operationForbidden);
      });
    });

    describe("delete draft descriptor", () => {
      it("should write on event-store for the deletion of a draft descriptor", async () => {
        const { eServiceId, organizationId, descriptorId } = ids();
        const descriptor: Descriptor = {
          ...getMockDescriptor(descriptorId),
          state: descriptorState.draft,
        };
        const eService: EService = {
          ...mockEService,
          id: eServiceId,
          producerId: organizationId,
          descriptors: [descriptor],
        };
        await addOneEService(eService);

        await catalogService.deleteDraftDescriptor(
          eServiceId,
          descriptorId,
          buildAuthData(organizationId)
        );

        const writtenEvent = await readLastEventByStreamId(eServiceId);
        expect(writtenEvent.stream_id).toBe(eServiceId);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceWithDescriptorsDeleted");
        const writtenPayload = decode({
          messageType: EServiceWithDescriptorsDeletedV1,
          payload: writtenEvent.data,
        });
        const expectedEServiceV1 = toEServiceV1(eService);
        expect(writtenPayload.eService).toEqual(expectedEServiceV1);
        expect(writtenPayload.descriptorId).toEqual(descriptorId);
      });
      it("should throw eServiceNotFound if the eService doesn't exist", () => {
        const { eServiceId, organizationId, descriptorId } = ids();

        expect(
          catalogService.deleteDraftDescriptor(
            eServiceId,
            descriptorId,
            buildAuthData(organizationId)
          )
        ).rejects.toThrowError(eServiceNotFound(eServiceId));
      });
      it("should throw operationForbidden if the requester is not allowed", async () => {
        const { eServiceId, organizationId, requesterId, descriptorId } = ids();
        const descriptor: Descriptor = {
          ...getMockDescriptor(descriptorId),
          state: descriptorState.draft,
        };
        const eService: EService = {
          ...mockEService,
          id: eServiceId,
          producerId: organizationId,
          descriptors: [descriptor],
        };
        await addOneEService(eService);
        expect(
          catalogService.deleteDraftDescriptor(
            eServiceId,
            descriptorId,
            buildAuthData(requesterId)
          )
        ).rejects.toThrowError(operationForbidden);
      });
    });

    describe("publish descriptor", () => {
      it("should write on event-store for the publication of a descriptor", async () => {
        const { eServiceId, organizationId, descriptorId } = ids();
        const descriptor: Descriptor = {
          ...getMockDescriptor(descriptorId),
          state: descriptorState.draft,
        };
        const eService: EService = {
          ...mockEService,
          id: eServiceId,
          producerId: organizationId,
          descriptors: [descriptor],
        };
        await addOneEService(eService);
        await catalogService.publishDescriptor(
          eServiceId,
          descriptorId,
          buildAuthData(organizationId)
        );

        const updatedDescriptor = {
          ...descriptor,
          state: descriptorState.published,
        };
        const writtenEvent = await readLastEventByStreamId(eServiceId);
        expect(writtenEvent.stream_id).toBe(eServiceId);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceDescriptorUpdated");
        const writtenPayload = decode({
          messageType: EServiceDescriptorUpdatedV1,
          payload: writtenEvent.data,
        });
        const expectedDescriptorV1 = toDescriptorV1(updatedDescriptor);
        expect(writtenPayload.eServiceId).toEqual(eServiceId);
        expect(writtenPayload.eServiceDescriptor?.state).toEqual(
          expectedDescriptorV1.state
        );
      });
      it("should throw an eServiceNotFound if the eService doesn't exist", async () => {
        const { eServiceId, organizationId, descriptorId } = ids();
        await expect(
          catalogService.publishDescriptor(
            eServiceId,
            descriptorId,
            buildAuthData(organizationId)
          )
        ).rejects.toThrowError(eServiceNotFound(eServiceId));
      });
      it("should throw operationForbidden if the requester is not allowed", async () => {
        const { eServiceId, organizationId, requesterId, descriptorId } = ids();
        const descriptor: Descriptor = {
          ...getMockDescriptor(descriptorId),
          state: descriptorState.draft,
        };
        const eService: EService = {
          ...mockEService,
          id: eServiceId,
          producerId: organizationId,
          descriptors: [descriptor],
        };
        await addOneEService(eService);
        expect(
          catalogService.publishDescriptor(
            eServiceId,
            descriptorId,
            buildAuthData(requesterId)
          )
        ).rejects.toThrowError(operationForbidden);
      });
      it("should throw notValidDescriptor if the descriptor is published state", async () => {
        const { eServiceId, organizationId, descriptorId } = ids();
        const descriptor: Descriptor = {
          ...getMockDescriptor(descriptorId),
          state: descriptorState.published,
        };
        const eService: EService = {
          ...mockEService,
          id: eServiceId,
          producerId: organizationId,
          descriptors: [descriptor],
        };
        await addOneEService(eService);
        expect(
          catalogService.publishDescriptor(
            eServiceId,
            descriptorId,
            buildAuthData(organizationId)
          )
        ).rejects.toThrowError(
          notValidDescriptor(descriptorId, descriptorState.published)
        );
      });
    });

    describe("suspend descriptor", () => {
      it("should write on event-store for the suspension of a descriptor", async () => {
        const { eServiceId, organizationId, descriptorId } = ids();
        const descriptor: Descriptor = {
          ...getMockDescriptor(descriptorId),
          state: descriptorState.published,
        };
        const eService: EService = {
          ...mockEService,
          id: eServiceId,
          producerId: organizationId,
          descriptors: [descriptor],
        };
        await addOneEService(eService);
        await catalogService.suspendDescriptor(
          eServiceId,
          descriptorId,
          buildAuthData(organizationId)
        );

        const updatedDescriptor = {
          ...descriptor,
          state: descriptorState.suspended,
        };
        const writtenEvent = await readLastEventByStreamId(eServiceId);
        expect(writtenEvent.stream_id).toBe(eServiceId);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceDescriptorUpdated");
        const writtenPayload = decode({
          messageType: EServiceDescriptorUpdatedV1,
          payload: writtenEvent.data,
        });
        const expectedDescriptorV1 = toDescriptorV1(updatedDescriptor);
        expect(writtenPayload.eServiceId).toEqual(eServiceId);
        expect(writtenPayload.eServiceDescriptor?.state).toEqual(
          expectedDescriptorV1.state
        );
      });
      it("should throw eServiceNotFound if the eService doesn't exist", () => {
        const { eServiceId, organizationId, descriptorId } = ids();

        expect(
          catalogService.suspendDescriptor(
            eServiceId,
            descriptorId,
            buildAuthData(organizationId)
          )
        ).rejects.toThrowError(eServiceNotFound(eServiceId));
      });
      it("should throw operationForbidden if the requester is not allowed", async () => {
        const { eServiceId, organizationId, requesterId, descriptorId } = ids();
        const descriptor: Descriptor = {
          ...getMockDescriptor(descriptorId),
          state: descriptorState.published,
        };
        const eService: EService = {
          ...mockEService,
          id: eServiceId,
          producerId: organizationId,
          descriptors: [descriptor],
        };
        await addOneEService(eService);
        expect(
          catalogService.suspendDescriptor(
            eServiceId,
            descriptorId,
            buildAuthData(requesterId)
          )
        ).rejects.toThrowError(operationForbidden);
      });
      it("should throw notValidDescriptor if the descriptor is in draft state", async () => {
        const { eServiceId, organizationId, descriptorId } = ids();
        const descriptor: Descriptor = {
          ...getMockDescriptor(descriptorId),
          state: descriptorState.draft,
        };
        const eService: EService = {
          ...mockEService,
          id: eServiceId,
          producerId: organizationId,
          descriptors: [descriptor],
        };
        await addOneEService(eService);
        expect(
          catalogService.suspendDescriptor(
            eServiceId,
            descriptorId,
            buildAuthData(organizationId)
          )
        ).rejects.toThrowError(
          notValidDescriptor(descriptorId, descriptorState.draft)
        );
      });
    });

    describe("activate descriptor", () => {
      it("should write on event-store for the activation of a descriptor", async () => {
        const { eServiceId, organizationId, descriptorId } = ids();
        const descriptor: Descriptor = {
          ...getMockDescriptor(descriptorId),
          state: descriptorState.suspended,
        };
        const eService: EService = {
          ...mockEService,
          id: eServiceId,
          producerId: organizationId,
          descriptors: [descriptor],
        };
        await addOneEService(eService);
        await catalogService.activateDescriptor(
          eServiceId,
          descriptorId,
          buildAuthData(organizationId)
        );

        const updatedDescriptor = {
          ...descriptor,
          state: descriptorState.published,
        };

        const writtenEvent = await readLastEventByStreamId(eServiceId);
        expect(writtenEvent.stream_id).toBe(eServiceId);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceDescriptorUpdated");
        const writtenPayload = decode({
          messageType: EServiceDescriptorUpdatedV1,
          payload: writtenEvent.data,
        });
        const expectedDescriptorV1 = toDescriptorV1(updatedDescriptor);
        expect(writtenPayload.eServiceId).toEqual(eServiceId);
        expect(writtenPayload.eServiceDescriptor?.state).toEqual(
          expectedDescriptorV1.state
        );
      });
      it("should throw eServiceNotFound if the eService doesn't exist", () => {
        const { eServiceId, organizationId, descriptorId } = ids();

        expect(
          catalogService.activateDescriptor(
            eServiceId,
            descriptorId,
            buildAuthData(organizationId)
          )
        ).rejects.toThrowError(eServiceNotFound(eServiceId));
      });
      it("should throw operationForbidden if the requester is not allowed", async () => {
        const { eServiceId, organizationId, requesterId, descriptorId } = ids();
        const descriptor: Descriptor = {
          ...getMockDescriptor(descriptorId),
          state: descriptorState.suspended,
        };
        const eService: EService = {
          ...mockEService,
          id: eServiceId,
          producerId: organizationId,
          descriptors: [descriptor],
        };
        await addOneEService(eService);
        expect(
          catalogService.activateDescriptor(
            eServiceId,
            descriptorId,
            buildAuthData(requesterId)
          )
        ).rejects.toThrowError(operationForbidden);
      });
      it("should throw notValidDescriptor if the descriptor is si draft state", async () => {
        const { eServiceId, organizationId, descriptorId } = ids();
        const descriptor: Descriptor = {
          ...getMockDescriptor(descriptorId),
          state: descriptorState.draft,
        };
        const eService: EService = {
          ...mockEService,
          id: eServiceId,
          producerId: organizationId,
          descriptors: [descriptor],
        };
        await addOneEService(eService);
        expect(
          catalogService.activateDescriptor(
            eServiceId,
            descriptorId,
            buildAuthData(organizationId)
          )
        ).rejects.toThrowError(
          notValidDescriptor(descriptorId, descriptorState.draft)
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
        const { eServiceId, organizationId, descriptorId } = ids();
        const descriptor: Descriptor = {
          ...getMockDescriptor(descriptorId),
          state: descriptorState.suspended,
        };
        const eService: EService = {
          ...mockEService,
          id: eServiceId,
          producerId: organizationId,
          descriptors: [descriptor],
        };
        await addOneEService(eService);
        await catalogService.archiveDescriptor(
          eServiceId,
          descriptorId,
          buildAuthData(organizationId)
        );

        const updatedDescriptor = {
          ...descriptor,
          state: descriptorState.archived,
        };
        const writtenEvent = await readLastEventByStreamId(eServiceId);
        expect(writtenEvent.stream_id).toBe(eServiceId);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceDescriptorUpdated");
        const writtenPayload = decode({
          messageType: EServiceDescriptorUpdatedV1,
          payload: writtenEvent.data,
        });
        const expectedDescriptorV1 = toDescriptorV1(updatedDescriptor);
        expect(writtenPayload.eServiceId).toEqual(eServiceId);
        expect(writtenPayload.eServiceDescriptor?.state).toEqual(
          expectedDescriptorV1.state
        );
      });
      it("should throw eServiceNotFound if the eService doesn't exist", () => {
        const { eServiceId, organizationId, descriptorId } = ids();

        expect(
          catalogService.archiveDescriptor(
            eServiceId,
            descriptorId,
            buildAuthData(organizationId)
          )
        ).rejects.toThrowError(eServiceNotFound(eServiceId));
      });
      it("should throw operationForbidden if the requester is not allowed", async () => {
        const { eServiceId, organizationId, requesterId, descriptorId } = ids();
        const descriptor: Descriptor = {
          ...getMockDescriptor(descriptorId),
          state: descriptorState.suspended,
        };
        const eService: EService = {
          ...mockEService,
          id: eServiceId,
          producerId: organizationId,
          descriptors: [descriptor],
        };
        await addOneEService(eService);
        expect(
          catalogService.archiveDescriptor(
            eServiceId,
            descriptorId,
            buildAuthData(requesterId)
          )
        ).rejects.toThrowError(operationForbidden);
      });
    });
  });

  /*
  TO DO add tests for
  
  uploadDocument
  deleteDocument
  updateDocument

  do they involve file manager?
  */

  describe("ReadModel Service", () => {
    let mockEService1: EService;
    let mockEService2: EService;
    let mockEService3: EService;
    let mockEService4: EService;
    let mockEService5: EService;
    let mockEService6: EService;

    beforeEach(() => {
      mockEService1 = getMockEService();
      mockEService2 = getMockEService();
      mockEService3 = getMockEService();
      mockEService4 = getMockEService();
      mockEService5 = getMockEService();
      mockEService6 = getMockEService();
    });
    describe("getEservices", () => {
      it("Should get eServices based on the given parameters", async () => {
        const {
          eServiceId,
          eServiceId2,
          eServiceId3,
          eServiceId4,
          eServiceId5,
          eServiceId6,
          organizationId,
          organizationId2,
        } = ids();
        const descriptor1: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.published,
        };
        const eService1: EService = {
          ...mockEService1,
          id: eServiceId,
          name: "eService 001",
          producerId: organizationId,
          descriptors: [descriptor1],
        };
        await addOneEService(eService1);

        const descriptor2: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.draft,
        };
        const eService2: EService = {
          ...mockEService2,
          id: eServiceId2,
          name: "eService 002",
          producerId: organizationId,
          descriptors: [descriptor2],
        };
        await addOneEService(eService2);

        const descriptor3: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.published,
        };
        const eService3: EService = {
          ...mockEService3,
          id: eServiceId3,
          name: "eService 003",
          producerId: organizationId,
          descriptors: [descriptor3],
        };
        await addOneEService(eService3);

        const descriptor4: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.draft,
        };
        const eService4: EService = {
          ...mockEService4,
          id: eServiceId4,
          name: "eService 004",
          producerId: organizationId2,
          descriptors: [descriptor4],
        };
        await addOneEService(eService4);

        const descriptor5: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.published,
        };
        const eService5: EService = {
          ...mockEService5,
          id: eServiceId5,
          name: "eService 005",
          producerId: organizationId2,
          descriptors: [descriptor5],
        };
        await addOneEService(eService5);

        const descriptor6: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.draft,
        };
        const eService6: EService = {
          ...mockEService6,
          id: eServiceId6,
          name: "eService 006",
          producerId: organizationId2,
          descriptors: [descriptor6],
        };
        await addOneEService(eService6);

        const result1 = await readModelService.getEServices(
          buildAuthData(organizationId),
          {
            eservicesIds: [eServiceId, eServiceId2],
            producersIds: [],
            states: [],
            agreementStates: [],
          },
          0,
          50
        );
        const result2 = await readModelService.getEServices(
          buildAuthData(organizationId),
          {
            eservicesIds: [],
            producersIds: [organizationId],
            states: [],
            agreementStates: [],
          },
          0,
          50
        );
        const result3 = await readModelService.getEServices(
          buildAuthData(organizationId),
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
          buildAuthData(organizationId),
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
        const { eServiceId, eServiceId2, eServiceId3, organizationId } = ids();

        const descriptor1: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.published,
        };
        const eService1: EService = {
          ...mockEService1,
          id: eServiceId,
          name: "eService 001",
          producerId: organizationId,
          descriptors: [descriptor1],
        };
        await addOneEService(eService1);

        const descriptor2: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.published,
        };
        const eService2: EService = {
          ...mockEService2,
          id: eServiceId2,
          name: "eService 002",
          producerId: organizationId,
          descriptors: [descriptor2],
        };
        await addOneEService(eService2);

        const descriptor3: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.published,
        };
        const eService3: EService = {
          ...mockEService1,
          id: eServiceId3,
          name: "eService 003",
          producerId: organizationId,
          descriptors: [descriptor3],
        };
        await addOneEService(eService3);

        const eService = await readModelService.getEServiceById(eServiceId);
        expect(eService?.data).toEqual(eService1);
      });
      it("should not get the eService if it doesn't exist", async () => {
        const { eServiceId, eServiceId2, organizationId } = ids();

        const eService1: EService = {
          ...mockEService1,
          id: eServiceId,
          name: "eService 001",
          producerId: organizationId,
        };
        await addOneEService(eService1);

        const eService = await readModelService.getEServiceById(eServiceId2);
        expect(eService).toBeUndefined();
      });
    });
    describe("getEserviceConsumers", () => {
      it("should get the consumers of the given eService", async () => {
        const { eServiceId, organizationId, descriptorId, tenantId } = ids();
        const descriptor1: Descriptor = {
          ...getMockDescriptor(descriptorId),
          state: descriptorState.published,
        };
        const eService1: EService = {
          ...mockEService1,
          id: eServiceId,
          producerId: organizationId,
          descriptors: [descriptor1],
        };
        await addOneEService(eService1);

        const tenant = await addOneTenant(tenantId);
        await addOneAgreement({
          eServiceId,
          descriptorId,
          producerId: organizationId,
          consumerId: tenantId,
        });

        const result = await readModelService.getEServiceConsumers(
          eServiceId,
          0,
          50
        );
        expect(result.totalCount).toBe(1);
        expect(result.results[0].consumerName).toBe(tenant.name);
      });
      it("should not get any consumers, if no one is using the given eService", async () => {
        const { eServiceId, organizationId } = ids();
        const descriptor1: Descriptor = {
          ...getMockDescriptor(),
          state: descriptorState.published,
        };
        const eService1: EService = {
          ...mockEService1,
          id: eServiceId,
          producerId: organizationId,
          descriptors: [descriptor1],
        };
        await addOneEService(eService1);

        const consumers = await readModelService.getEServiceConsumers(
          eServiceId,
          0,
          50
        );
        expect(consumers.results).toStrictEqual([]);
        expect(consumers.totalCount).toBe(0);
      });
    });
  });

  const writeEServiceInEventstore = async (
    eService: EService
  ): Promise<void> => {
    const eServiceEvent: EServiceEvent = {
      type: "EServiceAdded",
      data: { eService: toEServiceV1(eService) },
    };
    const eventToWrite = {
      stream_id: eServiceEvent.data.eService?.id,
      version: 0,
      type: eServiceEvent.type,
      data: Buffer.from(catalogEventToBinaryData(eServiceEvent)),
    };

    await postgresDB.none(
      "INSERT INTO catalog.events(stream_id, version, type, data) VALUES ($1, $2, $3, $4)",
      [
        eventToWrite.stream_id,
        eventToWrite.version,
        eventToWrite.type,
        eventToWrite.data,
      ]
    );
  };

  const writeEServiceInReadmodel = async (
    eService: EService
  ): Promise<void> => {
    await eservices.insertOne({
      data: eService,
      metadata: {
        version: 0,
      },
    });
  };

  const writeAgreementInReadmodel = async (
    agreement: Agreement
  ): Promise<void> => {
    await agreements.insertOne({
      data: agreement,
      metadata: {
        version: 0,
      },
    });
  };

  const writeTenantInReadmodel = async (tenant: Tenant): Promise<void> => {
    await tenants.insertOne({
      data: tenant,
      metadata: {
        version: 0,
      },
    });
  };

  const addOneTenant = async (tenantId: string): Promise<Tenant> => {
    const tenant: Tenant = {
      name: "A tenant",
      id: tenantId,
      createdAt: new Date(),
      attributes: [],
      externalId: {
        value: "123456",
        origin: "IPA",
      },
      features: [],
      mails: [],
    };
    await writeTenantInReadmodel(tenant);
    return tenant;
  };

  const _addOneTenant = async (tenantId: string): Promise<Tenant> => {
    const mockTenant = generateMock(Tenant);
    const tenant: Tenant = {
      ...mockTenant,
      id: tenantId,
      createdAt: new Date(),
    };
    await writeTenantInReadmodel(tenant);
    return tenant;
  };

  const addOneAgreement = async ({
    eServiceId,
    descriptorId,
    producerId,
    consumerId,
  }: {
    eServiceId: string;
    descriptorId: string;
    producerId: string;
    consumerId: string;
  }): Promise<void> => {
    const agreement: Agreement = {
      id: uuidv4(),
      createdAt: new Date(),
      eserviceId: eServiceId,
      descriptorId,
      producerId,
      consumerId,
      state: agreementState.active,
      verifiedAttributes: [],
      certifiedAttributes: [],
      declaredAttributes: [],
      consumerDocuments: [],
      stamps: {
        submission: undefined,
        activation: undefined,
        rejection: undefined,
        suspensionByProducer: undefined,
        suspensionByConsumer: undefined,
        upgrade: undefined,
        archiving: undefined,
      },
    };
    await writeAgreementInReadmodel(agreement);
  };

  const _addOneAgreement = async ({
    eServiceId,
    descriptorId,
    producerId,
    consumerId,
  }: {
    eServiceId: string;
    descriptorId: string;
    producerId: string;
    consumerId: string;
  }): Promise<void> => {
    const mockAgreement = generateMock(Agreement);
    const agreement: Agreement = {
      ...mockAgreement,
      createdAt: new Date(),
      state: agreementState.active,
      eserviceId: eServiceId,
      descriptorId,
      producerId,
      consumerId,
    };
    await writeAgreementInReadmodel(agreement);
  };

  const addOneEService = async (eService: EService): Promise<void> => {
    await writeEServiceInEventstore(eService);
    await writeEServiceInReadmodel(eService);
    // return eService;
  };

  const buildAuthData = (organizationId?: string): AuthData => ({
    organizationId: organizationId || uuidv4(),
    userId: uuidv4(),
    userRoles: [],
    externalId: {
      value: "123456",
      origin: "IPA",
    },
  });

  const buildDescriptorSeed = (
    descriptor: Descriptor
  ): EServiceDescriptorSeed => ({
    audience: descriptor.audience,
    voucherLifespan: descriptor.voucherLifespan,
    dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer,
    dailyCallsTotal: descriptor.dailyCallsTotal,
    agreementApprovalPolicy: "AUTOMATIC",
    description: descriptor.description,
    attributes: {
      certified: [],
      declared: [],
      verified: [],
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const readLastEventByStreamId = async (eServiceId: string): Promise<any> =>
    await postgresDB.one(
      "SELECT * FROM catalog.events WHERE stream_id = $1 ORDER BY sequence_num DESC LIMIT 1",
      [eServiceId]
    );

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const ids = () => ({
    eServiceId: uuidv4(),
    eServiceId2: uuidv4(),
    eServiceId3: uuidv4(),
    eServiceId4: uuidv4(),
    eServiceId5: uuidv4(),
    eServiceId6: uuidv4(),
    organizationId: uuidv4(),
    organizationId2: uuidv4(),
    descriptorId: uuidv4(),
    requesterId: uuidv4(),
    tenantId: uuidv4(),
  });

  const _getMockEService = (): EService => {
    const mockEService = generateMock(EService);
    const eService: EService = {
      ...mockEService,
      createdAt: new Date(),
      descriptors: [],
      technology: technology.rest,
    };
    return eService;
  };

  const getMockEService = (): EService => ({
    id: uuidv4(),
    name: "eService name",
    description: "eService description",
    createdAt: new Date(),
    producerId: uuidv4(),
    technology: technology.rest,
    descriptors: [],
  });

  const getMockDescriptor = (id?: string): Descriptor => ({
    id: id || uuidv4(),
    version: "0",
    docs: [],
    state: descriptorState.draft,
    audience: [],
    voucherLifespan: 60,
    dailyCallsPerConsumer: 10,
    dailyCallsTotal: 1000,
    createdAt: new Date(),
    serverUrls: ["pagopa.it"],
    agreementApprovalPolicy: "Automatic",
    attributes: {
      certified: [],
      verified: [],
      declared: [],
    },
  });

  const _getMockDescriptor = (id?: string): Descriptor => {
    const mockDescriptor = generateMock(Descriptor);
    const descriptor: Descriptor = {
      ...mockDescriptor,
      ...(id && { id }),
      voucherLifespan: 60,
      dailyCallsPerConsumer: 10,
      dailyCallsTotal: 1000,
      agreementApprovalPolicy: "Automatic",
      version: "0",
    };
    return descriptor;
  };

  function decode<I extends object>({
    messageType,
    payload,
  }: {
    messageType: MessageType<I>;
    payload: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  }): I {
    return messageType.fromBinary(Buffer.from(payload, "hex"));
  }
});

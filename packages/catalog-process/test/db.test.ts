/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { afterEach, beforeAll, describe, expect, it } from "vitest";
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
  EService,
  EServiceEvent,
  Tenant,
  agreementState,
  catalogEventToBinaryData,
  descriptorState,
  operationForbidden,
  technology,
} from "pagopa-interop-models";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { GenericContainer } from "testcontainers";
import { config } from "../src/utilities/config.js";
import { toEServiceV1 } from "../src/model/domain/toEvent.js";
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
    describe("create eService", () => {
      it("should write on event-store for the creation of an eService", async () => {
        const id = await catalogService.createEService(
          {
            name: "eService name",
            description: "eService description",
            technology: "REST",
          },
          buildAuthData()
        );
        expect(id).toBeDefined();
        const writtenEvent = await readLastEventByStreamId(id);
        expect(writtenEvent.stream_id).toBe(id);
        expect(writtenEvent.version).toBe("0");
        expect(writtenEvent.type).toBe("EServiceAdded");
      });
      it("should not write on event-store if eservice already exists", async () => {
        const { eServiceId, organizationId } = ids();
        await addOneEService({
          id: eServiceId,
          producerId: organizationId,
        });
        expect(
          catalogService.createEService(
            {
              name: "eService name",
              description: "eService description",
              technology: "REST",
            },
            buildAuthData(organizationId)
          )
        ).rejects.toThrowError(eServiceDuplicate("eService name"));
      });
    });

    describe("update eService", () => {
      it("should write on event-store for the update of an eService", async () => {
        const { eServiceId, organizationId } = ids();
        await addOneEService({
          id: eServiceId,
          producerId: organizationId,
        });
        await catalogService.updateEService(
          eServiceId,
          {
            name: "eService new name",
            description: "eService description",
            technology: "REST",
          },
          buildAuthData(organizationId)
        );

        const writtenEvent = await readLastEventByStreamId(eServiceId);
        expect(writtenEvent.stream_id).toBe(eServiceId);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceUpdated");
      });
      it("should throw an error if the eService doesn't exist", async () => {
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
      it("should throw an error if the requester is not allowed", async () => {
        const { eServiceId, organizationId, requesterId } = ids();
        await addOneEService({
          id: eServiceId,
          producerId: organizationId,
        });
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
      it("should throw an error if the eservice's descriptor is not in draft", async () => {
        const { eServiceId, organizationId } = ids();
        await addOneEService({
          id: eServiceId,
          producerId: organizationId,
          descriptorIsDraft: false,
        });
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

    describe("delete eService deletion", () => {
      it("should write on event-store for the deletion of an eService", async () => {
        const { eServiceId, organizationId } = ids();
        await addOneEService({
          id: eServiceId,
          producerId: organizationId,
          descriptorIsDraft: false,
          withDescriptors: false,
        });
        await catalogService.deleteEService(
          eServiceId,
          buildAuthData(organizationId)
        );
        const writtenEvent = await readLastEventByStreamId(eServiceId);
        expect(writtenEvent.stream_id).toBe(eServiceId);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceDeleted");
      });
      it("should throw an error if the eService doesn't exist", () => {
        const { eServiceId, organizationId } = ids();
        expect(
          catalogService.deleteEService(
            eServiceId,
            buildAuthData(organizationId)
          )
        ).rejects.toThrowError(eServiceNotFound(eServiceId));
      });
      it("should throw an error if the requester is not allowed", async () => {
        const { eServiceId, organizationId, requesterId } = ids();
        await addOneEService({
          id: eServiceId,
          producerId: organizationId,
        });
        expect(
          catalogService.deleteEService(eServiceId, buildAuthData(requesterId))
        ).rejects.toThrowError(operationForbidden);
      });
      it("should throw an error if the eService has a descriptor", async () => {
        const { eServiceId, organizationId } = ids();
        await addOneEService({
          id: eServiceId,
          producerId: organizationId,
        });
        expect(
          catalogService.deleteEService(
            eServiceId,
            buildAuthData(organizationId)
          )
        ).rejects.toThrowError(eServiceCannotBeDeleted(eServiceId));
      });
    });

    describe("create descriptor", async () => {
      it("should write on event-store for the creation of a descriptor", async () => {
        const { eServiceId, organizationId } = ids();
        await addOneEService({
          id: eServiceId,
          producerId: organizationId,
          withDescriptors: false,
        });
        await catalogService.createDescriptor(
          eServiceId,
          buildDescriptorSeed(),
          buildAuthData(organizationId)
        );
      });
      it("should throw an error if a draft descriptor already exists", async () => {
        const { eServiceId, organizationId } = ids();
        await addOneEService({
          id: eServiceId,
          producerId: organizationId,
        });
        expect(
          catalogService.createDescriptor(
            eServiceId,
            buildDescriptorSeed(),
            buildAuthData(organizationId)
          )
        ).rejects.toThrowError(draftDescriptorAlreadyExists(eServiceId));
      });
      it("should throw an error if the eService doesn't exist", async () => {
        const { eServiceId, organizationId } = ids();

        expect(
          catalogService.createDescriptor(
            eServiceId,
            buildDescriptorSeed(),
            buildAuthData(organizationId)
          )
        ).rejects.toThrowError(eServiceNotFound(eServiceId));
      });
      it("should throw an error if the requester is not allowed", async () => {
        const { eServiceId, organizationId, requesterId } = ids();
        await addOneEService({
          id: eServiceId,
          producerId: organizationId,
        });
        expect(
          catalogService.createDescriptor(
            eServiceId,
            buildDescriptorSeed(),
            buildAuthData(requesterId)
          )
        ).rejects.toThrowError(operationForbidden);
      });
    });

    describe("update descriptor", () => {
      it("should write on event-store for the update of a descriptor", async () => {
        const { eServiceId, organizationId, descriptorId } = ids();
        const updatedDescriptor = buildDescriptorSeed();
        updatedDescriptor.dailyCallsTotal = 200;
        await addOneEService({
          id: eServiceId,
          producerId: organizationId,
          descriptorId,
        });
        await catalogService.updateDescriptor(
          eServiceId,
          descriptorId,
          updatedDescriptor,
          buildAuthData(organizationId)
        );
        const writtenEvent = await readLastEventByStreamId(eServiceId);
        expect(writtenEvent.stream_id).toBe(eServiceId);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceUpdated");
      });
      it("should throw an error if the eService doesn't exist", () => {
        const { eServiceId, organizationId, descriptorId } = ids();
        const updatedDescriptor = buildDescriptorSeed();
        updatedDescriptor.dailyCallsTotal = 200;
        expect(
          catalogService.updateDescriptor(
            eServiceId,
            descriptorId,
            updatedDescriptor,
            buildAuthData(organizationId)
          )
        ).rejects.toThrowError(eServiceNotFound(eServiceId));
      });
      it("should throw an error if the requester is not allowed", async () => {
        const { eServiceId, organizationId, requesterId, descriptorId } = ids();
        const updatedDescriptor = buildDescriptorSeed();
        updatedDescriptor.dailyCallsTotal = 200;
        await addOneEService({
          id: eServiceId,
          producerId: organizationId,
          descriptorId,
        });
        expect(
          catalogService.updateDescriptor(
            eServiceId,
            descriptorId,
            updatedDescriptor,
            buildAuthData(requesterId)
          )
        ).rejects.toThrowError(operationForbidden);
      });
    });

    describe("delete draft descriptor", () => {
      it("should write on event-store for the deletion of a draft descriptor", async () => {
        const { eServiceId, organizationId, descriptorId } = ids();
        await addOneEService({
          id: eServiceId,
          producerId: organizationId,
          descriptorId,
          descriptorIsDraft: true,
        });
        await catalogService.deleteDraftDescriptor(
          eServiceId,
          descriptorId,
          buildAuthData(organizationId)
        );

        const writtenEvent = await readLastEventByStreamId(eServiceId);
        expect(writtenEvent.stream_id).toBe(eServiceId);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceWithDescriptorsDeleted");
      });
      it("should throw an error if the eService doesn't exist", () => {
        const { eServiceId, organizationId, descriptorId } = ids();

        expect(
          catalogService.deleteDraftDescriptor(
            eServiceId,
            descriptorId,
            buildAuthData(organizationId)
          )
        ).rejects.toThrowError(eServiceNotFound(eServiceId));
      });
      it("should throw an error if the requester is not allowed", async () => {
        const { eServiceId, organizationId, requesterId, descriptorId } = ids();
        await addOneEService({
          id: eServiceId,
          producerId: organizationId,
          descriptorId,
          descriptorIsDraft: true,
        });
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
        await addOneEService({
          id: eServiceId,
          producerId: organizationId,
          descriptorId,
          descriptorIsDraft: true,
        });
        await catalogService.publishDescriptor(
          eServiceId,
          descriptorId,
          buildAuthData(organizationId)
        );

        const writtenEvent = await readLastEventByStreamId(eServiceId);
        expect(writtenEvent.stream_id).toBe(eServiceId);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceDescriptorUpdated");
      });
      it("should throw an error if the eService doesn't exist", () => {
        const { eServiceId, organizationId, descriptorId } = ids();

        expect(
          catalogService.publishDescriptor(
            eServiceId,
            descriptorId,
            buildAuthData(organizationId)
          )
        ).rejects.toThrowError(eServiceNotFound(eServiceId));
      });
      it("should throw an error if requester is not allowed", async () => {
        const { eServiceId, organizationId, requesterId, descriptorId } = ids();
        await addOneEService({
          id: eServiceId,
          producerId: organizationId,
          descriptorId,
          descriptorIsDraft: true,
        });
        expect(
          catalogService.publishDescriptor(
            eServiceId,
            descriptorId,
            buildAuthData(requesterId)
          )
        ).rejects.toThrowError(eServiceNotFound(eServiceId));
      });
      it("should throw an error if the descriptor is not valid", async () => {
        const { eServiceId, organizationId, descriptorId } = ids();
        await addOneEService({
          id: eServiceId,
          producerId: organizationId,
          descriptorId,
          descriptorIsDraft: false,
        });
        expect(
          catalogService.publishDescriptor(
            eServiceId,
            descriptorId,
            buildAuthData(organizationId)
          )
        ).rejects.toThrowError(notValidDescriptor(descriptorId, "Draft"));
      });
    });

    describe("suspend descriptor", () => {
      it("should write on event-store for the suspension of a descriptor", async () => {
        const { eServiceId, organizationId, descriptorId } = ids();
        await addOneEService({
          id: eServiceId,
          producerId: organizationId,
          descriptorId,
          descriptorIsDraft: false,
        });
        await catalogService.suspendDescriptor(
          eServiceId,
          descriptorId,
          buildAuthData(organizationId)
        );

        const writtenEvent = await readLastEventByStreamId(eServiceId);
        expect(writtenEvent.stream_id).toBe(eServiceId);
        expect(writtenEvent.version).toBe("1");
        expect(writtenEvent.type).toBe("EServiceDescriptorUpdated");
      });
      it("should throw an error if the eService doesn't exist", () => {
        const { eServiceId, organizationId, descriptorId } = ids();

        expect(
          catalogService.suspendDescriptor(
            eServiceId,
            descriptorId,
            buildAuthData(organizationId)
          )
        ).rejects.toThrowError(eServiceNotFound(eServiceId));
      });
      it("should throw an error if requester is not allowed", async () => {
        const { eServiceId, organizationId, requesterId, descriptorId } = ids();
        await addOneEService({
          id: eServiceId,
          producerId: organizationId,
          descriptorId,
          descriptorIsDraft: false,
        });
        expect(
          catalogService.suspendDescriptor(
            eServiceId,
            descriptorId,
            buildAuthData(requesterId)
          )
        ).rejects.toThrowError(eServiceNotFound(eServiceId));
      });
      it("should throw an error if the descriptor is not valid", async () => {
        const { eServiceId, organizationId, descriptorId } = ids();
        await addOneEService({
          id: eServiceId,
          producerId: organizationId,
          descriptorId,
          descriptorIsDraft: true,
        });
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
      it("should write on event-store for the activation of a descriptor", () => {
        expect(1).toBe(1);
      });
      it("should throw an error if the eService doesn't exist", () => {
        const { eServiceId, organizationId, descriptorId } = ids();

        expect(
          catalogService.activateDescriptor(
            eServiceId,
            descriptorId,
            buildAuthData(organizationId)
          )
        ).rejects.toThrowError(eServiceNotFound(eServiceId));
      });
      it("should throw an error if requester is not allowed", async () => {
        const { eServiceId, organizationId, requesterId, descriptorId } = ids();
        await addOneEService({
          id: eServiceId,
          producerId: organizationId,
          descriptorId,
        });
        expect(
          catalogService.activateDescriptor(
            eServiceId,
            descriptorId,
            buildAuthData(requesterId)
          )
        ).rejects.toThrowError(eServiceNotFound(eServiceId));
      });
      it("should throw an error if the descriptor is not valid", async () => {
        const { eServiceId, organizationId, descriptorId } = ids();
        await addOneEService({
          id: eServiceId,
          producerId: organizationId,
          descriptorId,
          descriptorIsDraft: true,
        });
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
      it("To Do", () => {
        expect(1).toBe(1);
      });
    });
    describe("archive descriptor", () => {
      it("should write on event-store for the archiving of a descriptor", () => {
        expect(1).toBe(1);
      });
      it("should throw an error if the eService doesn't exist", () => {
        const { eServiceId, organizationId, descriptorId } = ids();

        expect(
          catalogService.archiveDescriptor(
            eServiceId,
            descriptorId,
            buildAuthData(organizationId)
          )
        ).rejects.toThrowError(eServiceNotFound(eServiceId));
      });
      it("should throw an error if requester is not allowed", async () => {
        const { eServiceId, organizationId, requesterId, descriptorId } = ids();
        await addOneEService({
          id: eServiceId,
          producerId: organizationId,
          descriptorId,
        });
        expect(
          catalogService.archiveDescriptor(
            eServiceId,
            descriptorId,
            buildAuthData(requesterId)
          )
        ).rejects.toThrowError(eServiceNotFound(eServiceId));
      });
    });
  });

  describe("ReadModel Service", () => {
    describe("getEservices", () => {
      it("Should get eServices based on the given parameters", async () => {
        const {
          eServiceId,
          eServiceId2,
          eServiceId3,
          eServiceId4,
          organizationId,
          organizationId2,
        } = ids();
        await addOneEService({
          id: eServiceId,
          producerId: organizationId,
          descriptorIsDraft: false,
        });
        await addOneEService({
          id: eServiceId2,
          producerId: organizationId,
          descriptorIsDraft: false,
        });
        await addOneEService({
          id: eServiceId3,
          producerId: organizationId,
          descriptorIsDraft: false,
        });
        await addOneEService({
          id: eServiceId4,
          producerId: organizationId2,
          descriptorIsDraft: true,
        });

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
        // TO DO test with other parameters configuration
        expect(result1.totalCount).toBe(2);
        expect(result2.totalCount).toBe(3);
        expect(result3.totalCount).toBe(1);
        // TO DO compare fields
      });
    });
    describe("getEServiceById", () => {
      it("should get the eService if it exists", async () => {
        const { eServiceId, organizationId } = ids();
        await addOneEService({
          id: eServiceId,
          producerId: organizationId,
        });
        const eService = await readModelService.getEServiceById(eServiceId);
        expect(eService?.data.name).toBe("eService name");
        expect(eService?.data.description).toBe("eService description");
      });
      it("should not get the eService if it doesn't exist", async () => {
        const { eServiceId } = ids();

        const eService = await readModelService.getEServiceById(eServiceId);
        expect(eService).toBeUndefined();
      });
    });
    describe("getEserviceConsumers", () => {
      it("should get the consumers of the given eService", async () => {
        const { eServiceId, organizationId, descriptorId, tenantId } = ids();
        await addOneEService({
          id: eServiceId,
          producerId: organizationId,
          descriptorId: descriptorId,
          descriptorIsDraft: false,
        });
        await addOneTenant(tenantId);
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
        expect(result.results[0].consumerName).toBe("A tenant");
      });
      it("should not get any consumers, if no one is using the given eService", async () => {
        const { eServiceId, organizationId } = ids();
        await addOneEService({
          id: eServiceId,
          producerId: organizationId,
        });
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

  const buildEService = ({
    id,
    producerId,
    descriptorIsDraft,
    withDescriptors,
    descriptorId,
  }: {
    id: string;
    producerId: string;
    descriptorIsDraft: boolean;
    withDescriptors: boolean;
    descriptorId: string;
  }): EService => ({
    id,
    name: "eService name",
    description: "eService description",
    createdAt: new Date(),
    producerId,
    technology: technology.rest,
    descriptors: withDescriptors
      ? [
          {
            id: descriptorId,
            version: "1",
            docs: [],
            state: descriptorIsDraft
              ? descriptorState.draft
              : descriptorState.published,
            audience: [],
            voucherLifespan: 60,
            dailyCallsPerConsumer: 100,
            dailyCallsTotal: 1000,
            createdAt: new Date(),
            serverUrls: ["pagopa.it"],
            attributes: {
              certified: [],
              verified: [],
              declared: [],
            },
          },
        ]
      : [],
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

  const writeTenantInReadmodel = async (tenant: Tenant) => {
    await tenants.insertOne({
      data: tenant,
      metadata: {
        version: 0,
      },
    });
  };

  const addOneTenant = async (tenantId: string) => {
    const tenant: Tenant = {
      name: "A tenant",
      id: tenantId,
      createdAt: new Date(),
      attributes: [],
      externalId: {
        value: "",
        origin: "",
      },
      features: [],
      mails: [],
    };
    await writeTenantInReadmodel(tenant);
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
  }) => {
    const agreement: Agreement = {
      id: uuidv4(),
      createdAt: new Date(),
      eserviceId: eServiceId,
      descriptorId: descriptorId,
      producerId: producerId,
      consumerId: consumerId,
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

  const addOneEService = async ({
    id,
    producerId = uuidv4(),
    descriptorIsDraft = true,
    withDescriptors = true,
    descriptorId = uuidv4(),
  }: {
    id: string;
    producerId?: string;
    descriptorIsDraft?: boolean;
    withDescriptors?: boolean;
    descriptorId?: string;
  }): Promise<void> => {
    const eService = buildEService({
      id,
      producerId,
      descriptorIsDraft,
      withDescriptors,
      descriptorId,
    });
    await writeEServiceInEventstore(eService);
    await writeEServiceInReadmodel(eService);
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

  const buildDescriptorSeed = (): EServiceDescriptorSeed => ({
    audience: [],
    voucherLifespan: 0,
    dailyCallsPerConsumer: 10,
    dailyCallsTotal: 100,
    agreementApprovalPolicy: "AUTOMATIC",
    attributes: {
      certified: [],
      declared: [],
      verified: [],
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const readLastEventByStreamId = async (eServiceId: string): Promise<any> =>
    (
      await postgresDB.many(
        "SELECT * FROM catalog.events WHERE stream_id = $1 ORDER BY version DESC",
        [eServiceId]
      )
    )[0];

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const ids = () => ({
    eServiceId: uuidv4(),
    eServiceId2: uuidv4(),
    eServiceId3: uuidv4(),
    eServiceId4: uuidv4(),
    organizationId: uuidv4(),
    organizationId2: uuidv4(),
    descriptorId: uuidv4(),
    requesterId: uuidv4(),
    tenantId: uuidv4(),
  });
});

/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-floating-promises */

import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  AgreementCollection,
  AuthData,
  EServiceCollection,
  ReadModelRepository,
  getMongodbContainer,
  getPostgreSqlContainer,
  initDB,
} from "pagopa-interop-commons";
import { IDatabase } from "pg-promise";
import { v4 as uuidv4 } from "uuid";
import {
  EService,
  EServiceEvent,
  catalogEventToBinaryData,
  descriptorState,
  draftDescriptorAlreadyExists,
  eServiceCannotBeDeleted,
  eServiceCannotBeUpdated,
  eServiceDuplicate,
  eServiceNotFound,
  operationForbidden,
  technology,
} from "pagopa-interop-models";
import { config } from "../src/utilities/config.js";
import { ReadModelService } from "../src/services/readModelService.js";
import { CatalogService } from "../src/services/catalogService.js";
import { toEServiceV1 } from "../src/model/domain/toEvent.js";
import { EServiceDescriptorSeed } from "../src/model/domain/models.js";

describe("database test", async () => {
  let eservices: EServiceCollection;
  let agreements: AgreementCollection;
  let readModelService: ReadModelService;
  let catalogService: CatalogService;
  let postgresDB: IDatabase<unknown>;

  beforeAll(async () => {
    const postgreSqlContainer = await getPostgreSqlContainer({
      dbName: config.eventStoreDbName,
      username: config.eventStoreDbUsername,
      password: config.eventStoreDbPassword,
    }).start();

    const mongodbContainer = await getMongodbContainer({
      dbName: config.readModelDbName,
      username: config.readModelDbUsername,
      password: config.readModelDbPassword,
    }).start();

    config.eventStoreDbPort = postgreSqlContainer.getMappedPort(5432);
    config.readModelDbPort = mongodbContainer.getMappedPort(27017);

    const readModelRepository = ReadModelRepository.init(config);
    eservices = readModelRepository.eservices;
    agreements = readModelRepository.agreements;
    readModelService = new ReadModelService(config);
    catalogService = new CatalogService(readModelService, config);

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

    await postgresDB.none("TRUNCATE TABLE catalog.events RESTART IDENTITY");
    await postgresDB.none("TRUNCATE TABLE agreement.events RESTART IDENTITY");
  });

  describe("eService creation", () => {
    it("should write on event-store for the creation of an eService", async () => {
      const id = await catalogService.createEService(
        {
          name: "name",
          description: "description",
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
      const organizationId = uuidv4();
      await addOneEService({
        id: uuidv4(),
        producerId: organizationId,
      });
      expect(
        catalogService.createEService(
          {
            name: "name",
            description: "description",
            technology: "REST",
          },
          buildAuthData(organizationId)
        )
      ).rejects.toThrowError(eServiceDuplicate("name"));
    });
  });

  describe("eService update", () => {
    it("should write on event-store for the update of an eService", async () => {
      const eServiceId = uuidv4();
      const organizationId = uuidv4();
      await addOneEService({
        id: eServiceId,
        producerId: organizationId,
      });
      await catalogService.updateEService(
        eServiceId,
        {
          name: "name",
          description: "description",
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
      const eServiceId = uuidv4();
      const organizationId = uuidv4();
      expect(
        catalogService.updateEService(
          eServiceId,
          {
            name: "name",
            description: "description",
            technology: "REST",
          },
          buildAuthData(organizationId)
        )
      ).rejects.toThrowError(eServiceNotFound(eServiceId));
    });
    it("should throw an error if the requester is not allowed", async () => {
      const eServiceId = uuidv4();
      const organizationId = uuidv4();
      const requesterId = uuidv4();
      await addOneEService({
        id: eServiceId,
        producerId: organizationId,
      });
      expect(
        catalogService.updateEService(
          eServiceId,
          {
            name: "name",
            description: "description",
            technology: "REST",
          },
          buildAuthData(requesterId)
        )
      ).rejects.toThrowError(operationForbidden);
    });
    it("should throw an error if the eservice's descriptor is not in draft", async () => {
      const eServiceId = uuidv4();
      const organizationId = uuidv4();
      await addOneEService({
        id: eServiceId,
        producerId: organizationId,
        draftDescriptor: false,
      });
      expect(
        catalogService.updateEService(
          eServiceId,
          {
            name: "name",
            description: "description",
            technology: "REST",
          },
          buildAuthData(organizationId)
        )
      ).rejects.toThrowError(eServiceCannotBeUpdated(eServiceId));
    });
  });

  describe("eService deletion", () => {
    it("should write on event-store for the deletion of an eService", async () => {
      const eServiceId = uuidv4();
      const organizationId = uuidv4();
      await addOneEService({
        id: eServiceId,
        producerId: organizationId,
        draftDescriptor: false,
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
      const eServiceId = uuidv4();
      const organizationId = uuidv4();

      expect(
        catalogService.deleteEService(eServiceId, buildAuthData(organizationId))
      ).rejects.toThrowError(eServiceNotFound(eServiceId));
    });
    it("should throw an error if the requester is not allowed", async () => {
      const eServiceId = uuidv4();
      const organizationId = uuidv4();
      const requesterId = uuidv4();
      await addOneEService({
        id: eServiceId,
        producerId: organizationId,
      });
      expect(
        catalogService.deleteEService(eServiceId, buildAuthData(requesterId))
      ).rejects.toThrowError(operationForbidden);
    });
    it("should throw an error if the eService has a descriptor", async () => {
      const eServiceId = uuidv4();
      const organizationId = uuidv4();
      await addOneEService({
        id: eServiceId,
        producerId: organizationId,
      });
      expect(
        catalogService.deleteEService(eServiceId, buildAuthData(organizationId))
      ).rejects.toThrowError(eServiceCannotBeDeleted(eServiceId));
    });
  });

  describe("create descriptor", async () => {
    it("should write in event-store for the creation of a descriptor", async () => {
      const eServiceId = uuidv4();
      const organizationId = uuidv4();
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
      const eServiceId = uuidv4();
      const organizationId = uuidv4();
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
      const eServiceId = uuidv4();
      const organizationId = uuidv4();

      expect(
        catalogService.createDescriptor(
          eServiceId,
          buildDescriptorSeed(),
          buildAuthData(organizationId)
        )
      ).rejects.toThrowError(eServiceNotFound(eServiceId));
    });
    it("should throw an error if the requester is not allowed", async () => {
      const eServiceId = uuidv4();
      const organizationId = uuidv4();
      const requesterId = uuidv4();
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
  describe("delete draft descriptor", () => {
    it("should write on event-store for the deletion of a draft descriptor", async () => {
      const eServiceId = uuidv4();
      const organizationId = uuidv4();
      const descriptorId = uuidv4();
      await addOneEService({
        id: eServiceId,
        producerId: organizationId,
        descriptorId,
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
      const eServiceId = uuidv4();
      const organizationId = uuidv4();
      const descriptorId = uuidv4();

      expect(
        catalogService.deleteDraftDescriptor(
          eServiceId,
          descriptorId,
          buildAuthData(organizationId)
        )
      ).rejects.toThrowError(eServiceNotFound(eServiceId));
    });
    it("should throw an error if the requester is not allowed", async () => {
      const eServiceId = uuidv4();
      const organizationId = uuidv4();
      const requesterId = uuidv4();
      const descriptorId = uuidv4();
      await addOneEService({
        id: eServiceId,
        producerId: organizationId,
        descriptorId,
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
  describe("update descriptor", () => {
    it("should write on event-store for the update of a descriptor", async () => {
      const eServiceId = uuidv4();
      const organizationId = uuidv4();
      const descriptorId = uuidv4();
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
      const eServiceId = uuidv4();
      const organizationId = uuidv4();
      const descriptorId = uuidv4();
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
      const eServiceId = uuidv4();
      const organizationId = uuidv4();
      const requesterId = uuidv4();
      const descriptorId = uuidv4();
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

  const buildEService = ({
    id,
    producerId,
    draftDescriptor,
    withDescriptors,
    descriptorId,
  }: {
    id: string;
    producerId: string;
    draftDescriptor: boolean;
    withDescriptors: boolean;
    descriptorId: string;
  }): EService => ({
    id,
    name: "name",
    description: "description",
    createdAt: new Date(),
    producerId,
    technology: technology.rest,
    descriptors: withDescriptors
      ? [
          {
            id: descriptorId,
            version: "1",
            docs: [],
            state: draftDescriptor
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

  const addOneEService = async ({
    id,
    producerId,
    draftDescriptor = true,
    withDescriptors = true,
    descriptorId = uuidv4(),
  }: {
    id: string;
    producerId: string;
    draftDescriptor?: boolean;
    withDescriptors?: boolean;
    descriptorId?: string;
  }): Promise<void> => {
    const eService = buildEService({
      id,
      producerId,
      draftDescriptor,
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
});

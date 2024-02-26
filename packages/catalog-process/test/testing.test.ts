/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  postgreSQLContainer,
  mongoDBContainer,
  minioContainer,
  TEST_POSTGRES_DB_PORT,
  TEST_MONGO_DB_PORT,
  TEST_MINIO_PORT,
  createMockedApiRequester,
  MockApiRequester,
  readLastEventByStreamId,
  decodeProtobufPayload,
} from "pagopa-interop-commons-test";
import * as pagopaInteropCommons from "pagopa-interop-commons";
import { IDatabase } from "pg-promise";
import { StartedTestContainer } from "testcontainers";
import {
  EService,
  EServiceAddedV1,
  unsafeBrandId,
} from "pagopa-interop-models";
import { config } from "../src/utilities/config.js";
import { api } from "../src/model/generated/api.js";
import {
  ReadModelService,
  readModelServiceBuilder,
} from "../src/services/readModelService.js";
import { toEServiceV1 } from "../src/model/domain/toEvent.js";
import {
  addOneEService,
  getMockDescriptor,
  getMockDocument,
  getMockEService,
} from "./utils.js";

type Api = typeof api.api;

describe("database test", () => {
  let eservices: pagopaInteropCommons.EServiceCollection;
  let agreements: pagopaInteropCommons.AgreementCollection;
  let attributes: pagopaInteropCommons.AttributeCollection;
  let tenants: pagopaInteropCommons.TenantCollection;
  let readModelService: ReadModelService;
  let postgresDB: IDatabase<unknown>;
  let startedPostgreSqlContainer: StartedTestContainer;
  let startedMongodbContainer: StartedTestContainer;
  let startedMinioContainer: StartedTestContainer;
  let fileManager: pagopaInteropCommons.FileManager;
  let apiRequester: MockApiRequester<Api>;

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

    const readModelRepository =
      pagopaInteropCommons.ReadModelRepository.init(config);
    eservices = readModelRepository.eservices;
    agreements = readModelRepository.agreements;
    tenants = readModelRepository.tenants;
    attributes = readModelRepository.attributes;
    readModelService = readModelServiceBuilder(readModelRepository);
    postgresDB = pagopaInteropCommons.initDB({
      username: config.eventStoreDbUsername,
      password: config.eventStoreDbPassword,
      host: config.eventStoreDbHost,
      port: config.eventStoreDbPort,
      database: config.eventStoreDbName,
      schema: config.eventStoreDbSchema,
      useSSL: config.eventStoreDbUseSSL,
    });
    fileManager = pagopaInteropCommons.initFileManager(config);

    vi.doMock("pagopa-interop-commons", () => ({
      ...pagopaInteropCommons,
      initDB: () => postgresDB,
      initFileManager: () => fileManager,
      readModelServiceBuilder: () => readModelService,
      ReadModelRepository: {
        init: () => readModelRepository,
      },
    }));

    const { default: app } = await import("../src/app.js");
    apiRequester = createMockedApiRequester<Api>(app);
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

  const mockEService = getMockEService();
  const mockDescriptor = getMockDescriptor();
  const mockDocument = getMockDocument();

  describe("GET /status", () => {
    it("should respond with 200 status code", async () => {
      const response = await apiRequester.get({
        path: "/status",
      });
      expect(response.status).toBe(200);
    });
  });

  describe("POST /eservices", () => {
    it("should write on event-store for the creation of an eService", async () => {
      const response = await apiRequester.post({
        path: "/eservices",
        body: {
          name: mockEService.name,
          description: mockEService.description,
          technology: "REST",
        },
      });

      const id = response.body.id;

      expect(id).toBeDefined();
      const writtenEvent = await readLastEventByStreamId(
        response.body.id,
        "catalog",
        postgresDB
      );

      expect(writtenEvent?.stream_id).toBe(id);
      expect(writtenEvent?.version).toBe("0");
      expect(writtenEvent?.type).toBe("EServiceAdded");

      const writtenPayload = decodeProtobufPayload({
        messageType: EServiceAddedV1,
        payload: writtenEvent!.data,
      });

      const eService: EService = {
        ...mockEService,
        createdAt: new Date(Number(writtenPayload.eService?.createdAt)),
        id: unsafeBrandId(id),
      };

      expect(writtenPayload.eService).toEqual(toEServiceV1(eService));
    });

    it("should throw eServiceDuplicate if an eService with the same name already exists", async () => {
      await addOneEService(mockEService, postgresDB, eservices);
      const response = apiRequester.post({
        path: "/eservices",
        body: {
          name: "mockEService.name",
          description: "mockEService.description",
          technology: "REST",
        },
      });
      console.log(response);
    });
  });
});

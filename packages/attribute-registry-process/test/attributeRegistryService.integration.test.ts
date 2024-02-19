/* eslint-disable functional/no-let */
import { beforeAll, afterEach, describe, expect, it, afterAll } from "vitest";
import {
  TEST_MONGO_DB_PORT,
  TEST_POSTGRES_DB_PORT,
  mongoDBContainer,
  postgresDBContainer,
} from "pagopa-interop-commons-test";
import {
  AttributeCollection,
  ReadModelRepository,
  initDB,
} from "pagopa-interop-commons";
import { StartedTestContainer } from "testcontainers";
import { v4 as uuidv4 } from "uuid";
import { Document } from "mongodb";
import { IDatabase } from "pg-promise";
import { config } from "../src/utilities/config.js";
import {
  AttributeRegistryService,
  attributeRegistryServiceBuilder,
} from "../src/services/attributeRegistryService.js";
import {
  ReadModelService,
  readModelServiceBuilder,
} from "../src/services/readModelService.js";

describe("database test", () => {
  let attributes: AttributeCollection;
  let readModelService: ReadModelService;
  let attributeRegistryService: AttributeRegistryService;
  let postgresDB: IDatabase<unknown>;
  let startedPostgreSqlContainer: StartedTestContainer;
  let startedMongodbContainer: StartedTestContainer;

  beforeAll(async () => {
    startedPostgreSqlContainer = await postgresDBContainer(config).start();

    startedMongodbContainer = await mongoDBContainer(config).start();

    config.eventStoreDbPort = startedPostgreSqlContainer.getMappedPort(
      TEST_POSTGRES_DB_PORT
    );
    config.readModelDbPort =
      startedMongodbContainer.getMappedPort(TEST_MONGO_DB_PORT);
    attributes = ReadModelRepository.init(config).attributes;
    readModelService = readModelServiceBuilder(config);
    attributeRegistryService = attributeRegistryServiceBuilder(
      config,
      readModelService
    );

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
    await attributes.deleteMany({});
    await postgresDB.none("TRUNCATE TABLE attribute.events RESTART IDENTITY");
  });

  afterAll(async () => {
    await startedPostgreSqlContainer.stop();
    await startedMongodbContainer.stop();
  });

  describe("attribute creation", () => {
    it("should write on event-store for the creation of a declared attribute", async () => {
      const id = await attributeRegistryService.createDeclaredAttribute(
        {
          name: "name",
          description: "description",
        },
        {
          organizationId: "organization-id",
          externalId: {
            origin: "IPA",
            value: "123456",
          },
          userId: uuidv4(),
          userRoles: [],
        }
      );
      expect(id).toBeDefined();

      const writtenEvent = await postgresDB.one(
        "SELECT * FROM attribute.events WHERE stream_id = $1",
        [id]
      );
      expect(writtenEvent.stream_id).toBe(id);
      expect(writtenEvent.version).toBe("0");
      expect(writtenEvent.type).toBe("AttributeAdded");
    });
    it("should write on event-store for the creation of a verified attribute", async () => {
      const id = await attributeRegistryService.createVerifiedAttribute(
        {
          name: "name",
          description: "description",
        },
        {
          organizationId: "organization-id",
          externalId: {
            origin: "IPA",
            value: "123456",
          },
          userId: uuidv4(),
          userRoles: [],
        }
      );
      expect(id).toBeDefined();

      const writtenEvent = await postgresDB.one(
        "SELECT * FROM attribute.events WHERE stream_id = $1",
        [id]
      );
      expect(writtenEvent.stream_id).toBe(id);
      expect(writtenEvent.version).toBe("0");
      expect(writtenEvent.type).toBe("AttributeAdded");
    });
  });

  describe("get an attribute by id", () => {
    it("should get the attribute if it exists", async () => {
      const id = uuidv4();
      await addOneAttribute(id);
      const attribute = await readModelService.getAttributeById(id);
      expect(attribute?.data.name).toBe("name");
      expect(attribute?.data.description).toBe("description");
    });
    it("should not get the attribute if it doesn't exist", async () => {
      const id = uuidv4();
      const attribute = await readModelService.getAttributeById(id);
      expect(attribute).toBeUndefined();
    });
  });

  describe("get an attribute by name", () => {
    it("should get the attribute if it exists", async () => {
      const id = uuidv4();
      await addOneAttribute(id);
      const attribute = await readModelService.getAttributeByName("name");
      expect(attribute?.data.name).toBe("name");
      expect(attribute?.data.description).toBe("description");
    });
    it("should not get the attribute if it doesn't exist", async () => {
      const attribute = await readModelService.getAttributeByName("name");
      expect(attribute).toBeUndefined();
    });
  });

  const addOneAttribute = (id: string): Promise<Document> =>
    attributes.insertOne({
      data: {
        id,
        name: "name",
        kind: "Certified",
        description: "description",
        creationTime: new Date(),
        code: undefined,
        origin: undefined,
      },
      metadata: {
        version: 0,
      },
    });
});

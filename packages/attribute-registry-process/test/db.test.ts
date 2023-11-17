/* eslint-disable functional/no-let */
import { beforeAll, afterEach, describe, expect, it } from "vitest";
import { GenericContainer } from "testcontainers";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import {
  AttributeCollection,
  ReadModelRepository,
  initDB,
} from "pagopa-interop-commons";
import { v4 as uuidv4 } from "uuid";
import { Document } from "mongodb";
import { IDatabase } from "pg-promise";
import { config } from "../src/utilities/config.js";
import { AttributeRegistryService } from "../src/services/attributeRegistryService.js";
import { ReadModelService } from "../src/services/readModelService.js";

describe("database test", () => {
  let attributes: AttributeCollection;
  let readModelService: ReadModelService;
  let attributeRegistryService: AttributeRegistryService;
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

    const mongodbContainer = await new GenericContainer("mongo:6.0.7")
      .withEnvironment({
        MONGO_INITDB_DATABASE: config.readModelDbName,
        MONGO_INITDB_ROOT_USERNAME: config.readModelDbUsername,
        MONGO_INITDB_ROOT_PASSWORD: config.readModelDbPassword,
      })
      .withExposedPorts(27017)
      .start();

    config.readModelDbPort = mongodbContainer.getMappedPort(27017);
    attributes = ReadModelRepository.init(config).attributes;
    readModelService = new ReadModelService(attributes);
    attributeRegistryService = new AttributeRegistryService(
      readModelService,
      postgreSqlContainer.getMappedPort(5432)
    );

    postgresDB = initDB({
      username: config.eventStoreDbUsername,
      password: config.eventStoreDbPassword,
      host: config.eventStoreDbHost,
      port: postgreSqlContainer.getMappedPort(5432),
      database: config.eventStoreDbName,
      schema: config.eventStoreDbSchema,
      useSSL: config.eventStoreDbUseSSL,
    });
  });

  afterEach(async () => {
    await attributes.deleteMany({});
    await postgresDB.none("TRUNCATE TABLE attribute.events RESTART IDENTITY");
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
});

const addOneAttribute = (id: string): Promise<Document> => {
  const { attributes } = ReadModelRepository.init(config);

  return attributes.insertOne({
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
};

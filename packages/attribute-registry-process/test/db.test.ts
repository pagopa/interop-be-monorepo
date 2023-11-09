import { beforeAll, afterEach, describe, expect, it } from "vitest";
import { GenericContainer } from "testcontainers";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { ReadModelRepository, initDB } from "pagopa-interop-commons";
import { v4 as uuidv4 } from "uuid";
import { Document } from "mongodb";
import { config } from "../src/utilities/config.js";
import { attributeRegistryService } from "../src/services/attributeRegistryService.js";
import { readModelService } from "../src/services/readModelService.js";

describe("database test", () => {
  const postgresDB = initDB({
    username: config.eventStoreDbUsername,
    password: config.eventStoreDbPassword,
    host: config.eventStoreDbHost,
    port: config.eventStoreDbPort,
    database: config.eventStoreDbName,
    schema: config.eventStoreDbSchema,
    useSSL: config.eventStoreDbUseSSL,
  });

  beforeAll(async () => {
    await new PostgreSqlContainer("postgres:14")
      .withUsername(config.eventStoreDbUsername)
      .withPassword(config.eventStoreDbPassword)
      .withDatabase(config.eventStoreDbName)
      .withCopyFilesToContainer([
        {
          source: "../../docker/event-store-init.sql",
          target: "/docker-entrypoint-initdb.d/01-init.sql",
        },
      ])
      .withExposedPorts({ container: 5432, host: config.eventStoreDbPort })
      .withReuse()
      .start();

    await new GenericContainer("mongo:6.0.7")
      .withEnvironment({
        MONGO_INITDB_DATABASE: "readmodel",
        MONGO_INITDB_ROOT_USERNAME: "root",
        MONGO_INITDB_ROOT_PASSWORD: "example",
      })
      .withExposedPorts({ container: 27017, host: 27017 })
      .withReuse()
      .start();
  });

  afterEach(async () => {
    const { attributes } = ReadModelRepository.init(config);
    await attributes.deleteMany({});

    postgresDB.none("TRUNCATE TABLE attribute.events");
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

  describe("should get an attribute by name", () => {
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

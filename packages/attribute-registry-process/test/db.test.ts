import { beforeAll, describe, expect, it } from "vitest";
import { GenericContainer } from "testcontainers";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { ReadModelRepository } from "pagopa-interop-commons";
import { v4 as uuidv4 } from "uuid";
import { Document } from "mongodb";
import { config } from "../src/utilities/config.js";
import { attributeRegistryService } from "../src/services/attributeRegistryService.js";
import { readModelService } from "../src/services/readModelService.js";

describe("database test", () => {
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
      .start();

    await new GenericContainer("mongo:6.0.7")
      .withEnvironment({
        MONGO_INITDB_DATABASE: "readmodel",
        MONGO_INITDB_ROOT_USERNAME: "root",
        MONGO_INITDB_ROOT_PASSWORD: "example",
      })
      .withExposedPorts({ container: 27017, host: 27017 })
      .start();
  });

  it("should write on event-store", async () => {
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

  it("should write and read on readmodel", async () => {
    const id = uuidv4();
    await addOneAttribute(id);
    const res = await readModelService.getAttributeById(id);
    expect(res?.data.name).toBe("name");
    expect(res?.data.description).toBe("description");
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

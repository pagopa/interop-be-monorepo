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
import { IDatabase } from "pg-promise";
import { Attribute, attributeKind } from "pagopa-interop-models";
import { config } from "../src/utilities/config.js";
import {
  AttributeRegistryService,
  attributeRegistryServiceBuilder,
} from "../src/services/attributeRegistryService.js";
import {
  ReadModelService,
  readModelServiceBuilder,
} from "../src/services/readModelService.js";
import {
  getMockAttribute,
  writeAttributeInEventstore,
  writeAttributeInReadmodel,
} from "./utils.js";

const mockAttribute = getMockAttribute();

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

  describe("attributeRegistryService", () => {
    describe("declared attribute creation", () => {
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

        const writtenEvent = await readLastEventByStreamId(id);
        expect(writtenEvent.stream_id).toBe(id);
        expect(writtenEvent.version).toBe("0");
        expect(writtenEvent.type).toBe("AttributeAdded");

        // TO DO check entire payload
      });
      it("should not write on event-store if the attribute already exists", () => {
        // TO DO
        expect(1).toBe(1);
      });
    });
    describe("verified attribute creation", () => {
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

        const writtenEvent = await readLastEventByStreamId(id);
        expect(writtenEvent.stream_id).toBe(id);
        expect(writtenEvent.version).toBe("0");
        expect(writtenEvent.type).toBe("AttributeAdded");

        // TO DO check entire payload
      });
      it("should not write on event-store if the attribute already exists", () => {
        // TO DO
        expect(1).toBe(1);
      });
    });
    describe("certified attribute creation", () => {
      it("should write on event-store for the creation of a certified attribute", async () => {
        // TO DO
        expect(1).toBe(1);
      });
      it("should not write on event-store if the attribute already exists", () => {
        // TO DO
        expect(1).toBe(1);
      });
      it("should not write on event-store if the organization is not a certifier", () => {
        // TO DO
        expect(1).toBe(1);
      });
      it("should not write on event-store if the certifier is not found", () => {
        // TO DO
        expect(1).toBe(1);
      });
    });

    describe("readModelService", () => {
      describe("getAttributesByIds", () => {
        it("should get the attributes if they exist", async () => {
          const attribute1 = {
            ...mockAttribute,
            id: uuidv4(),
            name: "attribute 001",
          };
          await addOneAttribute(attribute1);

          const attribute2 = {
            ...mockAttribute,
            id: uuidv4(),
            name: "attribute 002",
          };
          await addOneAttribute(attribute2);

          const attribute3 = {
            ...mockAttribute,
            id: uuidv4(),
            name: "attribute 003",
          };
          await addOneAttribute(attribute3);

          const attribute4 = {
            ...mockAttribute,
            id: uuidv4(),
            name: "attribute 004",
          };
          await addOneAttribute(attribute4);

          const attribute5 = {
            ...mockAttribute,
            id: uuidv4(),
            name: "attribute 005",
          };
          await addOneAttribute(attribute5);

          const attribute6 = {
            ...mockAttribute,
            id: uuidv4(),
            name: "attribute 006",
          };
          await addOneAttribute(attribute6);

          const result = await readModelService.getAttributesByIds({
            ids: [attribute1.id, attribute2.id, attribute3.id],
            offset: 0,
            limit: 50,
          });

          expect(result.totalCount).toBe(3);
          expect(result.results).toEqual([attribute1, attribute2, attribute3]);
        });
        it("should not get the attributes if they don't exist", async () => {
          const attribute1 = {
            ...mockAttribute,
            id: uuidv4(),
            name: "attribute 001",
          };
          const result = await readModelService.getAttributesByIds({
            ids: [attribute1.id],
            offset: 0,
            limit: 50,
          });
          expect(result.totalCount).toBe(0);
          expect(result.results).toEqual([]);
        });
        it("should not get any attributes if the requested ids list is empty", async () => {
          const attribute1 = {
            ...mockAttribute,
            id: uuidv4(),
            name: "attribute 001",
          };
          await addOneAttribute(attribute1);

          const attribute2 = {
            ...mockAttribute,
            id: uuidv4(),
            name: "attribute 002",
          };
          await addOneAttribute(attribute2);

          const attribute3 = {
            ...mockAttribute,
            id: uuidv4(),
            name: "attribute 003",
          };
          await addOneAttribute(attribute3);
          const result = await readModelService.getAttributesByIds({
            ids: [],
            offset: 0,
            limit: 50,
          });
          expect(result.totalCount).toBe(0);
          expect(result.results).toEqual([]);
        });
      });
      describe("getAttributesByKindsNameOrigin", () => {
        let attribute1: Attribute;
        let attribute2: Attribute;
        let attribute3: Attribute;
        let attribute4: Attribute;
        let attribute5: Attribute;

        beforeEach(async () => {
          attribute1 = {
            ...mockAttribute,
            id: uuidv4(),
            name: "attribute 001 test",
            kind: attributeKind.certified,
          };
          await addOneAttribute(attribute1);

          attribute2 = {
            ...mockAttribute,
            id: uuidv4(),
            name: "attribute 002 test",
            kind: attributeKind.declared,
          };
          await addOneAttribute(attribute2);

          attribute3 = {
            ...mockAttribute,
            id: uuidv4(),
            name: "attribute 003",
            kind: attributeKind.declared,
          };
          await addOneAttribute(attribute3);

          attribute4 = {
            ...mockAttribute,
            id: uuidv4(),
            name: "attribute 004",
            kind: attributeKind.verified,
            origin: "IPA",
            code: "123456",
          };
          await addOneAttribute(attribute4);

          attribute5 = {
            ...mockAttribute,
            id: uuidv4(),
            name: "attribute 005",
            kind: attributeKind.verified,
            origin: "IPA",
            code: "654321",
          };
          await addOneAttribute(attribute5);
        });
        it("should get the attributes if they exist (parameters: kinds, name, origin)", async () => {
          const result = await readModelService.getAttributesByKindsNameOrigin({
            kinds: ["Verified"],
            name: "attribute 004",
            origin: "IPA",
            offset: 0,
            limit: 50,
          });
          expect(result.totalCount).toBe(1);
          expect(result.results).toEqual([attribute4]);
        });
        it("should get the attributes if they exist (parameters: kinds only)", async () => {
          const result = await readModelService.getAttributesByKindsNameOrigin({
            kinds: ["Declared"],
            offset: 0,
            limit: 50,
          });
          expect(result.totalCount).toBe(2);
          expect(result.results).toEqual([attribute2, attribute3]);
        });
        it("should get the attributes if they exist (parameters: name only)", async () => {
          const result = await readModelService.getAttributesByKindsNameOrigin({
            kinds: [],
            name: "test",
            offset: 0,
            limit: 50,
          });
          expect(result.totalCount).toBe(2);
          expect(result.results).toEqual([attribute1, attribute2]);
        });
        it("should get the attributes if they exist (parameters: origin only)", async () => {
          const result = await readModelService.getAttributesByKindsNameOrigin({
            kinds: [],
            origin: "IPA",
            offset: 0,
            limit: 50,
          });
          expect(result.totalCount).toBe(2);
          expect(result.results).toEqual([attribute4, attribute5]);
        });
        it("should get all the attributes if no parameter is passed", async () => {
          const result = await readModelService.getAttributesByKindsNameOrigin({
            kinds: [],
            offset: 0,
            limit: 50,
          });
          expect(result.totalCount).toBe(5);
          expect(result.results).toEqual([
            attribute1,
            attribute2,
            attribute3,
            attribute4,
            attribute5,
          ]);
        });
        it("should not get the attributes if they don't exist", async () => {
          const result = await readModelService.getAttributesByKindsNameOrigin({
            kinds: [],
            name: "latest attribute",
            offset: 0,
            limit: 50,
          });
          expect(result.totalCount).toBe(0);
          expect(result.results).toEqual([]);
        });
      });
      describe("get an attribute by id", () => {
        it("should get the attribute if it exists", async () => {
          const expectedAttribute1 = {
            ...mockAttribute,
            id: uuidv4(),
            name: "attribute 001",
          };
          await addOneAttribute(expectedAttribute1);

          const expectedAttribute2 = {
            ...mockAttribute,
            id: uuidv4(),
            name: "attribute 002",
          };
          await addOneAttribute(expectedAttribute2);

          const expectedAttribute3 = {
            ...mockAttribute,
            id: uuidv4(),
            name: "attribute 003",
          };
          await addOneAttribute(expectedAttribute3);

          const attribute = await readModelService.getAttributeById(
            expectedAttribute1.id
          );
          expect(attribute?.data).toEqual(expectedAttribute1);
        });
        it("should not get the attribute if it doesn't exist", async () => {
          const id = uuidv4();
          const attribute = await readModelService.getAttributeById(id);
          expect(attribute).toBeUndefined();
        });
      });
      describe("get an attribute by name", () => {
        it("should get the attribute if it exists", async () => {
          await addOneAttribute(mockAttribute);
          const attribute = await readModelService.getAttributeByName(
            mockAttribute.name
          );
          expect(attribute?.data).toEqual(mockAttribute);
        });
        it("should not get the attribute if it doesn't exist", async () => {
          const attribute = await readModelService.getAttributeByName("name");
          expect(attribute).toBeUndefined();
        });
      });
      describe("getAttributeByOriginAndCode", () => {
        it("should get the attribute if it exists", async () => {
          const expectedAttribute = {
            ...mockAttribute,
            origin: "IPA",
            code: "123456",
          };

          await addOneAttribute(expectedAttribute);
          const attribute = await readModelService.getAttributeByOriginAndCode({
            origin: expectedAttribute.origin,
            code: expectedAttribute.code,
          });
          expect(attribute?.data).toEqual(expectedAttribute);
        });
        it("should not get the attribute if it doesn't exist", async () => {
          const attribute = await readModelService.getAttributeByOriginAndCode({
            origin: "IPA",
            code: "123456",
          });
          expect(attribute).toBeUndefined();
        });
      });
    });
  });

  const addOneAttribute = async (attribute: Attribute): Promise<void> => {
    await writeAttributeInEventstore(attribute, postgresDB);
    await writeAttributeInReadmodel(attribute, attributes);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const readLastEventByStreamId = async (attributeId: string): Promise<any> =>
    await postgresDB.one(
      "SELECT * FROM attribute.events WHERE stream_id = $1 ORDER BY sequence_num DESC LIMIT 1",
      [attributeId]
    );
});

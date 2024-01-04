/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable functional/no-let */
import { beforeAll, afterEach, describe, expect, it, beforeEach } from "vitest";
import { GenericContainer } from "testcontainers";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import {
  AttributeCollection,
  ReadModelRepository,
  initDB,
} from "pagopa-interop-commons";
import { v4 as uuidv4 } from "uuid";
import { IDatabase } from "pg-promise";
import {
  Attribute,
  AttributeAddedV1,
  attributeKind,
} from "pagopa-interop-models";
import { config } from "../src/utilities/config.js";
import {
  AttributeRegistryService,
  attributeRegistryServiceBuilder,
} from "../src/services/attributeRegistryService.js";
import {
  ReadModelService,
  readModelServiceBuilder,
} from "../src/services/readModelService.js";
import { attributeDuplicate } from "../src/model/domain/errors.js";
import { toAttributeV1 } from "../src/model/domain/toEvent.js";
import {
  decodeProtobufPayload,
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
            name: mockAttribute.name,
            description: mockAttribute.description,
          },
          {
            organizationId: uuidv4(),
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
        const writtenPayload = decodeProtobufPayload({
          messageType: AttributeAddedV1,
          payload: writtenEvent.data,
        });

        const attribute: Attribute = {
          ...mockAttribute,
          kind: attributeKind.declared,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          creationTime: new Date(writtenPayload.attribute!.creationTime),
          id,
        };

        expect(writtenPayload.attribute).toEqual(toAttributeV1(attribute));
      });
      it("should not write on event-store if the attribute already exists", async () => {
        const attribute = {
          ...mockAttribute,
          kind: attributeKind.declared,
        };
        await addOneAttribute(attribute);
        expect(
          attributeRegistryService.createDeclaredAttribute(
            {
              name: attribute.name,
              description: attribute.description,
            },
            {
              organizationId: uuidv4(),
              externalId: {
                origin: "IPA",
                value: "123456",
              },
              userId: uuidv4(),
              userRoles: [],
            }
          )
        ).rejects.toThrowError(attributeDuplicate(attribute.name));
      });
    });
    describe("verified attribute creation", () => {
      it("should write on event-store for the creation of a verified attribute", async () => {
        const id = await attributeRegistryService.createVerifiedAttribute(
          {
            name: mockAttribute.name,
            description: mockAttribute.description,
          },
          {
            organizationId: uuidv4(),
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

        const writtenPayload = decodeProtobufPayload({
          messageType: AttributeAddedV1,
          payload: writtenEvent.data,
        });

        const attribute: Attribute = {
          ...mockAttribute,
          kind: attributeKind.verified,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          creationTime: new Date(writtenPayload.attribute!.creationTime),
          id,
        };

        expect(writtenPayload.attribute).toEqual(toAttributeV1(attribute));
      });
      it("should not write on event-store if the attribute already exists", async () => {
        const attribute = {
          ...mockAttribute,
          kind: attributeKind.verified,
        };
        await addOneAttribute(attribute);
        expect(
          attributeRegistryService.createVerifiedAttribute(
            {
              name: attribute.name,
              description: attribute.description,
            },
            {
              organizationId: uuidv4(),
              externalId: {
                origin: "IPA",
                value: "123456",
              },
              userId: uuidv4(),
              userRoles: [],
            }
          )
        ).rejects.toThrowError(attributeDuplicate(attribute.name));
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
      let attribute1: Attribute;
      let attribute2: Attribute;
      let attribute3: Attribute;
      let attribute4: Attribute;
      let attribute5: Attribute;
      let attribute6: Attribute;
      let attribute7: Attribute;

      beforeEach(async () => {
        attribute1 = {
          ...mockAttribute,
          id: uuidv4(),
          name: "attribute 001 test",
          kind: attributeKind.certified,
          origin: "IPA",
          code: "12345A",
        };
        await addOneAttribute(attribute1);

        attribute2 = {
          ...mockAttribute,
          id: uuidv4(),
          name: "attribute 002 test",
          kind: attributeKind.certified,
          origin: "IPA",
          code: "12345B",
        };
        await addOneAttribute(attribute2);

        attribute3 = {
          ...mockAttribute,
          id: uuidv4(),
          name: "attribute 003 test",
          kind: attributeKind.certified,
          origin: "IPA",
          code: "12345C",
        };
        await addOneAttribute(attribute3);

        attribute4 = {
          ...mockAttribute,
          id: uuidv4(),
          name: "attribute 004",
          kind: attributeKind.declared,
        };
        await addOneAttribute(attribute4);

        attribute5 = {
          ...mockAttribute,
          id: uuidv4(),
          name: "attribute 005",
          kind: attributeKind.declared,
        };
        await addOneAttribute(attribute5);

        attribute6 = {
          ...mockAttribute,
          id: uuidv4(),
          name: "attribute 006",
          kind: attributeKind.verified,
        };
        await addOneAttribute(attribute6);

        attribute7 = {
          ...mockAttribute,
          id: uuidv4(),
          name: "attribute 007",
          kind: attributeKind.verified,
        };
        await addOneAttribute(attribute7);
      });

      describe("getAttributesByIds", () => {
        it("should get the attributes if they exist", async () => {
          const result = await readModelService.getAttributesByIds({
            ids: [attribute1.id, attribute2.id, attribute3.id],
            offset: 0,
            limit: 50,
          });

          expect(result.totalCount).toBe(3);
          expect(result.results).toEqual([attribute1, attribute2, attribute3]);
        });
        it("should not get the attributes if they don't exist", async () => {
          const result = await readModelService.getAttributesByIds({
            ids: [uuidv4(), uuidv4()],
            offset: 0,
            limit: 50,
          });
          expect(result.totalCount).toBe(0);
          expect(result.results).toEqual([]);
        });
        it("should not get any attributes if the requested ids list is empty", async () => {
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
        it("should get the attributes if they exist (parameters: kinds, name, origin)", async () => {
          const result = await readModelService.getAttributesByKindsNameOrigin({
            kinds: [attributeKind.certified],
            name: "test",
            origin: "IPA",
            offset: 0,
            limit: 50,
          });
          expect(result.totalCount).toBe(3);
          expect(result.results).toEqual([attribute1, attribute2, attribute3]);
        });
        it("should get the attributes if they exist (parameters: kinds only)", async () => {
          const result = await readModelService.getAttributesByKindsNameOrigin({
            kinds: [attributeKind.declared],
            offset: 0,
            limit: 50,
          });
          expect(result.totalCount).toBe(2);
          expect(result.results).toEqual([attribute4, attribute5]);
        });
        it("should get the attributes if they exist (parameters: name only)", async () => {
          const result = await readModelService.getAttributesByKindsNameOrigin({
            kinds: [],
            name: "test",
            offset: 0,
            limit: 50,
          });
          expect(result.totalCount).toBe(3);
          expect(result.results).toEqual([attribute1, attribute2, attribute3]);
        });
        it("should get the attributes if they exist (parameters: origin only)", async () => {
          const result = await readModelService.getAttributesByKindsNameOrigin({
            kinds: [],
            origin: "IPA",
            offset: 0,
            limit: 50,
          });
          expect(result.totalCount).toBe(3);
          expect(result.results).toEqual([attribute1, attribute2, attribute3]);
        });
        it("should get all the attributes if no parameter is passed", async () => {
          const result = await readModelService.getAttributesByKindsNameOrigin({
            kinds: [],
            offset: 0,
            limit: 50,
          });
          expect(result.totalCount).toBe(7);
          expect(result.results).toEqual([
            attribute1,
            attribute2,
            attribute3,
            attribute4,
            attribute5,
            attribute6,
            attribute7,
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
      describe("getAttributeById", () => {
        it("should get the attribute if it exists", async () => {
          const attribute = await readModelService.getAttributeById(
            attribute1.id
          );
          expect(attribute?.data).toEqual(attribute1);
        });
        it("should not get the attribute if it doesn't exist", async () => {
          const attribute = await readModelService.getAttributeById(uuidv4());
          expect(attribute).toBeUndefined();
        });
      });
      describe("getAttributeByName", () => {
        it("should get the attribute if it exists", async () => {
          const attribute = await readModelService.getAttributeByName(
            attribute1.name
          );
          expect(attribute?.data).toEqual(attribute1);
        });
        it("should not get the attribute if it doesn't exist", async () => {
          const attribute = await readModelService.getAttributeByName(
            "not-existing"
          );
          expect(attribute).toBeUndefined();
        });
      });
      describe("getAttributeByOriginAndCode", () => {
        it("should get the attribute if it exists", async () => {
          const attribute = await readModelService.getAttributeByOriginAndCode({
            origin: "IPA",
            code: "12345A",
          });
          expect(attribute?.data).toEqual(attribute1);
        });
        it("should not get the attribute if it doesn't exist", async () => {
          const attribute = await readModelService.getAttributeByOriginAndCode({
            origin: "IPA",
            code: "12345D",
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

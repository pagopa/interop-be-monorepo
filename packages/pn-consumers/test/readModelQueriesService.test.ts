/* eslint-disable functional/no-let */
import * as crypto from "crypto";
import { MongoMemoryServer } from "mongodb-memory-server";
import { describe, expect, it, afterEach, beforeAll, afterAll } from "vitest";
import { ReadModelQueriesClient } from "../src/services/readModelQueriesService.js";
import { ReadModelRepository } from "../../commons/dist/repositories/ReadModelRepository.js";

const PN_ESERVICE_ID_MOCK = "4747d063-0d9c-4a5d-b143-9f2fdc4d7f22";
const COMUNI_E_LORO_CONSORZI_E_ASSOCIAZIONI_ATTRIBUTE_ID_MOCK =
  "5ec5dd81-ff71-4af8-974b-4190eb8347bf";

const TENANT_COMUNE_ID = crypto.randomUUID();
const TENANT_NON_COMUNE_ID = crypto.randomUUID();

describe("MetricsManager", () => {
  const DB_NAME = "read-model";
  let readModel: ReadModelRepository;
  let mongoServer: MongoMemoryServer;
  let readModelQueriesClient: ReadModelQueriesClient;

  async function seedCollection(
    collection:
      | "eservices"
      | "agreements"
      | "tenants"
      | "purposes"
      | "attributes",
    data: Array<{ data: unknown }>
  ): Promise<void> {
    await readModel[collection].insertMany(data as never);
  }

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create({
      instance: {
        dbName: DB_NAME,
        auth: true,
      },
      auth: {
        customRootName: "root",
        customRootPwd: "root",
      },
    });

    readModel = ReadModelRepository.init({
      readModelDbUsername: mongoServer.auth?.customRootName as string,
      readModelDbPassword: mongoServer.auth?.customRootPwd as string,
      readModelDbHost: mongoServer.instanceInfo?.ip as string,
      readModelDbPort: mongoServer.instanceInfo?.port as number,
      readModelDbName: DB_NAME,
    });

    readModelQueriesClient = new ReadModelQueriesClient(readModel);
  });

  afterEach(async () => {
    await readModel.eservices.deleteMany({});
    await readModel.agreements.deleteMany({});
    await readModel.attributes.deleteMany({});
    await readModel.purposes.deleteMany({});
    await readModel.tenants.deleteMany({});
  });

  afterAll(async () => {
    await mongoServer?.stop();
  });

  it("should not count purposes with consumers that have no attribute with id 'COMUNI_E_LORO_CONSORZI_E_ASSOCIAZIONI_ATTRIBUTE_ID'", async () => {
    await seedCollection("tenants", [
      {
        data: getTenantMock({
          id: TENANT_COMUNE_ID,
          name: "tenant-comune",
          externalId: { origin: "origin", value: "value" },
          attributes: [
            { id: COMUNI_E_LORO_CONSORZI_E_ASSOCIAZIONI_ATTRIBUTE_ID_MOCK },
          ],
        }),
      },
      {
        data: getTenantMock({
          id: TENANT_NON_COMUNE_ID,
          name: "tenant-not-comune",
          externalId: { origin: "origin", value: "value" },
        }),
      },
    ]);

    await seedCollection("purposes", [
      {
        data: getPurposeMock({
          eserviceId: PN_ESERVICE_ID_MOCK,
          consumerId: TENANT_COMUNE_ID,
          versions: [{ state: "Active" }],
        }),
      },
      {
        data: getPurposeMock({
          eserviceId: PN_ESERVICE_ID_MOCK,
          consumerId: TENANT_NON_COMUNE_ID,
          versions: [{ state: "Active" }],
        }),
      },
    ]);

    const result = await readModelQueriesClient.getSENDPurposes(
      PN_ESERVICE_ID_MOCK,
      COMUNI_E_LORO_CONSORZI_E_ASSOCIAZIONI_ATTRIBUTE_ID_MOCK
    );

    expect(result).toHaveLength(1);
    expect(result[0].consumerId).toBe(TENANT_COMUNE_ID);
  });
});

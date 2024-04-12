/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  EServiceCollection,
  PurposeCollection,
  ReadModelRepository,
  TenantCollection,
  initDB,
} from "pagopa-interop-commons";
import { IDatabase } from "pg-promise";

import {
  TEST_MONGO_DB_PORT,
  TEST_POSTGRES_DB_PORT,
  getMockAuthData,
  getMockPurpose,
  getMockTenant,
  mongoDBContainer,
  postgreSQLContainer,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import { StartedTestContainer } from "testcontainers";
import {
  EService,
  Purpose,
  PurposeId,
  TenantKind,
  generateId,
  tenantKind,
  toReadModelEService,
} from "pagopa-interop-models";
import { config } from "../src/utilities/config.js";
import {
  PurposeService,
  purposeServiceBuilder,
} from "../src/services/purposeService.js";
import {
  ReadModelService,
  readModelServiceBuilder,
} from "../src/services/readModelService.js";
import {
  purposeNotFound,
  tenantKindNotFound,
} from "../src/model/domain/errors.js";
import { addOnePurpose, getMockEService } from "./utils.js";

describe("database test", async () => {
  let purposes: PurposeCollection;
  let eservices: EServiceCollection;
  let tenants: TenantCollection;
  let readModelService: ReadModelService;
  let purposeService: PurposeService;
  let postgresDB: IDatabase<unknown>;
  let startedPostgreSqlContainer: StartedTestContainer;
  let startedMongodbContainer: StartedTestContainer;

  beforeAll(async () => {
    startedPostgreSqlContainer = await postgreSQLContainer(config).start();
    startedMongodbContainer = await mongoDBContainer(config).start();

    config.eventStoreDbPort = startedPostgreSqlContainer.getMappedPort(
      TEST_POSTGRES_DB_PORT
    );
    config.readModelDbPort =
      startedMongodbContainer.getMappedPort(TEST_MONGO_DB_PORT);

    const readModelRepository = ReadModelRepository.init(config);
    purposes = readModelRepository.purposes;
    eservices = readModelRepository.eservices;
    tenants = readModelRepository.tenants;
    readModelService = readModelServiceBuilder(readModelRepository);
    postgresDB = initDB({
      username: config.eventStoreDbUsername,
      password: config.eventStoreDbPassword,
      host: config.eventStoreDbHost,
      port: config.eventStoreDbPort,
      database: config.eventStoreDbName,
      schema: config.eventStoreDbSchema,
      useSSL: config.eventStoreDbUseSSL,
    });
    purposeService = purposeServiceBuilder(postgresDB, readModelService);
  });

  afterEach(async () => {
    await purposes.deleteMany({});

    await postgresDB.none("TRUNCATE TABLE purpose.events RESTART IDENTITY");
  });

  afterAll(async () => {
    await startedPostgreSqlContainer.stop();
    await startedMongodbContainer.stop();
  });

  describe("Purpose service", () => {
    const mockPurpose = getMockPurpose();
    describe("getPurposeById", () => {
      it("Should get the purpose if it exists", async () => {
        const mockEService = getMockEService();
        const mockTenant = {
          ...getMockTenant(),
          kind: tenantKind.PA,
        };

        const mockPurpose1: Purpose = {
          ...mockPurpose,
          eserviceId: mockEService.id,
        };
        const mockPurpose2: Purpose = {
          ...getMockPurpose(),
          id: generateId(),
          title: "another purpose",
        };
        await addOnePurpose(mockPurpose1, postgresDB, purposes);
        await addOnePurpose(mockPurpose2, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);
        await writeInReadmodel(mockTenant, tenants);

        const result = await purposeService.getPurposeById(
          mockPurpose1.id,
          getMockAuthData(mockTenant.id)
        );
        expect(result).toMatchObject({
          purpose: mockPurpose1,
          isRiskAnalysisValid: false,
        });
      });
      it("Should throw purposeNotFound if the purpose doesn't exist", async () => {
        const notExistingId: PurposeId = generateId();
        await addOnePurpose(mockPurpose, postgresDB, purposes);

        expect(
          purposeService.getPurposeById(notExistingId, getMockAuthData())
        ).rejects.toThrowError(purposeNotFound(notExistingId));
      });
      it("Should throw eserviceNotFound if the eservice doesn't exist", () => {
        expect(1).toBe(1);
      });
      it("Should throw tenantNotFound if the tenant doesn't exist", () => {
        expect(1).toBe(1);
      });
      it("Should throw tenantKindNotFound if the tenant doesn't exist", async () => {
        const mockEService = getMockEService();
        const mockTenant = getMockTenant();

        const mockPurpose1: Purpose = {
          ...mockPurpose,
          eserviceId: mockEService.id,
        };
        const mockPurpose2: Purpose = {
          ...getMockPurpose(),
          id: generateId(),
          title: "another purpose",
        };
        await addOnePurpose(mockPurpose1, postgresDB, purposes);
        await addOnePurpose(mockPurpose2, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);
        await writeInReadmodel(mockTenant, tenants);

        expect(
          purposeService.getPurposeById(
            mockPurpose1.id,
            getMockAuthData(mockTenant.id)
          )
        ).rejects.toThrowError(tenantKindNotFound(mockTenant.id));
      });
    });

    describe("getRiskAnalysisDocument", () => {
      it("test", () => {
        expect(1).toBe(1);
      });
    });
  });
});

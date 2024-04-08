/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { afterEach, afterAll, beforeAll, describe, it, expect } from "vitest";
import {
  ReadModelRepository,
  TenantCollection,
  readModelWriterConfig,
} from "pagopa-interop-commons";
import { mongoDBContainer } from "pagopa-interop-commons-test";
import { StartedTestContainer } from "testcontainers";
import {
  Tenant,
  TenantCreatedV1,
  TenantEventEnvelope,
  generateId,
} from "pagopa-interop-models";
import { handleMessage } from "../src/tenantConsumerService.js";
import { toTenantV1 } from "./converterV1.js";

describe("database test", async () => {
  let tenants: TenantCollection;
  let startedMongoDBContainer: StartedTestContainer;

  const config = readModelWriterConfig();

  beforeAll(async () => {
    startedMongoDBContainer = await mongoDBContainer(config).start();

    config.readModelDbPort = startedMongoDBContainer.getMappedPort(27017);

    const readModelRepository = ReadModelRepository.init(config);
    tenants = readModelRepository.tenants;
  });

  afterEach(async () => {
    await tenants.deleteMany({});
  });

  afterAll(async () => {
    await startedMongoDBContainer.stop();
  });

  describe("Events V1", async () => {
    const mockTenant = getMockTenant();

    it("TenantCreated", async () => {
      const payload: TenantCreatedV1 = {
        tenant: toTenantV1(mockTenant),
      };
      const message: TenantEventEnvelope = {
        sequence_num: 1,
        stream_id: mockTenant.id,
        version: 1,
        type: "TenantCreated",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };
      await handleMessage(message, tenants);

      const retrievedTenant = await tenants.findOne({
        "data.id": mockTenant.id,
      });

      expect(retrievedTenant).toMatchObject({
        data: mockTenant,
        metadata: { version: 1 },
      });
    });

    it("TenantDeleted", () => {});

    it("TenantUpdated", () => {});

    it("SelfcareMappingCreated", () => {});

    it("SelfcareMappingDeleted", () => {});

    it("TenantMailAdded", () => {});

    it("TenantMailDeleted", () => {});
  });
});

export const getMockTenant = (): Tenant => ({
  name: "A tenant",
  id: generateId(),
  createdAt: new Date(),
  attributes: [],
  selfcareId: generateId(),
  externalId: {
    value: "123456",
    origin: "IPA",
  },
  features: [],
  mails: [],
});

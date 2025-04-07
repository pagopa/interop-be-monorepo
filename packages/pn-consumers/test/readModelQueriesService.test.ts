/* eslint-disable functional/no-let */
import { randomUUID } from "crypto";
import { describe, expect, it, afterEach, inject } from "vitest";
import {
  getMockPurpose,
  getMockTenant,
  getMockVerifiedTenantAttribute,
  setupTestContainersVitest,
} from "pagopa-interop-commons-test";
import { AttributeId, TenantId, unsafeBrandId } from "pagopa-interop-models";
import { ReadModelQueriesClient } from "../src/services/readModelQueriesService.js";

const PN_ESERVICE_ID_MOCK = "4747d063-0d9c-4a5d-b143-9f2fdc4d7f22";
const COMUNI_E_LORO_CONSORZI_E_ASSOCIAZIONI_ATTRIBUTE_ID_MOCK =
  "5ec5dd81-ff71-4af8-974b-4190eb8347bf";

const TENANT_COMUNE_ID = randomUUID();
const TENANT_NON_COMUNE_ID = randomUUID();

export const { cleanup, readModelRepository, postgresDB } =
  await setupTestContainersVitest(
    inject("readModelConfig"),
    inject("eventStoreConfig")
  );

afterEach(cleanup);

describe("MetricsManager", () => {
  const readModelQueriesClient = new ReadModelQueriesClient(
    readModelRepository
  );

  async function seedCollection(
    collection:
      | "eservices"
      | "agreements"
      | "tenants"
      | "purposes"
      | "attributes",
    data: Array<{ data: unknown }>
  ): Promise<void> {
    await readModelRepository[collection].insertMany(data as never);
  }

  it("should not count purposes with consumers that have no attribute with id 'COMUNI_E_LORO_CONSORZI_E_ASSOCIAZIONI_ATTRIBUTE_ID'", async () => {
    await seedCollection("tenants", [
      {
        data: {
          ...getMockTenant(unsafeBrandId<TenantId>(TENANT_COMUNE_ID), [
            getMockVerifiedTenantAttribute(
              unsafeBrandId<AttributeId>(
                COMUNI_E_LORO_CONSORZI_E_ASSOCIAZIONI_ATTRIBUTE_ID_MOCK
              )
            ),
          ]),
          name: "tenant-comune",
          externalId: { origin: "origin", value: "value" },
        },
      },
      {
        data: {
          ...getMockTenant(unsafeBrandId<TenantId>(TENANT_NON_COMUNE_ID)),
          name: "tenant-not-comune",
          externalId: { origin: "origin", value: "value" },
        },
      },
    ]);

    await seedCollection("purposes", [
      {
        data: {
          ...getMockPurpose(),
          eserviceId: unsafeBrandId(PN_ESERVICE_ID_MOCK),
          consumerId: unsafeBrandId(TENANT_COMUNE_ID),
          versions: [
            {
              id: randomUUID(),
              state: "Active",
              dailyCalls: 1,
              createdAt: new Date(),
            },
          ],
        },
      },
      {
        data: {
          ...getMockPurpose(),
          eserviceId: unsafeBrandId(PN_ESERVICE_ID_MOCK),
          consumerId: unsafeBrandId(TENANT_NON_COMUNE_ID),
          versions: [
            {
              id: randomUUID(),
              state: "Active",
              dailyCalls: 1,
              createdAt: new Date(),
            },
          ],
        },
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

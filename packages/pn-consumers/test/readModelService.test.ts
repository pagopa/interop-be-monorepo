/* eslint-disable functional/no-let */
import { describe, expect, it } from "vitest";
import {
  getMockPurpose,
  getMockPurposeVersion,
  getMockTenant,
  getMockVerifiedTenantAttribute,
} from "pagopa-interop-commons-test";
import {
  AttributeId,
  EServiceId,
  generateId,
  Purpose,
  purposeVersionState,
  Tenant,
  TenantId,
} from "pagopa-interop-models";
import { readModelService, seedPurposes, seedTenants } from "./utils.js";

describe("MetricsManager", () => {
  const PN_ESERVICE_ID_MOCK = generateId<EServiceId>();
  const COMUNI_E_LORO_CONSORZI_E_ASSOCIAZIONI_ATTRIBUTE_ID_MOCK =
    generateId<AttributeId>();

  const TENANT_COMUNE_ID = generateId<TenantId>();
  const TENANT_NON_COMUNE_ID = generateId<TenantId>();

  it("should not count purposes with consumers that have no attribute with id 'COMUNI_E_LORO_CONSORZI_E_ASSOCIAZIONI_ATTRIBUTE_ID'", async () => {
    const tenantsData: Tenant[] = [
      {
        ...getMockTenant(TENANT_COMUNE_ID, [
          {
            ...getMockVerifiedTenantAttribute(
              COMUNI_E_LORO_CONSORZI_E_ASSOCIAZIONI_ATTRIBUTE_ID_MOCK
            ),
            verifiedBy: [],
            revokedBy: [],
          },
        ]),
        name: "tenant-comune",
        externalId: { origin: "origin", value: "value" },
      },
      {
        ...getMockTenant(TENANT_NON_COMUNE_ID),
        name: "tenant-not-comune",
        externalId: { origin: "origin", value: "value" },
      },
    ];
    await seedTenants(tenantsData);

    const purposesData: Purpose[] = [
      {
        ...getMockPurpose(),
        eserviceId: PN_ESERVICE_ID_MOCK,
        consumerId: TENANT_COMUNE_ID,
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      },
      {
        ...getMockPurpose(),
        eserviceId: PN_ESERVICE_ID_MOCK,
        consumerId: TENANT_NON_COMUNE_ID,
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      },
    ];
    await seedPurposes(purposesData);

    const result = await readModelService.getSENDPurposes(
      PN_ESERVICE_ID_MOCK,
      COMUNI_E_LORO_CONSORZI_E_ASSOCIAZIONI_ATTRIBUTE_ID_MOCK
    );

    expect(result).toHaveLength(1);
    expect(result[0].consumerId).toBe(TENANT_COMUNE_ID);
  });
});

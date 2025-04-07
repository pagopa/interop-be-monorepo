/* eslint-disable @typescript-eslint/no-floating-promises */
import { fail } from "assert";
import { describe, expect, it } from "vitest";
import {
  Tenant,
  generateId,
  protobufDecoder,
  toTenantV2,
  TenantVerifiedAttributeExpirationUpdatedV2,
  TenantVerifier,
} from "pagopa-interop-models";
import { tenantApi } from "pagopa-interop-api-clients";
import { getMockContext, getMockTenant } from "pagopa-interop-commons-test";
import {
  tenantNotFound,
  expirationDateCannotBeInThePast,
  verifiedAttributeNotFoundInTenant,
  organizationNotFoundInVerifiers,
} from "../src/model/domain/errors.js";
import {
  addOneTenant,
  currentDate,
  getMockCertifiedTenantAttribute,
  getMockVerifiedBy,
  getMockVerifiedTenantAttribute,
  readLastTenantEvent,
  tenantService,
} from "./utils.js";

describe("updateTenantVerifiedAttribute", async () => {
  const expirationDate = new Date(
    currentDate.setDate(currentDate.getDate() + 1)
  );

  const updateVerifiedTenantAttributeSeed: tenantApi.UpdateVerifiedTenantAttributeSeed =
    {
      expirationDate: expirationDate.toISOString(),
    };

  const verifier = getMockTenant();
  const mockVerifiedBy: TenantVerifier = {
    ...getMockVerifiedBy(),
    id: verifier.id,
  };
  const mockVerifiedTenantAttribute = getMockVerifiedTenantAttribute();
  const tenant: Tenant = {
    ...getMockTenant(),
    attributes: [
      {
        ...mockVerifiedTenantAttribute,
        verifiedBy: [
          {
            ...mockVerifiedBy,
            expirationDate,
          },
        ],
      },
    ],
    updatedAt: currentDate,
    name: "A tenant",
  };
  const attributeId = tenant.attributes.map((a) => a.id)[0];
  const verifierId = mockVerifiedBy.id;
  it("should update the expirationDate", async () => {
    await addOneTenant(verifier);
    await addOneTenant(tenant);
    const returnedTenant = await tenantService.updateTenantVerifiedAttribute(
      {
        verifierId,
        tenantId: tenant.id,
        attributeId,
        updateVerifiedTenantAttributeSeed,
      },
      getMockContext({})
    );
    const writtenEvent = await readLastTenantEvent(tenant.id);
    if (!writtenEvent) {
      fail("Creation fails: tenant not found in event-store");
    }
    expect(writtenEvent).toBeDefined();
    expect(writtenEvent.stream_id).toBe(tenant.id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe("TenantVerifiedAttributeExpirationUpdated");
    const writtenPayload:
      | TenantVerifiedAttributeExpirationUpdatedV2
      | undefined = protobufDecoder(
      TenantVerifiedAttributeExpirationUpdatedV2
    ).parse(writtenEvent.data);

    if (!writtenPayload) {
      fail(
        "impossible to decode TenantVerifiedAttributeExpirationUpdatedV2 data"
      );
    }

    const updatedTenant: Tenant = {
      ...tenant,
      updatedAt: new Date(Number(writtenPayload.tenant?.updatedAt)),
    };

    expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
    expect(returnedTenant).toEqual(updatedTenant);
  });
  it("should throw tenantNotFound when tenant doesn't exist", async () => {
    expect(
      tenantService.updateTenantVerifiedAttribute(
        {
          verifierId,
          tenantId: tenant.id,
          attributeId,
          updateVerifiedTenantAttributeSeed,
        },
        getMockContext({})
      )
    ).rejects.toThrowError(tenantNotFound(tenant.id));
  });

  it("should throw expirationDateCannotBeInThePast when expiration date is in the past", async () => {
    const expirationDateinPast = new Date(
      currentDate.setDate(currentDate.getDate() - 3)
    );

    const updateVerifiedTenantAttributeSeed: tenantApi.UpdateVerifiedTenantAttributeSeed =
      {
        expirationDate: expirationDateinPast.toISOString(),
      };

    await addOneTenant(verifier);
    await addOneTenant(tenant);
    expect(
      tenantService.updateTenantVerifiedAttribute(
        {
          verifierId,
          tenantId: tenant.id,
          attributeId,
          updateVerifiedTenantAttributeSeed,
        },
        getMockContext({})
      )
    ).rejects.toThrowError(
      expirationDateCannotBeInThePast(expirationDateinPast)
    );
  });
  it("should throw verifiedAttributeNotFoundInTenant when the attribute is not verified", async () => {
    const mockCertifiedTenantAttribute = getMockCertifiedTenantAttribute();
    const updatedCertifiedTenant: Tenant = {
      ...getMockTenant(),
      attributes: [{ ...mockCertifiedTenantAttribute }],
      updatedAt: currentDate,
      name: "A updatedCertifiedTenant",
    };
    const attributeId = updatedCertifiedTenant.attributes.map((a) => a.id)[0];
    await addOneTenant(updatedCertifiedTenant);
    expect(
      tenantService.updateTenantVerifiedAttribute(
        {
          verifierId: generateId(),
          tenantId: updatedCertifiedTenant.id,
          attributeId,
          updateVerifiedTenantAttributeSeed,
        },
        getMockContext({})
      )
    ).rejects.toThrowError(
      verifiedAttributeNotFoundInTenant(updatedCertifiedTenant.id, attributeId)
    );
  });
  it("should throw organizationNotFoundInVerifiers when the organization is not verified", async () => {
    await addOneTenant(verifier);
    await addOneTenant(tenant);
    const verifierId = generateId();
    expect(
      tenantService.updateTenantVerifiedAttribute(
        {
          verifierId,
          tenantId: tenant.id,
          attributeId,
          updateVerifiedTenantAttributeSeed,
        },
        getMockContext({})
      )
    ).rejects.toThrowError(
      organizationNotFoundInVerifiers(verifierId, tenant.id, attributeId)
    );
  });
});

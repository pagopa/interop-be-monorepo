/* eslint-disable @typescript-eslint/no-floating-promises */
import { fail } from "assert";
import {
  generateId,
  protobufDecoder,
  Tenant,
  TenantVerifiedAttributeExtensionUpdatedV2,
  toTenantV2,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import {
  getMockContextInternal,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  tenantNotFound,
  expirationDateNotFoundInVerifier,
  verifiedAttributeNotFoundInTenant,
  organizationNotFoundInVerifiers,
} from "../src/model/domain/errors.js";
import {
  currentDate,
  addOneTenant,
  tenantService,
  getMockVerifiedTenantAttribute,
  getMockVerifiedBy,
  readLastTenantEvent,
} from "./utils.js";

describe("updateVerifiedAttributeExtensionDate", async () => {
  const expirationDate = new Date(
    currentDate.setDate(currentDate.getDate() + 1)
  );

  const mockVerifiedBy = getMockVerifiedBy();
  const mockVerifiedTenantAttribute = getMockVerifiedTenantAttribute();
  const tenant: Tenant = {
    ...getMockTenant(),
    attributes: [
      {
        ...mockVerifiedTenantAttribute,
        verifiedBy: [
          {
            ...mockVerifiedBy,
            extensionDate: currentDate,
            expirationDate,
          },
        ],
      },
    ],
    name: "A Tenant",
  };
  const attributeId = tenant.attributes.map((a) => a.id)[0];
  const verifierId = mockVerifiedBy.id;
  it("should update the extensionDate", async () => {
    const extensionDate = new Date(
      currentDate.getTime() +
        (expirationDate.getTime() - mockVerifiedBy.verificationDate.getTime())
    );

    await addOneTenant(tenant);
    const returnedTenant =
      await tenantService.updateVerifiedAttributeExtensionDate(
        tenant.id,
        attributeId,
        verifierId,
        getMockContextInternal({})
      );
    const writtenEvent = await readLastTenantEvent(tenant.id);
    if (!writtenEvent) {
      fail("Creation fails: tenant not found in event-store");
    }
    expect(writtenEvent.stream_id).toBe(tenant.id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe("TenantVerifiedAttributeExtensionUpdated");
    const writtenPayload:
      | TenantVerifiedAttributeExtensionUpdatedV2
      | undefined = protobufDecoder(
      TenantVerifiedAttributeExtensionUpdatedV2
    ).parse(writtenEvent.data);

    const updatedTenant: Tenant = {
      ...tenant,
      attributes: [
        {
          ...mockVerifiedTenantAttribute,
          verifiedBy: [
            {
              ...mockVerifiedBy,
              extensionDate,
              expirationDate,
            },
          ],
        },
      ],
      updatedAt: new Date(Number(writtenPayload.tenant?.updatedAt)),
    };
    expect(writtenPayload.tenant).toEqual(toTenantV2(updatedTenant));
    expect(returnedTenant).toEqual(updatedTenant);
  });
  it("should throw tenantNotFound when tenant doesn't exist", async () => {
    expect(
      tenantService.updateVerifiedAttributeExtensionDate(
        tenant.id,
        attributeId,
        verifierId,
        getMockContextInternal({})
      )
    ).rejects.toThrowError(tenantNotFound(tenant.id));
  });

  it("should throw expirationDateNotFoundInVerifier", async () => {
    const expirationDate = undefined;

    const updatedTenantWithoutExpirationDate: Tenant = {
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
      name: "A updatedTenant",
    };
    const attributeId = updatedTenantWithoutExpirationDate.attributes.map(
      (a) => a.id
    )[0];
    await addOneTenant(updatedTenantWithoutExpirationDate);
    expect(
      tenantService.updateVerifiedAttributeExtensionDate(
        updatedTenantWithoutExpirationDate.id,
        attributeId,
        verifierId,
        getMockContextInternal({})
      )
    ).rejects.toThrowError(
      expirationDateNotFoundInVerifier(
        verifierId,
        attributeId,
        updatedTenantWithoutExpirationDate.id
      )
    );
  });
  it("should throw verifiedAttributeNotFoundInTenant when the attribute is not verified", async () => {
    const mockTenant: Tenant = { ...getMockTenant(), attributes: [] };
    await addOneTenant(mockTenant);
    expect(
      tenantService.updateVerifiedAttributeExtensionDate(
        mockTenant.id,
        attributeId,
        verifierId,
        getMockContextInternal({})
      )
    ).rejects.toThrowError(
      verifiedAttributeNotFoundInTenant(mockTenant.id, attributeId)
    );
  });
  it("should throw organizationNotFoundInVerifiers when the organization is not verified", async () => {
    await addOneTenant(tenant);
    const verifierId = generateId();
    expect(
      tenantService.updateVerifiedAttributeExtensionDate(
        tenant.id,
        attributeId,
        verifierId,
        getMockContextInternal({})
      )
    ).rejects.toThrowError(
      organizationNotFoundInVerifiers(verifierId, tenant.id, attributeId)
    );
  });
});

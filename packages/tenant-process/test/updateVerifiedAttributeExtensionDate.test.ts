/* eslint-disable @typescript-eslint/no-floating-promises */
import { fail } from "assert";
import {
  generateId,
  protobufDecoder,
  Tenant,
  TenantVerifiedAttributeExtensionUpdatedV2,
  TenantVerifier,
  toTenantV2,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { getMockContext, getMockTenant } from "pagopa-interop-commons-test";
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
  readLastTenantEvent,
} from "./utils.js";

describe("updateVerifiedAttributeExtensionDate", async () => {
  const expirationDate = new Date(
    currentDate.setDate(currentDate.getDate() + 1)
  );

  const mockVerifier = getMockTenant();
  const sixHoursAgo = new Date();
  sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);
  const mockVerifiedBy: TenantVerifier = {
    id: mockVerifier.id,
    verificationDate: sixHoursAgo,
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

    await addOneTenant(mockVerifier);
    await addOneTenant(tenant);
    const returnedTenant =
      await tenantService.updateVerifiedAttributeExtensionDate(
        tenant.id,
        attributeId,
        verifierId,
        getMockContext({})
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
        getMockContext({})
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

    await addOneTenant(mockVerifier);
    await addOneTenant(updatedTenantWithoutExpirationDate);
    expect(
      tenantService.updateVerifiedAttributeExtensionDate(
        updatedTenantWithoutExpirationDate.id,
        attributeId,
        verifierId,
        getMockContext({})
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
        getMockContext({})
      )
    ).rejects.toThrowError(
      verifiedAttributeNotFoundInTenant(mockTenant.id, attributeId)
    );
  });
  it("should throw organizationNotFoundInVerifiers when the organization is not verified", async () => {
    await addOneTenant(mockVerifier);
    await addOneTenant(tenant);
    const verifierId = generateId();
    expect(
      tenantService.updateVerifiedAttributeExtensionDate(
        tenant.id,
        attributeId,
        verifierId,
        getMockContext({})
      )
    ).rejects.toThrowError(
      organizationNotFoundInVerifiers(verifierId, tenant.id, attributeId)
    );
  });
});

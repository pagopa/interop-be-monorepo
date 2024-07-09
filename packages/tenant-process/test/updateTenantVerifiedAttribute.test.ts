/* eslint-disable @typescript-eslint/no-floating-promises */
import { fail } from "assert";
import { describe, expect, it } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  Tenant,
  generateId,
  TenantUpdatedV1,
  protobufDecoder,
} from "pagopa-interop-models";
import { readLastEventByStreamId } from "pagopa-interop-commons-test/index.js";
import {
  tenantNotFound,
  expirationDateCannotBeInThePast,
  verifiedAttributeNotFoundInTenant,
  organizationNotFoundInVerifiers,
} from "../src/model/domain/errors.js";
import { UpdateVerifiedTenantAttributeSeed } from "../src/model/domain/models.js";
import { toTenantV1 } from "../src/model/domain/toEvent.js";
import {
  addOneTenant,
  currentDate,
  getMockAuthData,
  getMockCertifiedTenantAttribute,
  getMockTenant,
  getMockVerifiedBy,
  getMockVerifiedTenantAttribute,
  postgresDB,
  tenantService,
} from "./utils.js";

describe("updateTenantVerifiedAttribute", async () => {
  const mockVerifiedBy = getMockVerifiedBy();
  const expirationDate = new Date(
    currentDate.setDate(currentDate.getDate() + 1)
  );

  const updateVerifiedTenantAttributeSeed: UpdateVerifiedTenantAttributeSeed = {
    expirationDate: expirationDate.toISOString(),
  };

  const tenant: Tenant = {
    ...getMockTenant(),
    attributes: [
      {
        ...getMockVerifiedTenantAttribute(),
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
  it("Should update the expirationDate", async () => {
    await addOneTenant(tenant);
    const returnedTenant = await tenantService.updateTenantVerifiedAttribute(
      {
        verifierId,
        tenantId: tenant.id,
        attributeId,
        updateVerifiedTenantAttributeSeed,
      },
      {
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
        authData: getMockAuthData(),
      }
    );
    const writtenEvent = await readLastEventByStreamId(
      tenant.id,
      "tenant",
      postgresDB
    );
    if (!writtenEvent) {
      fail("Creation fails: tenant not found in event-store");
    }

    expect(writtenEvent).toMatchObject({
      stream_id: tenant.id,
      version: "1",
      type: "TenantUpdated",
    });

    const writtenPayload: TenantUpdatedV1 | undefined = protobufDecoder(
      TenantUpdatedV1
    ).parse(writtenEvent.data);

    if (!writtenPayload) {
      fail("impossible to decode TenantUpdatedV1 data");
    }

    const updatedTenant: Tenant = {
      ...tenant,
      updatedAt: new Date(Number(writtenPayload.tenant?.updatedAt)),
    };

    expect(writtenPayload.tenant).toEqual(toTenantV1(updatedTenant));
    expect(returnedTenant).toEqual(updatedTenant);
  });
  it("Should throw tenantNotFound when tenant doesn't exist", async () => {
    expect(
      tenantService.updateTenantVerifiedAttribute(
        {
          verifierId,
          tenantId: tenant.id,
          attributeId,
          updateVerifiedTenantAttributeSeed,
        },
        {
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
          authData: getMockAuthData(),
        }
      )
    ).rejects.toThrowError(tenantNotFound(tenant.id));
  });

  it("Should throw expirationDateCannotBeInThePast when expiration date is in the past", async () => {
    const expirationDateinPast = new Date(
      currentDate.setDate(currentDate.getDate() - 3)
    );

    const updateVerifiedTenantAttributeSeed: UpdateVerifiedTenantAttributeSeed =
      {
        expirationDate: expirationDateinPast.toISOString(),
      };

    await addOneTenant(tenant);
    expect(
      tenantService.updateTenantVerifiedAttribute(
        {
          verifierId,
          tenantId: tenant.id,
          attributeId,
          updateVerifiedTenantAttributeSeed,
        },
        {
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
          authData: getMockAuthData(),
        }
      )
    ).rejects.toThrowError(
      expirationDateCannotBeInThePast(expirationDateinPast)
    );
  });
  it("Should throw verifiedAttributeNotFoundInTenant when the attribute is not verified", async () => {
    const updatedCertifiedTenant: Tenant = {
      ...getMockTenant(),
      attributes: [{ ...getMockCertifiedTenantAttribute() }],
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
        {
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
          authData: getMockAuthData(),
        }
      )
    ).rejects.toThrowError(
      verifiedAttributeNotFoundInTenant(updatedCertifiedTenant.id, attributeId)
    );
  });
  it("Should throw organizationNotFoundInVerifiers when the organization is not verified", async () => {
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
        {
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
          authData: getMockAuthData(),
        }
      )
    ).rejects.toThrowError(
      organizationNotFoundInVerifiers(verifierId, tenant.id, attributeId)
    );
  });
});

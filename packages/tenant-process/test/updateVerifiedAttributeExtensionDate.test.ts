/* eslint-disable @typescript-eslint/no-floating-promises */
import { fail } from "assert";
import { genericLogger } from "pagopa-interop-commons";
import {
  getMockAuthData,
  readLastEventByStreamId,
} from "pagopa-interop-commons-test/index.js";
import {
  generateId,
  protobufDecoder,
  Tenant,
  TenantUpdatedV1,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import {
  tenantNotFound,
  expirationDateNotFoundInVerifier,
  verifiedAttributeNotFoundInTenant,
  organizationNotFoundInVerifiers,
} from "../src/model/domain/errors.js";
import { toTenantV1 } from "../src/model/domain/toEvent.js";
import {
  currentDate,
  addOneTenant,
  tenantService,
  getMockTenant,
  getMockVerifiedTenantAttribute,
  getMockVerifiedBy,
  postgresDB,
} from "./utils.js";

describe("updateVerifiedAttributeExtensionDate", async () => {
  const mockTenant = getMockTenant();
  const mockVerifiedBy = getMockVerifiedBy();
  const mockVerifiedTenantAttribute = getMockVerifiedTenantAttribute();
  const expirationDate = new Date(
    currentDate.setDate(currentDate.getDate() + 1)
  );

  const tenant: Tenant = {
    ...mockTenant,
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
  it("Should update the extensionDate", async () => {
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
    expect(writtenPayload.tenant).toEqual(toTenantV1(updatedTenant));
    expect(returnedTenant).toEqual(toTenantV1(updatedTenant));
  });
  it("Should throw tenantNotFound when tenant doesn't exist", async () => {
    const correlationId = generateId();
    expect(
      tenantService.updateVerifiedAttributeExtensionDate(
        tenant.id,
        attributeId,
        verifierId,
        {
          correlationId,
          logger: genericLogger,
          serviceName: "",
          authData: getMockAuthData(),
        }
      )
    ).rejects.toThrowError(tenantNotFound(tenant.id));
  });

  it("Should throw expirationDateNotFoundInVerifier", async () => {
    const expirationDate = undefined;

    const updatedTenantWithoutExpirationDate: Tenant = {
      ...mockTenant,
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
    const correlationId = generateId();
    expect(
      tenantService.updateVerifiedAttributeExtensionDate(
        updatedTenantWithoutExpirationDate.id,
        attributeId,
        verifierId,
        {
          correlationId,
          logger: genericLogger,
          serviceName: "",
          authData: getMockAuthData(),
        }
      )
    ).rejects.toThrowError(
      expirationDateNotFoundInVerifier(
        verifierId,
        attributeId,
        updatedTenantWithoutExpirationDate.id
      )
    );
  });
  it("Should throw verifiedAttributeNotFoundInTenant when the attribute is not verified", async () => {
    await addOneTenant(mockTenant);
    const correlationId = generateId();
    expect(
      tenantService.updateVerifiedAttributeExtensionDate(
        tenant.id,
        attributeId,
        verifierId,
        {
          correlationId,
          logger: genericLogger,
          serviceName: "",
          authData: getMockAuthData(),
        }
      )
    ).rejects.toThrowError(
      verifiedAttributeNotFoundInTenant(mockTenant.id, attributeId)
    );
  });
  it("Should throw organizationNotFoundInVerifiers when the organization is not verified", async () => {
    await addOneTenant(tenant);
    const verifierId = generateId();
    const correlationId = generateId();
    expect(
      tenantService.updateVerifiedAttributeExtensionDate(
        tenant.id,
        attributeId,
        verifierId,
        {
          correlationId,
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

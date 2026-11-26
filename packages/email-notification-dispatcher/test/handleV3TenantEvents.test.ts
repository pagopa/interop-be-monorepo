import { authRole } from "pagopa-interop-commons";
import {
  getMockAttribute,
  getMockContext,
  getMockTenant,
  getMockVerifiedTenantAttribute,
} from "pagopa-interop-commons-test";
import {
  ContactId,
  TenantId,
  UserId,
  generateId,
  toTenantV2,
  toTenantV3,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";

import { handleTenantEvent } from "../src/handlers/tenants/handleTenantEvent.js";
import { readModelService, templateService } from "./utils.js";

describe("Tenant event versions", () => {
  const { logger, correlationId } = getMockContext({});
  const attribute = { ...getMockAttribute("Verified"), origin: "IPA" };
  const verification = {
    id: generateId<TenantId>(),
    verificationDate: new Date(),
  };
  const tenant = getMockTenant(undefined, [
    {
      ...getMockVerifiedTenantAttribute(attribute.id),
      verifiedBy: [verification],
      revokedBy: [{ ...verification, revocationDate: new Date() }],
    },
  ]);
  const userId = generateId<UserId>();
  const contactId = generateId<ContactId>();
  const tenantV3 = toTenantV3({ ...tenant, contactId });
  const envelope = {
    sequence_num: 1,
    stream_id: tenant.id,
    version: 1,
    log_date: new Date(),
  };
  const params = {
    logger,
    correlationId,
    templateService,
    readModelService: {
      ...readModelService,
      getAttributeById: vi.fn().mockResolvedValue(attribute),
      getTenantById: vi.fn().mockResolvedValue(getMockTenant(verification.id)),
      getTenantUsersWithNotificationEnabled: vi.fn().mockResolvedValue([
        {
          userId,
          tenantId: tenant.id,
          userRoles: [authRole.ADMIN_ROLE],
        },
      ]),
    },
  };

  it.each([
    "TenantCertifiedAttributeAssigned",
    "TenantCertifiedAttributeRevoked",
    "TenantCertifiedDiscreteAttributeAssigned",
    "TenantCertifiedDiscreteAttributeRevoked",
    "TenantCertifiedDiscreteAttributeUpdated",
    "TenantVerifiedAttributeAssigned",
    "TenantVerifiedAttributeRevoked",
  ] as const)("produces the same email for %s in V2 and V3", async (type) => {
    const attributeData = {
      attributeId: attribute.id,
      previousValue: 1,
      newValue: 2,
    };
    const v2 = await handleTenantEvent({
      ...params,
      decodedMessage: {
        ...envelope,
        type,
        event_version: 2,
        data: { tenant: toTenantV2(tenant), ...attributeData },
      },
    });
    const v3 = await handleTenantEvent({
      ...params,
      decodedMessage: {
        ...envelope,
        type,
        event_version: 3,
        data: { tenant: tenantV3, ...attributeData },
      },
    });
    expect(v3).toEqual([expect.objectContaining({ type: "User", userId })]);
    expect(v3).toEqual(v2);
  });

  it.each(["TenantContactAdded", "TenantContactDeleted"] as const)(
    "consumes %s without producing notifications",
    async (type) => {
      const notifications = await handleTenantEvent({
        ...params,
        decodedMessage: {
          ...envelope,
          type,
          event_version: 3,
          data: { tenant: tenantV3, contactId },
        },
      });
      expect(notifications).toEqual([]);
    }
  );
});

import {
  getMockAttribute,
  getMockContext,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  Attribute,
  ContactId,
  Tenant,
  TenantEventEnvelopeV3,
  TenantEventV3,
  attributeKind,
  generateId,
  missingKafkaMessageDataError,
  toTenantV3,
} from "pagopa-interop-models";
import {
  getNotificationRecipients,
  inAppTemplates,
} from "pagopa-interop-notification-commons";
import { Mock, beforeEach, describe, expect, it } from "vitest";

import { handleTenantEvent } from "../src/handlers/tenants/handleTenantEvent.js";
import { addOneAttribute, readModelService } from "./utils.js";

const { logger } = getMockContext({});

const toTenantEventEnvelopeV3 = (
  event: Pick<TenantEventV3, "type" | "data">
): TenantEventEnvelopeV3 =>
  ({
    ...event,
    event_version: 3,
    sequence_num: 1,
    stream_id: generateId(),
    version: 1,
    log_date: new Date(),
  }) as TenantEventEnvelopeV3;

describe("Tenant V3 events", () => {
  const tenant: Tenant = {
    ...getMockTenant(),
    contactId: generateId<ContactId>(),
  };

  const mockGetNotificationRecipients = getNotificationRecipients as Mock;

  beforeEach(() => {
    mockGetNotificationRecipients.mockReset();
  });

  it.each([
    "TenantCertifiedAttributeAssigned",
    "TenantCertifiedAttributeRevoked",
    "TenantCertifiedDiscreteAttributeAssigned",
    "TenantCertifiedDiscreteAttributeRevoked",
    "TenantCertifiedDiscreteAttributeUpdated",
    "TenantVerifiedAttributeAssigned",
    "TenantVerifiedAttributeRevoked",
  ] as const)(
    "should look up the assignee recipients on the V3 %s event",
    async (type) => {
      mockGetNotificationRecipients.mockResolvedValue([]);

      const notifications = await handleTenantEvent(
        toTenantEventEnvelopeV3({
          type,
          data: { tenant: toTenantV3(tenant), attributeId: generateId() },
        }),
        logger,
        readModelService
      );

      expect(notifications).toEqual([]);
      expect(mockGetNotificationRecipients).toHaveBeenCalledWith(
        [tenant.id],
        "certifiedVerifiedAttributeAssignedRevokedToAssignee",
        readModelService,
        logger
      );
    }
  );

  it("should notify the assignee on the V3 TenantCertifiedAttributeAssigned event", async () => {
    const attribute: Attribute = {
      ...getMockAttribute(attributeKind.certified),
      origin: "IPA",
    };
    await addOneAttribute(attribute);

    const users = [
      { userId: generateId(), tenantId: tenant.id },
      { userId: generateId(), tenantId: tenant.id },
    ];
    mockGetNotificationRecipients.mockResolvedValue(users);

    const notifications = await handleTenantEvent(
      toTenantEventEnvelopeV3({
        type: "TenantCertifiedAttributeAssigned",
        data: { tenant: toTenantV3(tenant), attributeId: attribute.id },
      }),
      logger,
      readModelService
    );

    expect(notifications).toEqual(
      users.map((user) => ({
        userId: user.userId,
        tenantId: user.tenantId,
        body: inAppTemplates.certifiedAttributeAssignedToAssigneeFromImport(
          attribute.name
        ),
        notificationType: "certifiedVerifiedAttributeAssignedRevokedToAssignee",
        entityId: attribute.id,
      }))
    );
  });

  it("should throw missingKafkaMessageDataError when the tenant is missing in a V3 attribute event", async () => {
    await expect(
      handleTenantEvent(
        toTenantEventEnvelopeV3({
          type: "TenantCertifiedAttributeAssigned",
          data: { attributeId: generateId() },
        }),
        logger,
        readModelService
      )
    ).rejects.toThrow(
      missingKafkaMessageDataError("tenant", "TenantCertifiedAttributeAssigned")
    );
  });

  it.each([
    "TenantOnboarded",
    "TenantOnboardDetailsUpdated",
    "TenantDeclaredAttributeAssigned",
    "TenantDeclaredAttributeRevoked",
    "TenantVerifiedAttributeExpirationUpdated",
    "TenantVerifiedAttributeExtensionUpdated",
    "MaintenanceTenantDeleted",
    "MaintenanceTenantUpdated",
    "TenantContactAdded",
    "TenantKindUpdated",
    "TenantContactDeleted",
    "MaintenanceTenantPromotedToCertifier",
    "TenantDelegatedProducerFeatureAdded",
    "TenantDelegatedProducerFeatureRemoved",
    "TenantDelegatedConsumerFeatureAdded",
    "TenantDelegatedConsumerFeatureRemoved",
    "TenantRemoteIdAssigned",
    "MaintenanceTenantRemoteIdDeleted",
  ] as const)("should skip the V3 %s event", async (type) => {
    const notifications = await handleTenantEvent(
      toTenantEventEnvelopeV3({
        type,
        data: { tenant: toTenantV3(tenant) },
      }),
      logger,
      readModelService
    );

    expect(notifications).toEqual([]);
    expect(mockGetNotificationRecipients).not.toHaveBeenCalled();
  });
});

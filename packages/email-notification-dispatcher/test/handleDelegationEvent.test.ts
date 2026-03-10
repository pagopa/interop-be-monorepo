/* eslint-disable functional/immutable-data */
import {
  getMockContext,
  getMockDelegation,
  getMockDescriptorPublished,
  getMockEService,
  getMockTenant,
  getMockTenantMail,
} from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import {
  CorrelationId,
  DelegationEventEnvelopeV2,
  DelegationId,
  EService,
  EServiceId,
  generateId,
  NotificationType,
  Tenant,
  TenantId,
  TenantNotificationConfigId,
  toDelegationV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleDelegationEvent } from "../src/handlers/delegations/handleDelegationEvent.js";
import {
  addOneDelegation,
  addOneEService,
  addOneTenant,
  getMockUser,
  readModelService,
  templateService,
} from "./utils.js";

describe("handleDelegationEvent", async () => {
  const delegatorId = generateId<TenantId>();
  const delegateId = generateId<TenantId>();
  const eserviceId = generateId<EServiceId>();

  const descriptor = getMockDescriptorPublished();
  const eservice: EService = {
    ...getMockEService(),
    id: eserviceId,
    producerId: delegatorId,
    descriptors: [descriptor],
  };
  const delegatorTenant: Tenant = {
    ...getMockTenant(delegatorId),
    name: "Delegator Tenant",
    mails: [getMockTenantMail()],
  };
  const delegateTenant: Tenant = {
    ...getMockTenant(delegateId),
    name: "Delegate Tenant",
    mails: [getMockTenantMail()],
  };
  const users = [
    getMockUser(delegatorTenant.id),
    getMockUser(delegatorTenant.id),
    getMockUser(delegateTenant.id),
    getMockUser(delegateTenant.id),
  ];

  const { logger } = getMockContext({});

  beforeEach(async () => {
    await addOneEService(eservice);
    await addOneTenant(delegatorTenant);
    await addOneTenant(delegateTenant);
    readModelService.getTenantNotificationConfigByTenantId = vi
      .fn()
      .mockResolvedValue({
        id: generateId<TenantNotificationConfigId>(),
        tenantId: delegatorTenant.id,
        enabled: true,
        createAt: new Date(),
      });
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockImplementation((tenantIds: TenantId[], _: NotificationType) =>
        users
          .filter((user) =>
            tenantIds.includes(unsafeBrandId<TenantId>(user.tenantId))
          )
          .map((user) => ({
            userId: user.id,
            tenantId: user.tenantId,
            userRoles: [authRole.ADMIN_ROLE],
          }))
      );
  });

  describe("ProducerDelegationRevoked", () => {
    it("should route ProducerDelegationRevoked event to handler and generate messages", async () => {
      const delegation = getMockDelegation({
        kind: "DelegatedProducer",
        delegatorId: delegatorTenant.id,
        delegateId: delegateTenant.id,
        eserviceId: eservice.id,
      });
      await addOneDelegation(delegation);

      const decodedMessage: DelegationEventEnvelopeV2 = {
        type: "ProducerDelegationRevoked",
        event_version: 2,
        data: {
          delegation: toDelegationV2(delegation),
        },
        sequence_num: 1,
        stream_id: generateId<DelegationId>(),
        version: 1,
        log_date: new Date(),
      };

      const messages = await handleDelegationEvent({
        decodedMessage,
        logger,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      });

      expect(messages.length).toEqual(2);
      expect(
        messages.some(
          (message) => message.type === "User" && message.userId === users[2].id
        )
      ).toBe(true);
      expect(
        messages.some(
          (message) => message.type === "User" && message.userId === users[3].id
        )
      ).toBe(true);
      messages.forEach((message) => {
        expect(message.email.body).toContain(
          "Una delega che gestivi è stata revocata"
        );
        expect(message.email.body).toContain(delegatorTenant.name);
        expect(message.email.body).toContain(eservice.name);
      });
    });
  });
});

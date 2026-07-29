/* eslint-disable functional/immutable-data */
import { authRole, dateAtRomeZone } from "pagopa-interop-commons";
import {
  getMockContext,
  getMockDelegation,
  getMockDescriptor,
  getMockEService,
  getMockTenant,
  getMockTenantMail,
} from "pagopa-interop-commons-test";
import {
  CorrelationId,
  Delegation,
  DescriptorId,
  EService,
  EServiceArchivingRequestedByDelegateV2,
  EServiceDescriptorArchivingRequestedByDelegateV2,
  EServiceEventV2,
  EServiceId,
  NotificationType,
  Tenant,
  TenantId,
  TenantNotificationConfigId,
  archivingScope,
  delegationState,
  descriptorState,
  generateId,
  gracePeriodDays,
  toEServiceV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleEserviceArchivingRequestSubmittedToDelegator } from "../src/handlers/eservices/handleEserviceArchivingRequestSubmittedToDelegator.js";
import {
  addOneDelegation,
  addOneEService,
  addOneTenant,
  getMockUser,
  readModelService,
  templateService,
} from "./utils.js";

describe("handleEserviceArchivingRequestSubmittedToDelegator", () => {
  const delegatorId = generateId<TenantId>();
  const delegateId = generateId<TenantId>();
  const descriptorId = generateId<DescriptorId>();

  const descriptor = {
    ...getMockDescriptor(descriptorState.archiving),
    id: descriptorId,
    archivingSchedule: {
      archivableOn: new Date("2026-12-31T00:00:00.000Z"),
      startedAt: new Date("2026-05-14T00:00:00.000Z"),
      scope: archivingScope.eservice,
      gracePeriodDays: gracePeriodDays[0],
    },
  };

  const delegatorTenant: Tenant = {
    ...getMockTenant(delegatorId),
    name: "Delegator Tenant",
    mails: [getMockTenantMail()],
  };

  const delegateTenant: Tenant = {
    ...getMockTenant(delegateId),
    name: "Delegate Tenant",
  };

  const users = [
    getMockUser(delegatorTenant.id),
    getMockUser(delegatorTenant.id),
    getMockUser(delegateTenant.id),
  ];

  const eservice: EService = {
    ...getMockEService(),
    id: generateId<EServiceId>(),
    producerId: delegatorId,
    descriptors: [descriptor],
  };

  const delegation: Delegation = getMockDelegation({
    kind: "DelegatedProducer",
    eserviceId: eservice.id,
    delegatorId,
    delegateId,
    state: delegationState.active,
  });

  const { logger } = getMockContext({});

  beforeEach(async () => {
    await addOneTenant(delegatorTenant);
    await addOneTenant(delegateTenant);
    await addOneEService(eservice);
    await addOneDelegation(delegation);

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

  it("handles descriptor submitted scenario", async () => {
    const event: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceDescriptorArchivingRequestedByDelegate",
      data: {
        descriptorId,
        eservice: toEServiceV2(eservice),
      } satisfies EServiceDescriptorArchivingRequestedByDelegateV2,
    };

    const messages = await handleEserviceArchivingRequestSubmittedToDelegator({
      decodedMessage: event,
      logger,
      readModelService,
      templateService,
      correlationId: generateId<CorrelationId>(),
    });

    const expectedDate = dateAtRomeZone(
      descriptor.archivingSchedule.archivableOn
    );
    expect(messages).toHaveLength(3);
    messages.forEach((message) => {
      expect(message.email.subject).toBe(
        "Nuova richiesta di archiviazione di una versione di un e-service"
      );
      expect(message.email.body).toContain(delegateTenant.name);
      expect(message.email.body).toContain(
        `versione ${descriptor.version} dell&#x27;e-service ${eservice.name}`
      );
      expect(message.email.body).toContain(
        "Puoi approvare o rifiutare la richiesta."
      );
      expect(message.email.body).toContain(expectedDate);
    });
  });

  it("handles e-service submitted scenario", async () => {
    const event: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceArchivingRequestedByDelegate",
      data: {
        eservice: toEServiceV2(eservice),
      } satisfies EServiceArchivingRequestedByDelegateV2,
    };

    const messages = await handleEserviceArchivingRequestSubmittedToDelegator({
      decodedMessage: event,
      logger,
      readModelService,
      templateService,
      correlationId: generateId<CorrelationId>(),
    });

    const expectedDate = dateAtRomeZone(
      descriptor.archivingSchedule.archivableOn
    );
    expect(messages).toHaveLength(3);
    messages.forEach((message) => {
      expect(message.email.subject).toBe(
        "Nuova richiesta di archiviazione di un e-service"
      );
      expect(message.email.body).toContain(delegateTenant.name);
      expect(message.email.body).toContain(
        `archiviazione dell&#x27;e-service ${eservice.name}`
      );
      expect(message.email.body).toContain(
        "Puoi approvare o rifiutare la richiesta."
      );
      expect(message.email.body).toContain(expectedDate);
    });
  });
});

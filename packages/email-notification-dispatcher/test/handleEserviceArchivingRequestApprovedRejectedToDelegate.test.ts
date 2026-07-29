/* eslint-disable functional/immutable-data */
import { authRole, dateAtRomeZone } from "pagopa-interop-commons";
import {
  getMockContext,
  getMockDelegation,
  getMockDescriptor,
  getMockEService,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  CorrelationId,
  Delegation,
  DescriptorId,
  EService,
  EServiceArchivingRequestApprovedByDelegatorV2,
  EServiceArchivingRequestRejectedByDelegatorV2,
  EServiceDescriptorArchivingRequestApprovedByDelegatorV2,
  EServiceDescriptorArchivingRequestRejectedByDelegatorV2,
  EServiceEventV2,
  EServiceId,
  NotificationType,
  Tenant,
  TenantId,
  archivingScope,
  delegationState,
  descriptorState,
  generateId,
  gracePeriodDays,
  toEServiceV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleEserviceArchivingRequestApprovedRejectedToDelegate } from "../src/handlers/eservices/handleEserviceArchivingRequestApprovedRejectedToDelegate.js";
import {
  addOneDelegation,
  addOneEService,
  addOneTenant,
  getMockUser,
  readModelService,
  templateService,
} from "./utils.js";

describe("handleEserviceArchivingRequestApprovedRejectedToDelegate", () => {
  const delegatorId = generateId<TenantId>();
  const delegateId = generateId<TenantId>();
  const descriptorId = generateId<DescriptorId>();

  const descriptor = {
    ...getMockDescriptor(descriptorState.archiving),
    id: descriptorId,
    archivingSchedule: {
      archivableOn: new Date("2026-12-31T00:00:00.000Z"),
      startedAt: new Date("2026-05-14T00:00:00.000Z"),
      scope: archivingScope.descriptor,
      gracePeriodDays: gracePeriodDays[0],
    },
  };

  const delegatorTenant: Tenant = {
    ...getMockTenant(delegatorId),
    name: "Delegator Tenant",
  };

  const delegateTenant: Tenant = {
    ...getMockTenant(delegateId),
    name: "Delegate Tenant",
  };

  const users = [
    getMockUser(delegateTenant.id),
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

  it("handles descriptor approved scenario", async () => {
    const event: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceDescriptorArchivingRequestApprovedByDelegator",
      data: {
        descriptorId,
        eservice: toEServiceV2(eservice),
      } satisfies EServiceDescriptorArchivingRequestApprovedByDelegatorV2,
    };

    const messages =
      await handleEserviceArchivingRequestApprovedRejectedToDelegate({
        decodedMessage: event,
        logger,
        readModelService,
        templateService,
        correlationId: generateId<CorrelationId>(),
      });

    const expectedDate = dateAtRomeZone(
      descriptor.archivingSchedule.archivableOn
    );
    expect(messages).toHaveLength(2);
    messages.forEach((message) => {
      expect(message.email.subject).toBe(
        "La tua richiesta di archiviazione della versione dell' e-service è stata confermata"
      );
      expect(message.email.body).toContain(delegatorTenant.name);
      expect(message.email.body).toContain(
        `versione ${descriptor.version} dell&#x27;e-service ${eservice.name}`
      );
      expect(message.email.body).toContain(expectedDate);
    });
  });

  it("handles descriptor rejected scenario", async () => {
    const event: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceDescriptorArchivingRequestRejectedByDelegator",
      data: {
        descriptorId,
        eservice: toEServiceV2(eservice),
      } satisfies EServiceDescriptorArchivingRequestRejectedByDelegatorV2,
    };

    const messages =
      await handleEserviceArchivingRequestApprovedRejectedToDelegate({
        decodedMessage: event,
        logger,
        readModelService,
        templateService,
        correlationId: generateId<CorrelationId>(),
      });

    expect(messages).toHaveLength(2);
    messages.forEach((message) => {
      expect(message.email.subject).toBe(
        "La tua richiesta di archiviazione della versione dell' e-service è stata rifiutata"
      );
      expect(message.email.body).toContain(delegatorTenant.name);
      expect(message.email.body).toContain(
        `richiesta di archiviazione della versione ${descriptor.version}`
      );
    });
  });

  it("handles e-service approved scenario", async () => {
    const event: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceArchivingRequestApprovedByDelegator",
      data: {
        eservice: toEServiceV2(eservice),
      } satisfies EServiceArchivingRequestApprovedByDelegatorV2,
    };

    const messages =
      await handleEserviceArchivingRequestApprovedRejectedToDelegate({
        decodedMessage: event,
        logger,
        readModelService,
        templateService,
        correlationId: generateId<CorrelationId>(),
      });

    const expectedDate = dateAtRomeZone(
      descriptor.archivingSchedule.archivableOn
    );
    expect(messages).toHaveLength(2);
    messages.forEach((message) => {
      expect(message.email.subject).toBe(
        "La tua richiesta di archiviazione di un e-service è stata confermata"
      );
      expect(message.email.body).toContain(delegatorTenant.name);
      expect(message.email.body).toContain(
        `richiesta di archiviazione dell&#x27;e-service ${eservice.name}`
      );
      expect(message.email.body).toContain(expectedDate);
    });
  });

  it("handles e-service rejected scenario", async () => {
    const event: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceArchivingRequestRejectedByDelegator",
      data: {
        eservice: toEServiceV2(eservice),
      } satisfies EServiceArchivingRequestRejectedByDelegatorV2,
    };

    const messages =
      await handleEserviceArchivingRequestApprovedRejectedToDelegate({
        decodedMessage: event,
        logger,
        readModelService,
        templateService,
        correlationId: generateId<CorrelationId>(),
      });

    expect(messages).toHaveLength(2);
    messages.forEach((message) => {
      expect(message.email.subject).toBe(
        "La tua richiesta di archiviazione di un e-service è stata rifiutata"
      );
      expect(message.email.body).toContain(delegatorTenant.name);
      expect(message.email.body).toContain(
        `richiesta di archiviazione dell&#x27;e-service ${eservice.name}`
      );
    });
  });
});

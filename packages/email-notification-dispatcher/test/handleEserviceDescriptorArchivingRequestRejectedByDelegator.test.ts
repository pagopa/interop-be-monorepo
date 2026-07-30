/* eslint-disable functional/immutable-data */
/* eslint-disable sonarjs/no-identical-functions */
import { authRole } from "pagopa-interop-commons";
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
  delegationState,
  DescriptorId,
  descriptorState,
  EService,
  EServiceId,
  generateId,
  missingKafkaMessageDataError,
  NotificationType,
  Tenant,
  TenantId,
  TenantNotificationConfigId,
  toEServiceV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { tenantNotFound } from "pagopa-interop-notification-commons";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleEserviceDescriptorArchivingRequestRejectedByDelegator } from "../src/handlers/eservices/handleEserviceDescriptorArchivingRequestRejectedByDelegator.js";
import {
  addOneDelegation,
  addOneEService,
  addOneTenant,
  getMockUser,
  readModelService,
  templateService,
} from "./utils.js";

describe("handleEserviceDescriptorArchivingRequestRejectedByDelegator", async () => {
  const delegatorId = generateId<TenantId>();
  const delegateId = generateId<TenantId>();

  const archivingDescriptorId = generateId<DescriptorId>();
  const archivingDescriptor = {
    ...getMockDescriptor(descriptorState.archiving),
    id: archivingDescriptorId,
    version: "3",
    archivingSchedule: undefined,
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
    getMockUser(delegateTenant.id),
    getMockUser(delegateTenant.id),
  ];
  const eservice = {
    ...getMockEService(),
    id: generateId<EServiceId>(),
    producerId: delegatorId,
    descriptors: [archivingDescriptor],
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
    await addOneEService(eservice);
    await addOneDelegation(delegation);
    await addOneTenant(delegatorTenant);
    await addOneTenant(delegateTenant);
    readModelService.getTenantNotificationConfigByTenantId = vi
      .fn()
      .mockResolvedValue({
        id: generateId<TenantNotificationConfigId>(),
        tenantId: delegateTenant.id,
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

  it("should throw missingKafkaMessageDataError when eservice is undefined", async () => {
    await expect(() =>
      handleEserviceDescriptorArchivingRequestRejectedByDelegator({
        eserviceV2Msg: undefined,
        descriptorId: archivingDescriptorId,
        logger,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(
      missingKafkaMessageDataError(
        "eservice",
        "EServiceDescriptorArchivingRequestRejectedByDelegator"
      )
    );
  });

  it("should throw tenantNotFound when delegate is not found", async () => {
    const unknownDelegateId = generateId<TenantId>();
    const freshDescriptorId = generateId<DescriptorId>();
    const eserviceUnknownDelegate: EService = {
      ...getMockEService(),
      id: generateId<EServiceId>(),
      producerId: delegatorId,
      descriptors: [{ ...archivingDescriptor, id: freshDescriptorId }],
    };
    await addOneEService(eserviceUnknownDelegate);
    await addOneDelegation(
      getMockDelegation({
        kind: "DelegatedProducer",
        eserviceId: eserviceUnknownDelegate.id,
        delegatorId,
        delegateId: unknownDelegateId,
        state: delegationState.active,
      })
    );

    await expect(() =>
      handleEserviceDescriptorArchivingRequestRejectedByDelegator({
        eserviceV2Msg: toEServiceV2(eserviceUnknownDelegate),
        descriptorId: freshDescriptorId,
        logger,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(tenantNotFound(unknownDelegateId));
  });

  it("should generate one message per delegate user with the expected subject", async () => {
    const messages =
      await handleEserviceDescriptorArchivingRequestRejectedByDelegator({
        eserviceV2Msg: toEServiceV2(eservice),
        descriptorId: archivingDescriptorId,
        logger,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      });

    expect(messages.length).toEqual(2);
    expect(
      messages.every(
        (m) =>
          m.email.subject ===
          `La tua richiesta di archiviazione della versione dell'e-service è stata rifiutata`
      )
    ).toBe(true);
    expect(
      messages.some((m) => m.type === "User" && m.userId === users[0].id)
    ).toBe(true);
    expect(
      messages.some((m) => m.type === "User" && m.userId === users[1].id)
    ).toBe(true);
  });

  it("should return empty array when no users have notifications enabled", async () => {
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue([]);

    const messages =
      await handleEserviceDescriptorArchivingRequestRejectedByDelegator({
        eserviceV2Msg: toEServiceV2(eservice),
        descriptorId: archivingDescriptorId,
        logger,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      });

    expect(messages).toEqual([]);
  });
});

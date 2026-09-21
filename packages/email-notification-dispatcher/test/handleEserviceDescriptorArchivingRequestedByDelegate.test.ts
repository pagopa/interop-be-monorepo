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
  archivingScope,
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

import { handleEserviceDescriptorArchivingRequestedByDelegate } from "../src/handlers/eservices/handleEserviceDescriptorArchivingRequestedByDelegate.js";
import {
  addOneDelegation,
  addOneEService,
  addOneTenant,
  getMockUser,
  readModelService,
  templateService,
} from "./utils.js";

describe("handleEserviceDescriptorArchivingRequestedByDelegate", async () => {
  const delegatorId = generateId<TenantId>();
  const delegateId = generateId<TenantId>();

  const archivingDescriptorId = generateId<DescriptorId>();
  const archivingDescriptor = {
    ...getMockDescriptor(descriptorState.archiving),
    id: archivingDescriptorId,
    version: "3",
    archivingSchedule: {
      archivableOn: new Date("2026-12-31T00:00:00.000Z"),
      startedAt: new Date("2026-05-14T00:00:00.000Z"),
      scope: archivingScope.descriptor,
      gracePeriodDays: 60 as const,
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

  it("should throw missingKafkaMessageDataError when eservice is undefined", async () => {
    await expect(() =>
      handleEserviceDescriptorArchivingRequestedByDelegate({
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
        "EServiceDescriptorArchivingRequestedByDelegate"
      )
    );
  });

  it("should throw tenantNotFound when delegator is not found", async () => {
    const unknownDelegatorId = generateId<TenantId>();
    const freshDescriptorId = generateId<DescriptorId>();
    const eserviceUnknownDelegator: EService = {
      ...getMockEService(),
      id: generateId<EServiceId>(),
      producerId: unknownDelegatorId,
      descriptors: [{ ...archivingDescriptor, id: freshDescriptorId }],
    };
    await addOneEService(eserviceUnknownDelegator);
    await addOneDelegation(
      getMockDelegation({
        kind: "DelegatedProducer",
        eserviceId: eserviceUnknownDelegator.id,
        delegatorId: unknownDelegatorId,
        delegateId,
        state: delegationState.active,
      })
    );

    await expect(() =>
      handleEserviceDescriptorArchivingRequestedByDelegate({
        eserviceV2Msg: toEServiceV2(eserviceUnknownDelegator),
        descriptorId: freshDescriptorId,
        logger,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(tenantNotFound(unknownDelegatorId));
  });

  it("should throw tenantNotFound when delegate is not found", async () => {
    const unknownDelegateId = generateId<TenantId>();
    const freshDescriptorId2 = generateId<DescriptorId>();
    const eserviceUnknownDelegate: EService = {
      ...getMockEService(),
      id: generateId<EServiceId>(),
      producerId: delegatorId,
      descriptors: [{ ...archivingDescriptor, id: freshDescriptorId2 }],
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
      handleEserviceDescriptorArchivingRequestedByDelegate({
        eserviceV2Msg: toEServiceV2(eserviceUnknownDelegate),
        descriptorId: freshDescriptorId2,
        logger,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(tenantNotFound(unknownDelegateId));
  });

  it("should generate one message per delegator user with the expected subject", async () => {
    const messages = await handleEserviceDescriptorArchivingRequestedByDelegate(
      {
        eserviceV2Msg: toEServiceV2(eservice),
        descriptorId: archivingDescriptorId,
        logger,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      }
    );

    expect(messages.length).toEqual(3);
    expect(
      messages.every(
        (m) =>
          m.email.subject ===
          `Nuova richiesta di archiviazione di una versione di un e-service`
      )
    ).toBe(true);
    expect(
      messages.some((m) => m.type === "User" && m.userId === users[0].id)
    ).toBe(true);
    expect(
      messages.some((m) => m.type === "User" && m.userId === users[1].id)
    ).toBe(true);
  });

  it("should also generate a message to the delegator contact email (includeTenantContactEmails: true)", async () => {
    const messages = await handleEserviceDescriptorArchivingRequestedByDelegate(
      {
        eserviceV2Msg: toEServiceV2(eservice),
        descriptorId: archivingDescriptorId,
        logger,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      }
    );

    // 2 users + 1 tenant contact email = 3
    expect(messages.length).toEqual(3);
    expect(
      messages.some(
        (m) =>
          m.type === "Tenant" && m.address === delegatorTenant.mails[0].address
      )
    ).toBe(true);
  });

  it("should return empty array when no users have notifications enabled", async () => {
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue([]);
    readModelService.getTenantNotificationConfigByTenantId = vi
      .fn()
      .mockResolvedValue(undefined);

    const messages = await handleEserviceDescriptorArchivingRequestedByDelegate(
      {
        eserviceV2Msg: toEServiceV2(eservice),
        descriptorId: archivingDescriptorId,
        logger,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      }
    );

    expect(messages).toEqual([]);
  });
});

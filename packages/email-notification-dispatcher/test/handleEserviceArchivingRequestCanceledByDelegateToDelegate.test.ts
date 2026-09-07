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

import { handleEServiceArchivingRequestCanceledByDelegateToDelegate } from "../src/handlers/eservices/handleEserviceArchivingRequestCanceledByDelegateToDelegate.js";
import {
  addOneDelegation,
  addOneEService,
  addOneTenant,
  getMockUser,
  readModelService,
  templateService,
} from "./utils.js";

describe("handleEServiceArchivingRequestCanceledByDelegateToDelegate", async () => {
  const producerId = generateId<TenantId>();
  const delegateId = generateId<TenantId>();

  const descriptorId = generateId<DescriptorId>();
  const descriptor = {
    ...getMockDescriptor(descriptorState.archiving),
    id: descriptorId,
    version: "3",
  };

  const producerTenant: Tenant = {
    ...getMockTenant(producerId),
    name: "Producer Tenant",
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
    producerId: producerId,
    descriptors: [descriptor],
  };
  const delegation: Delegation = getMockDelegation({
    kind: "DelegatedProducer",
    eserviceId: eservice.id,
    delegatorId: producerId,
    delegateId,
    state: delegationState.active,
  });

  const { logger } = getMockContext({});

  beforeEach(async () => {
    await addOneEService(eservice);
    await addOneDelegation(delegation);
    await addOneTenant(producerTenant);
    await addOneTenant(delegateTenant);
    readModelService.getTenantNotificationConfigByTenantId = vi
      .fn()
      .mockResolvedValue({
        id: generateId<TenantNotificationConfigId>(),
        tenantId: producerTenant.id,
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
      handleEServiceArchivingRequestCanceledByDelegateToDelegate({
        eserviceV2Msg: undefined,
        logger,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(
      missingKafkaMessageDataError(
        "eservice",
        "EServiceArchivingRequestCanceledByDelegate"
      )
    );
  });

  it("should throw tenantNotFound when delegator is not found", async () => {
    const unknownDelegatorId = generateId<TenantId>();
    const eserviceUnknownDelegator: EService = {
      ...getMockEService(),
      id: generateId<EServiceId>(),
      producerId: unknownDelegatorId,
      descriptors: [getMockDescriptor(descriptorState.archiving)],
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
      handleEServiceArchivingRequestCanceledByDelegateToDelegate({
        eserviceV2Msg: toEServiceV2(eserviceUnknownDelegator),
        logger,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(tenantNotFound(unknownDelegatorId));
  });

  it("should generate one message per delegator user with the expected subject", async () => {
    const messages =
      await handleEServiceArchivingRequestCanceledByDelegateToDelegate({
        eserviceV2Msg: toEServiceV2(eservice),
        logger,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      });

    expect(messages.length).toEqual(3);
    expect(
      messages.every(
        (m) => m.email.subject === `Annullamento richiesta di archiviazione`
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
    const messages =
      await handleEServiceArchivingRequestCanceledByDelegateToDelegate({
        eserviceV2Msg: toEServiceV2(eservice),
        logger,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      });

    // 2 users + 1 tenant contact email = 3
    expect(messages.length).toEqual(3);
    expect(
      messages.some(
        (m) =>
          m.type === "Tenant" && m.address === delegateTenant.mails[0].address
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

    const messages =
      await handleEServiceArchivingRequestCanceledByDelegateToDelegate({
        eserviceV2Msg: toEServiceV2(eservice),
        logger,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      });

    expect(messages).toEqual([]);
  });
});

/* eslint-disable functional/immutable-data */
/* eslint-disable sonarjs/no-identical-functions */
import {
  getMockContext,
  getMockDelegation,
  getMockDescriptorPublished,
  getMockEService,
  getMockTenant,
  getMockTenantMail,
} from "pagopa-interop-commons-test";
import {
  CorrelationId,
  EService,
  EServiceId,
  generateId,
  missingKafkaMessageDataError,
  NotificationType,
  Tenant,
  TenantId,
  TenantNotificationConfigId,
  toDelegationV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eServiceNotFound, tenantNotFound } from "../src/models/errors.js";
import { handleProducerDelegationApproved } from "../src/handlers/delegations/handleProducerDelegationApproved.js";
import {
  addOneDelegation,
  addOneEService,
  addOneTenant,
  addOneUser,
  getMockUser,
  readModelService,
  templateService,
  userService,
} from "./utils.js";

describe("handleProducerDelegationApproved", async () => {
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
    mails: [getMockTenantMail()],
  };
  const delegateTenant: Tenant = {
    ...getMockTenant(delegateId),
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
    for (const user of users) {
      await addOneUser(user);
    }
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
          .map((user) => ({ userId: user.id, tenantId: user.tenantId }))
      );
  });

  it("should throw missingKafkaMessageDataError when delegation is undefined", async () => {
    await expect(() =>
      handleProducerDelegationApproved({
        delegationV2Msg: undefined,
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(
      missingKafkaMessageDataError("delegation", "ProducerDelegationApproved")
    );
  });

  it("should throw tenantNotFound when delegate is not found", async () => {
    const unknownProducerDelegateId = generateId<TenantId>();

    const delegation = getMockDelegation({
      kind: "DelegatedProducer",
      delegatorId: delegatorTenant.id,
      delegateId: unknownProducerDelegateId,
      eserviceId: eservice.id,
    });
    await addOneDelegation(delegation);

    await expect(() =>
      handleProducerDelegationApproved({
        delegationV2Msg: toDelegationV2(delegation),
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(tenantNotFound(unknownProducerDelegateId));
  });

  it("should throw tenantNotFound when delegator is not found", async () => {
    const unknownDelegatorId = generateId<TenantId>();

    const delegation = getMockDelegation({
      kind: "DelegatedProducer",
      delegatorId: unknownDelegatorId,
      delegateId: delegateTenant.id,
      eserviceId: eservice.id,
    });
    await addOneDelegation(delegation);

    await expect(() =>
      handleProducerDelegationApproved({
        delegationV2Msg: toDelegationV2(delegation),
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(tenantNotFound(unknownDelegatorId));
  });

  it("should throw eServiceNotFound when eservice is not found", async () => {
    const unknownEServiceId = generateId<EServiceId>();
    const delegation = getMockDelegation({
      kind: "DelegatedProducer",
      delegatorId: delegatorTenant.id,
      delegateId: delegateTenant.id,
      eserviceId: unknownEServiceId,
    });
    await addOneDelegation(delegation);

    await expect(() =>
      handleProducerDelegationApproved({
        delegationV2Msg: toDelegationV2(delegation),
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(eServiceNotFound(unknownEServiceId));
  });

  it("should generate one message per user of the delegator", async () => {
    const delegation = getMockDelegation({
      kind: "DelegatedProducer",
      delegatorId: delegatorTenant.id,
      delegateId: delegateTenant.id,
      eserviceId: eservice.id,
    });
    await addOneDelegation(delegation);

    const messages = await handleProducerDelegationApproved({
      delegationV2Msg: toDelegationV2(delegation),
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toEqual(2);
    expect(messages.some((message) => message.address === users[0].email)).toBe(
      true
    );
    expect(messages.some((message) => message.address === users[1].email)).toBe(
      true
    );
  });

  it("should not generate a message if the user disabled this email notification", async () => {
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue([
        { userId: users[0].id, tenantId: users[0].tenantId },
      ]);

    const delegation = getMockDelegation({
      kind: "DelegatedProducer",
      delegatorId: delegatorTenant.id,
      delegateId: delegateTenant.id,
      eserviceId: eservice.id,
    });
    await addOneDelegation(delegation);

    const messages = await handleProducerDelegationApproved({
      delegationV2Msg: toDelegationV2(delegation),
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toEqual(1);
    expect(messages.some((message) => message.address === users[0].email)).toBe(
      true
    );
    expect(messages.some((message) => message.address === users[1].email)).toBe(
      false
    );
  });

  it("should generate a complete and correct message", async () => {
    const delegation = getMockDelegation({
      kind: "DelegatedProducer",
      delegatorId: delegatorTenant.id,
      delegateId: delegateTenant.id,
      eserviceId: eservice.id,
    });
    await addOneDelegation(delegation);

    const messages = await handleProducerDelegationApproved({
      delegationV2Msg: toDelegationV2(delegation),
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toBe(2);
    messages.forEach((message) => {
      expect(message.email.body).toContain("<!-- Footer -->");
      expect(message.email.body).toContain("<!-- Title & Main Message -->");
      expect(message.email.body).toContain(
        `La tua richiesta di delega è stata accettata`
      );
      expect(message.email.body).toContain(delegatorTenant.name);
      expect(message.email.body).toContain(delegateTenant.name);
      expect(message.email.body).toContain(eservice.name);
    });
  });
});

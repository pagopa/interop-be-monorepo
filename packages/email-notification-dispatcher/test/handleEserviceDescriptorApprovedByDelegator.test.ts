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
  Delegation,
  delegationState,
  EServiceId,
  generateId,
  missingKafkaMessageDataError,
  Tenant,
  TenantId,
  TenantNotificationConfigId,
  unsafeBrandId,
  NotificationType,
  EService,
  toEServiceV2,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { match } from "ts-pattern";
import { tenantNotFound } from "../src/models/errors.js";
import { handleEserviceDescriptorApprovedByDelegator } from "../src/handlers/eservices/handleEserviceDescriptorApprovedByDelegator.js";
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

describe("handleEserviceDescriptorApprovedByDelegator", async () => {
  const delegatorId = generateId<TenantId>();
  const delegateId = generateId<TenantId>();

  const descriptor = getMockDescriptorPublished();
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
    getMockUser(delegatorTenant.id),
    getMockUser(delegatorTenant.id),
  ];
  const eservice = {
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
    await addOneEService(eservice);
    await addOneDelegation(delegation);
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

  it("should throw missingKafkaMessageDataError when eservice is undefined", async () => {
    await expect(() =>
      handleEserviceDescriptorApprovedByDelegator({
        eserviceV2Msg: undefined,
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(
      missingKafkaMessageDataError(
        "eservice",
        "EServiceDescriptorApprovedByDelegator"
      )
    );
  });

  it("should throw tenantNotFound when delegator is not found", async () => {
    const unkonwnDelegatorId = generateId<TenantId>();

    const eserviceWithUnknownDelegator: EService = {
      ...getMockEService(),
      id: generateId<EServiceId>(),
      producerId: unkonwnDelegatorId,
      descriptors: [getMockDescriptorPublished()],
    };
    await addOneEService(eserviceWithUnknownDelegator);

    const delegationWithUnknownDelegate: Delegation = getMockDelegation({
      kind: "DelegatedProducer",
      eserviceId: eserviceWithUnknownDelegator.id,
      delegatorId: unkonwnDelegatorId,
      delegateId,
      state: delegationState.active,
    });
    await addOneDelegation(delegationWithUnknownDelegate);

    await expect(() =>
      handleEserviceDescriptorApprovedByDelegator({
        eserviceV2Msg: toEServiceV2(eserviceWithUnknownDelegator),
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(tenantNotFound(unkonwnDelegatorId));
  });

  it("should throw tenantNotFound when delegate is not found", async () => {
    const unkonwnDelegateId = generateId<TenantId>();

    const eserviceWithUnknownDelegate: EService = {
      ...getMockEService(),
      id: generateId<EServiceId>(),
      producerId: delegatorId,
      descriptors: [getMockDescriptorPublished()],
    };
    await addOneEService(eserviceWithUnknownDelegate);

    const delegationWithUnknownDelegate: Delegation = getMockDelegation({
      kind: "DelegatedProducer",
      eserviceId: eserviceWithUnknownDelegate.id,
      delegatorId,
      delegateId: unkonwnDelegateId,
      state: delegationState.active,
    });
    await addOneDelegation(delegationWithUnknownDelegate);

    await expect(() =>
      handleEserviceDescriptorApprovedByDelegator({
        eserviceV2Msg: toEServiceV2(eserviceWithUnknownDelegate),
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(tenantNotFound(unkonwnDelegateId));
  });

  it("should generate one message per user of the delegate", async () => {
    const messages = await handleEserviceDescriptorApprovedByDelegator({
      eserviceV2Msg: toEServiceV2(eservice),
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toEqual(2);
    expect(
      messages.some(
        (message) => message.type === "User" && message.userId === users[0].id
      )
    ).toBe(true);
    expect(
      messages.some(
        (message) => message.type === "User" && message.userId === users[1].id
      )
    ).toBe(true);
  });

  it("should not generate a message if the user disabled this email notification", async () => {
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue([
        { userId: users[0].id, tenantId: users[0].tenantId },
      ]);

    const messages = await handleEserviceDescriptorApprovedByDelegator({
      eserviceV2Msg: toEServiceV2(eservice),
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toEqual(1);
    expect(
      messages.some(
        (message) => message.type === "User" && message.userId === users[0].id
      )
    ).toBe(true);
    expect(
      messages.some(
        (message) => message.type === "User" && message.userId === users[1].id
      )
    ).toBe(false);
  });

  it("should generate a complete and correct message", async () => {
    const messages = await handleEserviceDescriptorApprovedByDelegator({
      eserviceV2Msg: toEServiceV2(eservice),
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });
    expect(messages.length).toBe(2);
    messages.forEach((message) => {
      expect(message.email.body).toContain("<!-- Title & Main Message -->");
      expect(message.email.body).toContain("<!-- Footer -->");
      expect(message.email.body).toContain(
        `Approvata la pubblicazione della nuova versione`
      );
      match(message.type)
        .with("User", () => {
          expect(message.email.body).toContain("{{ recipientName }}");
          expect(message.email.body).toContain(delegatorTenant.name);
          expect(message.email.body).toContain(eservice.name);
        })
        .with("Tenant", () => {
          expect(message.email.body).toContain(delegatorTenant.name);
          expect(message.email.body).toContain(delegateTenant.name);
          expect(message.email.body).toContain(eservice.name);
        })
        .exhaustive();
    });
  });
});

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
  TenantId,
  TenantNotificationConfigId,
  toEServiceV2,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantNotFound } from "../src/models/errors.js";
import { handleEserviceDescriptorSubmittedByDelegate } from "../src/handlers/eservices/handleEserviceDescriptorSubmittedByDelegate.js";
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

describe("handleEServiceDescriptorSubmittedByDelegate", async () => {
  const delegatorId = generateId<TenantId>();
  const delegateId = generateId<TenantId>();

  const descriptor = getMockDescriptorPublished();
  const delegatorTenant = {
    ...getMockTenant(delegatorId),
    mails: [getMockTenantMail()],
  };
  const delegateTenant = getMockTenant(delegateId);
  const users = [
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
      .mockReturnValueOnce(
        users.map((user) => ({ userId: user.id, tenantId: user.tenantId }))
      );
  });

  it("should throw missingKafkaMessageDataError when eservice is undefined", async () => {
    await expect(() =>
      handleEserviceDescriptorSubmittedByDelegate({
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
        "EServiceDescriptorPublishedByDelegate"
      )
    );
  });

  it("should throw tenantNotFound when delegator is not found", async () => {
    const unkonwnDelegatorId = generateId<TenantId>();

    const eserviceWithUnknownDelegator = {
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
      handleEserviceDescriptorSubmittedByDelegate({
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

    const eserviceWithUnknownDelegate = {
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
      handleEserviceDescriptorSubmittedByDelegate({
        eserviceV2Msg: toEServiceV2(eserviceWithUnknownDelegate),
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(tenantNotFound(unkonwnDelegateId));
  });

  it("should generate one message per user of the delegator", async () => {
    const messages = await handleEserviceDescriptorSubmittedByDelegate({
      eserviceV2Msg: toEServiceV2(eservice),
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toEqual(3);
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

    const messages = await handleEserviceDescriptorSubmittedByDelegate({
      eserviceV2Msg: toEServiceV2(eservice),
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
      false
    );
  });

  it("should generate one message to the delegator", async () => {
    const messages = await handleEserviceDescriptorSubmittedByDelegate({
      eserviceV2Msg: toEServiceV2(eservice),
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toEqual(3);
    expect(
      messages.some(
        (message) => message.address === delegatorTenant.mails[0].address
      )
    ).toBe(true);
  });

  it("should generate a message using the latest tenant mail that was registered", async () => {
    const oldMail = { ...getMockTenantMail(), createdAt: new Date(1999) };
    const newMail = getMockTenantMail();
    const delegatorTenantWithMultipleMails = {
      ...getMockTenant(),
      mails: [oldMail, newMail],
    };
    await addOneTenant(delegatorTenantWithMultipleMails);

    const eserviceMultipleMails = {
      ...getMockEService(),
      id: generateId<EServiceId>(),
      producerId: delegatorTenantWithMultipleMails.id,
      descriptors: [getMockDescriptorPublished()],
    };
    await addOneEService(eserviceMultipleMails);

    const delegationMultipleMails = getMockDelegation({
      kind: "DelegatedProducer",
      eserviceId: eserviceMultipleMails.id,
      delegatorId: delegatorTenantWithMultipleMails.id,
      delegateId,
      state: delegationState.active,
    });
    await addOneDelegation(delegationMultipleMails);

    const messages = await handleEserviceDescriptorSubmittedByDelegate({
      eserviceV2Msg: toEServiceV2(eserviceMultipleMails),
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toEqual(3);
    expect(
      messages.some((message) => message.address === newMail.address)
    ).toBe(true);
  });

  it("should not generate a message to the delegator if they disabled email notification", async () => {
    readModelService.getTenantNotificationConfigByTenantId = vi
      .fn()
      .mockResolvedValue({
        id: generateId<TenantNotificationConfigId>(),
        tenantId: delegatorTenant.id,
        enabled: false,
        createAt: new Date(),
      });

    const messages = await handleEserviceDescriptorSubmittedByDelegate({
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
        (message) => message.address === delegatorTenant.mails[0].address
      )
    ).toBe(false);
  });

  it("should generate a complete and correct message", async () => {
    const messages = await handleEserviceDescriptorSubmittedByDelegate({
      eserviceV2Msg: toEServiceV2(eservice),
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });
    expect(messages.length).toBe(3);
    messages.forEach((message) => {
      expect(message.email.body).toContain("<!-- Title & Main Message -->");
      expect(message.email.body).toContain("<!-- Footer -->");
      expect(message.email.body).toContain(
        `Richiesta di approvazione per una nuova versione`
      );
      expect(message.email.body).toContain(delegatorTenant.name);
      expect(message.email.body).toContain(delegateTenant.name);
      expect(message.email.body).toContain(eservice.name);
    });
  });
});

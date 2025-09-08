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
  const producerId = generateId<TenantId>();
  const consumerId = generateId<TenantId>();
  const delegateId = generateId<TenantId>();

  const descriptor = getMockDescriptorPublished();
  const producerTenant = {
    ...getMockTenant(producerId),
    mails: [getMockTenantMail()],
  };
  const consumerTenant = getMockTenant(consumerId);
  const delegateTenant = getMockTenant(delegateId);
  const users = [
    getMockUser(producerTenant.id),
    getMockUser(producerTenant.id),
  ];
  const eservice = {
    ...getMockEService(),
    id: generateId<EServiceId>(),
    producerId,
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
    await addOneTenant(consumerTenant);
    await addOneTenant(delegateTenant);
    for (const user of users) {
      await addOneUser(user);
    }
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
      .mockReturnValueOnce(
        users.map((user) => ({ userId: user.id, tenantId: user.tenantId }))
      );
  });

  it("should throw missingKafkaMessageDataError when agreement is undefined", async () => {
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

  it("should throw tenantNotFound when producer is not found", async () => {
    const unkonwnProducerId = generateId<TenantId>();

    const eserviceWithUnknownProducer = {
      ...getMockEService(),
      id: generateId<EServiceId>(),
      producerId: unkonwnProducerId,
      descriptors: [getMockDescriptorPublished()],
    };
    await addOneEService(eserviceWithUnknownProducer);

    await expect(() =>
      handleEserviceDescriptorSubmittedByDelegate({
        eserviceV2Msg: toEServiceV2(eserviceWithUnknownProducer),
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(tenantNotFound(unkonwnProducerId));
  });

  it("should throw tenantNotFound when delegate is not found", async () => {
    const unkonwnDelegateId = generateId<TenantId>();

    const eserviceWithUnknownDelegate = {
      ...getMockEService(),
      id: generateId<EServiceId>(),
      producerId,
      descriptors: [getMockDescriptorPublished()],
    };
    await addOneEService(eserviceWithUnknownDelegate);

    const delegationWithUnknownDelegate: Delegation = getMockDelegation({
      kind: "DelegatedProducer",
      eserviceId: eserviceWithUnknownDelegate.id,
      delegatorId: producerId,
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

  it("should generate one message per user of the tenant that consumed the eservice", async () => {
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
        (message) => message.address === producerTenant.mails[0].address
      )
    ).toBe(true);
  });

  it("should generate a message using the latest consumer mail that was registered", async () => {
    const oldMail = { ...getMockTenantMail(), createdAt: new Date(1999) };
    const newMail = getMockTenantMail();
    const producerTenantWithMultipleMails = {
      ...getMockTenant(),
      mails: [oldMail, newMail],
    };
    await addOneTenant(producerTenantWithMultipleMails);

    const eserviceMultipleMails = {
      ...getMockEService(),
      id: generateId<EServiceId>(),
      producerId: producerTenantWithMultipleMails.id,
      descriptors: [getMockDescriptorPublished()],
    };
    await addOneEService(eserviceMultipleMails);

    const delegationMultipleMails = getMockDelegation({
      kind: "DelegatedProducer",
      eserviceId: eserviceMultipleMails.id,
      delegatorId: producerTenantWithMultipleMails.id,
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

  it("should not generate a message to the consumer if they disabled email notification", async () => {
    readModelService.getTenantNotificationConfigByTenantId = vi
      .fn()
      .mockResolvedValue({
        id: generateId<TenantNotificationConfigId>(),
        tenantId: producerTenant.id,
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
        (message) => message.address === producerTenant.mails[0].address
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
      // expect(message.email.body).toContain(delegateTenant.name);
      expect(message.email.body).toContain(eservice.name);
    });
  });
});

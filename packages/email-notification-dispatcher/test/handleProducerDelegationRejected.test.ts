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
  EServiceId,
  generateId,
  missingKafkaMessageDataError,
  NotificationType,
  TenantId,
  TenantNotificationConfigId,
  toDelegationV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eServiceNotFound, tenantNotFound } from "../src/models/errors.js";
import { handleProducerDelegationRejected } from "../src/handlers/delegations/handleProducerDelegationRejected.js";
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

describe("handleProducerDelegationRejected", async () => {
  const producerId = generateId<TenantId>();
  const consumerId = generateId<TenantId>();
  const eserviceId = generateId<EServiceId>();

  const descriptor = getMockDescriptorPublished();
  const eservice = {
    ...getMockEService(),
    id: eserviceId,
    producerId,
    descriptors: [descriptor],
  };
  const producerTenant = {
    ...getMockTenant(producerId),
    mails: [getMockTenantMail()],
  };
  const consumerTenant = {
    ...getMockTenant(consumerId),
    mails: [getMockTenantMail()],
  };
  const users = [
    getMockUser(producerTenant.id),
    getMockUser(producerTenant.id),
    getMockUser(consumerTenant.id),
    getMockUser(consumerTenant.id),
  ];

  const { logger } = getMockContext({});

  beforeEach(async () => {
    await addOneEService(eservice);
    await addOneTenant(producerTenant);
    await addOneTenant(consumerTenant);
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
      handleProducerDelegationRejected({
        delegationV2Msg: undefined,
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(
      missingKafkaMessageDataError("delegation", "ProducerDelegationRejected")
    );
  });

  it("should throw tenantNotFound when producer is not found", async () => {
    const unknownProducerDelegateId = generateId<TenantId>();

    const delegationToProducer = getMockDelegation({
      kind: "DelegatedProducer",
      delegateId: unknownProducerDelegateId,
    });
    await addOneDelegation(delegationToProducer);

    await expect(() =>
      handleProducerDelegationRejected({
        delegationV2Msg: toDelegationV2(delegationToProducer),
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(tenantNotFound(unknownProducerDelegateId));
  });

  it("should throw eServiceNotFound when eservice is not found", async () => {
    const unknownEServiceId = generateId<EServiceId>();
    const delegation = getMockDelegation({
      kind: "DelegatedProducer",
      delegateId: producerTenant.id,
      eserviceId: unknownEServiceId,
    });
    await addOneDelegation(delegation);

    await expect(() =>
      handleProducerDelegationRejected({
        delegationV2Msg: toDelegationV2(delegation),
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(eServiceNotFound(unknownEServiceId));
  });

  it("should generate one message per user of the producer", async () => {
    const delegation = getMockDelegation({
      kind: "DelegatedProducer",
      delegateId: producerTenant.id,
      eserviceId: eservice.id,
    });
    await addOneDelegation(delegation);

    const messages = await handleProducerDelegationRejected({
      delegationV2Msg: toDelegationV2(delegation),
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
        { userId: users[2].id, tenantId: users[2].tenantId },
      ]);

    const delegation = getMockDelegation({
      kind: "DelegatedProducer",
      delegateId: producerTenant.id,
      eserviceId: eservice.id,
    });
    await addOneDelegation(delegation);

    const messages = await handleProducerDelegationRejected({
      delegationV2Msg: toDelegationV2(delegation),
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toEqual(2);
    expect(messages.some((message) => message.address === users[2].email)).toBe(
      true
    );
    expect(messages.some((message) => message.address === users[3].email)).toBe(
      false
    );
  });

  it("should generate one message to the producer delegate", async () => {
    const delegation = getMockDelegation({
      kind: "DelegatedProducer",
      delegateId: producerTenant.id,
      eserviceId: eservice.id,
    });
    await addOneDelegation(delegation);

    const messages = await handleProducerDelegationRejected({
      delegationV2Msg: toDelegationV2(delegation),
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

  it("should generate a message using the latest producer mail that was registered", async () => {
    const oldMail = { ...getMockTenantMail(), createdAt: new Date(1999) };
    const newMail = getMockTenantMail();
    const producerTenantWithMultipleMails = {
      ...getMockTenant(),
      mails: [oldMail, newMail],
    };
    await addOneTenant(producerTenantWithMultipleMails);

    const delegation = getMockDelegation({
      kind: "DelegatedProducer",
      delegateId: producerTenantWithMultipleMails.id,
      eserviceId: eservice.id,
    });
    await addOneDelegation(delegation);

    const messages = await handleProducerDelegationRejected({
      delegationV2Msg: toDelegationV2(delegation),
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toEqual(1);
    expect(
      messages.some((message) => message.address === newMail.address)
    ).toBe(true);
  });

  it("should not generate a message to the producer if they disabled email notification", async () => {
    readModelService.getTenantNotificationConfigByTenantId = vi
      .fn()
      .mockResolvedValue({
        id: generateId<TenantNotificationConfigId>(),
        tenantId: producerTenant.id,
        enabled: false,
        createAt: new Date(),
      });

    const delegation = getMockDelegation({
      kind: "DelegatedProducer",
      delegateId: producerTenant.id,
      eserviceId: eservice.id,
    });
    await addOneDelegation(delegation);

    const messages = await handleProducerDelegationRejected({
      delegationV2Msg: toDelegationV2(delegation),
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
    const delegation = getMockDelegation({
      kind: "DelegatedProducer",
      delegateId: producerTenant.id,
      eserviceId: eservice.id,
    });
    await addOneDelegation(delegation);

    const messages = await handleProducerDelegationRejected({
      delegationV2Msg: toDelegationV2(delegation),
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });

    expect(messages.length).toBe(3);
    messages.forEach((message) => {
      expect(message.email.body).toContain("<!-- Footer -->");
      expect(message.email.body).toContain("<!-- Title & Main Message -->");
      expect(message.email.body).toContain(
        `La tua richiesta di delega è stata rifiutata`
      );
      expect(message.email.body).toContain(producerTenant.name);
      expect(message.email.body).toContain(eservice.name);
    });
  });
});

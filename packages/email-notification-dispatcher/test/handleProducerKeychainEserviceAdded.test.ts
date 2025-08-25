/* eslint-disable functional/immutable-data */
/* eslint-disable sonarjs/no-identical-functions */
import {
  getMockAgreement,
  getMockContext,
  getMockDescriptorPublished,
  getMockEService,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  agreementState,
  CorrelationId,
  EServiceId,
  generateId,
  TenantId,
  UserId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  descriptorPublishedNotFound,
  eServiceNotFound,
} from "../src/models/errors.js";
import { handleProducerKeychainEserviceAdded } from "../src/handlers/authorization/handleProducerKeychainEserviceAdded.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  getMockUser,
  readModelService,
  templateService,
} from "./utils.js";

describe("handleProducerKeychainEserviceAdded", async () => {
  const producerId = generateId<TenantId>();
  const consumerId = generateId<TenantId>();
  const eserviceId = generateId<EServiceId>();

  const descriptor = getMockDescriptorPublished();
  const eservice = {
    ...getMockEService(),
    id: eserviceId,
    producerId,
    consumerId,
    descriptors: [descriptor],
  };
  const producerTenant = getMockTenant(producerId);
  const consumerTenant = getMockTenant(consumerId);
  const users = [
    getMockUser(consumerTenant.id),
    getMockUser(consumerTenant.id),
  ];

  const userService = {
    readUser: vi.fn(),
  };
  const { logger } = getMockContext({});

  beforeEach(async () => {
    await addOneEService(eservice);
    await addOneTenant(producerTenant);
    await addOneTenant(consumerTenant);
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockReturnValueOnce(
        users.map((user) => ({ userId: user.userId, tenantId: user.tenantId }))
      );
    userService.readUser.mockImplementation((userId) =>
      users.find((user) => user.userId === userId)
    );
  });

  it("should throw eServiceNotFound when eservice is not found", async () => {
    const eserviceId = generateId<EServiceId>();
    await expect(() =>
      handleProducerKeychainEserviceAdded({
        eserviceId,
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(eServiceNotFound(eserviceId));
  });

  it("should throw descriptorPublishedNotFound when descriptor is not found", async () => {
    const eserviceNoDescriptor = { ...getMockEService(), descriptors: [] };
    await addOneEService(eserviceNoDescriptor);

    const agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      stamps: { activation: { when: new Date(), who: generateId<UserId>() } },
      producerId: producerTenant.id,
      eserviceId: eserviceNoDescriptor.id,
      consumerId: consumerTenant.id,
    };
    await addOneAgreement(agreement);

    await expect(() =>
      handleProducerKeychainEserviceAdded({
        eserviceId: eserviceNoDescriptor.id,
        logger,
        templateService,
        userService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(descriptorPublishedNotFound(agreement.eserviceId));
  });

  it("should return empty array if no consumer is present for the eservice", async () => {
    const messages = await handleProducerKeychainEserviceAdded({
      eserviceId: eservice.id,
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });
    expect(messages.length).toEqual(0);
  });

  it("should generate one message per user of the consumers of the eservice", async () => {
    const agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      stamps: { activation: { when: new Date(), who: generateId<UserId>() } },
      producerId: producerTenant.id,
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId: consumerTenant.id,
    };
    await addOneAgreement(agreement);

    const messages = await handleProducerKeychainEserviceAdded({
      eserviceId: eservice.id,
      logger,
      templateService,
      userService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });
    expect(messages.length).toEqual(2);
    expect(messages[0].address).toEqual(users[0].email);
    expect(messages[1].address).toEqual(users[1].email);
  });

  it("should not generate a message if the user disabled this email notification", async () => {
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue([users[0]]);

    const agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      stamps: { activation: { when: new Date(), who: generateId<UserId>() } },
      producerId: producerTenant.id,
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId: consumerTenant.id,
    };
    await addOneAgreement(agreement);

    const messages = await handleProducerKeychainEserviceAdded({
      eserviceId: eservice.id,
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
    const activationDate = new Date();
    const agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      stamps: {
        activation: { when: activationDate, who: generateId<UserId>() },
      },
      producerId: producerTenant.id,
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId: consumerTenant.id,
    };
    await addOneAgreement(agreement);

    const messages = await handleProducerKeychainEserviceAdded({
      eserviceId: eservice.id,
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
      expect(message.email.body).toContain(`Nuovo portachiavi di un e-service`);
    });
  });
});

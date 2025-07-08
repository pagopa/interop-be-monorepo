import { describe, it, expect, vi } from "vitest";
import {
  getMockContext,
  getMockEService,
  getMockDescriptorPublished,
  getMockAgreement,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  agreementState,
  generateId,
  missingKafkaMessageDataError,
  TenantId,
  toEServiceV2,
} from "pagopa-interop-models";
import { config } from "../src/config/config.js";
import { handleNewEServiceVersionPublished } from "../src/handlers/handleNewEServiceVersionPublished.js";
import { tenantNotFound } from "../src/models/errors.js";
import { inAppTemplates } from "../src/templates/inAppTemplates.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  readModelService,
} from "./utils.js";

describe("handleNewEServiceVersionPublished", async () => {
  const eservice = {
    ...getMockEService(),
    producerId: generateId<TenantId>(),
    descriptors: [getMockDescriptorPublished()],
  };
  const { logger } = getMockContext({});
  await addOneEService(eservice);

  it("should throw missingKafkaMessageDataError when eservice is undefined", async () => {
    await expect(() =>
      handleNewEServiceVersionPublished(undefined, logger, readModelService)
    ).rejects.toThrow(
      missingKafkaMessageDataError("eservice", "EServiceDescriptorPublished")
    );
  });

  it("should return empty array when no agreements exist for the eservice", async () => {
    const notifications = await handleNewEServiceVersionPublished(
      toEServiceV2(eservice),
      logger,
      readModelService
    );
    expect(notifications).toEqual([]);
  });

  it("should throw tenantNotFound when tenant is not found", async () => {
    const consumerId = generateId<TenantId>();
    const agreement = getMockAgreement(
      eservice.id,
      consumerId,
      agreementState.active
    );
    await addOneAgreement(agreement);

    await expect(() =>
      handleNewEServiceVersionPublished(
        toEServiceV2(eservice),
        logger,
        readModelService
      )
    ).rejects.toThrow(tenantNotFound(consumerId));
  });

  it("should return notifications when user notification configs exist for the eservice", async () => {
    const consumerId = generateId<TenantId>();
    const consumerTenant = getMockTenant(consumerId);
    const agreement = getMockAgreement(
      eservice.id,
      consumerId,
      agreementState.active
    );
    await addOneAgreement(agreement);
    await addOneTenant(consumerTenant);

    const userId = generateId();
    // eslint-disable-next-line functional/immutable-data
    readModelService.getUserNotificationConfigsByTenantIds = vi
      .fn()
      .mockResolvedValue([
        {
          userId,
          tenantId: consumerId,
        },
      ]);

    const notifications = await handleNewEServiceVersionPublished(
      toEServiceV2(eservice),
      logger,
      readModelService
    );

    const body = inAppTemplates.newEServiceVersionPublished(eservice.name);
    expect(notifications).toEqual([
      {
        id: expect.any(String),
        createdAt: expect.any(Date),
        userId,
        tenantId: consumerId,
        body,
        deepLink: `https://${config.interopFeBaseUrl}/ui/it/fruizione/catalogo-e-service/${eservice.id}/${eservice.descriptors[0].id}`,
        readAt: undefined,
      },
    ]);
  });

  it("should return empty array when no user notification configs exist for the eservice", async () => {
    const consumerId = generateId<TenantId>();
    const consumerTenant = getMockTenant(consumerId);
    const agreement = getMockAgreement(
      eservice.id,
      consumerId,
      agreementState.active
    );
    await addOneAgreement(agreement);
    await addOneTenant(consumerTenant);

    // eslint-disable-next-line functional/immutable-data
    readModelService.getUserNotificationConfigsByTenantIds = vi
      .fn()
      .mockResolvedValue([]);

    const notifications = await handleNewEServiceVersionPublished(
      toEServiceV2(eservice),
      logger,
      readModelService
    );

    expect(notifications).toEqual([]);
  });
});

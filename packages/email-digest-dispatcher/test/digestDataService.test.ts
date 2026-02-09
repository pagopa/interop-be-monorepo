import { describe, test, expect } from "vitest";
import {
  TenantId,
  CorrelationId,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { logger } from "pagopa-interop-commons";
import { digestDataServiceBuilder } from "../src/services/digestDataService.js";
import {
  readModelService,
  addOneTenant,
  addOneEService,
  addOneAgreement,
  createMockTenant,
  createMockAgreement,
  createRecentPublishedEService,
} from "./integrationUtils.js";

// One of the hardcoded PRIORITY_PRODUCER_IDS from digestDataService
const KNOWN_PRIORITY_PRODUCER_ID = unsafeBrandId<TenantId>(
  "bce8d16d-d26f-4c35-a835-35cca48ff8a5"
);

describe("digestDataService - priority producers", () => {
  test("should prioritize new e-services from priority producers over regular producers with more agreements", async () => {
    const log = logger({
      serviceName: "email-notification-digest-test",
      correlationId: generateId<CorrelationId>(),
    });
    const digestDataService = digestDataServiceBuilder(readModelService, log);

    // Create the consumer tenant (the one receiving the digest)
    const consumer = createMockTenant({ selfcareId: "test-selfcare-id" });
    await addOneTenant(consumer);

    // Create a priority producer using one of the hardcoded IDs
    const priorityProducer = createMockTenant({
      id: KNOWN_PRIORITY_PRODUCER_ID,
    });
    await addOneTenant(priorityProducer);

    // Create a regular (non-priority) producer
    const regularProducer = createMockTenant();
    await addOneTenant(regularProducer);

    // Create e-services from both producers
    const { eservice: priorityEservice } = createRecentPublishedEService(
      priorityProducer.id,
      1,
      0
    );
    const { eservice: regularEservice } = createRecentPublishedEService(
      regularProducer.id,
      1,
      0
    );
    await addOneEService(priorityEservice);
    await addOneEService(regularEservice);

    // Add more agreements to the regular producer's e-service
    // so that without priority, it would be ranked first
    const agreementConsumers = Array.from({ length: 10 }, () =>
      createMockTenant()
    );
    for (const agConsumer of agreementConsumers) {
      await addOneTenant(agConsumer);
      const agreement = createMockAgreement(regularEservice.id, agConsumer.id, {
        descriptorId: regularEservice.descriptors[0].id,
        producerId: regularProducer.id,
      });
      await addOneAgreement(agreement);
    }

    const digestData = await digestDataService.getDigestDataForTenant(
      consumer.id
    );

    // The priority producer's e-service should appear before the regular one
    expect(digestData.newEservices).toBeDefined();
    expect(digestData.newEservices?.items.length).toBeGreaterThanOrEqual(2);
    expect(digestData.newEservices?.items[0].producerName).toBe(
      priorityProducer.name
    );
  });
});

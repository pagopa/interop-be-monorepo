import { getMockContext, getMockTenant } from "pagopa-interop-commons-test";
import {
  CorrelationId,
  TenantEventEnvelopeV3,
  TenantEventV3,
  generateId,
  genericInternalError,
  toTenantV3,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

import { handleTenantEvent } from "../src/handlers/tenants/handleTenantEvent.js";
import { readModelService, templateService } from "./utils.js";

const { logger } = getMockContext({});
const correlationId = generateId<CorrelationId>();

// TODO PIN-11282: replace with the V3 handling once the dispatcher supports it
describe("Tenant V3 events should be rejected until supported", () => {
  const tenant = getMockTenant();

  it.each(TenantEventV3.options.map((o) => o.shape.type.value))(
    "should reject the V3 %s tenant event",
    async (eventType: TenantEventV3["type"]) => {
      const decodedMessage = {
        event_version: 3,
        type: eventType,
        data: { tenant: toTenantV3(tenant) },
        sequence_num: 1,
        stream_id: tenant.id,
        version: 1,
        log_date: new Date(),
      } as TenantEventEnvelopeV3;

      await expect(
        handleTenantEvent({
          decodedMessage,
          logger,
          readModelService,
          templateService,
          correlationId,
        })
      ).rejects.toThrowError(
        genericInternalError(`Tenant event V3 not supported yet: ${eventType}`)
      );
    }
  );
});

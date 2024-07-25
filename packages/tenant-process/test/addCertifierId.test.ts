/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  MaintenanceTenantPromotedToCertifierV2,
  Tenant,
  generateId,
  protobufDecoder,
  toTenantV2,
} from "pagopa-interop-models";
import { describe, it, expect, vi, afterAll, beforeAll } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import { readLastEventByStreamId } from "pagopa-interop-commons-test/index.js";
import {
  tenantNotFound,
  tenantIsAlreadyACertifier,
} from "../src/model/domain/errors.js";
import {
  addOneTenant,
  getMockTenant,
  postgresDB,
  tenantService,
} from "./utils.js";

describe("addCertifierId", async () => {
  const certifierId = generateId();

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("should write on event-store for the addition of the certifierId to the tenant", async () => {
    const mockTenant = getMockTenant();
    await addOneTenant(mockTenant);
    const returnedTenant = await tenantService.addCertifierId(
      {
        tenantId: mockTenant.id,
        certifierId,
        correlationId: generateId(),
      },
      genericLogger
    );
    const writtenEvent = await readLastEventByStreamId(
      mockTenant.id,
      "tenant",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: mockTenant.id,
      version: "1",
      type: "MaintenanceTenantPromotedToCertifier",
      event_version: 2,
    });

    const writtenPayload: MaintenanceTenantPromotedToCertifierV2 | undefined =
      protobufDecoder(MaintenanceTenantPromotedToCertifierV2).parse(
        writtenEvent.data
      );

    const expectedTenant: Tenant = {
      ...mockTenant,
      features: [
        {
          type: "PersistentCertifier",
          certifierId,
        },
      ],
      updatedAt: new Date(),
    };

    expect(writtenPayload.tenant).toEqual(toTenantV2(expectedTenant));
    expect(returnedTenant).toEqual(expectedTenant);
  });
  it("Should throw tenantNotFound when tenant doesn't exist", async () => {
    const mockTenant = getMockTenant();

    expect(
      tenantService.addCertifierId(
        {
          tenantId: mockTenant.id,
          certifierId,
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(tenantNotFound(mockTenant.id));
  });
  it("Should throw tenantIsAlreadyACertifier if the organization is a certifier", async () => {
    const certifierTenant: Tenant = {
      ...getMockTenant(),
      features: [
        {
          type: "PersistentCertifier",
          certifierId,
        },
      ],
    };

    await addOneTenant(certifierTenant);
    expect(
      tenantService.addCertifierId(
        {
          tenantId: certifierTenant.id,
          certifierId,
          correlationId: generateId(),
        },
        genericLogger
      )
    ).rejects.toThrowError(
      tenantIsAlreadyACertifier(certifierTenant.id, certifierId)
    );
  });
});

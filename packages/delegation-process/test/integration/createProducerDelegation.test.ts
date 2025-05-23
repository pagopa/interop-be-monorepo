import {
  getMockContext,
  getMockEService,
  getMockTenant,
  getMockAuthData,
} from "pagopa-interop-commons-test";
import { generateId, TenantId } from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import { differentEServiceProducer } from "../../src/model/domain/errors.js";
import { config } from "../../src/config/config.js";
import {
  addOneEservice,
  addOneTenant,
  delegationService,
} from "../integrationUtils.js";

describe("create producer delegation", () => {
  config.delegationsAllowedOrigins = ["IPA", "TEST"];

  it("should throw a differentEServiceProducer error if requester is not Eservice producer", async () => {
    const currentExecutionTime = new Date();
    vi.useFakeTimers();
    vi.setSystemTime(currentExecutionTime);

    const delegatorId = generateId<TenantId>();
    const authData = getMockAuthData(delegatorId);
    const delegator = {
      ...getMockTenant(delegatorId),
      externalId: {
        origin: "IPA",
        value: "test",
      },
    };

    const delegate = {
      ...getMockTenant(),
      features: [
        {
          type: "DelegatedProducer" as const,
          availabilityTimestamp: currentExecutionTime,
        },
      ],
    };
    const eservice = getMockEService();

    await addOneTenant(delegator);
    await addOneTenant(delegate);
    await addOneEservice(eservice);

    await expect(
      delegationService.createProducerDelegation(
        {
          delegateId: delegate.id,
          eserviceId: eservice.id,
        },
        getMockContext({ authData })
      )
    ).rejects.toThrowError(differentEServiceProducer(delegatorId));

    vi.useRealTimers();
  });
});

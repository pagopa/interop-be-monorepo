/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, expect, it } from "vitest";
import {
  Agreement,
  EService,
  EServiceId,
  Purpose,
  PurposeId,
  TenantId,
  agreementState,
  descriptorState,
  generateId,
  purposeVersionState,
} from "pagopa-interop-models";
import {
  getMockAgreement,
  getMockAuthData,
  getMockContext,
  getMockDescriptor,
  getMockEService,
  getMockPurpose,
  getMockPurposeVersion,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  purposeNotFound,
  tenantIsNotTheConsumer,
} from "../../src/model/domain/errors.js";
import {
  addOneAgreement,
  addOneEService,
  addOnePurpose,
  addOneTenant,
  purposeService,
} from "../integrationUtils.js";

describe("getUpdatedDailyCalls", () => {
  it("should return available daily calls for the consumer", async () => {
    const consumerId: TenantId = generateId();
    const producerId: TenantId = generateId();
    const eserviceId: EServiceId = generateId();

    const descriptor = {
      ...getMockDescriptor(descriptorState.published),
      dailyCallsPerConsumer: 100,
      dailyCallsTotal: 1000,
    };
    const eservice: EService = getMockEService(eserviceId, producerId, [
      descriptor,
    ]);
    const agreement: Agreement = {
      ...getMockAgreement(eservice.id, consumerId, agreementState.active),
      descriptorId: descriptor.id,
      producerId,
    };

    const consumerPurpose: Purpose = {
      ...getMockPurpose([
        {
          ...getMockPurposeVersion(purposeVersionState.active),
          dailyCalls: 40,
        },
      ]),
      eserviceId: eservice.id,
      consumerId,
    };
    const anotherConsumerPurpose: Purpose = {
      ...getMockPurpose([
        {
          ...getMockPurposeVersion(purposeVersionState.active),
          dailyCalls: 10,
        },
      ]),
      eserviceId: eservice.id,
      consumerId,
      id: generateId(),
    };
    const otherConsumerPurpose: Purpose = {
      ...getMockPurpose([
        {
          ...getMockPurposeVersion(purposeVersionState.active),
          dailyCalls: 100,
        },
      ]),
      eserviceId: eservice.id,
      consumerId: generateId(),
      id: generateId(),
    };

    await addOneTenant({ ...getMockTenant(consumerId) });
    await addOneEService(eservice);
    await addOneAgreement(agreement);
    await addOnePurpose(consumerPurpose);
    await addOnePurpose(anotherConsumerPurpose);
    await addOnePurpose(otherConsumerPurpose);

    const result = await purposeService.getUpdatedDailyCalls({
      purposeId: consumerPurpose.id,
      ctx: getMockContext({ authData: getMockAuthData(consumerId) }),
    });

    expect(result).toEqual({
      updatedDailyCallsPerConsumer: 50,
      updatedDailyCallsTotal: 850,
    });
  });

  it("should throw purposeNotFound if purpose does not exist", async () => {
    const consumerId: TenantId = generateId();
    const nonExistentPurposeId: PurposeId = generateId();

    await addOneTenant({ ...getMockTenant(consumerId) });

    await expect(
      purposeService.getUpdatedDailyCalls({
        purposeId: nonExistentPurposeId,
        ctx: getMockContext({ authData: getMockAuthData(consumerId) }),
      })
    ).rejects.toThrowError(purposeNotFound(nonExistentPurposeId));
  });

  it("should throw tenantIsNotTheConsumer if the requester is not the consumer", async () => {
    const consumerId: TenantId = generateId();
    const anotherConsumerId: TenantId = generateId();
    const producerId: TenantId = generateId();
    const eserviceId: EServiceId = generateId();

    const descriptor = {
      ...getMockDescriptor(descriptorState.published),
      dailyCallsPerConsumer: 100,
      dailyCallsTotal: 1000,
    };
    const eservice: EService = getMockEService(eserviceId, producerId, [
      descriptor,
    ]);
    const agreement: Agreement = {
      ...getMockAgreement(eservice.id, consumerId, agreementState.active),
      descriptorId: descriptor.id,
      producerId,
    };

    const consumerPurpose: Purpose = {
      ...getMockPurpose([
        {
          ...getMockPurposeVersion(purposeVersionState.active),
          dailyCalls: 40,
        },
      ]),
      eserviceId: eservice.id,
      consumerId,
    };

    await addOneTenant({ ...getMockTenant(consumerId) });
    await addOneTenant({ ...getMockTenant(anotherConsumerId) });
    await addOneEService(eservice);
    await addOneAgreement(agreement);
    await addOnePurpose(consumerPurpose);

    await expect(
      purposeService.getUpdatedDailyCalls({
        purposeId: consumerPurpose.id,
        ctx: getMockContext({ authData: getMockAuthData(anotherConsumerId) }),
      })
    ).rejects.toThrowError(
      tenantIsNotTheConsumer(anotherConsumerId, undefined)
    );
  });
});

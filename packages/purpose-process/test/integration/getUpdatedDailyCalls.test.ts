/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, expect, it } from "vitest";
import {
  Agreement,
  DescriptorId,
  EService,
  EServiceId,
  Purpose,
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
import { descriptorNotFound } from "../../src/model/domain/errors.js";
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
      eserviceId: eservice.id,
      descriptorId: descriptor.id,
      ctx: getMockContext({ authData: getMockAuthData(consumerId) }),
    });

    expect(result).toEqual({
      eserviceId: eservice.id,
      descriptorId: descriptor.id,
      updatedDailyCallsPerConsumer: 50,
      updatedDailyCallsTotal: 850,
    });
  });

  it("should throw descriptorNotFound if descriptor does not match active agreement", async () => {
    const consumerId: TenantId = generateId();
    const producerId: TenantId = generateId();
    const eserviceId: EServiceId = generateId();

    const descriptor = getMockDescriptor(descriptorState.published);
    const eservice: EService = getMockEService(eserviceId, producerId, [
      descriptor,
    ]);
    const agreement: Agreement = {
      ...getMockAgreement(eservice.id, consumerId, agreementState.active),
      descriptorId: descriptor.id,
      producerId,
    };

    await addOneTenant({ ...getMockTenant(consumerId) });
    await addOneEService(eservice);
    await addOneAgreement(agreement);

    const wrongDescriptorId: DescriptorId = generateId();

    await expect(
      purposeService.getUpdatedDailyCalls({
        eserviceId: eservice.id,
        descriptorId: wrongDescriptorId,
        ctx: getMockContext({ authData: getMockAuthData(consumerId) }),
      })
    ).rejects.toThrowError(descriptorNotFound(eservice.id, wrongDescriptorId));
  });
});

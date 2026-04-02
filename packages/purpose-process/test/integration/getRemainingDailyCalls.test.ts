/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, expect, it } from "vitest";
import {
  Agreement,
  AttributeId,
  EService,
  EServiceId,
  Purpose,
  PurposeId,
  TenantId,
  agreementState,
  descriptorState,
  generateId,
  purposeVersionState,
  tenantAttributeType,
  unsafeBrandId,
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

describe("getRemainingDailyCalls", () => {
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

    const result = await purposeService.getRemainingDailyCalls({
      purposeId: consumerPurpose.id,
      ctx: getMockContext({ authData: getMockAuthData(consumerId) }),
    });

    expect(result).toEqual({
      remainingDailyCallsPerConsumer: 50,
      remainingDailyCallsTotal: 850,
    });
  });

  it("should throw purposeNotFound if purpose does not exist", async () => {
    const consumerId: TenantId = generateId();
    const nonExistentPurposeId: PurposeId = generateId();

    await addOneTenant({ ...getMockTenant(consumerId) });

    await expect(
      purposeService.getRemainingDailyCalls({
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
      purposeService.getRemainingDailyCalls({
        purposeId: consumerPurpose.id,
        ctx: getMockContext({ authData: getMockAuthData(anotherConsumerId) }),
      })
    ).rejects.toThrowError(
      tenantIsNotTheConsumer(anotherConsumerId, undefined)
    );
  });

  it("should return remaining daily calls using base descriptor quota when the consumer agreement is suspended after certified attribute revocation", async () => {
    const consumerId: TenantId = generateId();
    const producerId: TenantId = generateId();
    const eserviceId: EServiceId = generateId();
    const certifiedAttributeId = unsafeBrandId<AttributeId>(generateId());

    const descriptor = {
      ...getMockDescriptor(descriptorState.published),
      dailyCallsPerConsumer: 10,
      dailyCallsTotal: 1000,
      attributes: {
        certified: [
          [
            {
              id: certifiedAttributeId,
              explicitAttributeVerification: false,
              dailyCallsPerConsumer: 100,
            },
          ],
        ],
        declared: [],
        verified: [],
      },
    };

    const eservice: EService = getMockEService(eserviceId, producerId, [
      descriptor,
    ]);

    const suspendedAgreement: Agreement = {
      ...getMockAgreement(eservice.id, consumerId, agreementState.suspended),
      descriptorId: descriptor.id,
      producerId,
    };

    // Attribute has been revoked: revocationTimestamp is set
    const consumerTenant = {
      ...getMockTenant(consumerId),
      attributes: [
        {
          id: certifiedAttributeId,
          type: tenantAttributeType.CERTIFIED,
          assignmentTimestamp: new Date(),
          revocationTimestamp: new Date(),
        },
      ],
    };

    const consumerPurpose: Purpose = {
      ...getMockPurpose([
        {
          ...getMockPurposeVersion(purposeVersionState.active),
          dailyCalls: 11,
        },
      ]),
      eserviceId: eservice.id,
      consumerId,
    };

    await addOneTenant(consumerTenant);
    await addOneEService(eservice);
    await addOneAgreement(suspendedAgreement);
    await addOnePurpose(consumerPurpose);

    const result = await purposeService.getRemainingDailyCalls({
      purposeId: consumerPurpose.id,
      ctx: getMockContext({ authData: getMockAuthData(consumerId) }),
    });

    expect(result).toEqual({
      remainingDailyCallsPerConsumer: 0,
      remainingDailyCallsTotal: 989,
    });
  });
});

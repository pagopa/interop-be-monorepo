/* eslint-disable @typescript-eslint/no-floating-promises */
import { afterEach, describe, expect, it } from "vitest";
import {
  Agreement,
  AttributeId,
  EService,
  EServiceId,
  Purpose,
  PurposeId,
  TenantId,
  agreementState,
  attributeCertifiedDiscreteComparator,
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
import { config } from "../../src/config/config.js";
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

  describe("certified discrete attributes (PIN-10337)", () => {
    afterEach(() => {
      config.featureFlagAttributeCertifiedDiscrete = false;
    });

    const setupDiscreteScenario = async ({
      threshold,
      discreteValue,
      differentiatedDailyCalls,
    }: {
      threshold: number;
      discreteValue: number;
      differentiatedDailyCalls: number;
    }): Promise<{ purposeId: PurposeId; consumerId: TenantId }> => {
      const consumerId: TenantId = generateId();
      const producerId: TenantId = generateId();
      const eserviceId: EServiceId = generateId();
      const attributeId: AttributeId = generateId();

      const descriptor = {
        ...getMockDescriptor(descriptorState.published),
        dailyCallsPerConsumer: 100,
        dailyCallsTotal: 1000,
        attributes: {
          certified: [
            [
              {
                id: attributeId,
                explicitAttributeVerification: false,
                dailyCallsPerConsumer: differentiatedDailyCalls,
                discreteConfig: {
                  threshold,
                  comparator: attributeCertifiedDiscreteComparator.GTE,
                },
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

      await addOneTenant({
        ...getMockTenant(consumerId, [
          {
            id: attributeId,
            type: "PersistentCertifiedDiscreteAttribute",
            assignmentTimestamp: new Date(),
            revocationTimestamp: undefined,
            discreteValue,
          },
        ]),
      });
      await addOneEService(eservice);
      await addOneAgreement(agreement);
      await addOnePurpose(consumerPurpose);

      return { purposeId: consumerPurpose.id, consumerId };
    };

    it("applies the differentiated discrete quota when the flag is enabled and the threshold is satisfied", async () => {
      config.featureFlagAttributeCertifiedDiscrete = true;

      const { purposeId, consumerId } = await setupDiscreteScenario({
        threshold: 1000,
        discreteValue: 1500,
        differentiatedDailyCalls: 500,
      });

      const result = await purposeService.getRemainingDailyCalls({
        purposeId,
        ctx: getMockContext({ authData: getMockAuthData(consumerId) }),
      });

      expect(result).toEqual({
        remainingDailyCallsPerConsumer: 460,
        remainingDailyCallsTotal: 960,
      });
    });

    it("applies the differentiated discrete quota even when it is lower than the descriptor default", async () => {
      config.featureFlagAttributeCertifiedDiscrete = true;

      const { purposeId, consumerId } = await setupDiscreteScenario({
        threshold: 1000,
        discreteValue: 1500,
        differentiatedDailyCalls: 50,
      });

      const result = await purposeService.getRemainingDailyCalls({
        purposeId,
        ctx: getMockContext({ authData: getMockAuthData(consumerId) }),
      });

      expect(result).toEqual({
        remainingDailyCallsPerConsumer: 10,
        remainingDailyCallsTotal: 960,
      });
    });

    it("falls back to the descriptor default when the discrete value does not satisfy the threshold", async () => {
      config.featureFlagAttributeCertifiedDiscrete = true;

      const { purposeId, consumerId } = await setupDiscreteScenario({
        threshold: 1000,
        discreteValue: 500,
        differentiatedDailyCalls: 500,
      });

      const result = await purposeService.getRemainingDailyCalls({
        purposeId,
        ctx: getMockContext({ authData: getMockAuthData(consumerId) }),
      });

      expect(result).toEqual({
        remainingDailyCallsPerConsumer: 60,
        remainingDailyCallsTotal: 960,
      });
    });

    it("ignores the discrete attribute when the feature flag is disabled", async () => {
      config.featureFlagAttributeCertifiedDiscrete = false;

      const { purposeId, consumerId } = await setupDiscreteScenario({
        threshold: 1000,
        discreteValue: 1500,
        differentiatedDailyCalls: 500,
      });

      const result = await purposeService.getRemainingDailyCalls({
        purposeId,
        ctx: getMockContext({ authData: getMockAuthData(consumerId) }),
      });

      expect(result).toEqual({
        remainingDailyCallsPerConsumer: 60,
        remainingDailyCallsTotal: 960,
      });
    });
  });
});

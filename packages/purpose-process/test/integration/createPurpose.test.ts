/* eslint-disable sonarjs/no-identical-functions */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { fail } from "assert";
import {
  Agreement,
  Descriptor,
  EService,
  Purpose,
  PurposeAddedV2,
  RiskAnalysisForm,
  Tenant,
  agreementState,
  descriptorState,
  generateId,
  purposeVersionState,
  tenantKind,
  toPurposeV2,
  unsafeBrandId,
  TenantId,
  delegationKind,
  delegationState,
} from "pagopa-interop-models";
import { purposeApi } from "pagopa-interop-api-clients";
import { describe, expect, it, vi } from "vitest";
import {
  getMockValidRiskAnalysisForm,
  decodeProtobufPayload,
  getMockAgreement,
  getMockEService,
  getMockTenant,
  getMockPurpose,
  getMockDescriptor,
  getMockAuthData,
  getMockDelegation,
  getMockContext,
  getMockExpiredRiskAnalysisForm,
} from "pagopa-interop-commons-test";
import {
  expiredRulesVersionError,
  rulesVersionNotFoundError,
} from "pagopa-interop-commons";
import {
  missingFreeOfChargeReason,
  tenantKindNotFound,
  tenantNotFound,
  riskAnalysisValidationFailed,
  agreementNotFound,
  duplicatedPurposeTitle,
  tenantIsNotTheConsumer,
} from "../../src/model/domain/errors.js";
import {
  addOneAgreement,
  addOneDelegation,
  addOneEService,
  addOnePurpose,
  addOneTenant,
  purposeService,
  readLastPurposeEvent,
} from "../integrationUtils.js";
import { buildRiskAnalysisFormSeed, getMockPurposeSeed } from "../mockUtils.js";

describe("createPurpose", () => {
  const tenant: Tenant = {
    ...getMockTenant(),
    kind: tenantKind.PA,
  };

  const descriptor1: Descriptor = {
    ...getMockDescriptor(),
    state: descriptorState.published,
    version: "",
  };

  const eService1: EService = {
    ...getMockEService(),
    producerId: tenant.id,
    descriptors: [descriptor1],
  };

  const agreementEservice1 = getMockAgreement(
    eService1.id,
    tenant.id,
    agreementState.active
  );

  const mockValidRiskAnalysisForm = getMockValidRiskAnalysisForm(tenantKind.PA);
  const mockExpiredRiskAnalysisForm = getMockExpiredRiskAnalysisForm(
    tenantKind.PA
  );

  const purposeSeed = getMockPurposeSeed(
    eService1.id,
    agreementEservice1.consumerId,
    buildRiskAnalysisFormSeed(mockValidRiskAnalysisForm)
  );
  it("should write on event-store for the creation of a purpose", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
    await addOneTenant(tenant);
    await addOneAgreement(agreementEservice1);
    await addOneEService(eService1);

    const createPurposeResponse = await purposeService.createPurpose(
      purposeSeed,
      getMockContext({
        authData: getMockAuthData(
          unsafeBrandId<TenantId>(purposeSeed.consumerId)
        ),
      })
    );

    const writtenEvent = await readLastPurposeEvent(
      createPurposeResponse.data.purpose.id
    );

    if (!writtenEvent) {
      fail("Update failed: purpose not found in event-store");
    }

    expect(writtenEvent).toMatchObject({
      stream_id: createPurposeResponse.data.purpose.id,
      version: "0",
      type: "PurposeAdded",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeAddedV2,
      payload: writtenEvent.data,
    });

    const expectedRiskAnalysisForm: RiskAnalysisForm = {
      ...mockValidRiskAnalysisForm,
      id: unsafeBrandId(
        createPurposeResponse.data.purpose.riskAnalysisForm!.id
      ),
      singleAnswers: mockValidRiskAnalysisForm.singleAnswers.map(
        (answer, i) => ({
          ...answer,
          id: createPurposeResponse.data.purpose.riskAnalysisForm!
            .singleAnswers[i].id,
        })
      ),
      multiAnswers: mockValidRiskAnalysisForm.multiAnswers.map((answer, i) => ({
        ...answer,
        id: createPurposeResponse.data.purpose.riskAnalysisForm!.multiAnswers[i]
          .id,
      })),
    };

    const expectedPurpose: Purpose = {
      title: purposeSeed.title,
      id: unsafeBrandId(createPurposeResponse.data.purpose.id),
      createdAt: new Date(),
      eserviceId: unsafeBrandId(purposeSeed.eserviceId),
      consumerId: unsafeBrandId(purposeSeed.consumerId),
      description: purposeSeed.description,
      versions: [
        {
          id: unsafeBrandId(writtenPayload.purpose!.versions[0].id),
          state: purposeVersionState.draft,
          dailyCalls: purposeSeed.dailyCalls,
          createdAt: new Date(),
        },
      ],
      isFreeOfCharge: true,
      freeOfChargeReason: purposeSeed.freeOfChargeReason,
      riskAnalysisForm: expectedRiskAnalysisForm,
    };

    expect(writtenPayload).toEqual({
      purpose: toPurposeV2(expectedPurpose),
    });
    expect(createPurposeResponse).toEqual({
      data: {
        purpose: expectedPurpose,
        isRiskAnalysisValid: true,
      },
      metadata: { version: 0 },
    });

    vi.useRealTimers();
  });

  it("should write on event-store for the creation of a purpose with isFreeOfCharge false", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
    await addOneTenant(tenant);
    await addOneAgreement(agreementEservice1);
    await addOneEService(eService1);

    const purposeSeedWithFreeOfChargeFalse: purposeApi.PurposeSeed = {
      ...purposeSeed,
      isFreeOfCharge: false,
      freeOfChargeReason: undefined,
    };

    const createPurposeResponse = await purposeService.createPurpose(
      purposeSeedWithFreeOfChargeFalse,
      getMockContext({
        authData: getMockAuthData(
          unsafeBrandId<TenantId>(purposeSeed.consumerId)
        ),
      })
    );

    const writtenEvent = await readLastPurposeEvent(
      createPurposeResponse.data.purpose.id
    );

    if (!writtenEvent) {
      fail("Update failed: purpose not found in event-store");
    }

    expect(writtenEvent).toMatchObject({
      stream_id: createPurposeResponse.data.purpose.id,
      version: "0",
      type: "PurposeAdded",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeAddedV2,
      payload: writtenEvent.data,
    });

    const expectedRiskAnalysisForm: RiskAnalysisForm = {
      ...mockValidRiskAnalysisForm,
      id: unsafeBrandId(
        createPurposeResponse.data.purpose.riskAnalysisForm!.id
      ),
      singleAnswers: mockValidRiskAnalysisForm.singleAnswers.map(
        (answer, i) => ({
          ...answer,
          id: createPurposeResponse.data.purpose.riskAnalysisForm!
            .singleAnswers[i].id,
        })
      ),
      multiAnswers: mockValidRiskAnalysisForm.multiAnswers.map((answer, i) => ({
        ...answer,
        id: createPurposeResponse.data.purpose.riskAnalysisForm!.multiAnswers[i]
          .id,
      })),
    };

    const expectedPurpose: Purpose = {
      title: purposeSeedWithFreeOfChargeFalse.title,
      id: unsafeBrandId(createPurposeResponse.data.purpose.id),
      createdAt: new Date(),
      eserviceId: unsafeBrandId(purposeSeedWithFreeOfChargeFalse.eserviceId),
      consumerId: unsafeBrandId(purposeSeedWithFreeOfChargeFalse.consumerId),
      description: purposeSeedWithFreeOfChargeFalse.description,
      versions: [
        {
          id: unsafeBrandId(writtenPayload.purpose!.versions[0].id),
          state: purposeVersionState.draft,
          dailyCalls: purposeSeedWithFreeOfChargeFalse.dailyCalls,
          createdAt: new Date(),
        },
      ],
      isFreeOfCharge: purposeSeedWithFreeOfChargeFalse.isFreeOfCharge,
      freeOfChargeReason: purposeSeedWithFreeOfChargeFalse.freeOfChargeReason,
      riskAnalysisForm: expectedRiskAnalysisForm,
    };

    expect(writtenPayload).toEqual({
      purpose: toPurposeV2(expectedPurpose),
    });
    expect(createPurposeResponse).toEqual({
      data: {
        purpose: expectedPurpose,
        isRiskAnalysisValid: true,
      },
      metadata: { version: 0 },
    });

    vi.useRealTimers();
  });

  it("should succeed when requester is Consumer Delegate and the Purpose was created successfully", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const delegateTenant = { ...getMockTenant(), kind: tenantKind.PA };

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: eService1.id,
      delegatorId: unsafeBrandId<TenantId>(purposeSeed.consumerId),
      delegateId: delegateTenant.id,
      state: delegationState.active,
    });

    await addOneTenant(delegateTenant);
    await addOneAgreement(agreementEservice1);
    await addOneEService(eService1);
    await addOneDelegation(delegation);

    const createPurposeResponse = await purposeService.createPurpose(
      purposeSeed,
      getMockContext({ authData: getMockAuthData(delegateTenant.id) })
    );

    const writtenEvent = await readLastPurposeEvent(
      createPurposeResponse.data.purpose.id
    );

    if (!writtenEvent) {
      fail("Update failed: purpose not found in event-store");
    }

    expect(writtenEvent).toMatchObject({
      stream_id: createPurposeResponse.data.purpose.id,
      version: "0",
      type: "PurposeAdded",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeAddedV2,
      payload: writtenEvent.data,
    });

    const expectedRiskAnalysisForm: RiskAnalysisForm = {
      ...mockValidRiskAnalysisForm,
      id: unsafeBrandId(
        createPurposeResponse.data.purpose.riskAnalysisForm!.id
      ),
      singleAnswers: mockValidRiskAnalysisForm.singleAnswers.map(
        (answer, i) => ({
          ...answer,
          id: createPurposeResponse.data.purpose.riskAnalysisForm!
            .singleAnswers[i].id,
        })
      ),
      multiAnswers: mockValidRiskAnalysisForm.multiAnswers.map((answer, i) => ({
        ...answer,
        id: createPurposeResponse.data.purpose.riskAnalysisForm!.multiAnswers[i]
          .id,
      })),
    };

    const expectedPurpose: Purpose = {
      title: purposeSeed.title,
      id: unsafeBrandId(createPurposeResponse.data.purpose.id),
      createdAt: new Date(),
      eserviceId: unsafeBrandId(purposeSeed.eserviceId),
      consumerId: unsafeBrandId(purposeSeed.consumerId),
      delegationId: delegation.id,
      description: purposeSeed.description,
      versions: [
        {
          id: unsafeBrandId(writtenPayload.purpose!.versions[0].id),
          state: purposeVersionState.draft,
          dailyCalls: purposeSeed.dailyCalls,
          createdAt: new Date(),
        },
      ],
      isFreeOfCharge: true,
      freeOfChargeReason: purposeSeed.freeOfChargeReason,
      riskAnalysisForm: expectedRiskAnalysisForm,
    };

    expect(writtenPayload).toEqual({
      purpose: toPurposeV2(expectedPurpose),
    });
    expect(createPurposeResponse).toEqual({
      data: {
        purpose: expectedPurpose,
        isRiskAnalysisValid: true,
      },
      metadata: { version: 0 },
    });

    vi.useRealTimers();
  });
  it("should succeed when requester is Consumer Delegate and the eservice was created by a delegated tenant and the Purpose was created successfully", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const producer = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantKind.PA,
    };

    const producerDelegate = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantKind.PA,
    };

    const eservice: EService = {
      ...getMockEService(),
      producerId: producerDelegate.id,
      descriptors: [descriptor1],
    };

    const producerDelegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      delegatorId: producer.id,
      delegateId: producerDelegate.id,
      state: delegationState.active,
    });

    const consumer = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantKind.PA,
    };

    const consumerDelegate = {
      ...getMockTenant(),
      id: generateId<TenantId>(),
      kind: tenantKind.PA,
    };

    const consumerDelegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: eservice.id,
      delegatorId: consumer.id,
      delegateId: consumerDelegate.id,
      state: delegationState.active,
    });

    const agreement: Agreement = {
      ...getMockAgreement(),
      consumerId: consumer.id,
      eserviceId: eservice.id,
      state: agreementState.active,
    };

    const delegatePurposeSeed: purposeApi.PurposeSeed = {
      ...purposeSeed,
      eserviceId: eservice.id,
      consumerId: agreement.consumerId,
    };

    await addOneTenant(consumerDelegate);
    await addOneTenant(producerDelegate);
    await addOneAgreement(agreement);
    await addOneEService(eservice);
    await addOneDelegation(consumerDelegation);
    await addOneDelegation(producerDelegation);

    const createPurposeResponse = await purposeService.createPurpose(
      delegatePurposeSeed,
      getMockContext({ authData: getMockAuthData(consumerDelegate.id) })
    );

    const writtenEvent = await readLastPurposeEvent(
      createPurposeResponse.data.purpose.id
    );

    if (!writtenEvent) {
      fail("Update failed: purpose not found in event-store");
    }

    expect(writtenEvent).toMatchObject({
      stream_id: createPurposeResponse.data.purpose.id,
      version: "0",
      type: "PurposeAdded",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: PurposeAddedV2,
      payload: writtenEvent.data,
    });

    const expectedRiskAnalysisForm: RiskAnalysisForm = {
      ...mockValidRiskAnalysisForm,
      id: unsafeBrandId(
        createPurposeResponse.data.purpose.riskAnalysisForm!.id
      ),
      singleAnswers: mockValidRiskAnalysisForm.singleAnswers.map(
        (answer, i) => ({
          ...answer,
          id: createPurposeResponse.data.purpose.riskAnalysisForm!
            .singleAnswers[i].id,
        })
      ),
      multiAnswers: mockValidRiskAnalysisForm.multiAnswers.map((answer, i) => ({
        ...answer,
        id: createPurposeResponse.data.purpose.riskAnalysisForm!.multiAnswers[i]
          .id,
      })),
    };

    const expectedPurpose: Purpose = {
      title: delegatePurposeSeed.title,
      id: unsafeBrandId(createPurposeResponse.data.purpose.id),
      createdAt: new Date(),
      eserviceId: unsafeBrandId(delegatePurposeSeed.eserviceId),
      consumerId: unsafeBrandId(delegatePurposeSeed.consumerId),
      delegationId: consumerDelegation.id,
      description: delegatePurposeSeed.description,
      versions: [
        {
          id: unsafeBrandId(writtenPayload.purpose!.versions[0].id),
          state: purposeVersionState.draft,
          dailyCalls: delegatePurposeSeed.dailyCalls,
          createdAt: new Date(),
        },
      ],
      isFreeOfCharge: true,
      freeOfChargeReason: delegatePurposeSeed.freeOfChargeReason,
      riskAnalysisForm: expectedRiskAnalysisForm,
    };

    expect(writtenPayload).toEqual({
      purpose: toPurposeV2(expectedPurpose),
    });
    expect(createPurposeResponse).toEqual({
      data: {
        purpose: expectedPurpose,
        isRiskAnalysisValid: true,
      },
      metadata: { version: 0 },
    });

    vi.useRealTimers();
  });
  it("should throw missingFreeOfChargeReason if the freeOfChargeReason is empty", async () => {
    const seed: purposeApi.PurposeSeed = {
      ...purposeSeed,
      freeOfChargeReason: undefined,
    };

    expect(
      purposeService.createPurpose(
        seed,
        getMockContext({
          authData: getMockAuthData(
            unsafeBrandId<TenantId>(purposeSeed.consumerId)
          ),
        })
      )
    ).rejects.toThrowError(missingFreeOfChargeReason());
  });
  it("should throw tenantKindNotFound if the kind doesn't exists", async () => {
    const tenantWithoutKind: Tenant = {
      ...tenant,
      kind: undefined,
    };

    const eService: EService = {
      ...eService1,
      producerId: tenantWithoutKind.id,
    };

    const agreementEservice = getMockAgreement(
      eService.id,
      tenantWithoutKind.id
    );

    const seed: purposeApi.PurposeSeed = {
      ...purposeSeed,
      eserviceId: eService.id,
      consumerId: agreementEservice.consumerId,
    };

    await addOneTenant(tenantWithoutKind);
    await addOneAgreement(agreementEservice);
    await addOneEService(eService);

    expect(
      purposeService.createPurpose(
        seed,
        getMockContext({
          authData: getMockAuthData(
            unsafeBrandId<TenantId>(purposeSeed.consumerId)
          ),
        })
      )
    ).rejects.toThrowError(tenantKindNotFound(tenantWithoutKind.id));
  });
  it("should throw tenantNotFound if the tenant doesn't exists", async () => {
    expect(
      purposeService.createPurpose(
        purposeSeed,
        getMockContext({
          authData: getMockAuthData(
            unsafeBrandId<TenantId>(purposeSeed.consumerId)
          ),
        })
      )
    ).rejects.toThrowError(tenantNotFound(tenant.id));
  });
  it("should throw agreementNotFound if the agreement doesn't exists ", async () => {
    const descriptor: Descriptor = {
      ...descriptor1,
      id: generateId(),
    };

    const eService: EService = {
      ...eService1,
      producerId: tenant.id,
      id: generateId(),
      descriptors: [descriptor],
    };

    const agreement: Agreement = {
      ...agreementEservice1,
      id: generateId(),
      eserviceId: eService.id,
      descriptorId: descriptor.id,
      producerId: eService.producerId,
      consumerId: tenant.id,
      state: agreementState.draft,
    };

    const seed: purposeApi.PurposeSeed = {
      ...purposeSeed,
      eserviceId: eService.id,
      consumerId: agreement.consumerId,
    };

    await addOneTenant(tenant);
    await addOneAgreement(agreement);
    await addOneEService(eService);

    expect(
      purposeService.createPurpose(
        seed,
        getMockContext({
          authData: getMockAuthData(unsafeBrandId<TenantId>(seed.consumerId)),
        })
      )
    ).rejects.toThrowError(agreementNotFound(eService.id, tenant.id));
  });
  it("should throw tenantIsNotTheConsumer if the requester is not the consumer", async () => {
    await addOneTenant(tenant);
    await addOneAgreement(agreementEservice1);
    await addOneEService(getMockEService());

    const seed: purposeApi.PurposeSeed = {
      ...purposeSeed,
      consumerId: generateId(),
    };

    expect(
      purposeService.createPurpose(
        seed,
        getMockContext({
          authData: getMockAuthData(
            unsafeBrandId<TenantId>(purposeSeed.consumerId)
          ),
        })
      )
    ).rejects.toThrowError(tenantIsNotTheConsumer(tenant.id));
  });
  it("should throw riskAnalysisValidationFailed if the purpose has a non valid risk analysis ", async () => {
    await addOneTenant(tenant);
    await addOneAgreement(agreementEservice1);
    await addOneEService(eService1);

    const mockInvalidRiskAnalysisForm: RiskAnalysisForm = {
      ...mockValidRiskAnalysisForm,
      version: "0",
    };

    const seed: purposeApi.PurposeSeed = {
      ...purposeSeed,
      riskAnalysisForm: buildRiskAnalysisFormSeed(mockInvalidRiskAnalysisForm),
    };

    expect(
      purposeService.createPurpose(
        seed,
        getMockContext({
          authData: getMockAuthData(unsafeBrandId<TenantId>(seed.consumerId)),
        })
      )
    ).rejects.toThrowError(
      riskAnalysisValidationFailed([
        rulesVersionNotFoundError(
          tenant.kind!,
          mockInvalidRiskAnalysisForm.version
        ),
      ])
    );
  });
  it("should throw riskAnalysisValidationFailed if the purpose has an expired risk analysis ", async () => {
    await addOneTenant(tenant);
    await addOneAgreement(agreementEservice1);
    await addOneEService(eService1);

    const seed: purposeApi.PurposeSeed = {
      ...purposeSeed,
      riskAnalysisForm: buildRiskAnalysisFormSeed(mockExpiredRiskAnalysisForm),
    };

    expect(
      purposeService.createPurpose(
        seed,
        getMockContext({
          authData: getMockAuthData(unsafeBrandId<TenantId>(seed.consumerId)),
        })
      )
    ).rejects.toThrowError(
      riskAnalysisValidationFailed([
        expiredRulesVersionError(
          mockExpiredRiskAnalysisForm.version,
          tenant.kind!
        ),
      ])
    );
  });
  it("should throw duplicatedPurposeName if a purpose with same name already exists", async () => {
    const existingPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: unsafeBrandId(purposeSeed.eserviceId),
      consumerId: unsafeBrandId(purposeSeed.consumerId),
      title: purposeSeed.title,
    };

    await addOnePurpose(existingPurpose);
    await addOneTenant(tenant);
    await addOneAgreement(agreementEservice1);
    await addOneEService(eService1);

    expect(
      purposeService.createPurpose(
        purposeSeed,
        getMockContext({
          authData: getMockAuthData(
            unsafeBrandId<TenantId>(purposeSeed.consumerId)
          ),
        })
      )
    ).rejects.toThrowError(duplicatedPurposeTitle(purposeSeed.title));
  });
});

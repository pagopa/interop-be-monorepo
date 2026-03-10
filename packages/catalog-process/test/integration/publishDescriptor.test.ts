/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  randomArrayItem,
  getMockTenant,
  getMockValidRiskAnalysis,
  getMockDelegation,
  getMockAuthData,
  getMockContext,
  getMockEService,
  getMockDescriptor,
  getMockDocument,
  getMockAgreement,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  descriptorState,
  EService,
  eserviceMode,
  EServiceDescriptorPublishedV2,
  toEServiceV2,
  TenantKind,
  tenantKind,
  Tenant,
  generateId,
  operationForbidden,
  delegationState,
  EServiceDescriptorSubmittedByDelegateV2,
  delegationKind,
  agreementState,
} from "pagopa-interop-models";
import { beforeAll, vi, afterAll, expect, describe, it } from "vitest";
import {
  eServiceNotFound,
  eServiceDescriptorNotFound,
  notValidDescriptorState,
  eServiceDescriptorWithoutInterface,
  tenantNotFound,
  tenantKindNotFound,
  eServiceRiskAnalysisIsRequired,
  riskAnalysisNotValid,
  audienceCannotBeEmpty,
  missingPersonalDataFlag,
} from "../../src/model/domain/errors.js";
import {
  addOneEService,
  catalogService,
  readLastEserviceEvent,
  addOneTenant,
  addOneAgreement,
  addOneDelegation,
} from "../integrationUtils.js";

describe("publish descriptor", () => {
  const mockEService = getMockEService();
  const mockDescriptor: Descriptor = getMockDescriptor();

  const mockDocument = getMockDocument();
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });
  afterAll(() => {
    vi.useRealTimers();
  });
  it("should write on event-store for the publication of a descriptor with mode Deliver", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
      interface: mockDocument,
    };
    const eservice: EService = {
      ...mockEService,
      mode: eserviceMode.deliver,
      descriptors: [descriptor],
      personalData: false,
    };
    await addOneEService(eservice);
    const publishDescriptorResponse = await catalogService.publishDescriptor(
      eservice.id,
      descriptor.id,
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDescriptorPublished",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorPublishedV2,
      payload: writtenEvent.data,
    });

    const expectedEservice = {
      ...eservice,
      descriptors: [
        {
          ...descriptor,
          publishedAt: new Date(),
          state: descriptorState.published,
        },
      ],
    };

    expect(publishDescriptorResponse).toEqual({
      data: expectedEservice,
      metadata: { version: parseInt(writtenEvent.version, 10) },
    });
    expect(writtenPayload.descriptorId).toEqual(descriptor.id);
    expect(writtenPayload.eservice).toEqual(toEServiceV2(expectedEservice));
  });

  it("should write on event-store for the publication of a descriptor with mode Receive", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
      interface: mockDocument,
    };

    const producerTenantKind: TenantKind = randomArrayItem(
      Object.values(tenantKind)
    );
    const producer: Tenant = {
      ...getMockTenant(),
      kind: producerTenantKind,
    };

    const riskAnalysis = getMockValidRiskAnalysis(producerTenantKind);

    const eservice: EService = {
      ...mockEService,
      producerId: producer.id,
      mode: eserviceMode.receive,
      descriptors: [descriptor],
      riskAnalysis: [riskAnalysis],
      personalData: true,
    };

    await addOneTenant(producer);
    await addOneEService(eservice);

    const publishDescriptorResponse = await catalogService.publishDescriptor(
      eservice.id,
      descriptor.id,
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDescriptorPublished",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorPublishedV2,
      payload: writtenEvent.data,
    });

    const expectedEservice = {
      ...eservice,
      descriptors: [
        {
          ...descriptor,
          publishedAt: new Date(),
          state: descriptorState.published,
        },
      ],
    };

    expect(publishDescriptorResponse).toEqual({
      data: expectedEservice,
      metadata: { version: parseInt(writtenEvent.version, 10) },
    });
    expect(writtenPayload.descriptorId).toEqual(descriptor.id);
    expect(writtenPayload.eservice).toEqual(toEServiceV2(expectedEservice));
  });

  it("should write on event-store for the submission of the descriptor by the delegate", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
      interface: mockDocument,
    };

    const producerTenantKind: TenantKind = randomArrayItem(
      Object.values(tenantKind)
    );
    const producer: Tenant = {
      ...getMockTenant(),
      kind: producerTenantKind,
    };

    const riskAnalysis = getMockValidRiskAnalysis(producerTenantKind);

    const eservice: EService = {
      ...mockEService,
      producerId: producer.id,
      mode: eserviceMode.receive,
      descriptors: [descriptor],
      riskAnalysis: [riskAnalysis],
      personalData: true,
    };

    const delegate = {
      ...getMockTenant(),
      kind: producerTenantKind,
    };

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      delegateId: delegate.id,
      state: delegationState.active,
    });

    await addOneTenant(producer);
    await addOneEService(eservice);
    await addOneDelegation(delegation);

    await catalogService.publishDescriptor(
      eservice.id,
      descriptor.id,
      getMockContext({ authData: getMockAuthData(delegate.id) })
    );

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDescriptorSubmittedByDelegate",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorSubmittedByDelegateV2,
      payload: writtenEvent.data,
    });

    const expectedEservice = toEServiceV2({
      ...eservice,
      descriptors: [
        {
          ...descriptor,
          state: descriptorState.waitingForApproval,
        },
      ],
    });

    expect(writtenPayload.descriptorId).toEqual(descriptor.id);
    expect(writtenPayload.eservice).toEqual(expectedEservice);
  });

  it("should also archive the previously published descriptor", async () => {
    const descriptor1: Descriptor = {
      ...mockDescriptor,
      id: generateId(),
      version: "1",
      state: descriptorState.published,
      publishedAt: new Date(),
      interface: getMockDocument(),
    };
    const descriptor2: Descriptor = {
      ...mockDescriptor,
      id: generateId(),
      version: "2",
      state: descriptorState.draft,
      interface: getMockDocument(),
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor1, descriptor2],
      personalData: false,
    };
    await addOneEService(eservice);
    await catalogService.publishDescriptor(
      eservice.id,
      descriptor2.id,
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );
    const writtenEvent = await readLastEserviceEvent(eservice.id);

    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDescriptorPublished",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorPublishedV2,
      payload: writtenEvent.data,
    });

    const expectedDescriptor1: Descriptor = {
      ...descriptor1,
      archivedAt: new Date(),
      state: descriptorState.archived,
    };
    const expectedDescriptor2: Descriptor = {
      ...descriptor2,
      publishedAt: new Date(),
      state: descriptorState.published,
    };

    const expectedEservice: EService = {
      ...eservice,
      descriptors: [expectedDescriptor1, expectedDescriptor2],
    };
    expect(writtenPayload).toEqual({
      eservice: toEServiceV2(expectedEservice),
      descriptorId: descriptor2.id,
    });
  });

  it("should also deprecate the previously published descriptor if there was a valid agreement", async () => {
    const descriptor1: Descriptor = {
      ...mockDescriptor,
      version: "1",
      id: generateId(),
      state: descriptorState.published,
      publishedAt: new Date(),
      interface: getMockDocument(),
    };
    const descriptor2: Descriptor = {
      ...mockDescriptor,
      version: "2",
      id: generateId(),
      state: descriptorState.draft,
      interface: getMockDocument(),
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor1, descriptor2],
      personalData: false,
    };
    await addOneEService(eservice);
    const tenant: Tenant = {
      ...getMockTenant(),
    };
    await addOneTenant(tenant);
    const agreement = {
      ...getMockAgreement(eservice.id, tenant.id, agreementState.active),
      descriptorId: descriptor1.id,
      producerId: eservice.producerId,
    };
    await addOneAgreement(agreement);
    await catalogService.publishDescriptor(
      eservice.id,
      descriptor2.id,
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );
    const writtenEvent = await readLastEserviceEvent(eservice.id);

    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDescriptorPublished",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorPublishedV2,
      payload: writtenEvent.data,
    });

    const expectedDescriptor1: Descriptor = {
      ...descriptor1,
      deprecatedAt: new Date(),
      state: descriptorState.deprecated,
    };
    const expectedDescriptor2: Descriptor = {
      ...descriptor2,
      publishedAt: new Date(),
      state: descriptorState.published,
    };

    const expectedEservice: EService = {
      ...eservice,
      descriptors: [expectedDescriptor1, expectedDescriptor2],
    };
    expect(writtenPayload).toEqual({
      eservice: toEServiceV2(expectedEservice),
      descriptorId: descriptor2.id,
    });
  });

  it("should throw eServiceNotFound if the eService doesn't exist", async () => {
    await expect(
      catalogService.publishDescriptor(
        mockEService.id,
        mockDescriptor.id,
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(eServiceNotFound(mockEService.id));
  });

  it("should throw eServiceDescriptorNotFound if the descriptor doesn't exist", async () => {
    const eservice: EService = {
      ...mockEService,
      descriptors: [],
    };
    await addOneEService(eservice);
    expect(
      catalogService.publishDescriptor(
        eservice.id,
        mockDescriptor.id,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(
      eServiceDescriptorNotFound(eservice.id, mockDescriptor.id)
    );
  });

  it("should throw operationForbidden if the requester is not the producer", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    expect(
      catalogService.publishDescriptor(
        eservice.id,
        descriptor.id,
        getMockContext({})
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw operationForbidden if the requester of the given e-service has been delegated and caller is not the delegate", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      state: delegationState.active,
    });

    await addOneEService(eservice);
    await addOneDelegation(delegation);

    expect(
      catalogService.publishDescriptor(
        eservice.id,
        descriptor.id,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw notValidDescriptorState if the descriptor is in published state", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.published,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    expect(
      catalogService.publishDescriptor(
        eservice.id,
        descriptor.id,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(
      notValidDescriptorState(descriptor.id, descriptorState.published)
    );
  });

  it("should throw notValidDescriptorState if the descriptor is in deprecated state", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.deprecated,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    expect(
      catalogService.publishDescriptor(
        eservice.id,
        descriptor.id,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(
      notValidDescriptorState(descriptor.id, descriptorState.deprecated)
    );
  });

  it("should throw notValidDescriptorState if the descriptor is in suspended state", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.suspended,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    expect(
      catalogService.publishDescriptor(
        eservice.id,
        descriptor.id,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(
      notValidDescriptorState(descriptor.id, descriptorState.suspended)
    );
  });

  it("should throw notValidDescriptorState if the descriptor is in archived state", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.archived,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    expect(
      catalogService.publishDescriptor(
        eservice.id,
        descriptor.id,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(
      notValidDescriptorState(descriptor.id, descriptorState.archived)
    );
  });

  it("should throw eServiceDescriptorWithoutInterface if the descriptor doesn't have an interface", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    expect(
      catalogService.publishDescriptor(
        eservice.id,
        descriptor.id,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(eServiceDescriptorWithoutInterface(descriptor.id));
  });

  it("should throw tenantNotFound if the eService has mode Receive and the producer tenant doesn't exist", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
      interface: mockDocument,
    };

    const eservice: EService = {
      ...mockEService,
      producerId: generateId(),
      mode: eserviceMode.receive,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    expect(
      catalogService.publishDescriptor(
        eservice.id,
        descriptor.id,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(tenantNotFound(eservice.producerId));
  });

  it("should throw tenantKindNotFound if the eService has mode Receive and the producer tenant kind doesn't exist", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
      interface: mockDocument,
    };

    const producer: Tenant = {
      ...getMockTenant(),
      kind: undefined,
    };

    const eservice: EService = {
      ...mockEService,
      producerId: producer.id,
      mode: eserviceMode.receive,
      descriptors: [descriptor],
    };

    await addOneTenant(producer);
    await addOneEService(eservice);

    expect(
      catalogService.publishDescriptor(
        eservice.id,
        descriptor.id,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(tenantKindNotFound(producer.id));
  });

  it("should throw eServiceRiskAnalysisIsRequired if the eService has mode Receive and no risk analysis", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
      interface: mockDocument,
    };

    const producerTenantKind: TenantKind = randomArrayItem(
      Object.values(tenantKind)
    );
    const producer: Tenant = {
      ...getMockTenant(),
      kind: producerTenantKind,
    };

    const eservice: EService = {
      ...mockEService,
      producerId: producer.id,
      mode: eserviceMode.receive,
      descriptors: [descriptor],
      riskAnalysis: [],
    };

    await addOneTenant(producer);
    await addOneEService(eservice);

    expect(
      catalogService.publishDescriptor(
        eservice.id,
        descriptor.id,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(eServiceRiskAnalysisIsRequired(eservice.id));
  });

  it("should throw riskAnalysisNotValid if the eService has mode Receive and one of the risk analyses is not valid", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
      interface: mockDocument,
    };

    const producerTenantKind: TenantKind = randomArrayItem(
      Object.values(tenantKind)
    );
    const producer: Tenant = {
      ...getMockTenant(),
      kind: producerTenantKind,
    };

    const validRiskAnalysis = getMockValidRiskAnalysis(producerTenantKind);
    const validRiskAnalysis2 = getMockValidRiskAnalysis(producerTenantKind);

    const riskAnalysis1 = validRiskAnalysis;
    const riskAnalysis2 = {
      ...validRiskAnalysis2,
      riskAnalysisForm: {
        ...validRiskAnalysis2.riskAnalysisForm,
        singleAnswers: [],
        // ^ validation here is schema only: it checks for missing expected fields, so this is invalid
      },
    };

    const eservice: EService = {
      ...mockEService,
      producerId: producer.id,
      mode: eserviceMode.receive,
      descriptors: [descriptor],
      riskAnalysis: [riskAnalysis1, riskAnalysis2],
    };

    await addOneTenant(producer);
    await addOneEService(eservice);

    expect(
      catalogService.publishDescriptor(
        eservice.id,
        descriptor.id,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(riskAnalysisNotValid());
  });

  it("should throw audienceCannotBeEmpty if the descriptor audience is an empty array", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
      interface: mockDocument,
      audience: [],
    };

    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };

    await addOneEService(eservice);

    expect(
      catalogService.publishDescriptor(
        eservice.id,
        descriptor.id,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(audienceCannotBeEmpty(descriptor.id));
  });

  it("should throw missingPersonalDataFlag if the eservice has personalData undefined", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
      interface: mockDocument,
    };

    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
      personalData: undefined,
    };

    await addOneEService(eservice);

    expect(
      catalogService.publishDescriptor(
        eservice.id,
        descriptor.id,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(missingPersonalDataFlag(eservice.id, descriptor.id));
  });
});

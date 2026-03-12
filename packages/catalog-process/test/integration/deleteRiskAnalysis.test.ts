/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getMockValidRiskAnalysis,
  decodeProtobufPayload,
  getMockDelegation,
  getMockContext,
  getMockAuthData,
  getMockDescriptor,
  getMockDocument,
  getMockEService,
} from "pagopa-interop-commons-test";
import {
  EService,
  toEServiceV2,
  EServiceRiskAnalysisDeletedV2,
  generateId,
  RiskAnalysisId,
  Descriptor,
  descriptorState,
  operationForbidden,
  delegationState,
  delegationKind,
  EServiceTemplateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  eServiceNotFound,
  eServiceRiskAnalysisNotFound,
  eserviceNotInDraftState,
  templateInstanceNotAllowed,
} from "../../src/model/domain/errors.js";
import {
  addOneDelegation,
  addOneEService,
  catalogService,
  readLastEserviceEvent,
} from "../integrationUtils.js";

describe("delete risk analysis", () => {
  const mockDescriptor = getMockDescriptor();
  const mockEService = getMockEService();
  const mockDocument = getMockDocument();
  it("should write on event-store for the deletion of a risk analysis", async () => {
    const riskAnalysis = getMockValidRiskAnalysis("PA");
    const eservice: EService = {
      ...mockEService,
      descriptors: [],
      riskAnalysis: [riskAnalysis],
      mode: "Receive",
    };
    await addOneEService(eservice);

    const deleteResponse = await catalogService.deleteRiskAnalysis(
      eservice.id,
      riskAnalysis.id,
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    const expectedEservice = {
      ...eservice,
      riskAnalysis: eservice.riskAnalysis.filter(
        (r) => r.id !== riskAnalysis.id
      ),
    };

    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceRiskAnalysisDeleted",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceRiskAnalysisDeletedV2,
      payload: writtenEvent.data,
    });
    expect(writtenPayload).toEqual({
      riskAnalysisId: riskAnalysis.id,
      eservice: toEServiceV2(expectedEservice),
    });
    expect(deleteResponse).toEqual({
      data: expectedEservice,
      metadata: { version: 1 },
    });
  });
  it("should write on event-store for the deletion of a risk analysis (delegate)", async () => {
    const riskAnalysis = getMockValidRiskAnalysis("PA");
    const eservice: EService = {
      ...mockEService,
      descriptors: [],
      riskAnalysis: [riskAnalysis],
      mode: "Receive",
    };
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      state: delegationState.active,
    });

    await addOneEService(eservice);
    await addOneDelegation(delegation);

    const deleteResponse = await catalogService.deleteRiskAnalysis(
      eservice.id,
      riskAnalysis.id,
      getMockContext({ authData: getMockAuthData(delegation.delegateId) })
    );

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    const expectedEservice = {
      ...eservice,
      riskAnalysis: eservice.riskAnalysis.filter(
        (r) => r.id !== riskAnalysis.id
      ),
    };

    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceRiskAnalysisDeleted",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceRiskAnalysisDeletedV2,
      payload: writtenEvent.data,
    });
    expect(writtenPayload).toEqual({
      riskAnalysisId: riskAnalysis.id,
      eservice: toEServiceV2(expectedEservice),
    });
    expect(deleteResponse).toEqual({
      data: expectedEservice,
      metadata: { version: 1 },
    });
  });
  it("should write on event-store for the deletion of a risk analysis", async () => {
    const riskAnalysis = getMockValidRiskAnalysis("PA");
    const eservice: EService = {
      ...mockEService,
      descriptors: [],
      riskAnalysis: [riskAnalysis],
      mode: "Receive",
    };
    await addOneEService(eservice);

    const deleteResponse = await catalogService.deleteRiskAnalysis(
      eservice.id,
      riskAnalysis.id,
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    const expectedEservice = {
      ...eservice,
      riskAnalysis: eservice.riskAnalysis.filter(
        (r) => r.id !== riskAnalysis.id
      ),
    };

    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceRiskAnalysisDeleted",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceRiskAnalysisDeletedV2,
      payload: writtenEvent.data,
    });
    expect(writtenPayload).toEqual({
      riskAnalysisId: riskAnalysis.id,
      eservice: toEServiceV2(expectedEservice),
    });
    expect(deleteResponse).toEqual({
      data: expectedEservice,
      metadata: { version: 1 },
    });
  });
  it("should throw eServiceNotFound if the eservice doesn't exist", () => {
    expect(
      catalogService.deleteRiskAnalysis(
        mockEService.id,
        generateId<RiskAnalysisId>(),
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(eServiceNotFound(mockEService.id));
  });
  it("should throw eServiceRiskAnalysisNotFound if the riskAnalysis doesn't exist", async () => {
    const eservice: EService = {
      ...mockEService,
      descriptors: [],
      riskAnalysis: [],
      mode: "Receive",
    };
    await addOneEService(eservice);

    const riskAnalysisId = generateId<RiskAnalysisId>();
    expect(
      catalogService.deleteRiskAnalysis(
        eservice.id,
        riskAnalysisId,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(
      eServiceRiskAnalysisNotFound(eservice.id, riskAnalysisId)
    );
  });
  it("should throw eserviceNotInDraftState if the eservice has a non-draft descriptor", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.published,
      interface: mockDocument,
      publishedAt: new Date(),
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
      riskAnalysis: [getMockValidRiskAnalysis("PA")],
      mode: "Receive",
    };
    await addOneEService(eservice);

    expect(
      catalogService.deleteRiskAnalysis(
        eservice.id,
        generateId<RiskAnalysisId>(),
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(eserviceNotInDraftState(eservice.id));
  });

  it("should throw operationForbidden if the requester is not the producer", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.published,
      interface: mockDocument,
      publishedAt: new Date(),
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
      riskAnalysis: [getMockValidRiskAnalysis("PA")],
      mode: "Receive",
    };
    await addOneEService(eservice);

    expect(
      catalogService.deleteRiskAnalysis(
        eservice.id,
        generateId<RiskAnalysisId>(),
        getMockContext({})
      )
    ).rejects.toThrowError(operationForbidden);
  });
  it("should throw operationForbidden if the requester if the given e-service has been delegated and caller is not the delegate", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.published,
      interface: mockDocument,
      publishedAt: new Date(),
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
      riskAnalysis: [getMockValidRiskAnalysis("PA")],
      mode: "Receive",
    };
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      state: delegationState.active,
    });

    await addOneEService(eservice);
    await addOneDelegation(delegation);

    expect(
      catalogService.deleteRiskAnalysis(
        eservice.id,
        generateId<RiskAnalysisId>(),
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(operationForbidden);
  });
  it("should throw templateInstanceNotAllowed if the templateId is defined", async () => {
    const templateId = unsafeBrandId<EServiceTemplateId>(generateId());
    const eservice: EService = {
      ...mockEService,
      templateId,
      descriptors: [],
      riskAnalysis: [getMockValidRiskAnalysis("PA")],
      mode: "Receive",
    };
    await addOneEService(eservice);

    expect(
      catalogService.deleteRiskAnalysis(
        eservice.id,
        generateId<RiskAnalysisId>(),
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(templateInstanceNotAllowed(eservice.id, templateId));
  });
});

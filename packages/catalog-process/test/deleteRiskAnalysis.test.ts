/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger } from "pagopa-interop-commons";
import {
  getMockValidRiskAnalysis,
  decodeProtobufPayload,
} from "pagopa-interop-commons-test/index.js";
import {
  EService,
  toEServiceV2,
  EServiceRiskAnalysisDeletedV2,
  generateId,
  RiskAnalysisId,
  Descriptor,
  descriptorState,
  operationForbidden,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  eServiceNotFound,
  eServiceRiskAnalysisNotFound,
  eserviceNotInDraftState,
} from "../src/model/domain/errors.js";
import {
  addOneEService,
  catalogService,
  getMockAuthData,
  getMockDescriptor,
  getMockDocument,
  getMockEService,
  readLastEserviceEvent,
} from "./utils.js";

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

    await catalogService.deleteRiskAnalysis(eservice.id, riskAnalysis.id, {
      authData: getMockAuthData(eservice.producerId),
      correlationId: "",
      serviceName: "",
      logger: genericLogger,
    });

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    const expectedEservice = toEServiceV2({
      ...eservice,
      riskAnalysis: eservice.riskAnalysis.filter(
        (r) => r.id !== riskAnalysis.id
      ),
    });

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
      eservice: expectedEservice,
    });
  });
  it("should throw eServiceNotFound if the eservice doesn't exist", () => {
    expect(
      catalogService.deleteRiskAnalysis(
        mockEService.id,
        generateId<RiskAnalysisId>(),
        {
          authData: getMockAuthData(mockEService.producerId),
          correlationId: "",
          serviceName: "",
          logger: genericLogger,
        }
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
      catalogService.deleteRiskAnalysis(eservice.id, riskAnalysisId, {
        authData: getMockAuthData(eservice.producerId),
        correlationId: "",
        serviceName: "",
        logger: genericLogger,
      })
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
        {
          authData: getMockAuthData(eservice.producerId),
          correlationId: "",
          serviceName: "",
          logger: genericLogger,
        }
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
        {
          authData: getMockAuthData(),
          correlationId: "",
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(operationForbidden);
  });
});

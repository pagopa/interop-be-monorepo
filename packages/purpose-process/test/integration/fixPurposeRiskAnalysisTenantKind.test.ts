/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, it, expect } from "vitest";
import {
  Purpose,
  MaintenancePurposeRiskAnalysisSetTenantKindV2,
  RiskAnalysisId,
  TenantKind,
  tenantKind,
  toPurposeV2,
  generateId,
  PurposeId,
  EService,
  eserviceMode,
} from "pagopa-interop-models";
import {
  decodeProtobufPayload,
  getMockContextInternal,
  getMockEService,
  getMockPurpose,
  getMockTenant,
  getMockValidRiskAnalysisForm,
  sortPurpose,
} from "pagopa-interop-commons-test";
import {
  purposeNotFound,
  unableToDetermineTenantKind,
  tenantKindNotFound,
} from "../../src/model/domain/errors.js";
import {
  addOneEService,
  addOnePurpose,
  addOneTenantKindHistory,
  purposeService,
  readLastPurposeEvent,
} from "../integrationUtils.js";

describe("fixPurposeRiskAnalysisTenantKind", () => {
  it("should use consumer's kind for deliver-mode eservices", async () => {
    const consumerKind: TenantKind = tenantKind.PA;
    const consumer = getMockTenant();
    const eservice: EService = {
      ...getMockEService(),
      mode: eserviceMode.deliver,
      personalData: false,
    };

    const riskAnalysisId = generateId<RiskAnalysisId>();
    const riskAnalysisForm = {
      ...getMockValidRiskAnalysisForm(consumerKind),
      riskAnalysisId,
      tenantKind: undefined,
    };

    const purpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: eservice.id,
      consumerId: consumer.id,
      riskAnalysisForm,
      createdAt: new Date("2024-01-10T10:00:00.000Z"),
    };

    await addOneEService(eservice);
    await addOnePurpose(purpose);

    await addOneTenantKindHistory({
      tenantId: consumer.id,
      metadataVersion: 0,
      kind: consumerKind,
      modifiedAt: new Date("2024-01-01T00:00:00.000Z"),
    });

    await purposeService.fixPurposeRiskAnalysisTenantKind(
      purpose.id,
      getMockContextInternal({})
    );

    const writtenEvent = await readLastPurposeEvent(purpose.id);
    expect(writtenEvent).toMatchObject({
      stream_id: purpose.id,
      version: "1",
      type: "MaintenancePurposeRiskAnalysisSetTenantKind",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: MaintenancePurposeRiskAnalysisSetTenantKindV2,
      payload: writtenEvent.data,
    });

    const expectedPurpose: Purpose = {
      ...purpose,
      riskAnalysisForm: {
        ...riskAnalysisForm,
        tenantKind: consumerKind,
      },
    };

    expect({
      purpose: sortPurpose(writtenPayload.purpose),
    }).toEqual({
      purpose: sortPurpose(toPurposeV2(expectedPurpose)),
    });
  });

  it("should use producer's kind for receive-mode eservices", async () => {
    const producerKind: TenantKind = tenantKind.PRIVATE;
    const producer = getMockTenant();
    const riskAnalysisId = generateId<RiskAnalysisId>();
    const riskAnalysisForm = {
      ...getMockValidRiskAnalysisForm(producerKind),
      riskAnalysisId,
      tenantKind: undefined,
    };

    const eservice: EService = {
      ...getMockEService(),
      mode: eserviceMode.receive,
      producerId: producer.id,
      personalData: false,
      riskAnalysis: [
        {
          id: riskAnalysisId,
          name: "risk analysis",
          riskAnalysisForm: getMockValidRiskAnalysisForm(producerKind),
          createdAt: new Date("2024-01-05T00:00:00.000Z"),
        },
      ],
    };

    const purpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: eservice.id,
      riskAnalysisForm,
      createdAt: new Date("2024-01-10T10:00:00.000Z"),
    };

    await addOneEService(eservice);
    await addOnePurpose(purpose);

    await addOneTenantKindHistory({
      tenantId: producer.id,
      metadataVersion: 0,
      kind: producerKind,
      modifiedAt: new Date("2024-01-01T00:00:00.000Z"),
    });

    await purposeService.fixPurposeRiskAnalysisTenantKind(
      purpose.id,
      getMockContextInternal({})
    );

    const writtenEvent = await readLastPurposeEvent(purpose.id);
    expect(writtenEvent).toMatchObject({
      stream_id: purpose.id,
      version: "1",
      type: "MaintenancePurposeRiskAnalysisSetTenantKind",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: MaintenancePurposeRiskAnalysisSetTenantKindV2,
      payload: writtenEvent.data,
    });

    const expectedPurpose: Purpose = {
      ...purpose,
      riskAnalysisForm: {
        ...riskAnalysisForm,
        tenantKind: producerKind,
      },
    };

    expect({
      purpose: sortPurpose(writtenPayload.purpose),
    }).toEqual({
      purpose: sortPurpose(toPurposeV2(expectedPurpose)),
    });
  });

  it("Should throw tenantKindNotFound when history is empty", async () => {
    const consumerKind: TenantKind = tenantKind.PA;
    const riskAnalysisId = generateId<RiskAnalysisId>();
    const riskAnalysisForm = {
      ...getMockValidRiskAnalysisForm(consumerKind),
      riskAnalysisId,
      tenantKind: undefined,
    };

    const eservice: EService = {
      ...getMockEService(),
      mode: eserviceMode.deliver,
      personalData: false,
    };

    const purpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: eservice.id,
      riskAnalysisForm,
    };

    await addOneEService(eservice);
    await addOnePurpose(purpose);

    expect(
      purposeService.fixPurposeRiskAnalysisTenantKind(
        purpose.id,
        getMockContextInternal({})
      )
    ).rejects.toThrowError(tenantKindNotFound(purpose.consumerId));
  });

  it("Should throw unableToDetermineTenantKind when receive-mode has no reference date", async () => {
    const producer = getMockTenant();
    const riskAnalysisId = generateId<RiskAnalysisId>();
    const riskAnalysisForm = {
      ...getMockValidRiskAnalysisForm(tenantKind.PRIVATE),
      riskAnalysisId,
      tenantKind: undefined,
    };

    const eservice: EService = {
      ...getMockEService(),
      mode: eserviceMode.receive,
      producerId: producer.id,
      personalData: false,
      descriptors: [],
      riskAnalysis: [],
    };

    const purpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: eservice.id,
      riskAnalysisForm,
    };

    await addOneEService(eservice);
    await addOnePurpose(purpose);

    expect(
      purposeService.fixPurposeRiskAnalysisTenantKind(
        purpose.id,
        getMockContextInternal({})
      )
    ).rejects.toThrowError(unableToDetermineTenantKind(producer.id));
  });

  it("Should throw purposeNotFound when purpose doesn't exist", async () => {
    const unknownPurposeId = generateId<PurposeId>();

    expect(
      purposeService.fixPurposeRiskAnalysisTenantKind(
        unknownPurposeId,
        getMockContextInternal({})
      )
    ).rejects.toThrowError(purposeNotFound(unknownPurposeId));
  });
});

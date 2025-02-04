/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockDocument,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  getMockTenant,
  getMockValidRiskAnalysis,
  randomArrayItem,
} from "pagopa-interop-commons-test";
import {
  generateId,
  TenantId,
  EServiceTemplateVersion,
  eserviceTemplateVersionState,
  EServiceTemplate,
  toEServiceTemplateV2,
  eserviceMode,
  TenantKind,
  tenantKind,
  Tenant,
  EServiceTemplateRiskAnalysisDeletedV2,
} from "pagopa-interop-models";
import { expect, describe, it, vi, afterAll, beforeAll } from "vitest";
import {
  eServiceTemplateNotFound,
  eserviceTemplateRequesterIsNotCreator,
  templateNotInDraftState,
  templateNotInReceiveMode,
} from "../src/model/domain/errors.js";
import {
  addOneEServiceTemplate,
  riskAnalysisService,
  readLastEserviceTemplateEvent,
  addOneTenant,
} from "./utils.js";

describe("deleteEServiceTemplateRiskAnalysis", () => {
  const mockDate = new Date();
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it("should write on event-store for the deletion of the eService template risk analysis", async () => {
    const requesterId = generateId<TenantId>();

    const creatorTenantKind: TenantKind = randomArrayItem(
      Object.values(tenantKind)
    );
    const creator: Tenant = {
      ...getMockTenant(requesterId),
      kind: creatorTenantKind,
    };

    const riskAnalysis = getMockValidRiskAnalysis(creatorTenantKind);
    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.draft,
      interface: getMockDocument(),
    };
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      mode: eserviceMode.receive,
      versions: [eserviceTemplateVersion],
      riskAnalysis: [riskAnalysis],
      creatorId: requesterId,
    };
    await addOneTenant(creator);
    await addOneEServiceTemplate(eserviceTemplate);

    await riskAnalysisService.deleteRiskAnalysis(
      eserviceTemplate.id,
      riskAnalysis.id,
      {
        authData: getMockAuthData(eserviceTemplate.creatorId),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      }
    );
    const writtenEvent = await readLastEserviceTemplateEvent(
      eserviceTemplate.id
    );
    expect(writtenEvent).toMatchObject({
      stream_id: eserviceTemplate.id,
      version: "1",
      type: "EServiceTemplateRiskAnalysisDeleted",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceTemplateRiskAnalysisDeletedV2,
      payload: writtenEvent.data,
    });

    const updatedEServiceTemplate: EServiceTemplate = {
      ...eserviceTemplate,
      riskAnalysis: [],
    };

    expect(writtenPayload.eserviceTemplate).toEqual(
      toEServiceTemplateV2(updatedEServiceTemplate)
    );
  });

  it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
    const requesterId = generateId<TenantId>();

    const creatorTenantKind: TenantKind = randomArrayItem(
      Object.values(tenantKind)
    );

    const riskAnalysis = getMockValidRiskAnalysis(creatorTenantKind);
    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.draft,
      interface: getMockDocument(),
    };
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      mode: eserviceMode.receive,
      versions: [eserviceTemplateVersion],
      riskAnalysis: [riskAnalysis],
      creatorId: requesterId,
    };

    expect(
      riskAnalysisService.deleteRiskAnalysis(
        eserviceTemplate.id,
        riskAnalysis.id,
        {
          authData: getMockAuthData(eserviceTemplate.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(eServiceTemplateNotFound(eserviceTemplate.id));
  });
  it("should throw operationForbidden if the requester is not the creator", async () => {
    const requesterId = generateId<TenantId>();

    const creatorTenantKind: TenantKind = randomArrayItem(
      Object.values(tenantKind)
    );
    const creator: Tenant = {
      ...getMockTenant(requesterId),
      kind: creatorTenantKind,
    };

    const riskAnalysis = getMockValidRiskAnalysis(creatorTenantKind);
    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.draft,
      interface: getMockDocument(),
    };
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      mode: eserviceMode.receive,
      versions: [eserviceTemplateVersion],
      riskAnalysis: [riskAnalysis],
      creatorId: generateId(),
    };
    await addOneTenant(creator);
    await addOneEServiceTemplate(eserviceTemplate);

    expect(
      riskAnalysisService.deleteRiskAnalysis(
        eserviceTemplate.id,
        riskAnalysis.id,
        {
          authData: getMockAuthData(requesterId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      eserviceTemplateRequesterIsNotCreator(eserviceTemplate.id)
    );
  });
  it("should throw eserviceNotInDraftState if the eservice is not in draft state", async () => {
    const requesterId = generateId<TenantId>();

    const creatorTenantKind: TenantKind = randomArrayItem(
      Object.values(tenantKind)
    );
    const creator: Tenant = {
      ...getMockTenant(requesterId),
      kind: creatorTenantKind,
    };

    const riskAnalysis = getMockValidRiskAnalysis(creatorTenantKind);
    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.published,
      interface: getMockDocument(),
    };
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      mode: eserviceMode.receive,
      versions: [eserviceTemplateVersion],
      riskAnalysis: [riskAnalysis],
      creatorId: requesterId,
    };
    await addOneTenant(creator);
    await addOneEServiceTemplate(eserviceTemplate);

    expect(
      riskAnalysisService.deleteRiskAnalysis(
        eserviceTemplate.id,
        riskAnalysis.id,
        {
          authData: getMockAuthData(eserviceTemplate.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(templateNotInDraftState(eserviceTemplate.id));
  });
  it("should throw eserviceNotInReceiveMode if the eservice is not in receive mode", async () => {
    const requesterId = generateId<TenantId>();

    const creatorTenantKind: TenantKind = randomArrayItem(
      Object.values(tenantKind)
    );
    const creator: Tenant = {
      ...getMockTenant(requesterId),
      kind: creatorTenantKind,
    };

    const riskAnalysis = getMockValidRiskAnalysis(creatorTenantKind);
    const eserviceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.draft,
      interface: getMockDocument(),
    };
    const eserviceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      mode: eserviceMode.deliver,
      versions: [eserviceTemplateVersion],
      riskAnalysis: [riskAnalysis],
      creatorId: requesterId,
    };
    await addOneTenant(creator);
    await addOneEServiceTemplate(eserviceTemplate);

    expect(
      riskAnalysisService.deleteRiskAnalysis(
        eserviceTemplate.id,
        riskAnalysis.id,
        {
          authData: getMockAuthData(eserviceTemplate.creatorId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(templateNotInReceiveMode(eserviceTemplate.id));
  });
});

/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import path from "path";
import { fileURLToPath } from "url";
import {
  RefreshableInteropToken,
  dateAtRomeZone,
  genericLogger,
  getIpaCode,
  getFormRulesByVersion,
  dataType,
} from "pagopa-interop-commons";
import {
  getMockTenant,
  getMockValidRiskAnalysisFormTemplate,
} from "pagopa-interop-commons-test/index.js";
import {
  CorrelationId,
  PurposeTemplate,
  PurposeTemplateEventEnvelopeV2,
  Tenant,
  TenantKind,
  generateId,
  toPurposeTemplateV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from "vitest";
import {
  cleanup,
  pdfGenerator,
  addOneTenant,
  fileManager,
  readModelService,
} from "../integrationUtils.js";

import { handlePurposeTemplateMessageV2 } from "../../src/handler/handlePurposeTemplateMessageV2.js";
import { getInteropBeClients } from "../../src/clients/clientProvider.js";

const clients = getInteropBeClients();

export const mockInternalAddRiskAnalysisTemplateDocumentMetadataFn = vi.fn();

vi.mock("pagopa-interop-api-clients", () => ({
  delegationApi: {
    createDelegationApiClient: vi.fn(),
  },
  agreementApi: {
    createAgreementApiClient: vi.fn(),
  },
  purposeApi: {
    createPurposeApiClient: vi.fn(),
  },
  purposeTemplateApi: {
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    createPurposeTemplateApiClient: () => ({
      // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
      get internalAddRiskAnalysisTemplateDocumentMetadata() {
        return mockInternalAddRiskAnalysisTemplateDocumentMetadataFn;
      },
    }),
  },
}));

describe("handlePurposeTemplateMessageV2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  const testToken = "mockToken";

  const testHeaders = {
    "X-Correlation-Id": generateId(),
    Authorization: `Bearer ${testToken}`,
  };

  let mockRefreshableToken: RefreshableInteropToken;

  beforeAll(() => {
    mockRefreshableToken = {
      get: () => Promise.resolve({ serialized: testToken }),
    } as unknown as RefreshableInteropToken;
  });
  afterEach(cleanup);

  it("should write on event-store for the publication of a purpose template and call purpose-template-process", async () => {
    vi.spyOn(pdfGenerator, "generate");

    const mockCreator: Tenant = {
      ...getMockTenant(),
      kind: "PA",
    };

    const baseRiskAnalysisForm = getMockValidRiskAnalysisFormTemplate("PA");
    const version = "3.0";

    const rules = getFormRulesByVersion(TenantKind.Enum.PA, version);

    const freeTextQuestionIds = new Set(
      rules?.questions
        .filter((q) => q.dataType === dataType.freeText)
        .map((q) => q.id)
    );

    const sanitizedRiskAnalysisForm = {
      ...baseRiskAnalysisForm,
      version,
      singleAnswers: baseRiskAnalysisForm.singleAnswers.map((answer) => {
        if (freeTextQuestionIds.has(answer.key)) {
          return { ...answer, value: undefined };
        }
        return answer;
      }),
    };

    const mockPurposeTemplate: PurposeTemplate = {
      id: generateId(),
      purposeTitle: "Mock Purpose Template Title",
      purposeDescription: "Mock Description",
      createdAt: new Date(),
      creatorId: mockCreator.id,
      state: "Published",
      purposeRiskAnalysisForm: sanitizedRiskAnalysisForm,
      purposeIsFreeOfCharge: true,
      purposeFreeOfChargeReason: "Test Reason",
      targetTenantKind: "PA",
      targetDescription: "Target Desc",
      handlesPersonalData: true,
      updatedAt: undefined,
      purposeDailyCalls: 100,
    };

    await addOneTenant(mockCreator);

    const mockEvent: PurposeTemplateEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockPurposeTemplate.id,
      version: 1,
      event_version: 2,
      type: "PurposeTemplatePublished",
      data: { purposeTemplate: toPurposeTemplateV2(mockPurposeTemplate) },
      log_date: new Date(),
      correlation_id: generateId(),
    };

    testHeaders["X-Correlation-Id"] = unsafeBrandId<CorrelationId>(
      mockEvent.correlation_id!
    );

    await handlePurposeTemplateMessageV2(
      mockEvent,
      pdfGenerator,
      fileManager,
      readModelService,
      mockRefreshableToken,
      clients,
      genericLogger
    );

    const expectedPdfPayload = {
      purposeTemplateId: mockPurposeTemplate.id,
      creatorName: mockCreator.name,
      creatorIPACode: getIpaCode(mockCreator),
      targetDescription: mockPurposeTemplate.targetDescription,
      handlesPersonalData: "Sì, tratta dati personali",
      purposeIsFreeOfCharge: expect.stringContaining("Sì"),
      purposeFreeOfChargeReason: expect.stringContaining(
        mockPurposeTemplate.purposeFreeOfChargeReason!
      ),
      answers: expect.any(String),
      date: dateAtRomeZone(mockEvent.log_date),
    };

    expect(pdfGenerator.generate).toBeCalledWith(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../src",
        "resources/purpose-template",
        "purposeTemplateRiskAnalysisTemplate.html"
      ),
      expectedPdfPayload
    );

    expect(
      mockInternalAddRiskAnalysisTemplateDocumentMetadataFn
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: "application/pdf",
        createdAt: expect.any(String),
        id: expect.any(String),
        path: expect.any(String),
        prettyName: "Template Analisi del rischio",
      }),
      expect.objectContaining({
        params: {
          purposeTemplateId: mockPurposeTemplate.id,
        },
        headers: testHeaders,
      })
    );
  });

  it("should not process events that don't require contract generation and only log an info message", async () => {
    const mockPurposeTemplate: PurposeTemplate = {
      id: generateId(),
      purposeTitle: "Mock Purpose Template Title",
      purposeDescription: "Mock Description",
      createdAt: new Date(),
      creatorId: generateId(),
      state: "Draft",
      purposeRiskAnalysisForm: getMockValidRiskAnalysisFormTemplate("PA"),
      purposeIsFreeOfCharge: true,
      targetTenantKind: "PA",
      targetDescription: "Target Desc",
      handlesPersonalData: true,
    };

    const mockEvent: PurposeTemplateEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mockPurposeTemplate.id,
      version: 1,
      event_version: 2,
      type: "PurposeTemplateAdded",
      data: { purposeTemplate: toPurposeTemplateV2(mockPurposeTemplate) },
      log_date: new Date(),
    };

    const pdfGeneratorSpy = vi.spyOn(pdfGenerator, "generate");
    const fileManagerSpy = vi.spyOn(fileManager, "resumeOrStoreBytes");

    await expect(
      handlePurposeTemplateMessageV2(
        mockEvent,
        pdfGenerator,
        fileManager,
        readModelService,
        mockRefreshableToken,
        clients,
        genericLogger
      )
    ).resolves.toBeUndefined();

    expect(pdfGeneratorSpy).not.toHaveBeenCalled();
    expect(fileManagerSpy).not.toHaveBeenCalled();
    expect(
      mockInternalAddRiskAnalysisTemplateDocumentMetadataFn
    ).not.toHaveBeenCalled();
  });

  it("should throw error if purposeTemplate data is missing in the event", async () => {
    const mockEvent: PurposeTemplateEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: generateId(),
      version: 1,
      event_version: 2,
      type: "PurposeTemplatePublished",
      data: { purposeTemplate: undefined },
      log_date: new Date(),
    };

    await expect(
      handlePurposeTemplateMessageV2(
        mockEvent,
        pdfGenerator,
        fileManager,
        readModelService,
        mockRefreshableToken,
        clients,
        genericLogger
      )
    ).rejects.toThrow(/missing data 'purposeTemplate'/);
  });
});

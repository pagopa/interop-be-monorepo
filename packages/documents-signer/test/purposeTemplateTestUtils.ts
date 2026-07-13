import {
  getMockCompleteRiskAnalysisFormTemplate,
  getMockPurposeTemplate,
} from "pagopa-interop-commons-test";
import {
  PurposeTemplate,
  PurposeTemplateEventEnvelopeV2,
  toPurposeTemplateV2,
} from "pagopa-interop-models";

type RiskAnalysisTemplateDocumentGeneratedEvent = Extract<
  PurposeTemplateEventEnvelopeV2,
  { type: "RiskAnalysisTemplateDocumentGenerated" }
>;

type PurposeTemplatePublishedEvent = Extract<
  PurposeTemplateEventEnvelopeV2,
  { type: "PurposeTemplatePublished" }
>;

const defaultCorrelationId = "test-correlation-id";
const defaultDocumentPath = "risk-analysis-template/file.pdf";

export function makePurposeTemplate({
  documentPath = defaultDocumentPath,
  overrides = {},
}: {
  documentPath?: string;
  overrides?: Partial<PurposeTemplate>;
} = {}): PurposeTemplate {
  const riskAnalysisForm = getMockCompleteRiskAnalysisFormTemplate();

  return {
    ...getMockPurposeTemplate(),
    ...overrides,
    purposeRiskAnalysisForm: {
      ...riskAnalysisForm,
      document: {
        ...riskAnalysisForm.document!,
        name: "file.pdf",
        prettyName: "file.pdf",
        path: documentPath,
      },
    },
  };
}

export function makeRiskAnalysisTemplateDocumentGeneratedEvent({
  purposeTemplate = makePurposeTemplate(),
  correlationId = defaultCorrelationId,
}: {
  purposeTemplate?: PurposeTemplate;
  correlationId?: string;
} = {}): RiskAnalysisTemplateDocumentGeneratedEvent {
  return {
    sequence_num: 1,
    stream_id: purposeTemplate.id,
    version: 1,
    log_date: new Date(),
    correlation_id: correlationId,
    type: "RiskAnalysisTemplateDocumentGenerated",
    data: {
      purposeTemplate: toPurposeTemplateV2(purposeTemplate),
    },
    event_version: 2,
  };
}

export function makePurposeTemplatePublishedEvent({
  purposeTemplate = makePurposeTemplate(),
  correlationId = defaultCorrelationId,
}: {
  purposeTemplate?: PurposeTemplate;
  correlationId?: string;
} = {}): PurposeTemplatePublishedEvent {
  return {
    sequence_num: 1,
    stream_id: purposeTemplate.id,
    version: 1,
    log_date: new Date(),
    correlation_id: correlationId,
    type: "PurposeTemplatePublished",
    data: {
      purposeTemplate: toPurposeTemplateV2(purposeTemplate),
    },
    event_version: 2,
  };
}

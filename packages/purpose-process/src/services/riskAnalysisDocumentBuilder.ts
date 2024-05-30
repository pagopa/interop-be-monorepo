import path from "path";
import { fileURLToPath } from "url";
import {
  FileManager,
  FormQuestionRules,
  Logger,
  PDFGenerator,
  RiskAnalysisFormRules,
  dateAtRomeZone,
  getFormRulesByVersion,
} from "pagopa-interop-commons";
import {
  PurposeDocumentEServiceInfo,
  Purpose,
  PurposeVersionDocument,
  PurposeVersionDocumentId,
  TenantKind,
  generateId,
  PurposeRiskAnalysisForm,
  RiskAnalysisDocumentPDFPayload,
  eserviceMode,
  RiskAnalysisSingleAnswer,
  RiskAnalysisMultiAnswer,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  missingRiskAnalysis,
  riskAnalysisConfigVersionNotFound,
} from "../model/domain/errors.js";
import { PurposeProcessConfig } from "../utilities/config.js";

const YES = "Sì";
const NO = "No";
const NOT_AVAILABLE = "N/A";

const createRiskAnalysisDocumentName = (): string =>
  `${new Date().toISOString()}_${generateId()}_risk_analysis.pdf`;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const riskAnalysisDocumentBuilder = (
  pdfGenerator: PDFGenerator,
  fileManager: FileManager,
  config: PurposeProcessConfig,
  logger: Logger
) => {
  const filename = fileURLToPath(import.meta.url);
  const dirname = path.dirname(filename);

  return {
    createRiskAnalysisDocument: async (
      purpose: Purpose,
      dailyCalls: number,
      eserviceInfo: PurposeDocumentEServiceInfo,
      tenantKind: TenantKind
    ): Promise<PurposeVersionDocument> => {
      const templateFilePath = path.resolve(
        dirname,
        "..",
        "resources/templates/documents",
        "agreementContractTemplate.html"
      );

      if (!purpose.riskAnalysisForm) {
        throw missingRiskAnalysis(purpose.id);
      }

      const riskAnalysisVersion = purpose.riskAnalysisForm.version;

      const riskAnalysisFormConfig = getFormRulesByVersion(
        tenantKind,
        riskAnalysisVersion
      );

      if (!riskAnalysisFormConfig) {
        throw riskAnalysisConfigVersionNotFound(
          riskAnalysisVersion,
          tenantKind
        );
      }

      const pdfPayload = getPdfPayload({
        riskAnalysisFormConfig,
        riskAnalysisForm: purpose.riskAnalysisForm,
        dailyCalls,
        eserviceInfo,
        isFreeOfCharge: purpose.isFreeOfCharge,
        freeOfChargeReason: purpose.freeOfChargeReason,
      });

      const pdfBuffer: Buffer = await pdfGenerator.generate(
        templateFilePath,
        pdfPayload
      );

      const documentId = generateId<PurposeVersionDocumentId>();
      const documentName = createRiskAnalysisDocumentName();

      const documentPath = await fileManager.storeBytes(
        config.s3Bucket,
        `TODO`,
        documentId,
        documentName,
        pdfBuffer,
        logger
      );

      return {
        id: documentId,
        contentType: "application/pdf",
        path: documentPath,
        createdAt: new Date(),
      };
    },
  };
};

const getPdfPayload = ({
  riskAnalysisFormConfig,
  riskAnalysisForm,
  dailyCalls,
  eserviceInfo,
  isFreeOfCharge,
  freeOfChargeReason,
}: {
  riskAnalysisFormConfig: RiskAnalysisFormRules;
  riskAnalysisForm: PurposeRiskAnalysisForm;
  dailyCalls: number;
  eserviceInfo: PurposeDocumentEServiceInfo;
  isFreeOfCharge: boolean;
  freeOfChargeReason?: string;
}): RiskAnalysisDocumentPDFPayload => {
  const answers = formatAnswers(riskAnalysisFormConfig, riskAnalysisForm);
  const { freeOfChargeHtml, freeOfChargeReasonHtml } = formatFreeOfCharge(
    isFreeOfCharge,
    freeOfChargeReason
  );
  const eServiceMode = match(eserviceInfo.mode)
    .with(eserviceMode.receive, () => "Riceve")
    .with(eserviceMode.deliver, () => "Eroga")
    .exhaustive();

  return {
    dailyCalls: dailyCalls.toString(),
    answers,
    eServiceName: eserviceInfo.name,
    producerText: formatTenantDescription(
      eserviceInfo.producerName,
      eserviceInfo.producerOrigin,
      eserviceInfo.producerIPACode
    ),
    consumerText: formatTenantDescription(
      eserviceInfo.consumerName,
      eserviceInfo.consumerOrigin,
      eserviceInfo.consumerIPACode
    ),
    freeOfCharge: freeOfChargeHtml,
    freeOfChargeReason: freeOfChargeReasonHtml,
    date: dateAtRomeZone(new Date()),
    eServiceMode,
  };
};

function formatSingleAnswer(
  _questionRules: FormQuestionRules,
  _singleAnswer: RiskAnalysisSingleAnswer
): string {
  return "";
}

function formatMultiAnswer(
  _questionRules: FormQuestionRules,
  _multiAnswer: RiskAnalysisMultiAnswer
): string {
  return "";
}

function formatAnswers(
  formConfig: RiskAnalysisFormRules,
  riskAnalysisForm: PurposeRiskAnalysisForm
): string {
  return formConfig.questions
    .flatMap((questionRules) => {
      const singleAnswers = riskAnalysisForm.singleAnswers
        .filter((a) => a.key === questionRules.id)
        .map((a) => formatSingleAnswer(questionRules, a));
      const multiAnswers = riskAnalysisForm.multiAnswers
        .filter((a) => a.key === questionRules.id)
        .map((a) => formatMultiAnswer(questionRules, a));
      return singleAnswers.concat(multiAnswers);
    })
    .join("\n");
}

function formatFreeOfCharge(
  isFreeOfCharge: boolean,
  freeOfChargeReason?: string
): { freeOfChargeHtml: string; freeOfChargeReasonHtml: string } {
  const freeOfChargeHtml = `<div class="item">
  <div class="label">Indicare se l'accesso ai dati messi a disposizione con la fruizione del presente e-service è a titolo gratuito</div>
  <div class="value">${isFreeOfCharge ? YES : NO}</div>
</div>`;

  const freeOfChargeReasonHtml = isFreeOfCharge
    ? `<div class="item">
  <div class="label">Motivazione titolo gratuito</div>
  <div class="value">${freeOfChargeReason ?? NOT_AVAILABLE}</div>
</div>`
    : '<div class="item-not-visible"></div>';

  return {
    freeOfChargeHtml,
    freeOfChargeReasonHtml,
  };
}

function formatTenantDescription(
  tenantName: string,
  tenantOrigin: string,
  tenantIPACode: string
): string {
  if (tenantOrigin === "IPA") {
    return `${tenantName} (codice IPA: ${tenantIPACode})`;
  }
  return tenantName;
}

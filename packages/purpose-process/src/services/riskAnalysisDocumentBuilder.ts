import path from "path";
import { fileURLToPath } from "url";
import {
  FileManager,
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
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  missingRiskAnalysis,
  riskAnalysisConfigVersionNotFound,
} from "../model/domain/errors.js";
import { PurposeProcessConfig } from "../utilities/config.js";

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
  const answers = sortedAnswers(riskAnalysisFormConfig, riskAnalysisForm);
  const { freeOfChargeHtml, freeOfChargeReadonHtml } = formatFreeOfCharge(
    isFreeOfCharge,
    freeOfChargeReason
  );
  const mode = match(eserviceInfo.mode)
    .with(eserviceMode.receive, () => "Riceve")
    .with(eserviceMode.deliver, () => "Eroga")
    .exhaustive();

  return {
    dailyCalls: dailyCalls.toString(),
    answers,
    eServiceName: eserviceInfo.name,
    producerText: getDescriptionText(
      eserviceInfo.producerName,
      eserviceInfo.producerOrigin,
      eserviceInfo.producerIPACode
    ),
    consumerText: getDescriptionText(
      eserviceInfo.consumerName,
      eserviceInfo.consumerOrigin,
      eserviceInfo.consumerIPACode
    ),
    freeOfCharge: freeOfChargeHtml,
    freeOfChargeReason: freeOfChargeReadonHtml,
    date: dateAtRomeZone(new Date()),
    eServiceMode: mode,
  };
};

function sortedAnswers(
  _formConfig: RiskAnalysisFormRules,
  _riskAnalysisForm: PurposeRiskAnalysisForm
): string {
  return "TODO";
}

function formatFreeOfCharge(
  _isFreeOfCharge: boolean,
  _freeOfChargeReadon?: string
): { freeOfChargeHtml: string; freeOfChargeReadonHtml: string } {
  return {
    freeOfChargeHtml: "TODO",
    freeOfChargeReadonHtml: "TODO",
  };
}

function getDescriptionText(
  _tenantName: string,
  _tenantOrigin: string,
  _tenantIPACode: string
): string {
  return `TODO`;
}

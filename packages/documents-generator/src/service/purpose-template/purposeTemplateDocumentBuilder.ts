import { fileURLToPath } from "url";
import path from "path";
import Handlebars from "handlebars";
import {
  FileManager,
  FormQuestionRules,
  LocalizedText,
  PDFGenerator,
  RiskAnalysisFormRules,
  answerNotFoundInConfigError,
  dataType,
  Logger,
  dateAtRomeZone,
  formatDateyyyyMMddHHmmss,
  getFormRulesByVersion,
  incompatibleConfigError,
  unexpectedRiskAnalysisTemplateFieldValueOrSuggestionError,
} from "pagopa-interop-commons";
import {
  generateId,
  PurposeTemplate,
  RiskAnalysisFormTemplate,
  RiskAnalysisTemplateAnswerAnnotation,
  RiskAnalysisTemplateDocument,
  RiskAnalysisTemplateDocumentId,
  RiskAnalysisTemplateMultiAnswer,
  RiskAnalysisTemplateSingleAnswer,
  TargetTenantKind,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { RiskAnalysisTemplateDocumentPDFPayload } from "../../model/purposeTemplateModels.js";
import { DocumentsGeneratorConfig } from "../../config/config.js";
import {
  missingRiskAnalysis,
  riskAnalysisConfigVersionNotFound,
} from "../../model/errors.js";

const YES = "Sì";
const NO = "No";
const YES_PERSONAL_DATA = "Sì, tratta dati personali";
const NO_PERSONAL_DATA = "No, non tratta dati personali";
const NOT_AVAILABLE = "N/A";
const NO_ANSWER = "-";
const CONTENT_TYPE_PDF = "application/pdf";
const RISK_ANALYSIS_TEMPLATE_DOCUMENT_PRETTY_NAME =
  "Template Analisi del rischio";

type Language = keyof LocalizedText;

const createRiskAnalysisTemplateDocumentName = (
  messageTimestamp: Date
): string =>
  `${formatDateyyyyMMddHHmmss(
    messageTimestamp
  )}_${generateId()}_risk_analysis_template.pdf`;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const riskAnalysisTemplateDocumentBuilder = (
  pdfGenerator: PDFGenerator,
  fileManager: FileManager,
  config: DocumentsGeneratorConfig,
  logger: Logger
) => {
  const filename = fileURLToPath(import.meta.url);
  const dirname = path.dirname(filename);

  return {
    // eslint-disable-next-line max-params
    createRiskAnalysisTemplateDocument: async (
      purposeTemplate: PurposeTemplate,
      creatorName: string,
      creatorIPACode: string | undefined,
      tenantKind: TargetTenantKind,
      language: Language,
      messageTimestamp: Date
    ): Promise<RiskAnalysisTemplateDocument> => {
      const templateFilePath = path.resolve(
        dirname,
        "../..",
        "resources/purpose-template",
        "purposeTemplateRiskAnalysisTemplate.html"
      );

      if (!purposeTemplate.purposeRiskAnalysisForm) {
        throw missingRiskAnalysis(purposeTemplate.id);
      }

      const riskAnalysisVersion =
        purposeTemplate.purposeRiskAnalysisForm.version;

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
        purposeTemplate,
        riskAnalysisFormTemplate: purposeTemplate.purposeRiskAnalysisForm,
        creatorName,
        creatorIPACode,
        purposeIsFreeOfCharge: purposeTemplate.purposeIsFreeOfCharge,
        purposeFreeOfChargeReason: purposeTemplate.purposeFreeOfChargeReason,
        language,
      });

      const pdfBuffer: Buffer = await pdfGenerator.generate(
        templateFilePath,
        pdfPayload
      );

      const documentId = generateId<RiskAnalysisTemplateDocumentId>();
      const documentName =
        createRiskAnalysisTemplateDocumentName(messageTimestamp);

      const documentPath = await fileManager.resumeOrStoreBytes(
        {
          bucket: config.s3Bucket,
          path: config.riskAnalysisTemplateDocumentsPath,
          resourceId: documentId,
          name: documentName,
          content: pdfBuffer,
        },
        logger
      );

      return {
        id: documentId,
        name: documentName,
        prettyName: RISK_ANALYSIS_TEMPLATE_DOCUMENT_PRETTY_NAME,
        contentType: CONTENT_TYPE_PDF,
        path: documentPath,
        createdAt: new Date(),
      };
    },
  };
};

const getPdfPayload = ({
  riskAnalysisFormConfig,
  purposeTemplate,
  riskAnalysisFormTemplate,
  creatorName,
  creatorIPACode,
  purposeIsFreeOfCharge,
  purposeFreeOfChargeReason,
  language,
}: {
  riskAnalysisFormConfig: RiskAnalysisFormRules;
  purposeTemplate: PurposeTemplate;
  riskAnalysisFormTemplate: RiskAnalysisFormTemplate;
  creatorName: string;
  creatorIPACode: string | undefined;
  purposeIsFreeOfCharge: boolean;
  purposeFreeOfChargeReason?: string;
  language: Language;
}): RiskAnalysisTemplateDocumentPDFPayload => {
  const answers = formatAnswers(
    riskAnalysisFormConfig,
    riskAnalysisFormTemplate,
    language
  );
  const { purposeFreeOfChargeHtml, purposeFreeOfChargeReasonHtml } =
    formatFreeOfCharge(purposeIsFreeOfCharge, purposeFreeOfChargeReason);

  return {
    purposeTemplateId: purposeTemplate.id,
    creatorName,
    creatorIPACode,
    targetDescription: purposeTemplate.targetDescription,
    handlesPersonalData: purposeTemplate.handlesPersonalData
      ? YES_PERSONAL_DATA
      : NO_PERSONAL_DATA,
    purposeIsFreeOfCharge: purposeFreeOfChargeHtml,
    purposeFreeOfChargeReason: purposeFreeOfChargeReasonHtml,
    answers,
    date: dateAtRomeZone(new Date()),
  };
};

function formatAnswers(
  formConfig: RiskAnalysisFormRules,
  riskAnalysisForm: RiskAnalysisFormTemplate,
  language: Language
): string {
  return formConfig.questions
    .flatMap((questionRules) => {
      const singleAnswers = riskAnalysisForm.singleAnswers
        .filter((a) => a.key === questionRules.id)
        .map((a) => formatSingleAnswer(questionRules, a, language));
      const multiAnswers = riskAnalysisForm.multiAnswers
        .filter((a) => a.key === questionRules.id)
        .map((a) => formatMultiAnswer(questionRules, a, language));
      return singleAnswers.concat(multiAnswers);
    })
    .join("\n");
}

function getLocalizedLabel(text: LocalizedText, language: Language): string {
  return match(language)
    .with("it", () => text.it)
    .with("en", () => text.en)
    .exhaustive();
}

function getSingleAnswerText(
  language: Language,
  questionRules: FormQuestionRules,
  answer: RiskAnalysisTemplateSingleAnswer
): string {
  return match(questionRules)
    .with({ dataType: dataType.freeText }, () => {
      if (answer.value) {
        throw unexpectedRiskAnalysisTemplateFieldValueOrSuggestionError(
          questionRules.id
        );
      }
      return NO_ANSWER;
    })
    .with({ dataType: dataType.single }, (questionConfig) => {
      if (!answer.value) {
        return NO_ANSWER;
      }
      const labeledValue = questionConfig.options.find(
        (q) => q.value === answer.value
      );
      if (!labeledValue) {
        throw answerNotFoundInConfigError(questionConfig.id, questionRules.id);
      }
      return getLocalizedLabel(labeledValue.label, language);
    })
    .with({ dataType: dataType.multi }, (questionConfig) => {
      throw incompatibleConfigError(questionConfig.id, questionRules.id);
    })
    .exhaustive();
}

function getMultiAnswerText(
  language: Language,
  questionRules: FormQuestionRules,
  answer: RiskAnalysisTemplateMultiAnswer
): string {
  return match(questionRules)
    .returnType<string>()
    .with(
      { dataType: P.union(dataType.freeText, dataType.single) },
      (questionConfig) => {
        throw incompatibleConfigError(questionConfig.id, questionRules.id);
      }
    )
    .with({ dataType: dataType.multi }, (questionConfig) => {
      const value = answer.values
        .map((value) => {
          const labeledValue = questionConfig.options.find(
            (q) => q.value === value
          );
          if (!labeledValue) {
            throw answerNotFoundInConfigError(
              questionConfig.id,
              questionRules.id
            );
          }
          return getLocalizedLabel(labeledValue.label, language);
        })
        .join(", ");

      return value || NO_ANSWER;
    })
    .exhaustive();
}

function getAnswerAnnotation(
  annotation: RiskAnalysisTemplateAnswerAnnotation | undefined
): string {
  if (!annotation) {
    return "";
  }

  const docs = annotation.docs
    .map(
      (doc) =>
        `<div class="doc"><i>Documento allegato: ${doc.prettyName} (id: ${doc.id}, checksum: ${doc.checksum})</i></div>`
    )
    .join("");

  return `<div class="info-label"><i>Annotazione: ${Handlebars.escapeExpression(
    annotation.text
  )}</i></div>
        ${docs}`;
}

function formatSingleAnswer(
  questionRules: FormQuestionRules,
  singleAnswer: RiskAnalysisTemplateSingleAnswer,
  language: Language
): string {
  return formatAnswer(
    questionRules,
    singleAnswer,
    language,
    getSingleAnswerText.bind(null, language),
    getSingleAnswerSuggestedValues,
    getSingleAnswerIsEditable
  );
}

function formatMultiAnswer(
  questionRules: FormQuestionRules,
  multiAnswer: RiskAnalysisTemplateMultiAnswer,
  language: Language
): string {
  return formatAnswer(
    questionRules,
    multiAnswer,
    language,
    getMultiAnswerText.bind(null, language),
    () => "",
    () => multiAnswer.editable
  );
}

function getSingleAnswerSuggestedValues(
  answer: RiskAnalysisTemplateSingleAnswer
): string {
  if (!answer.suggestedValues || answer.suggestedValues.length === 0) {
    return "";
  }

  const valuesList = answer.suggestedValues
    .map(
      (value, idx) =>
        `<li><span class="option-label">Opzione ${
          idx + 1
        }:</span> ${value}</li>`
    )
    .join("");

  return `<div class="suggested-values">
        <div class="title">Risposte:</div>
        <ul class="suggested-value-list">${valuesList}</ul>
      </div>`;
}

function getSingleAnswerIsEditable(
  answer: RiskAnalysisTemplateSingleAnswer
): boolean {
  if (answer.editable) {
    return true;
  }

  return answer.suggestedValues && answer.suggestedValues.length > 0;
}

// eslint-disable-next-line max-params
function formatAnswer<
  T extends RiskAnalysisTemplateSingleAnswer | RiskAnalysisTemplateMultiAnswer
>(
  questionRules: FormQuestionRules,
  answer: T,
  language: Language,
  getAnswerText: (questionRules: FormQuestionRules, answer: T) => string,
  getAnswerSuggestedValues: (answer: T) => string,
  getAnswerIsEditable: (answer: T) => boolean
): string {
  const questionLabel = getLocalizedLabel(questionRules.label, language);
  const infoLabel =
    questionRules.infoLabel &&
    getLocalizedLabel(questionRules.infoLabel, language);
  const answerText = getAnswerText(questionRules, answer);

  const answerAnnotation = getAnswerAnnotation(answer.annotation);
  const answerSuggestedValues = getAnswerSuggestedValues(answer);

  const isEditable = getAnswerIsEditable(answer);

  return `<div class="item">
  <div class="label">${questionLabel}&nbsp;${
    isEditable ? "" : "(Risposta non modificabile)"
  }</div>
  ${infoLabel ? `<div class="info-label">${infoLabel}</div>` : ""}

  ${
    answerSuggestedValues
      ? answerSuggestedValues
      : `<div class="answer"> <span class="answer-label">Risposta:</span> ${answerText}</div>`
  }

  ${answerAnnotation}
</div>
`;
}

function formatFreeOfCharge(
  purposeIsFreeOfCharge: boolean,
  purposeFreeOfChargeReason?: string
): { purposeFreeOfChargeHtml: string; purposeFreeOfChargeReasonHtml: string } {
  const purposeFreeOfChargeHtml = `<div class="item">
  <div class="label">Indicare se l'accesso ai dati messi a disposizione con la fruizione del presente e-service è a titolo gratuito</div>
  <div class="value">${purposeIsFreeOfCharge ? YES : NO}</div>
</div>`;

  const freeOfChargeReasonHtml = purposeIsFreeOfCharge
    ? `<div class="item">
  <div class="label">Motivazione titolo gratuito</div>
  <div class="value">${
    purposeFreeOfChargeReason
      ? Handlebars.escapeExpression(purposeFreeOfChargeReason)
      : NOT_AVAILABLE
  }</div>
</div>`
    : '<div class="item-not-visible"></div>';

  return {
    purposeFreeOfChargeHtml,
    purposeFreeOfChargeReasonHtml: freeOfChargeReasonHtml,
  };
}

import Handlebars from "handlebars";
import {
  FormQuestionRules,
  LocalizedText,
  answerNotFoundInConfigError,
  dataType,
  incompatibleConfigError,
} from "pagopa-interop-commons";
import {
  RiskAnalysisTemplateAnswerAnnotation,
  RiskAnalysisTemplateMultiAnswer,
  RiskAnalysisTemplateSingleAnswer,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";

const YES = "Sì";
const NO = "No";
const NOT_AVAILABLE = "N/A";
const NO_ANSWER = "-";

type Language = keyof LocalizedText;

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
        // TODO: change error
        throw new Error("Free text answers should not have a value. ");
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

  return `<div class="annotation">
        <div class="title">Annotazioni fornite dal creatore</div>
        <div class="text">${Handlebars.escapeExpression(annotation.text)}</div>
        ${
          annotation.docs
            ? `<ul class="docs">${annotation.docs.map(
                (doc) => `<li>${doc.prettyName}</li>`
              )}</ul>`
            : ""
        }
      </div>`;
}

// TODO: remove eslint-disable
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    getSingleAnswerSuggestedValues
  );
}

// TODO: remove eslint-disable
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    () => ""
  );
}

function getSingleAnswerSuggestedValues(
  answer: RiskAnalysisTemplateSingleAnswer
): string {
  if (!answer.suggestedValues || answer.suggestedValues.length === 0) {
    return "";
  }

  return `<div class="suggested-values">
        <div class="title">Risposte:</div>
        <ul class="suggested-value-list">${answer.suggestedValues.map(
          (value, idx) => `<li>Opzione ${idx + 1}: ${value}</li>`
        )}</ul>
      </div>`;
}

function formatAnswer<
  T extends RiskAnalysisTemplateSingleAnswer | RiskAnalysisTemplateMultiAnswer
>(
  questionRules: FormQuestionRules,
  answer: T,
  language: Language,
  getAnswerText: (questionRules: FormQuestionRules, answer: T) => string,
  getAnswerSuggestedValues: (answer: T) => string
): string {
  const questionLabel = getLocalizedLabel(questionRules.label, language);
  const infoLabel =
    questionRules.infoLabel &&
    getLocalizedLabel(questionRules.infoLabel, language);
  const answerText = getAnswerText(questionRules, answer);

  const answerAnnotation = getAnswerAnnotation(answer.annotation);
  const answerSuggestedValues = getAnswerSuggestedValues(answer);
  const notEditableChip = answer.editable
    ? ""
    : `<div class="not-editable-chip">Non modificabile</div>`;

  return `<div class="item">
  ${notEditableChip}
  <div class="label">${questionLabel}</div>
  ${infoLabel ? `<div class="info-label">${infoLabel}</div>` : ""}
  <div class="answer">${answerText}</div>
  ${answerSuggestedValues}
  ${answerAnnotation}
</div>
`;
}

// TODO: remove eslint-disable
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

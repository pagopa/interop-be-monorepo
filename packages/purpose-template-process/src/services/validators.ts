import {
  PurposeTemplateState,
  RiskAnalysisFormTemplate,
  TenantKind,
  RiskAnalysisTemplateSingleAnswer,
  RiskAnalysisTemplateMultiAnswer,
  TenantId,
  operationForbidden,
} from "pagopa-interop-models";
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import { match } from "ts-pattern";
import {
  RiskAnalysisTemplateValidatedForm,
  RiskAnalysisTemplateValidatedSingleOrMultiAnswer,
  riskAnalysisValidatedFormTemplateToNewRiskAnalysisFormTemplate,
  // validateNoHyperlinks,
  validatePurposeTemplateRiskAnalysis,
  validateRiskAnalysisAnswer,
  riskAnalysisValidatedAnswerToNewRiskAnalysisAnswer,
  UIAuthData,
  M2MAdminAuthData,
} from "pagopa-interop-commons";
import {
  annotationTextLengthError,
  // hyperlinkDetectionError,
  missingFreeOfChargeReason,
  purposeTemplateNameConflict,
  purposeTemplateNotInValidState,
  riskAnalysisTemplateValidationFailed,
} from "../model/domain/errors.js";
import { ReadModelServiceSQL } from "./readModelServiceSQL.js";

export const assertConsistentFreeOfCharge = (
  isFreeOfCharge: boolean,
  freeOfChargeReason: string | undefined
): void => {
  if (isFreeOfCharge && !freeOfChargeReason) {
    throw missingFreeOfChargeReason();
  }
};

export const assertPurposeTemplateTitleIsNotDuplicated = async ({
  readModelService,
  title,
}: {
  readModelService: ReadModelServiceSQL;
  title: string;
}): Promise<void> => {
  const purposeTemplateWithSameName = await readModelService.getPurposeTemplate(
    title
  );
  if (purposeTemplateWithSameName) {
    throw purposeTemplateNameConflict(
      purposeTemplateWithSameName.data.id,
      purposeTemplateWithSameName.data.purposeTitle
    );
  }
};

export const assertPurposeTemplateStateIsValid = (
  state: PurposeTemplateState,
  validStates: PurposeTemplateState[]
): void => {
  if (!validStates.includes(state)) {
    throw purposeTemplateNotInValidState(state, validStates);
  }
};

export function validateAndTransformRiskAnalysisTemplate(
  purposeRiskAnalysisForm:
    | purposeTemplateApi.RiskAnalysisFormTemplateSeed
    | undefined,
  tenantKind: TenantKind
): RiskAnalysisFormTemplate | undefined {
  if (!purposeRiskAnalysisForm) {
    return undefined;
  }

  const validatedForm = validateRiskAnalysisTemplateOrThrow({
    riskAnalysisForm: purposeRiskAnalysisForm,
    tenantKind,
  });

  return riskAnalysisValidatedFormTemplateToNewRiskAnalysisFormTemplate(
    validatedForm
  );
}

export function validateAndTransformRiskAnalysisAnswer(
  riskAnalysisAnswer: purposeTemplateApi.RiskAnalysisTemplateAnswerRequest,
  tenantKind: TenantKind
): RiskAnalysisTemplateSingleAnswer | RiskAnalysisTemplateMultiAnswer {
  const validatedAnswer = validateRiskAnalysisAnswerOrThrow({
    riskAnalysisAnswer,
    tenantKind,
  });

  return riskAnalysisValidatedAnswerToNewRiskAnalysisAnswer(validatedAnswer);
}

function validateRiskAnalysisTemplateOrThrow({
  riskAnalysisForm,
  tenantKind,
}: {
  riskAnalysisForm: purposeTemplateApi.RiskAnalysisFormTemplateSeed;
  tenantKind: TenantKind;
}): RiskAnalysisTemplateValidatedForm {
  const result = validatePurposeTemplateRiskAnalysis(
    riskAnalysisForm,
    tenantKind
  );

  return match(result)
    .with({ type: "invalid" }, ({ issues }) => {
      throw riskAnalysisTemplateValidationFailed(issues);
    })
    .with({ type: "valid" }, ({ value }) => value)
    .exhaustive();
}

function validateRiskAnalysisAnswerOrThrow({
  riskAnalysisAnswer,
  tenantKind,
}: {
  riskAnalysisAnswer: purposeTemplateApi.RiskAnalysisTemplateAnswerRequest;
  tenantKind: TenantKind;
}): RiskAnalysisTemplateValidatedSingleOrMultiAnswer {
  if (riskAnalysisAnswer.answerData.annotation) {
    const { text } = riskAnalysisAnswer.answerData.annotation;
    if (text.length > 250) {
      throw annotationTextLengthError(text, text.length, 250);
    }

    // validateNoHyperlinks(text, hyperlinkDetectionError(text)); // todo disabled until hyperlinks validation rules are defined
  }

  const result = validateRiskAnalysisAnswer(
    riskAnalysisAnswer.answerKey,
    riskAnalysisAnswer.answerData,
    tenantKind
  );

  if (result.type === "invalid") {
    throw riskAnalysisTemplateValidationFailed(result.issues);
  }

  return result.value;
}

export function assertRequesterPurposeTemplateCreator(
  creatorId: TenantId,
  authData: UIAuthData | M2MAdminAuthData
): void {
  if (authData.organizationId !== creatorId) {
    throw operationForbidden;
  }
}

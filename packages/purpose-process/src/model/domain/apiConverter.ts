import { match } from "ts-pattern";
import {
  Purpose,
  PurposeRiskAnalysisForm,
  PurposeVersion,
  PurposeVersionDocument,
  PurposeVersionState,
  RiskAnalysisMultiAnswer,
  RiskAnalysisSingleAnswer,
  purposeVersionState,
} from "pagopa-interop-models";
import {
  LocalizedText,
  DataType,
  dataType,
  Dependency,
  HideOptionConfig,
  LabeledValue,
  FormQuestionRules,
  RiskAnalysisFormRules,
} from "pagopa-interop-commons";
import {
  ApiDataType,
  ApiDependency,
  ApiFormQuestionRules,
  ApiHideOptionConfig,
  ApiLabeledValue,
  ApiLocalizedText,
  ApiPurpose,
  ApiPurposeVersion,
  ApiPurposeVersionDocument,
  ApiPurposeVersionState,
  ApiRiskAnalysisForm,
  ApiRiskAnalysisFormRules,
} from "./models.js";

export const singleAnswersToApiSingleAnswers = (
  singleAnswers: RiskAnalysisSingleAnswer[]
): Record<string, string[]> =>
  singleAnswers.reduce<Record<string, string[]>>((acc, curr) => {
    if (!curr.value) {
      return acc;
    }
    // eslint-disable-next-line functional/immutable-data
    acc[curr.key] = [curr.value];
    return acc;
  }, {});

export const multiAnswersToApiMultiAnswers = (
  multiAnswers: RiskAnalysisMultiAnswer[]
): Record<string, string[]> =>
  multiAnswers.reduce<Record<string, string[]>>((acc, curr) => {
    if (curr.values.length === 0) {
      return acc;
    }
    // eslint-disable-next-line functional/immutable-data
    acc[curr.key] = curr.values;
    return acc;
  }, {});

export const riskAnalysisFormToApiRiskAnalysisForm = (
  riskAnalysisForm: PurposeRiskAnalysisForm
): ApiRiskAnalysisForm => {
  const apiSingleAnswersMap = singleAnswersToApiSingleAnswers(
    riskAnalysisForm.singleAnswers
  );
  const apiMultiAnswersMap = multiAnswersToApiMultiAnswers(
    riskAnalysisForm.multiAnswers
  );
  return {
    version: riskAnalysisForm.version,
    answers: { ...apiSingleAnswersMap, ...apiMultiAnswersMap },
    riskAnalysisId: riskAnalysisForm.riskAnalysisId,
  };
};

export const purposeVersionStateToApiPurposeVersionState = (
  state: PurposeVersionState
): ApiPurposeVersionState =>
  match<PurposeVersionState, ApiPurposeVersionState>(state)
    .with(purposeVersionState.active, () => "ACTIVE")
    .with(purposeVersionState.archived, () => "ARCHIVED")
    .with(purposeVersionState.draft, () => "DRAFT")
    .with(purposeVersionState.rejected, () => "REJECTED")
    .with(purposeVersionState.suspended, () => "SUSPENDED")
    .with(purposeVersionState.waitingForApproval, () => "WAITING_FOR_APPROVAL")
    .exhaustive();

export const apiPurposeVersionStateToPurposeVersionState = (
  state: ApiPurposeVersionState
): PurposeVersionState =>
  match<ApiPurposeVersionState, PurposeVersionState>(state)
    .with("ACTIVE", () => purposeVersionState.active)
    .with("ARCHIVED", () => purposeVersionState.archived)
    .with("DRAFT", () => purposeVersionState.draft)
    .with("REJECTED", () => purposeVersionState.rejected)
    .with("SUSPENDED", () => purposeVersionState.suspended)
    .with("WAITING_FOR_APPROVAL", () => purposeVersionState.waitingForApproval)
    .exhaustive();

export const purposeVersionDocumentToApiPurposeVersionDocument = (
  document: PurposeVersionDocument
): ApiPurposeVersionDocument => ({
  id: document.id,
  contentType: document.contentType,
  path: document.path,
  createdAt: document.createdAt.toJSON(),
});

export const purposeVersionToApiPurposeVersion = (
  version: PurposeVersion
): ApiPurposeVersion => ({
  id: version.id,
  state: purposeVersionStateToApiPurposeVersionState(version.state),
  createdAt: version.createdAt.toJSON(),
  updatedAt: version.updatedAt?.toJSON(),
  firstActivationAt: version.firstActivationAt?.toJSON(),
  riskAnalysis: version.riskAnalysis
    ? purposeVersionDocumentToApiPurposeVersionDocument(version.riskAnalysis)
    : undefined,
  dailyCalls: version.dailyCalls,
  suspendedAt: version.suspendedAt?.toJSON(),
});

export const purposeToApiPurpose = (
  purpose: Purpose,
  isRiskAnalysisValid: boolean
): ApiPurpose => ({
  id: purpose.id,
  eserviceId: purpose.eserviceId,
  consumerId: purpose.consumerId,
  versions: purpose.versions.map(purposeVersionToApiPurposeVersion),
  suspendedByConsumer: purpose.suspendedByConsumer,
  suspendedByProducer: purpose.suspendedByProducer,
  title: purpose.title,
  description: purpose.description,
  riskAnalysisForm: purpose.riskAnalysisForm
    ? riskAnalysisFormToApiRiskAnalysisForm(purpose.riskAnalysisForm)
    : undefined,
  createdAt: purpose.createdAt?.toJSON(),
  updatedAt: purpose.updatedAt?.toJSON(),
  isRiskAnalysisValid,
  isFreeOfCharge: purpose.isFreeOfCharge,
  freeOfChargeReason: purpose.freeOfChargeReason,
});

export const localizedTextToApiLocalizedText = (
  localizedText: LocalizedText
): ApiLocalizedText => ({
  it: localizedText.it,
  en: localizedText.en,
});

export const dataTypeToApiDataType = (type: DataType): ApiDataType =>
  match<DataType, ApiDataType>(type)
    .with(dataType.single, () => "SINGLE")
    .with(dataType.multi, () => "MULTI")
    .with(dataType.freeText, () => "FREETEXT")
    .exhaustive();

export const dependencyToApiDependency = (
  dependency: Dependency
): ApiDependency => ({
  id: dependency.id,
  value: dependency.value,
});

export const hideOptionConfigToApiHideOptionConfig = (
  hideOptionConfig: HideOptionConfig
): ApiHideOptionConfig => ({
  id: hideOptionConfig.id,
  value: hideOptionConfig.value,
});
export const mapHideOptionToApiMapHideOption = (
  mapHideOptionConfig: Record<string, HideOptionConfig[]>
): Record<string, ApiHideOptionConfig[]> =>
  Object.fromEntries(
    Object.entries(mapHideOptionConfig).map(([key, value]) => [
      key,
      value.map(hideOptionConfigToApiHideOptionConfig),
    ])
  );

export const labeledValueToApiLabeledValue = (
  labeledValue: LabeledValue
): ApiLabeledValue => ({
  label: localizedTextToApiLocalizedText(labeledValue.label),
  value: labeledValue.value,
});

export const formConfigQuestionToApiFormConfigQuestion = (
  question: FormQuestionRules
): ApiFormQuestionRules => {
  const commonFields = {
    id: question.id,
    label: localizedTextToApiLocalizedText(question.label),
    infoLabel: question.infoLabel
      ? localizedTextToApiLocalizedText(question.infoLabel)
      : undefined,
    dataType: dataTypeToApiDataType(question.dataType),
    required: question.required,
    dependencies: question.dependencies.map(dependencyToApiDependency),
    visualType: question.type,
    defaultValue: question.defaultValue,
    hideOption: question.hideOption
      ? mapHideOptionToApiMapHideOption(question.hideOption)
      : undefined,
  };

  return match<FormQuestionRules, ApiFormQuestionRules>(question)
    .with({ dataType: dataType.freeText }, () => commonFields)
    .with({ dataType: dataType.single }, { dataType: dataType.multi }, (q) => ({
      ...commonFields,
      options: q.options.map(labeledValueToApiLabeledValue),
    }))
    .exhaustive();
};

export const riskAnalysisFormConfigToApiRiskAnalysisFormConfig = (
  configuration: RiskAnalysisFormRules
): ApiRiskAnalysisFormRules => ({
  version: configuration.version,
  questions: configuration.questions.map(
    formConfigQuestionToApiFormConfigQuestion
  ),
});

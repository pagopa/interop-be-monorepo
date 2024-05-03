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
  RiskAnalysisFormConfig,
  FormConfigQuestion,
  LocalizedText,
  dataType,
  DataType,
  Dependency,
  HideOptionConfig,
} from "pagopa-interop-models";
import {
  ApiDataType,
  ApiDependency,
  ApiFormConfigQuestion,
  ApiHideOptionConfig,
  ApiLocalizedText,
  ApiPurpose,
  ApiPurposeVersion,
  ApiPurposeVersionDocument,
  ApiPurposeVersionState,
  ApiRiskAnalysisForm,
  ApiRiskAnalysisFormConfig,
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
  expectedApprovalDate: version.expectedApprovalDate?.toJSON(),
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
    .with(dataType.freetext, () => "FREETEXT")
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

export const formConfigQuestiontoApiFormConfigQuestion = (
  question: FormConfigQuestion
): ApiFormConfigQuestion =>
  match<FormConfigQuestion, ApiFormConfigQuestion>(question)
    .with({ dataType: dataType.freetext }, (q) => ({
      id: q.id,
      label: localizedTextToApiLocalizedText(q.label),
      infoLabel: q.infoLabel
        ? localizedTextToApiLocalizedText(q.infoLabel)
        : undefined,
      dataType: dataTypeToApiDataType(q.dataType),
      required: q.required,
      dependencies: q.dependencies.map(dependencyToApiDependency),
      visualType: q.type,
      defaultValue: q.defaultValue,
      hideOption: q.hideOption
        ? mapHideOptionToApiMapHideOption(q.hideOption)
        : undefined,
    }))
    .with({ dataType: dataType.single }, (q) => ({
      id: q.id,
      label: localizedTextToApiLocalizedText(q.label),
      infoLabel: q.infoLabel
        ? localizedTextToApiLocalizedText(q.infoLabel)
        : undefined,
      dataType: dataTypeToApiDataType(q.dataType),
      required: q.required,
      dependencies: q.dependencies.map(dependencyToApiDependency),
      visualType: q.type,
      defaultValue: q.defaultValue,
      hideOption: q.hideOption
        ? mapHideOptionToApiMapHideOption(q.hideOption)
        : undefined,
      options: q.options.map(),
    }))
    .with({ dataType: dataType.multi }, (q) => ({}))
    .exhaustive();
export const riskAnalysisFormConfigToApiRiskAnalysisFormConfig = (
  configuration: RiskAnalysisFormConfig
): ApiRiskAnalysisFormConfig => ({
  version: configuration.version,
  answers: configuration.answers.map(formConfigQuestiontoApiFormConfigQuestion),
});

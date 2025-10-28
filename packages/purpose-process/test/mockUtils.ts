/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { riskAnalysisFormToRiskAnalysisFormToValidate } from "pagopa-interop-commons";
import {
  Purpose,
  RiskAnalysis,
  RiskAnalysisForm,
  generateId,
  tenantKind,
  unsafeBrandId,
  PurposeRiskAnalysisFormV2,
  TenantKind,
  PurposeRiskAnalysisForm,
  EServiceId,
  TenantId,
  Descriptor,
  EServiceTemplateId,
  EService,
} from "pagopa-interop-models";
import {
  getMockValidRiskAnalysisForm,
  validRiskAnalysis2_0_Private,
  validRiskAnalysis3_0_Pa,
  getMockEService,
} from "pagopa-interop-commons-test";
import { purposeApi } from "pagopa-interop-api-clients";
import {
  RiskAnalysisValidatedForm,
  riskAnalysisValidatedFormToNewRiskAnalysisForm,
} from "pagopa-interop-commons";

import { match } from "ts-pattern";
import { validateAndTransformRiskAnalysis } from "../src/services/validators.js";

export const buildRiskAnalysisSeed = (
  riskAnalysis: RiskAnalysis
): purposeApi.RiskAnalysisFormSeed =>
  riskAnalysisFormToRiskAnalysisFormToValidate(riskAnalysis.riskAnalysisForm);

export const buildRiskAnalysisFormSeed = (
  riskAnalysisForm: RiskAnalysisForm
): purposeApi.RiskAnalysisFormSeed =>
  riskAnalysisFormToRiskAnalysisFormToValidate(riskAnalysisForm);

export const createUpdatedRiskAnalysisForm = (
  riskAnalysisForm: PurposeRiskAnalysisForm,
  writtenRiskAnalysisForm: PurposeRiskAnalysisFormV2
): RiskAnalysisForm => ({
  ...riskAnalysisForm,
  id: unsafeBrandId(writtenRiskAnalysisForm.id),
  singleAnswers: riskAnalysisForm.singleAnswers.map((singleAnswer) => ({
    ...singleAnswer,
    id: unsafeBrandId(
      writtenRiskAnalysisForm.singleAnswers.find(
        (sa) => sa.key === singleAnswer.key
      )!.id
    ),
  })),
  multiAnswers: riskAnalysisForm.multiAnswers.map((multiAnswer) => ({
    ...multiAnswer,
    id: unsafeBrandId(
      writtenRiskAnalysisForm.multiAnswers.find(
        (ma) => ma.key === multiAnswer.key
      )!.id
    ),
  })),
});

export const createUpdatedReversePurpose = (
  mockPurpose: Purpose,
  purposeUpdateContent: purposeApi.ReversePurposeUpdateContent
): Purpose => ({
  ...mockPurpose,
  title: purposeUpdateContent.title,
  description: purposeUpdateContent.description,
  isFreeOfCharge: purposeUpdateContent.isFreeOfCharge,
  freeOfChargeReason: purposeUpdateContent.freeOfChargeReason,
  versions: [
    {
      ...mockPurpose.versions[0],
      dailyCalls: purposeUpdateContent.dailyCalls,
      updatedAt: new Date(),
    },
  ],
  updatedAt: new Date(),
});

export const createUpdatedPurpose = (
  mockPurpose: Purpose,
  purposeUpdateContent: purposeApi.PurposeUpdateContent,
  tenantKind: TenantKind,
  writtenRiskAnalysisForm: PurposeRiskAnalysisFormV2
): Purpose => ({
  ...mockPurpose,
  title: purposeUpdateContent.title,
  description: purposeUpdateContent.description,
  isFreeOfCharge: purposeUpdateContent.isFreeOfCharge,
  freeOfChargeReason: purposeUpdateContent.freeOfChargeReason,
  versions: [
    {
      ...mockPurpose.versions[0],
      dailyCalls: purposeUpdateContent.dailyCalls,
      updatedAt: new Date(),
    },
  ],
  updatedAt: new Date(),
  riskAnalysisForm: createUpdatedRiskAnalysisForm(
    validateAndTransformRiskAnalysis(
      purposeUpdateContent.riskAnalysisForm,
      false,
      tenantKind,
      new Date(),
      undefined
    )!,
    writtenRiskAnalysisForm
  ),
});

export const getMockPurposeSeed = (
  eserviceId: string = generateId(),
  consumerId: string = generateId(),
  riskAnalysisForm: purposeApi.RiskAnalysisFormSeed = buildRiskAnalysisFormSeed(
    getMockValidRiskAnalysisForm(tenantKind.PA)
  )
): purposeApi.PurposeSeed => ({
  eserviceId,
  consumerId,
  title: "Mock title",
  dailyCalls: 10,
  description: "Mock description",
  isFreeOfCharge: true,
  freeOfChargeReason: "reason",
  riskAnalysisForm,
});

export const getMockReversePurposeSeed = (
  eserviceId: string = generateId(),
  consumerId: string = generateId(),
  riskAnalysisId: string = generateId()
): purposeApi.ReversePurposeSeed => ({
  eserviceId,
  consumerId,
  riskAnalysisId,
  title: "test purpose title",
  description: "test purpose description",
  isFreeOfCharge: true,
  freeOfChargeReason: "test",
  dailyCalls: 1,
});

export const getMockPurposeFromTemplateSeed = (
  eserviceId: string = generateId(),
  consumerId: string = generateId(),
  riskAnalysisForm?: purposeApi.RiskAnalysisFormSeed
): purposeApi.PurposeFromTemplateSeed => ({
  eserviceId,
  consumerId,
  title: "Mock title",
  dailyCalls: 10,
  riskAnalysisForm,
});

export const getMockEServiceForPurposeFromTemplate = (
  eserviceId: EServiceId = generateId<EServiceId>(),
  producerId: TenantId = generateId<TenantId>(),
  descriptors: Descriptor[] = [],
  templateId?: EServiceTemplateId | undefined
): EService => ({
  ...getMockEService(eserviceId, producerId, descriptors, templateId),
  personalData: false,
});

export const validatedRiskAnalysisFormFromTemplate3_0_Pa: RiskAnalysisValidatedForm =
  {
    version: validRiskAnalysis3_0_Pa.version,
    singleAnswers: [
      {
        key: "publicInterestTaskText",
        value: "public interest task text test",
      },
    ],
    multiAnswers: [],
  };

export const validatedRiskAnalysisFormFromTemplate2_0_Private: RiskAnalysisValidatedForm =
  {
    version: validRiskAnalysis2_0_Private.version,
    singleAnswers: [],
    multiAnswers: [],
  };

export const getMockValidRiskAnalysisFormFromTemplate = (
  producerTenantKind: TenantKind
): RiskAnalysisForm =>
  match(producerTenantKind)
    .with(tenantKind.PA, () =>
      riskAnalysisValidatedFormToNewRiskAnalysisForm(
        validatedRiskAnalysisFormFromTemplate3_0_Pa
      )
    )
    .with(tenantKind.PRIVATE, tenantKind.GSP, tenantKind.SCP, () =>
      riskAnalysisValidatedFormToNewRiskAnalysisForm(
        validatedRiskAnalysisFormFromTemplate2_0_Private
      )
    )
    .exhaustive();

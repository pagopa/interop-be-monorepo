/* eslint-disable no-restricted-imports */
import { PurposeTemplate } from "pagopa-interop-models";
import {
  PurposeTemplateEServiceDescriptorVersionSQL,
  PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSQL,
  PurposeTemplateRiskAnalysisAnswerAnnotationSQL,
  PurposeTemplateRiskAnalysisAnswerSQL,
  PurposeTemplateRiskAnalysisFormSQL,
  PurposeTemplateSQL,
} from "pagopa-interop-readmodel-models";

import { PurposeTemplateV2 } from "../../../models/dist/gen/v2/purpose-template/purpose-template.js";
export const splitPurposeTemplateIntoObjectsSQL = (
  _purposeTemplate: PurposeTemplate,
  _metadataVersion: number
): PurposeTemplateItemsSQL => {
  const purposeTemplateSQL: PurposeTemplateSQL = {} as PurposeTemplateSQL;

  const eserviceDescriptorVersionsSQL =
    [] as PurposeTemplateEServiceDescriptorVersionSQL[];
  const riskAnalysisFormSQL = undefined;
  const riskAnalysisAnswersSQL = [] as PurposeTemplateRiskAnalysisAnswerSQL[];
  const riskAnalysisAnswerAnnotationsSQL =
    [] as PurposeTemplateRiskAnalysisAnswerAnnotationSQL[];
  const riskAnalysisAnswerAnnotationDocumentsSQL =
    [] as PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSQL[];

  return {
    purposeTemplateSQL,
    eserviceDescriptorVersionsSQL,
    riskAnalysisFormSQL,
    riskAnalysisAnswersSQL,
    riskAnalysisAnswerAnnotationsSQL,
    riskAnalysisAnswerAnnotationDocumentsSQL,
  };
};

export const fromPurposeTemplateV2 = (
  _input: PurposeTemplateV2
): PurposeTemplate => ({} as PurposeTemplate);
export type PurposeTemplateItemsSQL = {
  purposeTemplateSQL: PurposeTemplateSQL;
  eserviceDescriptorVersionsSQL: PurposeTemplateEServiceDescriptorVersionSQL[];
  riskAnalysisFormSQL: PurposeTemplateRiskAnalysisFormSQL | undefined;
  riskAnalysisAnswersSQL: PurposeTemplateRiskAnalysisAnswerSQL[];
  riskAnalysisAnswerAnnotationsSQL: PurposeTemplateRiskAnalysisAnswerAnnotationSQL[];
  riskAnalysisAnswerAnnotationDocumentsSQL: PurposeTemplateRiskAnalysisAnswerAnnotationDocumentSQL[];
};

import { EServiceSQL, genericInternalError, EServiceTemplateBindingSQL, DescriptorSQL, DescriptorRejectionReasonSQL, DocumentSQL, DescriptorAttributeSQL, EserviceRiskAnalysisSQL, RiskAnalysisAnswerSQL } from "pagopa-interop-models/dist";

export const parseEServiceSQL = (data: unknown): EServiceSQL | undefined => {
  if (!data) {
    return undefined;
  } else {
    const result = EServiceSQL.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse eservice sql item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};

export const parseEServiceTemplateBindingSQL = (data: unknown): EServiceTemplateBindingSQL | undefined => {
  if (!data) {
    return undefined;
  } else {

    const result = EServiceTemplateBindingSQL.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse eservice_template_binding sql item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};

export const parseDescriptorSQL = (data: unknown): DescriptorSQL | undefined => {
  if (!data) {
    return undefined;
  } else {
    const result = DescriptorSQL.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse descriptor sql item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};

export const parseDescriptorRejectionReasonSQL = (data: unknown): DescriptorRejectionReasonSQL | undefined => {
  if (!data) {
    return undefined;
  } else {
    const result = DescriptorRejectionReasonSQL.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse descriptor_rejection_reason sql item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};

export const parseDocumentSQL = (data: any): DocumentSQL | undefined => {
  if (!data) {
    return undefined;
  } else {
    const result = DocumentSQL.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse eservice_descriptor_document sql item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};

export const parseDescriptorAttributeSQL = (
  data: any
): DescriptorAttributeSQL | undefined => {
  if (!data) {
    return undefined;
  } else {
    const result = DescriptorAttributeSQL.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse eservice_descriptor_attribute sql item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};

export const parseRiskAnalysisSQL = (
  data: any
): EserviceRiskAnalysisSQL | undefined => {
  if (!data) {
    return undefined;
  } else {
    const result = EserviceRiskAnalysisSQL.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse eservice_risk_analysis sql item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};

export const parseRiskAnalysisAnswerSQL = (
  data: any
): RiskAnalysisAnswerSQL | undefined => {
  if (!data) {
    return undefined;
  } else {
    const result = RiskAnalysisAnswerSQL.safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse eservice_risk_analysis_answer sql item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
};

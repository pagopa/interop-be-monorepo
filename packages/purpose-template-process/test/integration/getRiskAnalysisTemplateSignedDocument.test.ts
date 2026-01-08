/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  getMockAuthData,
  getMockCompleteRiskAnalysisFormTemplate,
  getMockContext,
  getMockPurposeTemplate,
  getMockValidRiskAnalysisFormTemplate,
} from "pagopa-interop-commons-test";
import {
  generateId,
  PurposeTemplate,
  PurposeTemplateId,
  TenantId,
  tenantKind,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import {
  purposeTemplateNotFound,
  purposeTemplateRiskAnalysisFormNotFound,
  purposeTemplateRiskAnalysisTemplateSignedDocumentNotFound,
} from "../../src/model/domain/errors.js";
import {
  addOnePurposeTemplate,
  purposeTemplateService,
} from "../integrationUtils.js";

describe("getRiskAnalysisTemplateSignedDocument", async () => {
  it("should get the risk analysis template signed document if it exists", async () => {
    const riskAnalysisFormTemplate = getMockCompleteRiskAnalysisFormTemplate();

    const purposeTemplate: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      purposeRiskAnalysisForm: riskAnalysisFormTemplate,
    };

    await addOnePurposeTemplate(purposeTemplate);

    const purposeTemplateResponse =
      await purposeTemplateService.getRiskAnalysisTemplateSignedDocument(
        purposeTemplate.id,
        getMockContext({ authData: getMockAuthData(purposeTemplate.creatorId) })
      );
    expect(purposeTemplateResponse).toMatchObject(
      purposeTemplate.purposeRiskAnalysisForm!.signedDocument!
    );
  });

  it("should throw purposeTemplateRiskAnalysisTemplateSignedDocumentNotFound if the risk analysis template  signed document doesn't exist", async () => {
    const riskAnalysisFormTemplate = getMockValidRiskAnalysisFormTemplate(
      tenantKind.PA
    );
    const purposeTemplateWithNoDocuments: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      purposeRiskAnalysisForm: riskAnalysisFormTemplate,
    };

    await addOnePurposeTemplate(purposeTemplateWithNoDocuments);

    await expect(
      purposeTemplateService.getRiskAnalysisTemplateSignedDocument(
        purposeTemplateWithNoDocuments.id,
        getMockContext({
          authData: getMockAuthData(purposeTemplateWithNoDocuments.creatorId),
        })
      )
    ).rejects.toThrowError(
      purposeTemplateRiskAnalysisTemplateSignedDocumentNotFound(
        riskAnalysisFormTemplate.id
      )
    );
  });

  it("should throw purposeTemplateNotFound if the purpose template does not exist", async () => {
    const notExistentPurposeTemplateId = generateId<PurposeTemplateId>();
    await expect(
      purposeTemplateService.getRiskAnalysisTemplateSignedDocument(
        notExistentPurposeTemplateId,
        getMockContext({
          authData: getMockAuthData(generateId<TenantId>()),
        })
      )
    ).rejects.toThrowError(
      purposeTemplateNotFound(notExistentPurposeTemplateId)
    );
  });

  it("should throw purposeTemplateRiskAnalysisFormNotFound if the purpose template has no risk analysis form template", async () => {
    const purposeTemplateWithNoForm = getMockPurposeTemplate();

    await addOnePurposeTemplate(purposeTemplateWithNoForm);

    await expect(
      purposeTemplateService.getRiskAnalysisTemplateSignedDocument(
        purposeTemplateWithNoForm.id,
        getMockContext({
          authData: getMockAuthData(purposeTemplateWithNoForm.creatorId),
        })
      )
    ).rejects.toThrowError(
      purposeTemplateRiskAnalysisFormNotFound(purposeTemplateWithNoForm.id)
    );
  });
});

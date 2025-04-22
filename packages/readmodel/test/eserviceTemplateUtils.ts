import {
  EServiceTemplate,
  EServiceTemplateId,
  RiskAnalysis,
  riskAnalysisAnswerKind,
} from "pagopa-interop-models";
import {
  DrizzleReturnType,
  eserviceTemplateInReadmodelEserviceTemplate,
  EServiceTemplateItemsSQL,
  eserviceTemplateRiskAnalysisAnswerInReadmodelEserviceTemplate,
  EServiceTemplateRiskAnalysisAnswerSQL,
  eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate,
  EServiceTemplateRiskAnalysisSQL,
  EServiceTemplateSQL,
  eserviceTemplateVersionAttributeInReadmodelEserviceTemplate,
  EServiceTemplateVersionAttributeSQL,
  eserviceTemplateVersionDocumentInReadmodelEserviceTemplate,
  EServiceTemplateVersionDocumentSQL,
  eserviceTemplateVersionInReadmodelEserviceTemplate,
  eserviceTemplateVersionInterfaceInReadmodelEserviceTemplate,
  EServiceTemplateVersionInterfaceSQL,
  EServiceTemplateVersionSQL,
} from "pagopa-interop-readmodel-models";
import { expect } from "vitest";
import { eq } from "drizzle-orm";
import { eserviceTemplateReadModelServiceBuilder } from "../src/eserviceTemplateReadModelService.js";
import { readModelDB } from "./utils.js";

export const eserviceTemplateReadModelService =
  eserviceTemplateReadModelServiceBuilder(readModelDB);

export const generateEServiceTemplateRiskAnalysisAnswersSQL = (
  eserviceTemplateId: string,
  riskAnalyses: RiskAnalysis[],
  metadataVersion: number
): EServiceTemplateRiskAnalysisAnswerSQL[] =>
  riskAnalyses.flatMap(({ riskAnalysisForm }) => [
    ...riskAnalysisForm.singleAnswers.map(
      (a): EServiceTemplateRiskAnalysisAnswerSQL => ({
        id: a.id,
        eserviceTemplateId,
        metadataVersion,
        key: a.key,
        value: a.value ? [a.value] : [],
        riskAnalysisFormId: riskAnalysisForm.id,
        kind: riskAnalysisAnswerKind.single,
      })
    ),
    ...riskAnalysisForm.multiAnswers.map(
      (a): EServiceTemplateRiskAnalysisAnswerSQL => ({
        id: a.id,
        eserviceTemplateId,
        metadataVersion,
        key: a.key,
        value: a.values,
        riskAnalysisFormId: riskAnalysisForm.id,
        kind: riskAnalysisAnswerKind.multi,
      })
    ),
  ]);

export const checkCompleteEServiceTemplate = async (
  eserviceTemplate: EServiceTemplate
): Promise<EServiceTemplateItemsSQL> => {
  const eserviceTemplateSQL = await retrieveEServiceTemplateSQLById(
    eserviceTemplate.id,
    readModelDB
  );
  const versionsSQL = await retrieveEServiceTemplateVersionsSQLById(
    eserviceTemplate.id,
    readModelDB
  );
  const interfacesSQL = await retrieveEServiceTemplateVersionInterfacesSQLById(
    eserviceTemplate.id,
    readModelDB
  );
  const documentsSQL = await retrieveEServiceTemplateVersionDocumentsSQLById(
    eserviceTemplate.id,
    readModelDB
  );
  const attributesSQL = await retrieveEServiceTemplateVersionAttributesSQLById(
    eserviceTemplate.id,
    readModelDB
  );
  const riskAnalysesSQL = await retrieveEServiceTemplateRiskAnalysesSQLById(
    eserviceTemplate.id,
    readModelDB
  );
  const riskAnalysisAnswersSQL =
    await retrieveEServiceTemplateRiskAnalysisAnswersSQLById(
      eserviceTemplate.id,
      readModelDB
    );

  expect(eserviceTemplateSQL).toBeDefined();
  expect(versionsSQL).toHaveLength(eserviceTemplate.versions.length);
  expect(interfacesSQL).toHaveLength(eserviceTemplate.versions.length);
  expect(documentsSQL).toHaveLength(eserviceTemplate.versions[0].docs.length);
  expect(attributesSQL).toHaveLength(
    eserviceTemplate.versions[0].attributes.certified.flat().length
  );
  expect(riskAnalysesSQL).toHaveLength(eserviceTemplate.riskAnalysis.length);
  expect(riskAnalysisAnswersSQL).toHaveLength(
    eserviceTemplate.riskAnalysis.reduce(
      (sum, ra) =>
        sum +
        ra.riskAnalysisForm.multiAnswers.length +
        ra.riskAnalysisForm.singleAnswers.length,
      0
    )
  );

  return {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    eserviceTemplateSQL: eserviceTemplateSQL!,
    versionsSQL,
    interfacesSQL,
    documentsSQL,
    attributesSQL,
    riskAnalysesSQL,
    riskAnalysisAnswersSQL,
  };
};

export const retrieveEServiceTemplateSQLById = async (
  eserviceTemplateId: EServiceTemplateId,
  db: DrizzleReturnType
): Promise<EServiceTemplateSQL | undefined> => {
  const result = await db
    .select()
    .from(eserviceTemplateInReadmodelEserviceTemplate)
    .where(
      eq(eserviceTemplateInReadmodelEserviceTemplate.id, eserviceTemplateId)
    );

  return result[0];
};

export const retrieveEServiceTemplateVersionsSQLById = async (
  eserviceTemplateId: EServiceTemplateId,
  db: DrizzleReturnType
): Promise<EServiceTemplateVersionSQL[]> =>
  await db
    .select()
    .from(eserviceTemplateVersionInReadmodelEserviceTemplate)
    .where(
      eq(
        eserviceTemplateVersionInReadmodelEserviceTemplate.eserviceTemplateId,
        eserviceTemplateId
      )
    );

export const retrieveEServiceTemplateVersionDocumentsSQLById = async (
  eserviceTemplateId: EServiceTemplateId,
  db: DrizzleReturnType
): Promise<EServiceTemplateVersionDocumentSQL[]> =>
  await db
    .select()
    .from(eserviceTemplateVersionDocumentInReadmodelEserviceTemplate)
    .where(
      eq(
        eserviceTemplateVersionDocumentInReadmodelEserviceTemplate.eserviceTemplateId,
        eserviceTemplateId
      )
    );

export const retrieveEServiceTemplateVersionInterfacesSQLById = async (
  eserviceTemplateId: EServiceTemplateId,
  db: DrizzleReturnType
): Promise<EServiceTemplateVersionInterfaceSQL[]> =>
  await db
    .select()
    .from(eserviceTemplateVersionInterfaceInReadmodelEserviceTemplate)
    .where(
      eq(
        eserviceTemplateVersionInterfaceInReadmodelEserviceTemplate.eserviceTemplateId,
        eserviceTemplateId
      )
    );

export const retrieveEServiceTemplateVersionAttributesSQLById = async (
  eserviceTemplateId: EServiceTemplateId,
  db: DrizzleReturnType
): Promise<EServiceTemplateVersionAttributeSQL[]> =>
  await db
    .select()
    .from(eserviceTemplateVersionAttributeInReadmodelEserviceTemplate)
    .where(
      eq(
        eserviceTemplateVersionAttributeInReadmodelEserviceTemplate.eserviceTemplateId,
        eserviceTemplateId
      )
    );

export const retrieveEServiceTemplateRiskAnalysesSQLById = async (
  eserviceTemplateId: EServiceTemplateId,
  db: DrizzleReturnType
): Promise<EServiceTemplateRiskAnalysisSQL[]> =>
  await db
    .select()
    .from(eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate)
    .where(
      eq(
        eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate.eserviceTemplateId,
        eserviceTemplateId
      )
    );

export const retrieveEServiceTemplateRiskAnalysisAnswersSQLById = async (
  eserviceTemplateId: EServiceTemplateId,
  db: DrizzleReturnType
): Promise<EServiceTemplateRiskAnalysisAnswerSQL[]> =>
  await db
    .select()
    .from(eserviceTemplateRiskAnalysisAnswerInReadmodelEserviceTemplate)
    .where(
      eq(
        eserviceTemplateRiskAnalysisAnswerInReadmodelEserviceTemplate.eserviceTemplateId,
        eserviceTemplateId
      )
    );

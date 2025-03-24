/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  EService,
  EServiceId,
  RiskAnalysis,
  riskAnalysisAnswerKind,
} from "pagopa-interop-models";
import { eq } from "drizzle-orm";
import {
  DrizzleReturnType,
  eserviceDescriptorAttributeInReadmodelCatalog,
  EServiceDescriptorAttributeSQL,
  eserviceDescriptorDocumentInReadmodelCatalog,
  EServiceDescriptorDocumentSQL,
  eserviceDescriptorInReadmodelCatalog,
  eserviceDescriptorInterfaceInReadmodelCatalog,
  EServiceDescriptorInterfaceSQL,
  eserviceDescriptorRejectionReasonInReadmodelCatalog,
  EServiceDescriptorRejectionReasonSQL,
  EServiceDescriptorSQL,
  eserviceDescriptorTemplateVersionRefInReadmodelCatalog,
  EServiceDescriptorTemplateVersionRefSQL,
  eserviceInReadmodelCatalog,
  EServiceItemsSQL,
  eserviceRiskAnalysisAnswerInReadmodelCatalog,
  EServiceRiskAnalysisAnswerSQL,
  eserviceRiskAnalysisInReadmodelCatalog,
  EServiceRiskAnalysisSQL,
  EServiceSQL,
  eserviceTemplateRefInReadmodelCatalog,
  EServiceTemplateRefSQL,
} from "pagopa-interop-readmodel-models";
import { expect } from "vitest";
import { catalogReadModelServiceBuilderSQL } from "../src/catalogReadModelService.js";
import { readModelDB } from "./utils.js";

export const catalogReadModelService =
  catalogReadModelServiceBuilderSQL(readModelDB);

export const generateEServiceRiskAnalysisAnswersSQL = (
  eserviceId: string,
  riskAnalyses: RiskAnalysis[],
  metadataVersion: number
): EServiceRiskAnalysisAnswerSQL[] =>
  riskAnalyses.flatMap(({ riskAnalysisForm }) => [
    ...riskAnalysisForm.singleAnswers.map(
      (a): EServiceRiskAnalysisAnswerSQL => ({
        id: a.id,
        eserviceId,
        metadataVersion,
        key: a.key,
        value: a.value ? [a.value] : [],
        riskAnalysisFormId: riskAnalysisForm.id,
        kind: riskAnalysisAnswerKind.single,
      })
    ),
    ...riskAnalysisForm.multiAnswers.map(
      (a): EServiceRiskAnalysisAnswerSQL => ({
        id: a.id,
        eserviceId,
        metadataVersion,
        key: a.key,
        value: a.values,
        riskAnalysisFormId: riskAnalysisForm.id,
        kind: riskAnalysisAnswerKind.multi,
      })
    ),
  ]);

export const checkCompleteEService = async (
  eservice: EService
): Promise<EServiceItemsSQL> => {
  const eserviceSQL = await retrieveEServiceSQLById(eservice.id, readModelDB);
  const descriptorsSQL = await retrieveEserviceDescriptorsSQLById(
    eservice.id,
    readModelDB
  );
  const interfacesSQL = await retrieveEserviceInterfacesSQLById(
    eservice.id,
    readModelDB
  );
  const documentsSQL = await retrieveEserviceDocumentsSQLById(
    eservice.id,
    readModelDB
  );
  const attributesSQL = await retrieveEserviceDescriptorAttributesSQLById(
    eservice.id,
    readModelDB
  );
  const rejectionReasonsSQL = await retrieveEserviceRejectionReasonsSQLById(
    eservice.id,
    readModelDB
  );
  const riskAnalysesSQL = await retrieveEserviceRiskAnalysesSQLById(
    eservice.id,
    readModelDB
  );
  const riskAnalysisAnswersSQL =
    await retrieveEserviceRiskAnalysisAnswersSQLById(eservice.id, readModelDB);
  const templateRefsSQL = await retrieveEServiceTemplateRefSQLById(
    eservice.id,
    readModelDB
  );
  const templateVersionRefsSQL =
    await retrieveEServiceTemplateVersionRefsSQLById(eservice.id, readModelDB);

  expect(eserviceSQL).toBeDefined();
  expect(descriptorsSQL).toHaveLength(eservice.descriptors.length);
  expect(interfacesSQL).toHaveLength(eservice.descriptors.length);
  expect(documentsSQL).toHaveLength(eservice.descriptors[0].docs.length);
  expect(attributesSQL).toHaveLength(
    eservice.descriptors[0].attributes.certified.flat().length
  );
  expect(rejectionReasonsSQL).toHaveLength(
    eservice.descriptors[0].rejectionReasons!.length
  );
  expect(riskAnalysesSQL).toHaveLength(eservice.riskAnalysis.length);
  expect(riskAnalysisAnswersSQL).toHaveLength(
    eservice.riskAnalysis.reduce(
      (sum, ra) =>
        sum +
        ra.riskAnalysisForm.multiAnswers.length +
        ra.riskAnalysisForm.singleAnswers.length,
      0
    )
  );
  expect(templateRefsSQL).toBeDefined();
  expect(templateVersionRefsSQL).toHaveLength(eservice.descriptors.length);

  return {
    eserviceSQL: eserviceSQL!,
    descriptorsSQL,
    interfacesSQL,
    documentsSQL,
    attributesSQL,
    rejectionReasonsSQL,
    riskAnalysesSQL,
    riskAnalysisAnswersSQL,
    templateRefSQL: templateRefsSQL!,
    templateVersionRefsSQL,
  };
};

export const retrieveEServiceSQLById = async (
  eserviceId: EServiceId,
  db: DrizzleReturnType
): Promise<EServiceSQL | undefined> => {
  const result = await db
    .select()
    .from(eserviceInReadmodelCatalog)
    .where(eq(eserviceInReadmodelCatalog.id, eserviceId));

  return result[0];
};

export const retrieveEserviceDescriptorsSQLById = async (
  eserviceId: EServiceId,
  db: DrizzleReturnType
): Promise<EServiceDescriptorSQL[]> =>
  await db
    .select()
    .from(eserviceDescriptorInReadmodelCatalog)
    .where(eq(eserviceDescriptorInReadmodelCatalog.eserviceId, eserviceId));

export const retrieveEserviceDocumentsSQLById = async (
  eserviceId: EServiceId,
  db: DrizzleReturnType
): Promise<EServiceDescriptorDocumentSQL[]> =>
  await db
    .select()
    .from(eserviceDescriptorDocumentInReadmodelCatalog)
    .where(
      eq(eserviceDescriptorDocumentInReadmodelCatalog.eserviceId, eserviceId)
    );

export const retrieveEserviceInterfacesSQLById = async (
  eserviceId: EServiceId,
  db: DrizzleReturnType
): Promise<EServiceDescriptorInterfaceSQL[]> =>
  await db
    .select()
    .from(eserviceDescriptorInterfaceInReadmodelCatalog)
    .where(
      eq(eserviceDescriptorInterfaceInReadmodelCatalog.eserviceId, eserviceId)
    );

export const retrieveEserviceDescriptorAttributesSQLById = async (
  eserviceId: EServiceId,
  db: DrizzleReturnType
): Promise<EServiceDescriptorAttributeSQL[]> =>
  await db
    .select()
    .from(eserviceDescriptorAttributeInReadmodelCatalog)
    .where(
      eq(eserviceDescriptorAttributeInReadmodelCatalog.eserviceId, eserviceId)
    );

export const retrieveEserviceRejectionReasonsSQLById = async (
  eserviceId: EServiceId,
  db: DrizzleReturnType
): Promise<EServiceDescriptorRejectionReasonSQL[]> =>
  await db
    .select()
    .from(eserviceDescriptorRejectionReasonInReadmodelCatalog)
    .where(
      eq(
        eserviceDescriptorRejectionReasonInReadmodelCatalog.eserviceId,
        eserviceId
      )
    );

export const retrieveEserviceRiskAnalysesSQLById = async (
  eserviceId: EServiceId,
  db: DrizzleReturnType
): Promise<EServiceRiskAnalysisSQL[]> =>
  await db
    .select()
    .from(eserviceRiskAnalysisInReadmodelCatalog)
    .where(eq(eserviceRiskAnalysisInReadmodelCatalog.eserviceId, eserviceId));

export const retrieveEserviceRiskAnalysisAnswersSQLById = async (
  eserviceId: EServiceId,
  db: DrizzleReturnType
): Promise<EServiceRiskAnalysisAnswerSQL[]> =>
  await db
    .select()
    .from(eserviceRiskAnalysisAnswerInReadmodelCatalog)
    .where(
      eq(eserviceRiskAnalysisAnswerInReadmodelCatalog.eserviceId, eserviceId)
    );

export const retrieveEServiceTemplateRefSQLById = async (
  eserviceId: EServiceId,
  db: DrizzleReturnType
): Promise<EServiceTemplateRefSQL | undefined> => {
  const result = await db
    .select()
    .from(eserviceTemplateRefInReadmodelCatalog)
    .where(eq(eserviceTemplateRefInReadmodelCatalog.eserviceId, eserviceId));

  return result[0];
};

export const retrieveEServiceTemplateVersionRefsSQLById = async (
  eserviceId: EServiceId,
  db: DrizzleReturnType
): Promise<EServiceDescriptorTemplateVersionRefSQL[]> =>
  await db
    .select()
    .from(eserviceDescriptorTemplateVersionRefInReadmodelCatalog)
    .where(
      eq(
        eserviceDescriptorTemplateVersionRefInReadmodelCatalog.eserviceId,
        eserviceId
      )
    );

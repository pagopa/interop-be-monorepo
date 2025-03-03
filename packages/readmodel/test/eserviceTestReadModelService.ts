/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { EServiceId } from "pagopa-interop-models";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import {
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
  eserviceInReadmodelCatalog,
  eserviceRiskAnalysisAnswerInReadmodelCatalog,
  EServiceRiskAnalysisAnswerSQL,
  eserviceRiskAnalysisInReadmodelCatalog,
  EServiceRiskAnalysisSQL,
  EServiceSQL,
} from "pagopa-interop-readmodel-models";

export const retrieveEServiceSQL = async (
  eserviceId: EServiceId,
  db: ReturnType<typeof drizzle>
): Promise<EServiceSQL | undefined> => {
  const result = await db
    .select()
    .from(eserviceInReadmodelCatalog)
    .where(eq(eserviceInReadmodelCatalog.id, eserviceId))
    .limit(1);
  return result[0];
};

export const retrieveDescriptorsSQL = async (
  eserviceId: EServiceId,
  db: ReturnType<typeof drizzle>
): Promise<EServiceDescriptorSQL[] | undefined> => {
  const result = await db
    .select()
    .from(eserviceDescriptorInReadmodelCatalog)
    .where(eq(eserviceDescriptorInReadmodelCatalog.eserviceId, eserviceId));
  return result.length > 0 ? result : undefined;
};

export const retrieveEserviceDocumentsSQL = async (
  eserviceId: EServiceId,
  db: ReturnType<typeof drizzle>
): Promise<EServiceDescriptorDocumentSQL[] | undefined> =>
  await db
    .select()
    .from(eserviceDescriptorDocumentInReadmodelCatalog)
    .where(
      eq(eserviceDescriptorDocumentInReadmodelCatalog.eserviceId, eserviceId)
    );

export const retrieveEserviceInterfacesSQL = async (
  eserviceId: EServiceId,
  db: ReturnType<typeof drizzle>
): Promise<EServiceDescriptorInterfaceSQL[] | undefined> => {
  const result = await db
    .select()
    .from(eserviceDescriptorInterfaceInReadmodelCatalog)
    .where(
      eq(eserviceDescriptorInterfaceInReadmodelCatalog.eserviceId, eserviceId)
    );

  return result.length > 0 ? result : undefined;
};

export const retrieveEserviceAttributesSQL = async (
  eserviceId: EServiceId,
  db: ReturnType<typeof drizzle>
): Promise<EServiceDescriptorAttributeSQL[] | undefined> => {
  const result = await db
    .select()
    .from(eserviceDescriptorAttributeInReadmodelCatalog)
    .where(
      eq(eserviceDescriptorAttributeInReadmodelCatalog.eserviceId, eserviceId)
    );

  return result.length > 0 ? result : undefined;
};

export const retrieveRejectionReasonsSQL = async (
  eserviceId: EServiceId,
  db: ReturnType<typeof drizzle>
): Promise<EServiceDescriptorRejectionReasonSQL[] | undefined> => {
  const result = await db
    .select()
    .from(eserviceDescriptorRejectionReasonInReadmodelCatalog)
    .where(
      eq(
        eserviceDescriptorRejectionReasonInReadmodelCatalog.eserviceId,
        eserviceId
      )
    );

  return result.length > 0 ? result : undefined;
};

export const retrieveEserviceRiskAnalysesSQL = async (
  eserviceId: EServiceId,
  db: ReturnType<typeof drizzle>
): Promise<EServiceRiskAnalysisSQL[] | undefined> => {
  const result = await db
    .select()
    .from(eserviceRiskAnalysisInReadmodelCatalog)
    .where(eq(eserviceRiskAnalysisInReadmodelCatalog.eserviceId, eserviceId));

  return result.length > 0 ? result : undefined;
};

export const retrieveEserviceRiskAnalysisAnswersSQL = async (
  eserviceId: EServiceId,
  db: ReturnType<typeof drizzle>
): Promise<EServiceRiskAnalysisAnswerSQL[] | undefined> => {
  const result = await db
    .select()
    .from(eserviceRiskAnalysisAnswerInReadmodelCatalog)
    .where(
      eq(eserviceRiskAnalysisAnswerInReadmodelCatalog.eserviceId, eserviceId)
    );

  return result.length > 0 ? result : undefined;
};

// export const retrieveEserviceTemplateBindingSQL = (
//   eserviceId: EServiceId,
//   db: ReturnType<typeof drizzle>
// ) =>
//   db
//     .select()
//     .from(eserviceTemplateBindingInReadmodelCatalog)
//     .where(
//       eq(eserviceTemplateBindingInReadmodelCatalog.eserviceId, eserviceId)
//     );

/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { EServiceId } from "pagopa-interop-models";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  eserviceDescriptorAttributeInReadmodelCatalog,
  eserviceDescriptorDocumentInReadmodelCatalog,
  eserviceDescriptorInReadmodelCatalog,
  eserviceDescriptorRejectionReasonInReadmodelCatalog,
  eserviceInReadmodelCatalog,
  eserviceRiskAnalysisAnswerInReadmodelCatalog,
  eserviceRiskAnalysisInReadmodelCatalog,
  eserviceTemplateBindingInReadmodelCatalog,
} from "pagopa-interop-readmodel-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const retrieveEServiceSQL = (
  eserviceId: EServiceId,
  db: ReturnType<typeof drizzle>
) =>
  db
    .select()
    .from(eserviceInReadmodelCatalog)
    .where(eq(eserviceInReadmodelCatalog.id, eserviceId))
    .limit(1);

export const retrieveDescriptorsSQL = (
  eserviceId: EServiceId,
  db: ReturnType<typeof drizzle>
) =>
  db
    .select()
    .from(eserviceDescriptorInReadmodelCatalog)
    .where(eq(eserviceDescriptorInReadmodelCatalog.eserviceId, eserviceId));

export const retrieveEserviceDocumentSQL = (
  eserviceId: EServiceId,
  db: ReturnType<typeof drizzle>
) =>
  db
    .select()
    .from(eserviceDescriptorDocumentInReadmodelCatalog)
    .where(
      eq(eserviceDescriptorDocumentInReadmodelCatalog.eserviceId, eserviceId)
    );

export const retrieveEserviceAttributesSQL = (
  eserviceId: EServiceId,
  db: ReturnType<typeof drizzle>
) =>
  db
    .select()
    .from(eserviceDescriptorAttributeInReadmodelCatalog)
    .where(
      eq(eserviceDescriptorAttributeInReadmodelCatalog.eserviceId, eserviceId)
    );

export const retrieveRejectionReasonsSQL = (
  eserviceId: EServiceId,
  db: ReturnType<typeof drizzle>
) =>
  db
    .select()
    .from(eserviceDescriptorRejectionReasonInReadmodelCatalog)
    .where(
      eq(
        eserviceDescriptorRejectionReasonInReadmodelCatalog.eserviceId,
        eserviceId
      )
    );

export const retrieveEserviceRiskAnalysesSQL = (
  eserviceId: EServiceId,
  db: ReturnType<typeof drizzle>
) =>
  db
    .select()
    .from(eserviceRiskAnalysisInReadmodelCatalog)
    .where(eq(eserviceRiskAnalysisInReadmodelCatalog.eserviceId, eserviceId));

export const retrieveEserviceRiskAnalysisAnswersSQL = (
  eserviceId: EServiceId,
  db: ReturnType<typeof drizzle>
) =>
  db
    .select()
    .from(eserviceRiskAnalysisAnswerInReadmodelCatalog)
    .where(
      eq(eserviceRiskAnalysisAnswerInReadmodelCatalog.eserviceId, eserviceId)
    );

export const retrieveEserviceTemplateBindingSQL = (
  eserviceId: EServiceId,
  db: ReturnType<typeof drizzle>
) =>
  db
    .select()
    .from(eserviceTemplateBindingInReadmodelCatalog)
    .where(
      eq(eserviceTemplateBindingInReadmodelCatalog.eserviceId, eserviceId)
    );

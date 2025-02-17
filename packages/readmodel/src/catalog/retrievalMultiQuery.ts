/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { EServiceId } from "pagopa-interop-models";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  eserviceDescriptorAttributeInReadmodel,
  eserviceDescriptorDocumentInReadmodel,
  eserviceDescriptorInReadmodel,
  eserviceDescriptorRejectionReasonInReadmodel,
  eserviceInReadmodel,
  eserviceRiskAnalysisAnswerInReadmodel,
  eserviceRiskAnalysisInReadmodel,
  eserviceTemplateBindingInReadmodel,
} from "../drizzle/schema.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const retrieveEServiceSQL = (
  eserviceId: EServiceId,
  db: ReturnType<typeof drizzle>
) =>
  db
    .select()
    .from(eserviceInReadmodel)
    .where(eq(eserviceInReadmodel.id, eserviceId))
    .limit(1);

export const retrieveDescriptorsSQL = (
  eserviceId: EServiceId,
  db: ReturnType<typeof drizzle>
) =>
  db
    .select()
    .from(eserviceDescriptorInReadmodel)
    .where(eq(eserviceDescriptorInReadmodel.eserviceId, eserviceId));

export const retrieveEserviceDocumentSQL = (
  eserviceId: EServiceId,
  db: ReturnType<typeof drizzle>
) =>
  db
    .select()
    .from(eserviceDescriptorDocumentInReadmodel)
    .where(eq(eserviceDescriptorDocumentInReadmodel.eserviceId, eserviceId));

export const retrieveEserviceAttributesSQL = (
  eserviceId: EServiceId,
  db: ReturnType<typeof drizzle>
) =>
  db
    .select()
    .from(eserviceDescriptorAttributeInReadmodel)
    .where(eq(eserviceDescriptorAttributeInReadmodel.eserviceId, eserviceId));

export const retrieveRejectionReasonsSQL = (
  eserviceId: EServiceId,
  db: ReturnType<typeof drizzle>
) =>
  db
    .select()
    .from(eserviceDescriptorRejectionReasonInReadmodel)
    .where(
      eq(eserviceDescriptorRejectionReasonInReadmodel.eserviceId, eserviceId)
    );

export const retrieveEserviceRiskAnalysesSQL = (
  eserviceId: EServiceId,
  db: ReturnType<typeof drizzle>
) =>
  db
    .select()
    .from(eserviceRiskAnalysisInReadmodel)
    .where(eq(eserviceRiskAnalysisInReadmodel.eserviceId, eserviceId));

export const retrieveEserviceRiskAnalysisAnswersSQL = (
  eserviceId: EServiceId,
  db: ReturnType<typeof drizzle>
) =>
  db
    .select()
    .from(eserviceRiskAnalysisAnswerInReadmodel)
    .where(eq(eserviceRiskAnalysisAnswerInReadmodel.eserviceId, eserviceId));

export const retrieveEserviceTemplateBindingSQL = (
  eserviceId: EServiceId,
  db: ReturnType<typeof drizzle>
) =>
  db
    .select()
    .from(eserviceTemplateBindingInReadmodel)
    .where(eq(eserviceTemplateBindingInReadmodel.eserviceId, eserviceId));

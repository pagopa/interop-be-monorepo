/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { EServiceId } from "pagopa-interop-models";
import {
  eserviceDescriptorAttributeInReadmodelCatalog,
  eserviceDescriptorDocumentInReadmodelCatalog,
  eserviceDescriptorRejectionReasonInReadmodelCatalog,
  eserviceInReadmodelCatalog,
  eserviceRiskAnalysisAnswerInReadmodelCatalog,
  eserviceRiskAnalysisInReadmodelCatalog,
  eserviceDescriptorInReadmodelCatalog,
  eserviceTemplateBindingInReadmodelCatalog,
  EServiceDescriptorAttributeSQL,
  EServiceDescriptorDocumentSQL,
  EServiceDescriptorRejectionReasonSQL,
  EServiceDescriptorSQL,
  EServiceRiskAnalysisAnswerSQL,
  EServiceRiskAnalysisSQL,
  EServiceSQL,
  EServiceTemplateBindingSQL,
} from "pagopa-interop-readmodel-models";
import { EServiceItemsSQL } from "./aggregators.js";

/*
es1
d1                  d2                  d3
dd1 dd2 dd3         dd4 dd5             dd6
a1 a2 a3            a4 a5               a6  

[
{eservice: es1, descriptor: d1, doc: dd1, att: a1},
{eservice: es1, descriptor: d1, doc: dd1, att: a2},
{eservice: es1, descriptor: d1, doc: dd2, att: a1},
{eservice: es1, descriptor: d1, doc: dd2, att: a2},
{eservice: es1, descriptor: d1, doc: dd3, att: a1},
{eservice: es1, descriptor: d1, doc: dd3, att: a2},

{eservice: es1, descriptor: d2, doc: dd4, att: a4},
{eservice: es1, descriptor: d2, doc: dd4, att: a5},
{eservice: es1, descriptor: d2, doc: dd5, att: a4},
{eservice: es1, descriptor: d2, doc: dd5, att: a5},

{eservice: es1, descriptor: d3, doc: dd6, att: a6},
]


{
    eservice: es1,
    descriptors: [d1, d2, d3],
    documents: [dd1, dd2, dd3, dd4, dd5, dd6]
}
1) 8 in contemporanea
2) join completo e nuovo aggregator ad hoc
2b) join completo e aggregator precedente
3) ibrido: tante query quanti descriptor (per ogni descriptor join su tutti i componenti)


eservice ->1 descriptor ->2 document
             descriptor ->3 attribute
             descriptor ->4 rejection reason
         ->5 risk analysis ->6 answer
         ->7 template binding

ogni freccia traccia un join. Ogni join si basa su una reference.
Perché usiamo left join e non full join? Esempio: tutti gli attribute se esistono hanno il descriptorId come reference. Non esiste attribute senza il suo descriptor. Quindi il left join copre tutte le combinazioni. Il full join darebbe lo stesso risultato. Invece, se avessimo attributes che possono esistere senza descriptor, il full join restituirebbe un risultato più esteso.

Perché usiamo left join e non inner join? Abbiamo ad esempio descriptor senza document, quindi non devono essere ignorati
 */

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const eserviceJoin = async (
  eserviceId: EServiceId,
  db: ReturnType<typeof drizzle>
) => {
  const query1 = () =>
    db
      .select({
        eservice: eserviceInReadmodelCatalog,
        descriptor: eserviceDescriptorInReadmodelCatalog,
        document: eserviceDescriptorDocumentInReadmodelCatalog,
        attribute: eserviceDescriptorAttributeInReadmodelCatalog,
        rejection: eserviceDescriptorRejectionReasonInReadmodelCatalog,
        riskAnalysis: eserviceRiskAnalysisInReadmodelCatalog,
        riskAnalysisAnswer: eserviceRiskAnalysisAnswerInReadmodelCatalog,
        templateBinding: eserviceTemplateBindingInReadmodelCatalog,
      })
      .from(eserviceInReadmodelCatalog);

  const query1bis = (eserviceId: EServiceId) =>
    db
      .select({
        eservice: eserviceInReadmodelCatalog,
        descriptor: eserviceDescriptorInReadmodelCatalog,
        document: eserviceDescriptorDocumentInReadmodelCatalog,
        attribute: eserviceDescriptorAttributeInReadmodelCatalog,
        rejection: eserviceDescriptorRejectionReasonInReadmodelCatalog,
        riskAnalysis: eserviceRiskAnalysisInReadmodelCatalog,
        riskAnalysisAnswer: eserviceRiskAnalysisAnswerInReadmodelCatalog,
        templateBinding: eserviceTemplateBindingInReadmodelCatalog,
      })
      .from(eserviceInReadmodelCatalog)
      .where(eq(eserviceInReadmodelCatalog.id, eserviceId));

  const query2 = (
    input: ReturnType<typeof query1> | ReturnType<typeof query1bis>
  ) =>
    input
      .leftJoin(
        // 1
        eserviceDescriptorInReadmodelCatalog,
        eq(
          eserviceInReadmodelCatalog.id,
          eserviceDescriptorInReadmodelCatalog.eserviceId
        )
      )
      .leftJoin(
        // 2
        eserviceDescriptorDocumentInReadmodelCatalog,
        eq(
          eserviceDescriptorInReadmodelCatalog.id,
          eserviceDescriptorDocumentInReadmodelCatalog.descriptorId
        )
      )
      .leftJoin(
        // 3
        eserviceDescriptorAttributeInReadmodelCatalog,
        eq(
          eserviceDescriptorInReadmodelCatalog.id,
          eserviceDescriptorAttributeInReadmodelCatalog.descriptorId
        )
      )
      .leftJoin(
        // 4
        eserviceDescriptorRejectionReasonInReadmodelCatalog,
        eq(
          eserviceDescriptorInReadmodelCatalog.id,
          eserviceDescriptorRejectionReasonInReadmodelCatalog.descriptorId
        )
      )
      .leftJoin(
        // 5
        eserviceRiskAnalysisInReadmodelCatalog,
        eq(
          eserviceInReadmodelCatalog.id,
          eserviceRiskAnalysisInReadmodelCatalog.eserviceId
        )
      )
      .leftJoin(
        // 6
        eserviceRiskAnalysisAnswerInReadmodelCatalog,
        eq(
          eserviceRiskAnalysisInReadmodelCatalog.riskAnalysisFormId,
          eserviceRiskAnalysisAnswerInReadmodelCatalog.riskAnalysisFormId
        )
      )
      .leftJoin(
        // 7
        eserviceTemplateBindingInReadmodelCatalog,
        eq(
          eserviceInReadmodelCatalog.id,
          eserviceTemplateBindingInReadmodelCatalog.eserviceId
        )
      );

  await query2(query1());
  await query2(query1bis(eserviceId));
  // TODO: make this work with query1.query2

  await db
    .select({
      eservice: eserviceInReadmodelCatalog,
      descriptor: eserviceDescriptorInReadmodelCatalog,
      document: eserviceDescriptorDocumentInReadmodelCatalog,
      attribute: eserviceDescriptorAttributeInReadmodelCatalog,
      rejection: eserviceDescriptorRejectionReasonInReadmodelCatalog,
      riskAnalysis: eserviceRiskAnalysisInReadmodelCatalog,
      riskAnalysisAnswer: eserviceRiskAnalysisAnswerInReadmodelCatalog,
      templateBinding: eserviceTemplateBindingInReadmodelCatalog,
    })
    .from(eserviceInReadmodelCatalog)
    // .where(eq(eserviceInReadmodelCatalog.id, eserviceId))
    .leftJoin(
      // 1
      eserviceDescriptorInReadmodelCatalog,
      eq(
        eserviceInReadmodelCatalog.id,
        eserviceDescriptorInReadmodelCatalog.eserviceId
      )
    )
    .leftJoin(
      // 2
      eserviceDescriptorDocumentInReadmodelCatalog,
      eq(
        eserviceDescriptorInReadmodelCatalog.id,
        eserviceDescriptorDocumentInReadmodelCatalog.descriptorId
      )
    )
    .leftJoin(
      // 3
      eserviceDescriptorAttributeInReadmodelCatalog,
      eq(
        eserviceDescriptorInReadmodelCatalog.id,
        eserviceDescriptorAttributeInReadmodelCatalog.descriptorId
      )
    )
    .leftJoin(
      // 4
      eserviceDescriptorRejectionReasonInReadmodelCatalog,
      eq(
        eserviceDescriptorInReadmodelCatalog.id,
        eserviceDescriptorRejectionReasonInReadmodelCatalog.descriptorId
      )
    )
    .leftJoin(
      // 5
      eserviceRiskAnalysisInReadmodelCatalog,
      eq(
        eserviceInReadmodelCatalog.id,
        eserviceRiskAnalysisInReadmodelCatalog.eserviceId
      )
    )
    .leftJoin(
      // 6
      eserviceRiskAnalysisAnswerInReadmodelCatalog,
      eq(
        eserviceRiskAnalysisInReadmodelCatalog.riskAnalysisFormId,
        eserviceRiskAnalysisAnswerInReadmodelCatalog.riskAnalysisFormId
      )
    )
    .leftJoin(
      // 7
      eserviceTemplateBindingInReadmodelCatalog,
      eq(
        eserviceInReadmodelCatalog.id,
        eserviceTemplateBindingInReadmodelCatalog.eserviceId
      )
    );
};
export const fromJoinToAggregator = (
  queryRes: Array<{
    eservice: EServiceSQL;
    descriptor: EServiceDescriptorSQL | null;
    document: EServiceDescriptorDocumentSQL | null;
    attribute: EServiceDescriptorAttributeSQL | null;
    rejection: EServiceDescriptorRejectionReasonSQL | null;
    riskAnalysis: EServiceRiskAnalysisSQL | null;
    riskAnalysisAnswer: EServiceRiskAnalysisAnswerSQL | null;
    templateBinding: EServiceTemplateBindingSQL | null;
  }>
): EServiceItemsSQL => {
  const eserviceSQL = queryRes[0].eservice;

  const descriptorIdSet = new Set<string>();
  const descriptorsSQL: EServiceDescriptorSQL[] = [];

  const documentIdSet = new Set<string>();
  const documentsSQL: EServiceDescriptorDocumentSQL[] = [];

  const attributeIdSet = new Set<string>();
  const attributesSQL: EServiceDescriptorAttributeSQL[] = [];

  const riskAnalysisIdSet = new Set<string>();
  const riskAnalysesSQL: EServiceRiskAnalysisSQL[] = [];

  const riskAnalysisAnswerIdSet = new Set<string>();
  const riskAnalysisAnswersSQL: EServiceRiskAnalysisAnswerSQL[] = [];

  const rejectionReasonsSet = new Set<string>();
  const rejectionReasonsSQL: EServiceDescriptorRejectionReasonSQL[] = [];

  queryRes.forEach((row) => {
    const descriptorSQL = row.descriptor;

    if (descriptorSQL) {
      if (!descriptorIdSet.has(descriptorSQL.id)) {
        descriptorIdSet.add(descriptorSQL.id);
        // eslint-disable-next-line functional/immutable-data
        descriptorsSQL.push(descriptorSQL);
      }

      const documentSQL = row.document;

      if (documentSQL && !documentIdSet.has(documentSQL.id)) {
        documentIdSet.add(documentSQL.id);
        // eslint-disable-next-line functional/immutable-data
        documentsSQL.push(documentSQL);
      }

      const attributeSQL = row.attribute;
      if (attributeSQL && !attributeIdSet.has(attributeSQL.attributeId)) {
        attributeIdSet.add(attributeSQL.attributeId);
        // eslint-disable-next-line functional/immutable-data
        attributesSQL.push(attributeSQL);
      }

      const rejectionReasonSQL = row.rejection;
      if (
        rejectionReasonSQL &&
        !rejectionReasonsSet.has(rejectionReasonSQL.rejectionReason)
      ) {
        rejectionReasonsSet.add(rejectionReasonSQL.rejectionReason);
        // eslint-disable-next-line functional/immutable-data
        rejectionReasonsSQL.push(rejectionReasonSQL);
      }
    }

    const riskAnalysisSQL = row.riskAnalysis;
    if (riskAnalysisSQL) {
      if (!riskAnalysisIdSet.has(riskAnalysisSQL.id)) {
        riskAnalysisIdSet.add(riskAnalysisSQL.id);
        // eslint-disable-next-line functional/immutable-data
        riskAnalysesSQL.push(riskAnalysisSQL);
      }

      const riskAnalysisAnswerSQL = row.riskAnalysisAnswer;
      if (
        riskAnalysisAnswerSQL &&
        !riskAnalysisAnswerIdSet.has(riskAnalysisAnswerSQL.id)
      ) {
        riskAnalysisAnswerIdSet.add(riskAnalysisAnswerSQL.id);
        // eslint-disable-next-line functional/immutable-data
        riskAnalysisAnswersSQL.push(riskAnalysisAnswerSQL);
      }
    }
  });

  return {
    eserviceSQL,
    descriptorsSQL,
    documentsSQL,
    attributesSQL,
    riskAnalysesSQL,
    riskAnalysisAnswersSQL,
    rejectionReasonsSQL,
    // templateBindingSQL: [],
  };
};

export const fromJoinToAggregatorArray = (
  queryRes: Array<{
    eservice: EServiceSQL;
    descriptor: EServiceDescriptorSQL | null;
    document: EServiceDescriptorDocumentSQL | null;
    attribute: EServiceDescriptorAttributeSQL | null;
    rejection: EServiceDescriptorRejectionReasonSQL | null;
    riskAnalysis: EServiceRiskAnalysisSQL | null;
    riskAnalysisAnswer: EServiceRiskAnalysisAnswerSQL | null;
    templateBinding: EServiceTemplateBindingSQL | null;
  }>
): {
  eservicesSQL: EServiceSQL[];
  riskAnalysesSQL: EServiceRiskAnalysisSQL[];
  riskAnalysisAnswersSQL: EServiceRiskAnalysisAnswerSQL[];
  descriptorsSQL: EServiceDescriptorSQL[];
  attributesSQL: EServiceDescriptorAttributeSQL[];
  documentsSQL: EServiceDescriptorDocumentSQL[];
  rejectionReasonsSQL: EServiceDescriptorRejectionReasonSQL[];
  templateBindingSQL: EServiceTemplateBindingSQL[];
} => {
  const eserviceIdSet = new Set<string>();
  const eservicesSQL: EServiceSQL[] = [];

  const descriptorIdSet = new Set<string>();
  const descriptorsSQL: EServiceDescriptorSQL[] = [];

  const documentIdSet = new Set<string>();
  const documentsSQL: EServiceDescriptorDocumentSQL[] = [];

  const attributeIdSet = new Set<string>();
  const attributesSQL: EServiceDescriptorAttributeSQL[] = [];

  const riskAnalysisIdSet = new Set<string>();
  const riskAnalysesSQL: EServiceRiskAnalysisSQL[] = [];

  const riskAnalysisAnswerIdSet = new Set<string>();
  const riskAnalysisAnswersSQL: EServiceRiskAnalysisAnswerSQL[] = [];

  const rejectionReasonsSet = new Set<string>();
  const rejectionReasonsSQL: EServiceDescriptorRejectionReasonSQL[] = [];

  queryRes.forEach((row) => {
    const eserviceSQL = row.eservice;

    if (!eserviceIdSet.has(eserviceSQL.id)) {
      eserviceIdSet.add(eserviceSQL.id);
      // eslint-disable-next-line functional/immutable-data
      eservicesSQL.push(eserviceSQL);
    }

    const descriptorSQL = row.descriptor;

    if (descriptorSQL) {
      if (!descriptorIdSet.has(descriptorSQL.id)) {
        descriptorIdSet.add(descriptorSQL.id);
        // eslint-disable-next-line functional/immutable-data
        descriptorsSQL.push(descriptorSQL);
      }

      const documentSQL = row.document;

      if (documentSQL && !documentIdSet.has(documentSQL.id)) {
        documentIdSet.add(documentSQL.id);
        // eslint-disable-next-line functional/immutable-data
        documentsSQL.push(documentSQL);
      }

      const attributeSQL = row.attribute;
      if (attributeSQL && !attributeIdSet.has(attributeSQL.attributeId)) {
        attributeIdSet.add(attributeSQL.attributeId);
        // eslint-disable-next-line functional/immutable-data
        attributesSQL.push(attributeSQL);
      }

      const rejectionReasonSQL = row.rejection;
      if (
        rejectionReasonSQL &&
        !rejectionReasonsSet.has(rejectionReasonSQL.rejectionReason)
      ) {
        rejectionReasonsSet.add(rejectionReasonSQL.rejectionReason);
        // eslint-disable-next-line functional/immutable-data
        rejectionReasonsSQL.push(rejectionReasonSQL);
      }
    }

    const riskAnalysisSQL = row.riskAnalysis;
    if (riskAnalysisSQL) {
      if (!riskAnalysisIdSet.has(riskAnalysisSQL.id)) {
        riskAnalysisIdSet.add(riskAnalysisSQL.id);
        // eslint-disable-next-line functional/immutable-data
        riskAnalysesSQL.push(riskAnalysisSQL);
      }

      const riskAnalysisAnswerSQL = row.riskAnalysisAnswer;
      if (
        riskAnalysisAnswerSQL &&
        !riskAnalysisAnswerIdSet.has(riskAnalysisAnswerSQL.id)
      ) {
        riskAnalysisAnswerIdSet.add(riskAnalysisAnswerSQL.id);
        // eslint-disable-next-line functional/immutable-data
        riskAnalysisAnswersSQL.push(riskAnalysisAnswerSQL);
      }
    }
  });

  return {
    eservicesSQL,
    descriptorsSQL,
    documentsSQL,
    attributesSQL,
    riskAnalysesSQL,
    riskAnalysisAnswersSQL,
    rejectionReasonsSQL,
    templateBindingSQL: [],
  };
};

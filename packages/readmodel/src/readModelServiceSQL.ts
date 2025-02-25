import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { EService, EServiceId, WithMetadata } from "pagopa-interop-models";
import {
  eserviceDescriptorAttributeInReadmodelCatalog,
  eserviceDescriptorDocumentInReadmodelCatalog,
  eserviceDescriptorInReadmodelCatalog,
  eserviceDescriptorRejectionReasonInReadmodelCatalog,
  eserviceInReadmodelCatalog,
  eserviceRiskAnalysisAnswerInReadmodelCatalog,
  eserviceRiskAnalysisInReadmodelCatalog,
} from "pagopa-interop-readmodel-models";
import { splitEserviceIntoObjectsSQL } from "./catalog/splitters.js";
import {
  aggregateEservice,
  aggregateEserviceArray,
  fromJoinToAggregator,
  fromJoinToAggregatorArray,
} from "./catalog/aggregators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(db: ReturnType<typeof drizzle>) {
  return {
    async addEService(eservice: WithMetadata<EService>): Promise<void> {
      const {
        eserviceSQL,
        riskAnalysesSQL,
        riskAnalysisAnswersSQL,
        descriptorsSQL,
        attributesSQL,
        documentsSQL,
        rejectionReasonsSQL,
      } = splitEserviceIntoObjectsSQL(eservice.data, eservice.metadata.version);

      await db.transaction(async (tx) => {
        await tx.insert(eserviceInReadmodelCatalog).values(eserviceSQL);

        for (const descriptor of descriptorsSQL) {
          await tx
            .insert(eserviceDescriptorInReadmodelCatalog)
            .values(descriptor);
        }

        for (const doc of documentsSQL) {
          await tx
            .insert(eserviceDescriptorDocumentInReadmodelCatalog)
            .values(doc);
        }

        for (const att of attributesSQL) {
          await tx
            .insert(eserviceDescriptorAttributeInReadmodelCatalog)
            .values(att);
        }

        for (const riskAnalysis of riskAnalysesSQL) {
          await tx
            .insert(eserviceRiskAnalysisInReadmodelCatalog)
            .values(riskAnalysis);
        }

        for (const riskAnalysisAnswer of riskAnalysisAnswersSQL) {
          await tx
            .insert(eserviceRiskAnalysisAnswerInReadmodelCatalog)
            .values(riskAnalysisAnswer);
        }

        for (const rejectionReason of rejectionReasonsSQL) {
          await tx
            .insert(eserviceDescriptorRejectionReasonInReadmodelCatalog)
            .values(rejectionReason);
        }
      });
    },
    async getEServiceById(
      eserviceId: EServiceId
    ): Promise<WithMetadata<EService> | undefined> {
      /*
        eservice ->1 descriptor ->2 document
                      descriptor ->3 attribute
                      descriptor ->4 rejection reason
                  ->5 risk analysis ->6 answer
                  ->7 template binding
      */
      const queryResult = await db
        .select({
          eservice: eserviceInReadmodelCatalog,
          descriptor: eserviceDescriptorInReadmodelCatalog,
          document: eserviceDescriptorDocumentInReadmodelCatalog,
          attribute: eserviceDescriptorAttributeInReadmodelCatalog,
          rejection: eserviceDescriptorRejectionReasonInReadmodelCatalog,
          riskAnalysis: eserviceRiskAnalysisInReadmodelCatalog,
          riskAnalysisAnswer: eserviceRiskAnalysisAnswerInReadmodelCatalog,
          // templateBinding: eserviceTemplateBindingInReadmodelCatalog,
        })
        .from(eserviceInReadmodelCatalog)
        .where(eq(eserviceInReadmodelCatalog.id, eserviceId))
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
        );
      // .leftJoin(
      //   // 7
      //   eserviceTemplateBindingInReadmodelCatalog,
      //   eq(
      //     eserviceInReadmodelCatalog.id,
      //     eserviceTemplateBindingInReadmodelCatalog.eserviceId
      //   )
      // );

      if (queryResult.length === 0) {
        return undefined;
      }

      const aggregatorInput = fromJoinToAggregator(queryResult);

      return aggregateEservice(aggregatorInput);
    },
    async deleteEServiceById(eserviceId: EServiceId): Promise<void> {
      await db
        .delete(eserviceInReadmodelCatalog)
        .where(eq(eserviceInReadmodelCatalog.id, eserviceId));
    },
    async getAllEServices(): Promise<Array<WithMetadata<EService>>> {
      const queryResult = await db
        .select({
          eservice: eserviceInReadmodelCatalog,
          descriptor: eserviceDescriptorInReadmodelCatalog,
          document: eserviceDescriptorDocumentInReadmodelCatalog,
          attribute: eserviceDescriptorAttributeInReadmodelCatalog,
          rejection: eserviceDescriptorRejectionReasonInReadmodelCatalog,
          riskAnalysis: eserviceRiskAnalysisInReadmodelCatalog,
          riskAnalysisAnswer: eserviceRiskAnalysisAnswerInReadmodelCatalog,
          // templateBinding: eserviceTemplateBindingInReadmodelCatalog,
        })
        .from(eserviceInReadmodelCatalog)
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
        );
      // .leftJoin(
      //   // 7
      //   eserviceTemplateBindingInReadmodelCatalog,
      //   eq(
      //     eserviceInReadmodelCatalog.id,
      //     eserviceTemplateBindingInReadmodelCatalog.eserviceId
      //   )
      // );

      const aggregatorInput = fromJoinToAggregatorArray(queryResult);
      return aggregateEserviceArray(aggregatorInput);
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { EService, EServiceId, WithMetadata } from "pagopa-interop-models";
import {
  eserviceDescriptorAttributeInReadmodelCatalog,
  eserviceDescriptorDocumentInReadmodelCatalog,
  eserviceDescriptorInReadmodelCatalog,
  eserviceDescriptorInterfaceInReadmodelCatalog,
  eserviceDescriptorRejectionReasonInReadmodelCatalog,
  eserviceInReadmodelCatalog,
  eserviceRiskAnalysisAnswerInReadmodelCatalog,
  eserviceRiskAnalysisInReadmodelCatalog,
} from "pagopa-interop-readmodel-models";
import { splitEserviceIntoObjectsSQL } from "./catalog/splitters.js";
import {
  aggregateEservice,
  aggregateEserviceArray,
  toEServiceAggregator,
  toEServiceAggregatorArray,
} from "./catalog/aggregators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function catalogReadModelServiceBuilderSQL(
  db: ReturnType<typeof drizzle>
) {
  return {
    async upsertEService(eservice: WithMetadata<EService>): Promise<void> {
      const {
        eserviceSQL,
        riskAnalysesSQL,
        riskAnalysisAnswersSQL,
        descriptorsSQL,
        attributesSQL,
        interfacesSQL,
        documentsSQL,
        rejectionReasonsSQL,
      } = splitEserviceIntoObjectsSQL(eservice.data, eservice.metadata.version);

      await db.transaction(async (tx) => {
        await tx
          .delete(eserviceInReadmodelCatalog)
          .where(eq(eserviceInReadmodelCatalog.id, eserviceSQL.id));

        await tx.insert(eserviceInReadmodelCatalog).values(eserviceSQL);

        for (const descriptorSQL of descriptorsSQL) {
          await tx
            .insert(eserviceDescriptorInReadmodelCatalog)
            .values(descriptorSQL);
        }

        for (const interfaceSQL of interfacesSQL) {
          await tx
            .insert(eserviceDescriptorInterfaceInReadmodelCatalog)
            .values(interfaceSQL);
        }

        for (const docSQL of documentsSQL) {
          await tx
            .insert(eserviceDescriptorDocumentInReadmodelCatalog)
            .values(docSQL);
        }

        for (const attributeSQL of attributesSQL) {
          await tx
            .insert(eserviceDescriptorAttributeInReadmodelCatalog)
            .values(attributeSQL);
        }

        for (const riskAnalysisSQL of riskAnalysesSQL) {
          await tx
            .insert(eserviceRiskAnalysisInReadmodelCatalog)
            .values(riskAnalysisSQL);
        }

        for (const riskAnalysisAnswerSQL of riskAnalysisAnswersSQL) {
          await tx
            .insert(eserviceRiskAnalysisAnswerInReadmodelCatalog)
            .values(riskAnalysisAnswerSQL);
        }

        for (const rejectionReasonSQL of rejectionReasonsSQL) {
          await tx
            .insert(eserviceDescriptorRejectionReasonInReadmodelCatalog)
            .values(rejectionReasonSQL);
        }
      });
    },
    async getEServiceById(
      eserviceId: EServiceId
    ): Promise<WithMetadata<EService> | undefined> {
      /*
        eservice ->1 descriptor ->2 interface
                      descriptor ->3 document
                      descriptor ->4 attribute
                      descriptor ->5 rejection reason
                  ->6 risk analysis ->7 answer
                  ->8 template binding
      */
      const queryResult = await db
        .select({
          eservice: eserviceInReadmodelCatalog,
          descriptor: eserviceDescriptorInReadmodelCatalog,
          interface: eserviceDescriptorInterfaceInReadmodelCatalog,
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
          eserviceDescriptorInterfaceInReadmodelCatalog,
          eq(
            eserviceDescriptorInReadmodelCatalog.id,
            eserviceDescriptorInterfaceInReadmodelCatalog.descriptorId
          )
        )
        .leftJoin(
          // 3
          eserviceDescriptorDocumentInReadmodelCatalog,
          eq(
            eserviceDescriptorInReadmodelCatalog.id,
            eserviceDescriptorDocumentInReadmodelCatalog.descriptorId
          )
        )
        .leftJoin(
          // 4
          eserviceDescriptorAttributeInReadmodelCatalog,
          eq(
            eserviceDescriptorInReadmodelCatalog.id,
            eserviceDescriptorAttributeInReadmodelCatalog.descriptorId
          )
        )
        .leftJoin(
          // 5
          eserviceDescriptorRejectionReasonInReadmodelCatalog,
          eq(
            eserviceDescriptorInReadmodelCatalog.id,
            eserviceDescriptorRejectionReasonInReadmodelCatalog.descriptorId
          )
        )
        .leftJoin(
          // 6
          eserviceRiskAnalysisInReadmodelCatalog,
          eq(
            eserviceInReadmodelCatalog.id,
            eserviceRiskAnalysisInReadmodelCatalog.eserviceId
          )
        )
        .leftJoin(
          // 7
          eserviceRiskAnalysisAnswerInReadmodelCatalog,
          eq(
            eserviceRiskAnalysisInReadmodelCatalog.riskAnalysisFormId,
            eserviceRiskAnalysisAnswerInReadmodelCatalog.riskAnalysisFormId
          )
        );
      // .leftJoin(
      //   // 8
      //   eserviceTemplateBindingInReadmodelCatalog,
      //   eq(
      //     eserviceInReadmodelCatalog.id,
      //     eserviceTemplateBindingInReadmodelCatalog.eserviceId
      //   )
      // );

      if (queryResult.length === 0) {
        return undefined;
      }

      const aggregatorInput = toEServiceAggregator(queryResult);

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
          interface: eserviceDescriptorInterfaceInReadmodelCatalog,
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
          eserviceDescriptorInterfaceInReadmodelCatalog,
          eq(
            eserviceDescriptorInReadmodelCatalog.id,
            eserviceDescriptorInterfaceInReadmodelCatalog.descriptorId
          )
        )
        .leftJoin(
          // 3
          eserviceDescriptorDocumentInReadmodelCatalog,
          eq(
            eserviceDescriptorInReadmodelCatalog.id,
            eserviceDescriptorDocumentInReadmodelCatalog.descriptorId
          )
        )
        .leftJoin(
          // 4
          eserviceDescriptorAttributeInReadmodelCatalog,
          eq(
            eserviceDescriptorInReadmodelCatalog.id,
            eserviceDescriptorAttributeInReadmodelCatalog.descriptorId
          )
        )
        .leftJoin(
          // 5
          eserviceDescriptorRejectionReasonInReadmodelCatalog,
          eq(
            eserviceDescriptorInReadmodelCatalog.id,
            eserviceDescriptorRejectionReasonInReadmodelCatalog.descriptorId
          )
        )
        .leftJoin(
          // 6
          eserviceRiskAnalysisInReadmodelCatalog,
          eq(
            eserviceInReadmodelCatalog.id,
            eserviceRiskAnalysisInReadmodelCatalog.eserviceId
          )
        )
        .leftJoin(
          // 7
          eserviceRiskAnalysisAnswerInReadmodelCatalog,
          eq(
            eserviceRiskAnalysisInReadmodelCatalog.riskAnalysisFormId,
            eserviceRiskAnalysisAnswerInReadmodelCatalog.riskAnalysisFormId
          )
        );
      // .leftJoin(
      //   // 8
      //   eserviceTemplateBindingInReadmodelCatalog,
      //   eq(
      //     eserviceInReadmodelCatalog.id,
      //     eserviceTemplateBindingInReadmodelCatalog.eserviceId
      //   )
      // );

      const aggregatorInput = toEServiceAggregatorArray(queryResult);
      return aggregateEserviceArray(aggregatorInput);
    },
  };
}

export type CatalogReadModelServiceSQL = ReturnType<
  typeof catalogReadModelServiceBuilderSQL
>;

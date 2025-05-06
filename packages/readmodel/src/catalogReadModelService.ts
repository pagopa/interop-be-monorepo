import { and, eq, lte, SQL } from "drizzle-orm";
import {
  EService,
  EServiceId,
  genericInternalError,
  WithMetadata,
} from "pagopa-interop-models";
import {
  DrizzleReturnType,
  eserviceDescriptorAttributeInReadmodelCatalog,
  eserviceDescriptorDocumentInReadmodelCatalog,
  eserviceDescriptorInReadmodelCatalog,
  eserviceDescriptorInterfaceInReadmodelCatalog,
  eserviceDescriptorRejectionReasonInReadmodelCatalog,
  eserviceDescriptorTemplateVersionRefInReadmodelCatalog,
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
import { checkMetadataVersion } from "./utils.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function catalogReadModelServiceBuilder(db: DrizzleReturnType) {
  return {
    // eslint-disable-next-line sonarjs/cognitive-complexity
    async upsertEService(
      eservice: EService,
      metadataVersion: number
    ): Promise<void> {
      await db.transaction(async (tx) => {
        const shouldUpsert = await checkMetadataVersion(
          tx,
          eserviceInReadmodelCatalog,
          metadataVersion,
          eservice.id
        );

        if (!shouldUpsert) {
          return;
        }

        await tx
          .delete(eserviceInReadmodelCatalog)
          .where(eq(eserviceInReadmodelCatalog.id, eservice.id));

        const {
          eserviceSQL,
          riskAnalysesSQL,
          riskAnalysisAnswersSQL,
          descriptorsSQL,
          attributesSQL,
          interfacesSQL,
          documentsSQL,
          rejectionReasonsSQL,
          templateVersionRefsSQL,
        } = splitEserviceIntoObjectsSQL(eservice, metadataVersion);

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

        for (const templateVersionRefSQL of templateVersionRefsSQL) {
          await tx
            .insert(eserviceDescriptorTemplateVersionRefInReadmodelCatalog)
            .values(templateVersionRefSQL);
        }
      });
    },
    async getEServiceById(
      eserviceId: EServiceId
    ): Promise<WithMetadata<EService> | undefined> {
      return await this.getEServiceByFilter(
        eq(eserviceInReadmodelCatalog.id, eserviceId)
      );
    },
    async getEServiceByFilter(
      filter: SQL | undefined
    ): Promise<WithMetadata<EService> | undefined> {
      if (filter === undefined) {
        throw genericInternalError("Filter cannot be undefined");
      }

      /*
        eservice ->1 descriptor ->2 interface
                      descriptor ->3 document
                      descriptor ->4 attribute
                      descriptor ->5 rejection reason
                      descriptor ->6 template version ref
                  ->7 risk analysis ->8 answers
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
          templateVersionRef:
            eserviceDescriptorTemplateVersionRefInReadmodelCatalog,
        })
        .from(eserviceInReadmodelCatalog)
        .where(filter)
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
          eserviceDescriptorTemplateVersionRefInReadmodelCatalog,
          eq(
            eserviceDescriptorInReadmodelCatalog.id,
            eserviceDescriptorTemplateVersionRefInReadmodelCatalog.descriptorId
          )
        )
        .leftJoin(
          // 7
          eserviceRiskAnalysisInReadmodelCatalog,
          eq(
            eserviceInReadmodelCatalog.id,
            eserviceRiskAnalysisInReadmodelCatalog.eserviceId
          )
        )
        .leftJoin(
          // 8
          eserviceRiskAnalysisAnswerInReadmodelCatalog,
          eq(
            eserviceRiskAnalysisInReadmodelCatalog.riskAnalysisFormId,
            eserviceRiskAnalysisAnswerInReadmodelCatalog.riskAnalysisFormId
          )
        );

      if (queryResult.length === 0) {
        return undefined;
      }

      return aggregateEservice(toEServiceAggregator(queryResult));
    },
    async getEServicesByFilter(
      filter: SQL | undefined
    ): Promise<Array<WithMetadata<EService>>> {
      if (filter === undefined) {
        throw genericInternalError("Filter cannot be undefined");
      }

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
          templateRef: eserviceTemplateRefInReadmodelCatalog,
          templateVersionRef:
            eserviceDescriptorTemplateVersionRefInReadmodelCatalog,
        })
        .from(eserviceInReadmodelCatalog)
        .where(filter)
        .leftJoin(
          eserviceDescriptorInReadmodelCatalog,
          eq(
            eserviceInReadmodelCatalog.id,
            eserviceDescriptorInReadmodelCatalog.eserviceId
          )
        )
        .leftJoin(
          eserviceDescriptorInterfaceInReadmodelCatalog,
          eq(
            eserviceDescriptorInReadmodelCatalog.id,
            eserviceDescriptorInterfaceInReadmodelCatalog.descriptorId
          )
        )
        .leftJoin(
          eserviceDescriptorDocumentInReadmodelCatalog,
          eq(
            eserviceDescriptorInReadmodelCatalog.id,
            eserviceDescriptorDocumentInReadmodelCatalog.descriptorId
          )
        )
        .leftJoin(
          eserviceDescriptorAttributeInReadmodelCatalog,
          eq(
            eserviceDescriptorInReadmodelCatalog.id,
            eserviceDescriptorAttributeInReadmodelCatalog.descriptorId
          )
        )
        .leftJoin(
          eserviceDescriptorRejectionReasonInReadmodelCatalog,
          eq(
            eserviceDescriptorInReadmodelCatalog.id,
            eserviceDescriptorRejectionReasonInReadmodelCatalog.descriptorId
          )
        )
        .leftJoin(
          eserviceDescriptorTemplateVersionRefInReadmodelCatalog,
          eq(
            eserviceDescriptorInReadmodelCatalog.id,
            eserviceDescriptorTemplateVersionRefInReadmodelCatalog.descriptorId
          )
        )
        .leftJoin(
          eserviceRiskAnalysisInReadmodelCatalog,
          eq(
            eserviceInReadmodelCatalog.id,
            eserviceRiskAnalysisInReadmodelCatalog.eserviceId
          )
        )
        .leftJoin(
          eserviceRiskAnalysisAnswerInReadmodelCatalog,
          eq(
            eserviceRiskAnalysisInReadmodelCatalog.riskAnalysisFormId,
            eserviceRiskAnalysisAnswerInReadmodelCatalog.riskAnalysisFormId
          )
        )
        .leftJoin(
          eserviceTemplateRefInReadmodelCatalog,
          eq(
            eserviceInReadmodelCatalog.id,
            eserviceTemplateRefInReadmodelCatalog.eserviceId
          )
        );

      return aggregateEserviceArray(toEServiceAggregatorArray(queryResult));
    },
    async deleteEServiceById(
      eserviceId: EServiceId,
      metadataVersion: number
    ): Promise<void> {
      await db
        .delete(eserviceInReadmodelCatalog)
        .where(
          and(
            eq(eserviceInReadmodelCatalog.id, eserviceId),
            lte(eserviceInReadmodelCatalog.metadataVersion, metadataVersion)
          )
        );
    },
  };
}

export type CatalogReadModelService = ReturnType<
  typeof catalogReadModelServiceBuilder
>;

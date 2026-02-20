import { and, eq, SQL } from "drizzle-orm";
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
import {
  aggregateEservice,
  aggregateEserviceArray,
  toEServiceAggregator,
  toEServiceAggregatorArray,
} from "./catalog/aggregators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function getEServicesQueryResult(db: DrizzleReturnType, filter: SQL) {
  /*
        eservice ->1 descriptor ->2 interface
                      descriptor ->3 document
                      descriptor ->4 attribute
                      descriptor ->5 rejection reason
                      descriptor ->6 template version ref
                  ->7 risk analysis ->8 answers
  */
  return db
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
      and(
        eq(
          eserviceRiskAnalysisInReadmodelCatalog.riskAnalysisFormId,
          eserviceRiskAnalysisAnswerInReadmodelCatalog.riskAnalysisFormId
        ),
        eq(
          eserviceRiskAnalysisInReadmodelCatalog.eserviceId,
          eserviceRiskAnalysisAnswerInReadmodelCatalog.eserviceId
        )
      )
    );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function catalogReadModelServiceBuilder(db: DrizzleReturnType) {
  return {
    // eslint-disable-next-line sonarjs/cognitive-complexity
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

      const queryResult = await getEServicesQueryResult(db, filter);

      if (queryResult.length === 0) {
        return undefined;
      }

      return aggregateEservice(toEServiceAggregator(queryResult));
    },
    async getEServicesByFilter(filter: SQL | undefined): Promise<EService[]> {
      if (filter === undefined) {
        throw genericInternalError("Filter cannot be undefined");
      }

      const queryResult = await getEServicesQueryResult(db, filter);

      return aggregateEserviceArray(toEServiceAggregatorArray(queryResult)).map(
        (eservice) => eservice.data
      );
    },
  };
}
export type CatalogReadModelService = ReturnType<
  typeof catalogReadModelServiceBuilder
>;

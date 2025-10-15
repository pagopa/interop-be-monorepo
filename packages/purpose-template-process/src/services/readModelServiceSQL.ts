import {
  EService,
  EServiceDescriptorPurposeTemplate,
  EServiceId,
  ListResult,
  PurposeTemplate,
  PurposeTemplateId,
  PurposeTemplateState,
  RiskAnalysisTemplateAnswerAnnotationDocument,
  RiskAnalysisTemplateAnswerAnnotationDocumentId,
  TenantId,
  TenantKind,
  WithMetadata,
} from "pagopa-interop-models";
import {
  aggregatePurposeTemplateEServiceDescriptor,
  aggregatePurposeTemplateEServiceDescriptorArray,
  CatalogReadModelService,
  PurposeTemplateReadModelService,
  aggregatePurposeTemplateArray,
  toPurposeTemplateAggregatorArray,
  toRiskAnalysisTemplateAnswerAnnotationDocument,
} from "pagopa-interop-readmodel";
import {
  DrizzleReturnType,
  eserviceInReadmodelCatalog,
  purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate,
  purposeTemplateInReadmodelPurposeTemplate,
  purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate,
  purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate,
  purposeTemplateRiskAnalysisAnswerInReadmodelPurposeTemplate,
  purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate,
} from "pagopa-interop-readmodel-models";
import {
  and,
  eq,
  exists,
  getTableColumns,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  SQL,
} from "drizzle-orm";
import {
  ascLower,
  createListResult,
  escapeRegExp,
  getValidFormRulesVersions,
  withTotalCount,
} from "pagopa-interop-commons";

export type GetPurposeTemplatesFilters = {
  purposeTitle?: string;
  targetTenantKind?: TenantKind;
  creatorIds: TenantId[];
  eserviceIds: EServiceId[];
  states: PurposeTemplateState[];
  excludeExpiredRiskAnalysis?: boolean;
};

export type GetPurposeTemplateEServiceDescriptorsFilters = {
  purposeTemplateId: PurposeTemplateId;
  producerIds: TenantId[];
  eserviceIds: EServiceId[];
};

const getPurposeTemplatesFilters = (
  readModelDB: DrizzleReturnType,
  filters: GetPurposeTemplatesFilters
): SQL | undefined => {
  const {
    purposeTitle,
    creatorIds,
    eserviceIds,
    states,
    targetTenantKind,
    excludeExpiredRiskAnalysis,
  } = filters;

  const purposeTitleFilter = purposeTitle
    ? ilike(
        purposeTemplateInReadmodelPurposeTemplate.purposeTitle,
        `%${escapeRegExp(purposeTitle)}%`
      )
    : undefined;

  const creatorIdsFilter =
    creatorIds.length > 0
      ? inArray(purposeTemplateInReadmodelPurposeTemplate.creatorId, creatorIds)
      : undefined;

  const eserviceIdsFilter =
    eserviceIds.length > 0
      ? and(
          exists(
            readModelDB
              .select()
              .from(purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate)
              .where(
                inArray(
                  purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate.eserviceId,
                  eserviceIds
                )
              )
          ),
          isNotNull(
            purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate.eserviceId
          )
        )
      : undefined;

  const statesFilter =
    states.length > 0
      ? inArray(purposeTemplateInReadmodelPurposeTemplate.state, states)
      : undefined;

  const targetTenantKindFilter = targetTenantKind
    ? eq(
        purposeTemplateInReadmodelPurposeTemplate.targetTenantKind,
        targetTenantKind
      )
    : undefined;

  const validFormRulesByTenantKind = getValidFormRulesVersions();
  const excludeExpiredRiskAnalysisFilters = excludeExpiredRiskAnalysis
    ? or(
        ...Array.from(validFormRulesByTenantKind.entries()).map(
          ([tenantKind, versions]) =>
            and(
              eq(
                purposeTemplateInReadmodelPurposeTemplate.targetTenantKind,
                tenantKind
              ),
              inArray(
                purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate.version,
                versions
              )
            )
        ),
        isNull(
          purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate.version
        )
      )
    : undefined;

  return and(
    purposeTitleFilter,
    creatorIdsFilter,
    eserviceIdsFilter,
    statesFilter,
    targetTenantKindFilter,
    excludeExpiredRiskAnalysisFilters
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderSQL({
  readModelDB,
  catalogReadModelServiceSQL,
  purposeTemplateReadModelServiceSQL,
}: {
  readModelDB: DrizzleReturnType;
  catalogReadModelServiceSQL: CatalogReadModelService;
  purposeTemplateReadModelServiceSQL: PurposeTemplateReadModelService;
}) {
  return {
    async getEServiceById(id: EServiceId): Promise<EService | undefined> {
      return (await catalogReadModelServiceSQL.getEServiceById(id))?.data;
    },
    async getPurposeTemplate(
      title: string
    ): Promise<WithMetadata<PurposeTemplate> | undefined> {
      return await purposeTemplateReadModelServiceSQL.getPurposeTemplateByFilter(
        ilike(
          purposeTemplateInReadmodelPurposeTemplate.purposeTitle,
          escapeRegExp(title)
        )
      );
    },
    async getPurposeTemplates(
      filters: GetPurposeTemplatesFilters,
      { limit, offset }: { limit: number; offset: number }
    ): Promise<ListResult<PurposeTemplate>> {
      const subquery = readModelDB
        .select(
          withTotalCount({
            purposeTemplateId: purposeTemplateInReadmodelPurposeTemplate.id,
          })
        )
        .from(purposeTemplateInReadmodelPurposeTemplate)
        .leftJoin(
          purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate,
          eq(
            purposeTemplateInReadmodelPurposeTemplate.id,
            purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate.purposeTemplateId
          )
        )
        .leftJoin(
          purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate,
          eq(
            purposeTemplateInReadmodelPurposeTemplate.id,
            purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate.purposeTemplateId
          )
        )
        .where(getPurposeTemplatesFilters(readModelDB, filters))
        .groupBy(purposeTemplateInReadmodelPurposeTemplate.id)
        .orderBy(
          ascLower(purposeTemplateInReadmodelPurposeTemplate.purposeTitle)
        )
        .limit(limit)
        .offset(offset)
        .as("subquery");

      const queryResult = await readModelDB
        .select({
          purposeTemplate: purposeTemplateInReadmodelPurposeTemplate,
          purposeRiskAnalysisFormTemplate:
            purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate,
          purposeRiskAnalysisTemplateAnswer:
            purposeTemplateRiskAnalysisAnswerInReadmodelPurposeTemplate,
          purposeRiskAnalysisTemplateAnswerAnnotation:
            purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate,
          purposeRiskAnalysisTemplateAnswerAnnotationDocument:
            purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate,
          totalCount: subquery.totalCount,
        })
        .from(purposeTemplateInReadmodelPurposeTemplate)
        .innerJoin(
          subquery,
          eq(
            purposeTemplateInReadmodelPurposeTemplate.id,
            subquery.purposeTemplateId
          )
        )
        .leftJoin(
          purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate,
          eq(
            purposeTemplateInReadmodelPurposeTemplate.id,
            purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate.purposeTemplateId
          )
        )
        .leftJoin(
          purposeTemplateRiskAnalysisAnswerInReadmodelPurposeTemplate,
          eq(
            purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate.id,
            purposeTemplateRiskAnalysisAnswerInReadmodelPurposeTemplate.riskAnalysisFormId
          )
        )
        .leftJoin(
          purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate,
          eq(
            purposeTemplateRiskAnalysisAnswerInReadmodelPurposeTemplate.id,
            purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate.answerId
          )
        )
        .leftJoin(
          purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate,
          eq(
            purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate.id,
            purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate.annotationId
          )
        )
        .orderBy(
          ascLower(purposeTemplateInReadmodelPurposeTemplate.purposeTitle)
        );

      const purposeTemplates = aggregatePurposeTemplateArray(
        toPurposeTemplateAggregatorArray(queryResult)
      );
      return createListResult(
        purposeTemplates.map((purposeTemplate) => purposeTemplate.data),
        queryResult[0]?.totalCount
      );
    },
    async getPurposeTemplateById(
      purposeTemplateId: PurposeTemplateId
    ): Promise<WithMetadata<PurposeTemplate> | undefined> {
      return await purposeTemplateReadModelServiceSQL.getPurposeTemplateById(
        purposeTemplateId
      );
    },
    async getRiskAnalysisTemplateAnswerAnnotationDocument(
      purposeTemplateId: PurposeTemplateId,
      documentId: RiskAnalysisTemplateAnswerAnnotationDocumentId
    ): Promise<
      WithMetadata<RiskAnalysisTemplateAnswerAnnotationDocument> | undefined
    > {
      const queryResult = await readModelDB
        .select()
        .from(
          purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate
        )
        .where(
          and(
            eq(
              purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate.purposeTemplateId,
              purposeTemplateId
            ),
            eq(
              purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate.id,
              documentId
            )
          )
        );

      if (queryResult.length === 0) {
        return undefined;
      }

      return {
        data: toRiskAnalysisTemplateAnswerAnnotationDocument(queryResult[0]),
        metadata: { version: queryResult[0].metadataVersion },
      };
    },
    async getPurposeTemplateEServiceDescriptorsByPurposeTemplateIdAndEserviceId(
      purposeTemplateId: PurposeTemplateId,
      eserviceId: EServiceId
    ): Promise<EServiceDescriptorPurposeTemplate | undefined> {
      const queryResult = await readModelDB
        .select(
          getTableColumns(
            purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate
          )
        )
        .from(purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate)
        .where(
          and(
            eq(
              purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate.purposeTemplateId,
              purposeTemplateId
            ),
            eq(
              purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate.eserviceId,
              eserviceId
            )
          )
        )
        .limit(1);

      if (queryResult.length === 0) {
        return undefined;
      }

      const purposeTemplateEServiceDescriptor =
        aggregatePurposeTemplateEServiceDescriptor(queryResult[0]);

      return purposeTemplateEServiceDescriptor.data;
    },
    async getPurposeTemplateEServiceDescriptors(
      filters: GetPurposeTemplateEServiceDescriptorsFilters,
      { limit, offset }: { limit: number; offset: number }
    ): Promise<ListResult<EServiceDescriptorPurposeTemplate>> {
      const { purposeTemplateId, producerIds, eserviceIds } = filters;

      const queryResult = await readModelDB
        .select(
          withTotalCount(
            getTableColumns(
              purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate
            )
          )
        )
        .from(purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate)
        .innerJoin(
          eserviceInReadmodelCatalog,
          eq(
            purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate.eserviceId,
            eserviceInReadmodelCatalog.id
          )
        )
        .where(
          and(
            eq(
              purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate.purposeTemplateId,
              purposeTemplateId
            ),
            producerIds.length > 0
              ? inArray(eserviceInReadmodelCatalog.producerId, producerIds)
              : undefined,
            eserviceIds.length > 0
              ? inArray(
                  purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate.eserviceId,
                  eserviceIds
                )
              : undefined
          )
        )
        .orderBy(
          purposeTemplateEserviceDescriptorInReadmodelPurposeTemplate.createdAt
        )
        .limit(limit)
        .offset(offset);

      const purposeTemplateEServiceDescriptors =
        aggregatePurposeTemplateEServiceDescriptorArray(queryResult);

      return createListResult(
        purposeTemplateEServiceDescriptors.map(
          (eserviceDescriptor) => eserviceDescriptor.data
        ),
        queryResult[0]?.totalCount
      );
    },
  };
}
export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;

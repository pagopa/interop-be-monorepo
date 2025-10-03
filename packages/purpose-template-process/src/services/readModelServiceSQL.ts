import {
  EService,
  EServiceId,
  ListResult,
  PurposeTemplate,
  PurposeTemplateId,
  PurposeTemplateState,
  Tenant,
  TenantId,
  TenantKind,
  WithMetadata,
} from "pagopa-interop-models";
import {
  CatalogReadModelService,
  TenantReadModelService,
  PurposeTemplateReadModelService,
  aggregatePurposeTemplateArray,
  toPurposeTemplateAggregatorArray,
} from "pagopa-interop-readmodel";
import {
  DrizzleReturnType,
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
  tenantReadModelServiceSQL,
  purposeTemplateReadModelServiceSQL,
}: {
  readModelDB: DrizzleReturnType;
  catalogReadModelServiceSQL: CatalogReadModelService;
  tenantReadModelServiceSQL: TenantReadModelService;
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async getPurposeTemplateById(
      _id: PurposeTemplateId
    ): Promise<WithMetadata<PurposeTemplate> | undefined> {
      // TO DO: this is a placeholder function Replace with actual implementation to fetch the purpose template by ID
      return undefined;
    },
    async getTenantById(id: TenantId): Promise<Tenant | undefined> {
      return (await tenantReadModelServiceSQL.getTenantById(id))?.data;
    },
  };
}
export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;

import {
  EService,
  EServiceId,
  ListResult,
  PurposeTemplate,
  PurposeTemplateId,
  PurposeTemplateState,
  Tenant,
  TenantId,
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
  getTableColumns,
  ilike,
  inArray,
  isNotNull,
  SQL,
} from "drizzle-orm";
import {
  createListResult,
  createOrderByClauses,
  escapeRegExp,
  withTotalCount,
} from "pagopa-interop-commons";

export type GetPurposeTemplatesFilters = {
  purposeTitle?: string;
  creatorIds: TenantId[];
  eserviceIds: EServiceId[];
  states: PurposeTemplateState[];
};

const getPurposeTemplatesFilters = (
  readModelDB: DrizzleReturnType,
  filters: GetPurposeTemplatesFilters
): SQL | undefined => {
  const { purposeTitle, creatorIds, eserviceIds, states } = filters;

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

  return and(
    purposeTitleFilter,
    creatorIdsFilter,
    eserviceIdsFilter,
    statesFilter
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
    async checkPurposeTemplateName(): Promise<boolean> {
      return false;
    },
    async getEServiceById(id: EServiceId): Promise<EService | undefined> {
      return (await catalogReadModelServiceSQL.getEServiceById(id))?.data;
    },
    async getPurposeTemplate(
      title: string
    ): Promise<WithMetadata<PurposeTemplate> | undefined> {
      return await purposeTemplateReadModelServiceSQL.getPurposeTemplateByFilter(
        and(
          ilike(
            purposeTemplateInReadmodelPurposeTemplate.purposeTitle,
            escapeRegExp(title)
          )
        )
      );
    },
    async getPurposeTemplates(
      filters: GetPurposeTemplatesFilters,
      {
        offset,
        limit,
        sortColumns,
        directions: directions,
      }: {
        offset: number;
        limit: number;
        sortColumns: string | undefined;
        directions: string | undefined;
      }
    ): Promise<ListResult<PurposeTemplate>> {
      const tableColumns = getTableColumns(
        purposeTemplateInReadmodelPurposeTemplate
      );
      const orderClause = createOrderByClauses({
        table: purposeTemplateInReadmodelPurposeTemplate,
        sortColumns,
        directions,
        defaultSortColumn: tableColumns.purposeTitle,
      });

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
        .where(getPurposeTemplatesFilters(readModelDB, filters))
        .groupBy(purposeTemplateInReadmodelPurposeTemplate.id)
        .orderBy(...orderClause)
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
          and(
            eq(
              purposeTemplateRiskAnalysisFormInReadmodelPurposeTemplate.id,
              purposeTemplateRiskAnalysisAnswerInReadmodelPurposeTemplate.riskAnalysisFormId
            )
          )
        )
        .leftJoin(
          purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate,
          and(
            eq(
              purposeTemplateRiskAnalysisAnswerInReadmodelPurposeTemplate.id,
              purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate.answerId
            )
          )
        )
        .leftJoin(
          purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate,
          and(
            eq(
              purposeTemplateRiskAnalysisAnswerAnnotationInReadmodelPurposeTemplate.id,
              purposeTemplateRiskAnalysisAnswerAnnotationDocumentInReadmodelPurposeTemplate.annotationId
            )
          )
        )
        .orderBy(...orderClause);

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
      return purposeTemplateReadModelServiceSQL.getPurposeTemplateById(
        purposeTemplateId
      );
    },
    async getTenantById(id: TenantId): Promise<Tenant | undefined> {
      return (await tenantReadModelServiceSQL.getTenantById(id))?.data;
    },
  };
}
export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;

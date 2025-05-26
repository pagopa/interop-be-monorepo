import {
  ascLower,
  createListResult,
  escapeRegExp,
  M2MAuthData,
  UIAuthData,
  withTotalCount,
} from "pagopa-interop-commons";
import {
  Attribute,
  AttributeId,
  EServiceTemplate,
  EServiceTemplateId,
  EServiceTemplateVersionState,
  ListResult,
  Tenant,
  TenantId,
  WithMetadata,
  eserviceTemplateVersionState,
  genericInternalError,
} from "pagopa-interop-models";
import { z } from "zod";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import {
  attributeInReadmodelAttribute,
  DrizzleReturnType,
  eserviceInReadmodelCatalog,
  eserviceTemplateInReadmodelEserviceTemplate,
  eserviceTemplateRiskAnalysisAnswerInReadmodelEserviceTemplate,
  eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate,
  eserviceTemplateVersionAttributeInReadmodelEserviceTemplate,
  eserviceTemplateVersionDocumentInReadmodelEserviceTemplate,
  eserviceTemplateVersionInReadmodelEserviceTemplate,
  eserviceTemplateVersionInterfaceInReadmodelEserviceTemplate,
  tenantInReadmodelTenant,
} from "pagopa-interop-readmodel-models";
import {
  aggregateEServiceTemplateArray,
  AttributeReadModelService,
  EServiceTemplateReadModelService,
  TenantReadModelService,
  toEServiceTemplateAggregatorArray,
} from "pagopa-interop-readmodel";
import { and, count, eq, ilike, inArray, isNotNull, ne, or } from "drizzle-orm";
import { hasRoleToAccessDraftTemplateVersions } from "./validators.js";

export type GetEServiceTemplatesFilters = {
  name?: string;
  eserviceTemplatesIds: EServiceTemplateId[];
  creatorsIds: TenantId[];
  states: EServiceTemplateVersionState[];
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderSQL({
  readModelDB,
  eserviceTemplateReadModelServiceSQL,
  tenantReadModelServiceSQL,
  attributeReadModelServiceSQL,
}: {
  readModelDB: DrizzleReturnType;
  eserviceTemplateReadModelServiceSQL: EServiceTemplateReadModelService;
  tenantReadModelServiceSQL: TenantReadModelService;
  attributeReadModelServiceSQL: AttributeReadModelService;
}) {
  return {
    async getEServiceTemplateById(
      id: EServiceTemplateId
    ): Promise<WithMetadata<EServiceTemplate> | undefined> {
      return await eserviceTemplateReadModelServiceSQL.getEServiceTemplateById(
        id
      );
    },
    async getEServiceTemplateByNameAndCreatorId({
      name,
      creatorId,
    }: {
      name: string;
      creatorId: TenantId;
    }): Promise<WithMetadata<EServiceTemplate> | undefined> {
      return await eserviceTemplateReadModelServiceSQL.getEServiceTemplateByFilter(
        and(
          eq(eserviceTemplateInReadmodelEserviceTemplate.creatorId, creatorId),
          ilike(
            eserviceTemplateInReadmodelEserviceTemplate.name,
            escapeRegExp(name)
          )
        )
      );
    },
    async getTenantById(id: TenantId): Promise<Tenant | undefined> {
      return (await tenantReadModelServiceSQL.getTenantById(id))?.data;
    },
    async getAttributesByIds(
      attributesIds: AttributeId[]
    ): Promise<Attribute[]> {
      return (
        await attributeReadModelServiceSQL.getAttributesByFilter(
          inArray(attributeInReadmodelAttribute.id, attributesIds)
        )
      ).map((a) => a.data);
    },
    async getEServiceTemplates(
      filters: GetEServiceTemplatesFilters,
      offset: number,
      limit: number,
      authData: UIAuthData | M2MAuthData
    ): Promise<ListResult<EServiceTemplate>> {
      const { eserviceTemplatesIds, creatorsIds, states, name } = filters;

      const subquery = readModelDB
        .select(
          withTotalCount({
            eserviceTemplateId: eserviceTemplateInReadmodelEserviceTemplate.id,
          })
        )
        .from(eserviceTemplateInReadmodelEserviceTemplate)
        .leftJoin(
          eserviceTemplateVersionInReadmodelEserviceTemplate,
          eq(
            eserviceTemplateInReadmodelEserviceTemplate.id,
            eserviceTemplateVersionInReadmodelEserviceTemplate.eserviceTemplateId
          )
        )
        .where(
          and(
            // NAME FILTER
            name
              ? ilike(
                  eserviceTemplateInReadmodelEserviceTemplate.name,
                  `%${escapeRegExp(name)}%`
                )
              : undefined,
            // IDS FILTER
            eserviceTemplatesIds.length > 0
              ? inArray(
                  eserviceTemplateInReadmodelEserviceTemplate.id,
                  eserviceTemplatesIds
                )
              : undefined,
            // CREATORS IDS FILTER
            creatorsIds.length > 0
              ? inArray(
                  eserviceTemplateInReadmodelEserviceTemplate.creatorId,
                  creatorsIds
                )
              : undefined,
            // STATES FILTER
            states.length > 0
              ? inArray(
                  eserviceTemplateVersionInReadmodelEserviceTemplate.state,
                  states
                )
              : undefined,
            // VISIBILITY FILTER
            hasRoleToAccessDraftTemplateVersions(authData)
              ? or(
                  eq(
                    eserviceTemplateInReadmodelEserviceTemplate.creatorId,
                    authData.organizationId
                  ),
                  and(
                    ne(
                      eserviceTemplateVersionInReadmodelEserviceTemplate.state,
                      eserviceTemplateVersionState.draft
                    ),
                    isNotNull(
                      eserviceTemplateVersionInReadmodelEserviceTemplate.id
                    )
                  )
                )
              : and(
                  ne(
                    eserviceTemplateVersionInReadmodelEserviceTemplate.state,
                    eserviceTemplateVersionState.draft
                  ),
                  isNotNull(
                    eserviceTemplateVersionInReadmodelEserviceTemplate.id
                  )
                )
          )
        )
        .groupBy(eserviceTemplateInReadmodelEserviceTemplate.id)
        .orderBy(ascLower(eserviceTemplateInReadmodelEserviceTemplate.name))
        .limit(limit)
        .offset(offset)
        .as("subquery");

      const queryResult = await readModelDB
        .select({
          eserviceTemplate: eserviceTemplateInReadmodelEserviceTemplate,
          version: eserviceTemplateVersionInReadmodelEserviceTemplate,
          interface:
            eserviceTemplateVersionInterfaceInReadmodelEserviceTemplate,
          document: eserviceTemplateVersionDocumentInReadmodelEserviceTemplate,
          attribute:
            eserviceTemplateVersionAttributeInReadmodelEserviceTemplate,
          riskAnalysis: eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate,
          riskAnalysisAnswer:
            eserviceTemplateRiskAnalysisAnswerInReadmodelEserviceTemplate,
          totalCount: subquery.totalCount,
        })
        .from(eserviceTemplateInReadmodelEserviceTemplate)
        .innerJoin(
          subquery,
          eq(
            subquery.eserviceTemplateId,
            eserviceTemplateInReadmodelEserviceTemplate.id
          )
        )
        .leftJoin(
          eserviceTemplateVersionInReadmodelEserviceTemplate,
          eq(
            eserviceTemplateInReadmodelEserviceTemplate.id,
            eserviceTemplateVersionInReadmodelEserviceTemplate.eserviceTemplateId
          )
        )
        .leftJoin(
          eserviceTemplateVersionInterfaceInReadmodelEserviceTemplate,
          eq(
            eserviceTemplateVersionInReadmodelEserviceTemplate.id,
            eserviceTemplateVersionInterfaceInReadmodelEserviceTemplate.versionId
          )
        )
        .leftJoin(
          eserviceTemplateVersionDocumentInReadmodelEserviceTemplate,
          eq(
            eserviceTemplateVersionInReadmodelEserviceTemplate.id,
            eserviceTemplateVersionDocumentInReadmodelEserviceTemplate.versionId
          )
        )
        .leftJoin(
          eserviceTemplateVersionAttributeInReadmodelEserviceTemplate,
          eq(
            eserviceTemplateVersionInReadmodelEserviceTemplate.id,
            eserviceTemplateVersionAttributeInReadmodelEserviceTemplate.versionId
          )
        )
        .leftJoin(
          eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate,
          eq(
            eserviceTemplateInReadmodelEserviceTemplate.id,
            eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate.eserviceTemplateId
          )
        )
        .leftJoin(
          eserviceTemplateRiskAnalysisAnswerInReadmodelEserviceTemplate,
          eq(
            eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate.riskAnalysisFormId,
            eserviceTemplateRiskAnalysisAnswerInReadmodelEserviceTemplate.riskAnalysisFormId
          )
        )
        .orderBy(ascLower(eserviceTemplateInReadmodelEserviceTemplate.name));

      const eserviceTemplates = aggregateEServiceTemplateArray(
        toEServiceTemplateAggregatorArray(queryResult)
      );
      return createListResult(
        eserviceTemplates.map((eserviceTemplate) => eserviceTemplate.data),
        queryResult[0]?.totalCount ?? 0
      );
    },
    async checkNameConflictInstances(
      eserviceTemplate: EServiceTemplate,
      newName: string
    ): Promise<boolean> {
      const queryResult = await readModelDB.transaction(async (tx) => {
        const instanceProducerIds = (
          await tx
            .select({
              producerId: eserviceInReadmodelCatalog.producerId,
            })
            .from(eserviceInReadmodelCatalog)
            .where(
              and(
                eq(eserviceInReadmodelCatalog.templateId, eserviceTemplate.id)
              )
            )
            .groupBy(eserviceInReadmodelCatalog.producerId)
        ).map((d) => d.producerId);

        return await tx
          .select({
            count: count(),
          })
          .from(eserviceInReadmodelCatalog)
          .where(
            and(
              eq(eserviceInReadmodelCatalog.name, newName),
              inArray(
                eserviceInReadmodelCatalog.producerId,
                instanceProducerIds
              )
            )
          );
      });

      return queryResult.length > 0 ? queryResult[0].count > 0 : false;
    },
    async getCreators(
      name: string | undefined,
      limit: number,
      offset: number
    ): Promise<ListResult<eserviceTemplateApi.CompactOrganization>> {
      const queryResult = await readModelDB
        .select(
          withTotalCount({
            id: tenantInReadmodelTenant.id,
            name: tenantInReadmodelTenant.name,
          })
        )
        .from(tenantInReadmodelTenant)
        .innerJoin(
          eserviceTemplateInReadmodelEserviceTemplate,
          eq(
            eserviceTemplateInReadmodelEserviceTemplate.creatorId,
            tenantInReadmodelTenant.id
          )
        )
        .innerJoin(
          eserviceTemplateVersionInReadmodelEserviceTemplate,
          eq(
            eserviceTemplateInReadmodelEserviceTemplate.id,
            eserviceTemplateVersionInReadmodelEserviceTemplate.eserviceTemplateId
          )
        )
        .where(
          // E-SERVICE TEMPLATE FILTER
          and(
            eq(
              eserviceTemplateVersionInReadmodelEserviceTemplate.state,
              eserviceTemplateVersionState.published
            ),
            // TENANT FILTER
            name
              ? ilike(tenantInReadmodelTenant.name, `%${escapeRegExp(name)}%`)
              : undefined
          )
        )
        .groupBy(tenantInReadmodelTenant.id)
        .orderBy(ascLower(tenantInReadmodelTenant.name))
        .limit(limit)
        .offset(offset);

      const data: eserviceTemplateApi.CompactOrganization[] = queryResult.map(
        (d) => ({
          id: d.id,
          name: d.name,
        })
      );

      const result = z
        .array(eserviceTemplateApi.CompactOrganization)
        .safeParse(data);

      if (!result.success) {
        throw genericInternalError(
          `Unable to parse compact organization items: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );
      }

      return createListResult(result.data, queryResult[0]?.totalCount ?? 0);
    },
  };
}

export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;

import {
  AuthData,
  hasPermission,
  ReadModelRepository,
  userRoles,
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
  descriptorState,
  eserviceTemplateVersionState,
  genericInternalError,
} from "pagopa-interop-models";
import { z } from "zod";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import {
  attributeInReadmodelAttribute,
  DrizzleReturnType,
  eserviceDescriptorInReadmodelCatalog,
  eserviceInReadmodelCatalog,
  eserviceTemplateInReadmodelEserviceTemplate,
  eserviceTemplateRefInReadmodelCatalog,
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
import {
  and,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { concat } from "drizzle-orm/pg-core/expressions";

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
      return eserviceTemplateReadModelServiceSQL.getEServiceTemplateById(id);
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
            ReadModelRepository.escapeRegExp(name)
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
      authData: AuthData
    ): Promise<ListResult<EServiceTemplate>> {
      const { eserviceTemplatesIds, creatorsIds, states, name } = filters;

      const queryResult = await readModelDB.transaction(async (tx) => {
        const subquery = tx
          .select({
            eserviceTemplateId: eserviceTemplateInReadmodelEserviceTemplate.id,
            totalCount: sql`COUNT(*) OVER()`.as("totalCount"),
          })
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
                    `%${ReadModelRepository.escapeRegExp(name)}%`
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
              or(
                hasPermission(
                  [
                    userRoles.ADMIN_ROLE,
                    userRoles.API_ROLE,
                    userRoles.SUPPORT_ROLE,
                  ],
                  authData
                )
                  ? or(
                      eq(
                        eserviceTemplateInReadmodelEserviceTemplate.creatorId,
                        authData.organizationId
                      ),
                      isNull(
                        eserviceTemplateVersionInReadmodelEserviceTemplate.id
                      )
                    )
                  : undefined,
                ne(
                  eserviceTemplateVersionInReadmodelEserviceTemplate.state,
                  eserviceTemplateVersionState.draft
                )
              )
            )
          )
          .groupBy(eserviceTemplateInReadmodelEserviceTemplate.id)
          .limit(limit)
          .offset(offset)
          .as("subquery");

        return await tx
          .select({
            eserviceTemplate: eserviceTemplateInReadmodelEserviceTemplate,
            version: eserviceTemplateVersionInReadmodelEserviceTemplate,
            interface:
              eserviceTemplateVersionInterfaceInReadmodelEserviceTemplate,
            document:
              eserviceTemplateVersionDocumentInReadmodelEserviceTemplate,
            attribute:
              eserviceTemplateVersionAttributeInReadmodelEserviceTemplate,
            riskAnalysis:
              eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate,
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
          .orderBy(
            sql`LOWER(${eserviceTemplateInReadmodelEserviceTemplate.name})`
          );
      });

      return {
        results: aggregateEServiceTemplateArray(
          toEServiceTemplateAggregatorArray(queryResult)
        ).map((eserviceTemplate) => eserviceTemplate.data),
        totalCount: Number(queryResult[0]?.totalCount ?? 0),
      };
    },
    async checkNameConflictInstances(
      eserviceTemplate: EServiceTemplate,
      newName: string
    ): Promise<boolean> {
      const queryResult = await readModelDB
        .select({
          eserviceId: eserviceInReadmodelCatalog.id,
        })
        .from(eserviceInReadmodelCatalog)
        .innerJoin(
          eserviceDescriptorInReadmodelCatalog,
          eq(
            eserviceInReadmodelCatalog.id,
            eserviceDescriptorInReadmodelCatalog.eserviceId
          )
        )
        .innerJoin(
          eserviceTemplateRefInReadmodelCatalog,
          eq(
            eserviceInReadmodelCatalog.id,
            eserviceTemplateRefInReadmodelCatalog.eserviceId
          )
        )
        .where(
          and(
            ne(
              eserviceDescriptorInReadmodelCatalog.state,
              descriptorState.draft
            ),
            eq(
              eserviceTemplateRefInReadmodelCatalog.eserviceTemplateId,
              eserviceTemplate.id
            ),
            or(
              and(
                isNotNull(eserviceTemplateRefInReadmodelCatalog.instanceLabel),
                eq(
                  concat(
                    eserviceInReadmodelCatalog.name,
                    ` ${eserviceTemplateRefInReadmodelCatalog.instanceLabel}`
                  ),
                  newName
                )
              ),
              eq(eserviceInReadmodelCatalog.name, newName)
            )
          )
        )
        .groupBy(eserviceInReadmodelCatalog.id);

      return queryResult.length > 0;
    },
    async getCreators(
      name: string | undefined,
      limit: number,
      offset: number
    ): Promise<ListResult<eserviceTemplateApi.CompactOrganization>> {
      const queryResult = await readModelDB
        .select({
          id: tenantInReadmodelTenant.id,
          name: tenantInReadmodelTenant.name,
          totalCount: sql`COUNT(*) OVER()`.as("totalCount"),
        })
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
              ? ilike(
                  tenantInReadmodelTenant.name,
                  `%${ReadModelRepository.escapeRegExp(name)}%`
                )
              : undefined
          )
        )
        .groupBy(tenantInReadmodelTenant.id)
        .orderBy(sql`LOWER(${tenantInReadmodelTenant.name})`)
        .limit(limit)
        .offset(offset);

      const data = queryResult.map((d) => ({
        id: d.id,
        name: d.name,
      }));

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

      return {
        results: result.data,
        totalCount: Number(queryResult[0]?.totalCount ?? 0),
      };
    },
  };
}

export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;

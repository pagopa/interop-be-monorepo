import {
  AuthData,
  EServiceTemplateCollection,
  hasPermission,
  ReadModelFilter,
  ReadModelRepository,
  userRoles,
} from "pagopa-interop-commons";
import {
  EServiceTemplate,
  EServiceTemplateId,
  EServiceTemplateVersionState,
  ListResult,
  TenantId,
  WithMetadata,
  eserviceTemplateVersionState,
  genericInternalError,
} from "pagopa-interop-models";
import { Filter, WithId } from "mongodb";
import { z } from "zod";

export type GetEServiceTemplatesFilters = {
  name?: string;
  eserviceTemplatesIds: EServiceTemplateId[];
  creatorsIds: TenantId[];
  states: EServiceTemplateVersionState[];
};

async function getEServiceTemplate(
  eserviceTemplates: EServiceTemplateCollection,
  filter: Filter<WithId<WithMetadata<EServiceTemplate>>>
): Promise<WithMetadata<EServiceTemplate> | undefined> {
  const data = await eserviceTemplates.findOne(filter, {
    projection: { data: true, metadata: true },
  });
  if (!data) {
    return undefined;
  } else {
    const result = z
      .object({
        metadata: z.object({ version: z.number() }),
        data: EServiceTemplate,
      })
      .safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse eService item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return {
      data: result.data.data,
      metadata: { version: result.data.metadata.version },
    };
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(
  readModelRepository: ReadModelRepository
) {
  const eserviceTemplates = readModelRepository.eserviceTemplates;

  return {
    async getEServiceTemplateById(
      id: EServiceTemplateId
    ): Promise<WithMetadata<EServiceTemplate> | undefined> {
      return getEServiceTemplate(eserviceTemplates, { "data.id": id });
    },

    async getEServiceTemplateByNameAndCreatorId({
      name,
      creatorId,
    }: {
      name: string;
      creatorId: TenantId;
    }): Promise<WithMetadata<EServiceTemplate> | undefined> {
      return getEServiceTemplate(eserviceTemplates, {
        "data.name": {
          $regex: `^${ReadModelRepository.escapeRegExp(name)}$$`,
          $options: "i",
        },
        "data.creatorId": creatorId,
      });
    },

    async getEServiceTemplates(
      filters: GetEServiceTemplatesFilters,
      offset: number,
      limit: number,
      authData: AuthData
    ): Promise<ListResult<EServiceTemplate>> {
      const { eserviceTemplatesIds, creatorsIds, states, name } = filters;

      const nameFilter: ReadModelFilter<EServiceTemplate> = name
        ? {
            "data.name": {
              $regex: ReadModelRepository.escapeRegExp(name),
              $options: "i",
            },
          }
        : {};

      const idsFilter: ReadModelFilter<EServiceTemplate> =
        ReadModelRepository.arrayToFilter(eserviceTemplatesIds, {
          "data.id": { $in: eserviceTemplatesIds },
        });

      const creatorsIdsFilter: ReadModelFilter<EServiceTemplate> =
        ReadModelRepository.arrayToFilter(creatorsIds, {
          "data.creatorId": { $in: creatorsIds },
        });

      const templateStateFilter: ReadModelFilter<EServiceTemplate> =
        ReadModelRepository.arrayToFilter(states, {
          "data.versions.state": { $in: states },
        });

      const visibilityFilter: ReadModelFilter<EServiceTemplate> = hasPermission(
        [userRoles.ADMIN_ROLE, userRoles.API_ROLE, userRoles.SUPPORT_ROLE],
        authData
      )
        ? {
            $nor: [
              {
                "data.creatorId": { $ne: authData.organizationId },
                "data.versions": { $size: 1 },
                "data.versions.state": eserviceTemplateVersionState.draft,
              },
            ],
          }
        : {
            $nor: [
              {
                "data.versions": { $size: 1 },
                "data.versions.state": {
                  $eq: eserviceTemplateVersionState.draft,
                },
              },
            ],
          };

      const aggregationPipeline = [
        { $match: nameFilter },
        { $match: idsFilter },
        { $match: creatorsIdsFilter },
        { $match: templateStateFilter },
        { $match: visibilityFilter },
        {
          $project: {
            data: 1,
            computedColumn: { $toLower: ["$data.name"] },
          },
        },
        {
          $sort: { computedColumn: 1 },
        },
      ];

      const data = await eserviceTemplates
        .aggregate(
          [...aggregationPipeline, { $skip: offset }, { $limit: limit }],
          { allowDiskUse: true }
        )
        .toArray();

      const result = z
        .array(EServiceTemplate)
        .safeParse(data.map((d) => d.data));
      if (!result.success) {
        throw genericInternalError(
          `Unable to parse eservice templates items: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );
      }

      return {
        results: result.data,
        totalCount: await ReadModelRepository.getTotalCount(
          eserviceTemplates,
          aggregationPipeline
        ),
      };
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;

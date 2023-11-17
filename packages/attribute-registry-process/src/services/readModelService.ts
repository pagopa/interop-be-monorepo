import { Filter } from "mongodb";
import { z } from "zod";
import {
  AttributeCollection,
  logger,
  ReadModelRepository,
} from "pagopa-interop-commons";
import {
  AttributeKind,
  Attribute,
  ErrorTypes,
  WithMetadata,
} from "pagopa-interop-models";
import { ListResult } from "../model/types.js";
import { AttributeRegistryConfig } from "../utilities/config.js";

export class ReadModelService {
  private attributes: AttributeCollection;
  constructor(config: AttributeRegistryConfig) {
    this.attributes = ReadModelRepository.init(config).attributes;
  }

  public async getAttributesByIds({
    ids,
    offset,
    limit,
  }: {
    ids: string[];
    offset: number;
    limit: number;
  }): Promise<ListResult<Attribute>> {
    return this.getAttributes({
      aggregationPipeline: [
        {
          $match: {
            "data.id": {
              $in: ids,
            },
          },
        },
        {
          $project: {
            data: 1,
            computedColumn: { $toLower: ["$data.name"] },
          },
        },
        {
          $sort: { computedColumn: 1 },
        },
      ],
      offset,
      limit,
    });
  }

  public async getAttributesByKindsNameOrigin({
    kinds,
    name,
    origin,
    offset,
    limit,
  }: {
    kinds: AttributeKind[];
    name?: string;
    origin?: string;
    offset: number;
    limit: number;
  }): Promise<ListResult<Attribute>> {
    const nameFilter = name
      ? {
          "data.name": {
            $regex: name,
            $options: "i",
          },
        }
      : {};
    const originFilter = origin
      ? {
          "data.origin": origin,
        }
      : {};
    const aggregationPipeline = [
      {
        $match: {
          ...nameFilter,
          ...originFilter,
          ...ReadModelRepository.arrayToFilter(kinds, (kinds) => ({
            "data.kind": { $in: kinds },
          })),
        },
      },
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
    return this.getAttributes({
      aggregationPipeline,
      offset,
      limit,
    });
  }

  public async getAttributeById(
    id: string
  ): Promise<WithMetadata<Attribute> | undefined> {
    return this.getAttribute({ "data.id": id });
  }

  public async getAttributeByName(
    name: string
  ): Promise<WithMetadata<Attribute> | undefined> {
    return this.getAttribute({
      "data.name": {
        $regex: `^${name}$$`,
        $options: "i",
      },
    });
  }

  public async getAttributeByOriginAndCode({
    origin,
    code,
  }: {
    origin: string;
    code: string;
  }): Promise<WithMetadata<Attribute> | undefined> {
    return this.getAttribute({
      "data.origin": origin,
      "data.code": code,
    });
  }

  private async getAttribute(
    filter: Filter<{ data: Attribute }>
  ): Promise<WithMetadata<Attribute> | undefined> {
    const data = await this.attributes.findOne(filter, {
      projection: { data: true, metadata: true },
    });
    if (data) {
      const result = z
        .object({
          metadata: z.object({ version: z.number() }),
          data: Attribute,
        })
        .safeParse(data);
      if (!result.success) {
        logger.error(
          `Unable to parse attribute item: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );
        throw ErrorTypes.GenericError;
      }
      return {
        data: result.data.data,
        metadata: { version: result.data.metadata.version },
      };
    }
    return undefined;
  }

  private async getAttributes({
    aggregationPipeline,
    offset,
    limit,
  }: {
    aggregationPipeline: object[];
    offset: number;
    limit: number;
  }): Promise<ListResult<Attribute>> {
    const data = await this.attributes
      .aggregate([...aggregationPipeline, { $skip: offset }, { $limit: limit }])
      .toArray();
    const result = z.array(Attribute).safeParse(data.map((d) => d.data));
    if (!result.success) {
      logger.error(
        `Unable to parse attributes items: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
      throw ErrorTypes.GenericError;
    }
    return {
      results: result.data,
      totalCount: await ReadModelRepository.getTotalCount(
        this.attributes,
        aggregationPipeline
      ),
    };
  }
}

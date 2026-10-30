import type { OpenAPIObject } from "openapi3-ts";
import type { TemplateContext } from "openapi-zod-client";

export function createSchemaRenderer(
  schemas: NonNullable<OpenAPIObject["components"]>["schemas"]
): (name: string, generatedSchema: string) => string {
  return (name, generatedSchema) => {
    const schema = schemas?.[name];
    if (!schema || "$ref" in schema || schema.minProperties === undefined) {
      return generatedSchema;
    }

    // Zodios unwraps top-level effects when router transformations are disabled.
    return `${generatedSchema}.refine(value => Object.keys(value).length >= ${schema.minProperties}, { message: "Expected at least ${schema.minProperties} properties" }).and(z.unknown())`;
  };
}

type EndpointGroup = TemplateContext["endpointsGroups"][string];

type EndpointChunk = {
  name: string;
  endpoints: EndpointGroup["endpoints"];
};

type EndpointChunkHelpers = {
  endpointChunks: (
    groupName: string,
    endpoints: EndpointGroup["endpoints"]
  ) => EndpointChunk[];
  hasChunkedEndpointGroups: (
    endpointsGroups: TemplateContext["endpointsGroups"]
  ) => boolean;
  shouldChunkEndpoints: (endpoints: EndpointGroup["endpoints"]) => boolean;
};

export function createEndpointChunkHelpers(
  maxEndpointsPerChunk: number
): EndpointChunkHelpers {
  const shouldChunkEndpoints = (
    endpoints: EndpointGroup["endpoints"]
  ): boolean => endpoints.length > maxEndpointsPerChunk;

  const endpointChunks = (
    groupName: string,
    endpoints: EndpointGroup["endpoints"]
  ): EndpointChunk[] => {
    const chunks: EndpointChunk[] = [];
    for (
      let index: number = 0;
      index < endpoints.length;
      index += maxEndpointsPerChunk
    ) {
      chunks.push({
        name: `${groupName}EndpointsChunk${chunks.length}`,
        endpoints: endpoints.slice(index, index + maxEndpointsPerChunk),
      });
    }

    return chunks;
  };

  const hasChunkedEndpointGroups = (
    endpointsGroups: TemplateContext["endpointsGroups"]
  ): boolean =>
    Object.values(endpointsGroups).some((group) =>
      shouldChunkEndpoints(group.endpoints)
    );

  return {
    endpointChunks,
    hasChunkedEndpointGroups,
    shouldChunkEndpoints,
  };
}

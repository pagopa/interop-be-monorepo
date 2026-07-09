import type { TemplateContext } from "openapi-zod-client";

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
      let index = 0;
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

import { describe, expect, it } from "vitest";
import type { TemplateContext } from "openapi-zod-client";
import { createEndpointChunkHelpers } from "../src/generatorUtils.js";

const testMaxEndpointsPerChunk = 2;
const { endpointChunks, hasChunkedEndpointGroups, shouldChunkEndpoints } =
  createEndpointChunkHelpers(testMaxEndpointsPerChunk);

function createContext(endpointCount: number): TemplateContext {
  const endpoints: TemplateContext["endpoints"] = Array.from(
    { length: endpointCount },
    (_, index) => ({ alias: `endpoint${index}` }) as never
  );

  return {
    schemas: {},
    endpoints: [],
    endpointsGroups: {
      process: {
        schemas: {},
        types: {},
        endpoints,
      },
    },
    types: {},
    circularTypeByName: {},
    emittedType: {},
  };
}

describe("endpoint chunking", () => {
  it("does not chunk groups at the configured limit", () => {
    const context: TemplateContext = createContext(testMaxEndpointsPerChunk);

    expect(
      shouldChunkEndpoints(context.endpointsGroups.process?.endpoints ?? [])
    ).toBe(false);
    expect(hasChunkedEndpointGroups(context.endpointsGroups)).toBe(false);
  });

  it("chunks groups above the configured limit", () => {
    const context: TemplateContext = createContext(
      testMaxEndpointsPerChunk + 1
    );
    const endpoints: TemplateContext["endpoints"] =
      context.endpointsGroups.process?.endpoints ?? [];

    expect(shouldChunkEndpoints(endpoints)).toBe(true);
    expect(hasChunkedEndpointGroups(context.endpointsGroups)).toBe(true);
    expect(endpointChunks("process", endpoints)).toEqual([
      {
        name: "processEndpointsChunk0",
        endpoints: endpoints.slice(0, testMaxEndpointsPerChunk),
      },
      {
        name: "processEndpointsChunk1",
        endpoints: endpoints.slice(testMaxEndpointsPerChunk),
      },
    ]);
  });
});

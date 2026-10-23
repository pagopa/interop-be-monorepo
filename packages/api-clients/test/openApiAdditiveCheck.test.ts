import { describe, expect, it } from "vitest";

import {
  compareOpenApiSpecs,
  formatReport,
  hasNonAdditiveChanges,
} from "../scripts/openApiAdditiveCheck.js";

const baseSpec = {
  openapi: "3.0.3",
  info: { version: "1.0.0" },
  servers: [{ url: "/api" }],
  security: [{ bearerAuth: [] }],
  paths: {
    "/items/{itemId}": {
      parameters: [
        {
          name: "itemId",
          in: "path",
          required: true,
          schema: { type: "string" },
        },
      ],
      get: {
        operationId: "getItem",
        responses: {
          "200": { $ref: "#/components/responses/Ok" },
        },
      },
    },
  },
  components: {
    responses: {
      Ok: { description: "OK" },
    },
    schemas: {
      Item: { type: "object" },
    },
  },
};

describe("compareOpenApiSpecs", () => {
  it("reports modified existing endpoints and components as plain text, including zero", () => {
    const report = formatReport({
      addedOperations: ["GET /new"],
      removedOperations: [],
      modifiedOperations: [],
      addedComponents: ["schemas/New"],
      removedComponents: [],
      modifiedComponents: [],
      changedGlobals: [],
      addedTags: [],
      removedTags: [],
      modifiedTags: [],
      baseVersion: "1.0.0",
      headVersion: "1.1.0",
    });

    expect(report).toContain("Existing endpoints modified: 0");
    expect(report).toContain("Existing components modified: 0");
    expect(report).not.toContain("**");
    expect(report).not.toContain("`");
  });

  it("allows new operations and components while preserving existing definitions", () => {
    const headSpec = {
      ...baseSpec,
      info: { version: "1.1.0" },
      paths: {
        ...baseSpec.paths,
        "/items": {
          get: {
            operationId: "getItems",
            responses: {
              "200": {
                description: "OK",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/ItemList" },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        ...baseSpec.components,
        schemas: {
          ...baseSpec.components.schemas,
          ItemList: { type: "array" },
        },
      },
    };

    const diff = compareOpenApiSpecs(baseSpec, headSpec);

    expect(diff).toEqual({
      addedOperations: ["GET /items"],
      removedOperations: [],
      modifiedOperations: [],
      addedComponents: ["schemas/ItemList"],
      removedComponents: [],
      modifiedComponents: [],
      changedGlobals: [],
      addedTags: [],
      removedTags: [],
      modifiedTags: [],
      baseVersion: "1.0.0",
      headVersion: "1.1.0",
    });
    expect(hasNonAdditiveChanges(diff)).toBe(false);
  });

  it("detects modifications and removals of existing operations", () => {
    const headSpec = {
      ...baseSpec,
      paths: {
        "/items/{itemId}": {
          parameters: baseSpec.paths["/items/{itemId}"].parameters,
          get: {
            operationId: "getItem",
            responses: {
              "404": { description: "Not found" },
            },
          },
        },
      },
    };

    const modifiedDiff = compareOpenApiSpecs(baseSpec, headSpec);

    expect(modifiedDiff).toMatchObject({
      modifiedOperations: ["GET /items/{itemId}"],
      removedOperations: [],
    });
    expect(hasNonAdditiveChanges(modifiedDiff)).toBe(true);

    const removedDiff = compareOpenApiSpecs(baseSpec, {
      ...baseSpec,
      paths: {},
    });
    expect(removedDiff.removedOperations).toEqual(["GET /items/{itemId}"]);
    expect(hasNonAdditiveChanges(removedDiff)).toBe(true);
  });

  it("detects changes to path-level parameters and existing shared components", () => {
    const headSpec = {
      ...baseSpec,
      paths: {
        "/items/{itemId}": {
          parameters: [
            {
              name: "itemId",
              in: "path",
              required: false,
              schema: { type: "string" },
            },
          ],
          get: baseSpec.paths["/items/{itemId}"].get,
        },
      },
      components: {
        ...baseSpec.components,
        responses: {
          Ok: { description: "Changed response" },
        },
      },
    };

    const diff = compareOpenApiSpecs(baseSpec, headSpec);

    expect(diff).toMatchObject({
      modifiedOperations: ["GET /items/{itemId}"],
      modifiedComponents: ["responses/Ok"],
    });
    expect(hasNonAdditiveChanges(diff)).toBe(true);
  });

  it("detects changes to global server and existing tag definitions", () => {
    const baseWithTag = {
      ...baseSpec,
      tags: [{ name: "items", description: "Items" }],
    };
    const headSpec = {
      ...baseWithTag,
      servers: [{ url: "/changed" }],
      tags: [{ name: "items", description: "Changed" }],
    };

    const diff = compareOpenApiSpecs(baseWithTag, headSpec);

    expect(diff).toMatchObject({
      changedGlobals: ["servers"],
      modifiedTags: ["items"],
    });
    expect(hasNonAdditiveChanges(diff)).toBe(true);
  });
});

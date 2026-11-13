import { AttributeRegistryProcessServerConfig } from "pagopa-interop-commons";
import { describe, expect, it } from "vitest";

describe("AttributeRegistryProcessServerConfig", () => {
  it("prefers the canonical URL when the deprecated value is invalid", () => {
    const env: NodeJS.ProcessEnv = {
      ATTRIBUTE_REGISTRY_PROCESS_URL: "http://attribute-registry-process/",
      ATTRIBUTE_PROCESS_URL: "",
    };

    const result: AttributeRegistryProcessServerConfig =
      AttributeRegistryProcessServerConfig.parse(env);

    expect(result.attributeRegistryProcessUrl).toBe(
      "http://attribute-registry-process"
    );
  });

  it("accepts the deprecated URL when the canonical value is missing", () => {
    const env: NodeJS.ProcessEnv = {
      ATTRIBUTE_PROCESS_URL: "http://attribute-registry-process/",
    };

    const result: AttributeRegistryProcessServerConfig =
      AttributeRegistryProcessServerConfig.parse(env);

    expect(result.attributeRegistryProcessUrl).toBe(
      "http://attribute-registry-process"
    );
  });

  it("rejects the config when both URL values are missing", () => {
    const env: NodeJS.ProcessEnv = {};
    const result: ReturnType<
      typeof AttributeRegistryProcessServerConfig.safeParse
    > = AttributeRegistryProcessServerConfig.safeParse(env);

    if (result.success) {
      throw new Error("Expected the config parsing to fail");
    }
    expect(result.error.issues).toContainEqual({
      code: "custom",
      message: 'Missing required env variable "ATTRIBUTE_REGISTRY_PROCESS_URL"',
      path: [],
    });
  });
});

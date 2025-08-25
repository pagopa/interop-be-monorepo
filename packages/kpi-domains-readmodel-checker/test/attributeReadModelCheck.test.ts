import { getMockAttribute } from "pagopa-interop-commons-test";
import { describe, expect, it } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import { Attribute, WithMetadata, attributeKind } from "pagopa-interop-models";
import { upsertAttribute } from "pagopa-interop-readmodel/testUtils";
import { compare } from "../src/utils.js";
import {
  addOneAttribute,
  readModelDB,
  readModelServiceKPI,
  readModelServiceSQL,
} from "./utils.js";

describe("Check attribute readmodels", () => {
  it("should return -1 if the postgres schema is empty", async () => {
    const attribute = getMockAttribute();

    await addOneAttribute({
      data: attribute,
      metadata: { version: 1 },
    });

    const attributes = await readModelServiceKPI.getAllAttributes();

    const postgresAttributes = await readModelServiceSQL.getAllAttributes();

    const res = compare({
      kpiItems: attributes,
      postgresItems: postgresAttributes,
      schema: "attribute",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(-1);
  });

  it("should detect no differences if all the items are equal", async () => {
    const attribute: WithMetadata<Attribute> = {
      data: getMockAttribute(),
      metadata: { version: 1 },
    };

    await addOneAttribute(attribute);

    await upsertAttribute(
      readModelDB,
      attribute.data,
      attribute.metadata.version
    );

    const attributes = await readModelServiceKPI.getAllAttributes();

    const postgresAttributes = await readModelServiceSQL.getAllAttributes();

    const res = compare({
      kpiItems: attributes,
      postgresItems: postgresAttributes,
      schema: "attribute",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(0);
  });

  it("should detect differences if the postgres item is not present", async () => {
    const attribute1: WithMetadata<Attribute> = {
      data: getMockAttribute(),
      metadata: { version: 1 },
    };

    const attribute2: WithMetadata<Attribute> = {
      data: getMockAttribute(),
      metadata: { version: 1 },
    };

    await addOneAttribute(attribute1);
    await addOneAttribute(attribute2);

    await upsertAttribute(
      readModelDB,
      attribute2.data,
      attribute2.metadata.version
    );

    const attributes = await readModelServiceKPI.getAllAttributes();

    const postgresAttributes = await readModelServiceSQL.getAllAttributes();

    const res = compare({
      kpiItems: attributes,
      postgresItems: postgresAttributes,
      schema: "attribute",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });

  it("should detect differences if the kpi item is not present", async () => {
    const attribute1: WithMetadata<Attribute> = {
      data: getMockAttribute(),
      metadata: { version: 1 },
    };

    const attribute2: WithMetadata<Attribute> = {
      data: getMockAttribute(),
      metadata: { version: 1 },
    };

    await addOneAttribute(attribute1);

    await upsertAttribute(
      readModelDB,
      attribute1.data,
      attribute1.metadata.version
    );
    await upsertAttribute(
      readModelDB,
      attribute2.data,
      attribute2.metadata.version
    );

    const attributes = await readModelServiceKPI.getAllAttributes();

    const postgresAttributes = await readModelServiceSQL.getAllAttributes();

    const res = compare({
      kpiItems: attributes,
      postgresItems: postgresAttributes,
      schema: "attribute",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });

  it("should detect differences if the items are different", async () => {
    const attribute1: WithMetadata<Attribute> = {
      data: {
        ...getMockAttribute(),
        kind: attributeKind.certified,
      },
      metadata: { version: 1 },
    };

    const attribute1InPostgresDb: WithMetadata<Attribute> = {
      data: {
        ...attribute1.data,
        kind: attributeKind.declared,
      },
      metadata: attribute1.metadata,
    };

    await addOneAttribute(attribute1);

    await upsertAttribute(
      readModelDB,
      attribute1InPostgresDb.data,
      attribute1InPostgresDb.metadata.version
    );

    const attributes = await readModelServiceKPI.getAllAttributes();

    const postgresAttributes = await readModelServiceSQL.getAllAttributes();

    const res = compare({
      kpiItems: attributes,
      postgresItems: postgresAttributes,
      schema: "attribute",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });

  it("should detect differences if the items are equal but the version is different", async () => {
    const attribute1: WithMetadata<Attribute> = {
      data: getMockAttribute(),
      metadata: { version: 1 },
    };

    const attribute1InPostgresDb: WithMetadata<Attribute> = {
      data: attribute1.data,
      metadata: {
        version: 3,
      },
    };

    await addOneAttribute(attribute1);

    await upsertAttribute(
      readModelDB,
      attribute1InPostgresDb.data,
      attribute1InPostgresDb.metadata.version
    );

    const attributes = await readModelServiceKPI.getAllAttributes();

    const postgresAttributes = await readModelServiceSQL.getAllAttributes();

    const res = compare({
      kpiItems: attributes,
      postgresItems: postgresAttributes,
      schema: "attribute",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });
});

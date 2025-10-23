import { getMockPurposeTemplate } from "pagopa-interop-commons-test";
import { describe, expect, it } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import { PurposeTemplate, WithMetadata } from "pagopa-interop-models";
import { upsertPurposeTemplate } from "pagopa-interop-readmodel/testUtils";
import { compare } from "../src/utils.js";
import {
  addOnePurposeTemplate,
  readModelDB,
  readModelServiceKPI,
  readModelServiceSQL,
} from "./utils.js";

describe("Check purpose template read models", () => {
  it("should return -1 if the postgres schema is empty", async () => {
    const purposeTemplate = getMockPurposeTemplate();

    await addOnePurposeTemplate({
      data: purposeTemplate,
      metadata: { version: 1 },
    });

    const kpiItems = await readModelServiceKPI.getAllPurposeTemplates();
    const postgresItems = await readModelServiceSQL.getAllPurposeTemplates();

    const res = compare({
      kpiItems,
      postgresItems,
      schema: "purpose_template",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(-1);
  });

  it("should detect no differences if all the items are equal", async () => {
    const purposeTemplate: WithMetadata<PurposeTemplate> = {
      data: getMockPurposeTemplate(),
      metadata: { version: 1 },
    };

    await addOnePurposeTemplate(purposeTemplate);

    await upsertPurposeTemplate(
      readModelDB,
      purposeTemplate.data,
      purposeTemplate.metadata.version
    );

    const kpiItems = await readModelServiceKPI.getAllPurposeTemplates();
    const postgresItems = await readModelServiceSQL.getAllPurposeTemplates();

    const res = compare({
      kpiItems,
      postgresItems,
      schema: "purpose_template",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(0);
  });

  it("should detect differences if the postgres item is not present", async () => {
    const purposeTemplate1: WithMetadata<PurposeTemplate> = {
      data: getMockPurposeTemplate(),
      metadata: { version: 1 },
    };

    const purposeTemplate2: WithMetadata<PurposeTemplate> = {
      data: getMockPurposeTemplate(),
      metadata: { version: 1 },
    };

    await addOnePurposeTemplate(purposeTemplate1);
    await addOnePurposeTemplate(purposeTemplate2);

    await upsertPurposeTemplate(
      readModelDB,
      purposeTemplate2.data,
      purposeTemplate2.metadata.version
    );

    const kpiItems = await readModelServiceKPI.getAllPurposeTemplates();
    const postgresItems = await readModelServiceSQL.getAllPurposeTemplates();

    const res = compare({
      kpiItems,
      postgresItems,
      schema: "purpose_template",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });

  it("should detect differences if the kpi item is not present", async () => {
    const purposeTemplate1: WithMetadata<PurposeTemplate> = {
      data: getMockPurposeTemplate(),
      metadata: { version: 1 },
    };

    const purposeTemplate2: WithMetadata<PurposeTemplate> = {
      data: getMockPurposeTemplate(),
      metadata: { version: 1 },
    };

    await addOnePurposeTemplate(purposeTemplate1);

    await upsertPurposeTemplate(
      readModelDB,
      purposeTemplate1.data,
      purposeTemplate1.metadata.version
    );
    await upsertPurposeTemplate(
      readModelDB,
      purposeTemplate2.data,
      purposeTemplate2.metadata.version
    );

    const kpiItems = await readModelServiceKPI.getAllPurposeTemplates();
    const postgresItems = await readModelServiceSQL.getAllPurposeTemplates();

    const res = compare({
      kpiItems,
      postgresItems,
      schema: "purpose_template",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });

  it("should detect differences if the items are different", async () => {
    const purposeTemplate1: WithMetadata<PurposeTemplate> = {
      data: getMockPurposeTemplate(),
      metadata: { version: 1 },
    };

    const purposeTemplate1InPostgresDb: WithMetadata<PurposeTemplate> = {
      data: {
        ...purposeTemplate1.data,
        purposeTitle: "Different Title",
      },
      metadata: purposeTemplate1.metadata,
    };

    await addOnePurposeTemplate(purposeTemplate1);

    await upsertPurposeTemplate(
      readModelDB,
      purposeTemplate1InPostgresDb.data,
      purposeTemplate1InPostgresDb.metadata.version
    );

    const kpiItems = await readModelServiceKPI.getAllPurposeTemplates();
    const postgresItems = await readModelServiceSQL.getAllPurposeTemplates();

    const res = compare({
      kpiItems,
      postgresItems,
      schema: "purpose_template",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });

  it("should detect differences if the items are equal but the version is different", async () => {
    const purposeTemplate1: WithMetadata<PurposeTemplate> = {
      data: getMockPurposeTemplate(),
      metadata: { version: 1 },
    };

    const purposeTemplate1InPostgresDb: WithMetadata<PurposeTemplate> = {
      data: purposeTemplate1.data,
      metadata: { version: 3 },
    };

    await addOnePurposeTemplate(purposeTemplate1);

    await upsertPurposeTemplate(
      readModelDB,
      purposeTemplate1InPostgresDb.data,
      purposeTemplate1InPostgresDb.metadata.version
    );

    const kpiItems = await readModelServiceKPI.getAllPurposeTemplates();
    const postgresItems = await readModelServiceSQL.getAllPurposeTemplates();

    const res = compare({
      kpiItems,
      postgresItems,
      schema: "purpose_template",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });
});

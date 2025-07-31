import {
  getMockDocument,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
} from "pagopa-interop-commons-test";
import { describe, expect, it } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import {
  EServiceTemplate,
  EServiceTemplateVersion,
  WithMetadata,
} from "pagopa-interop-models";
import { upsertEServiceTemplate } from "pagopa-interop-readmodel/testUtils";
import { compare } from "../src/utils.js";
import {
  addOneEServiceTemplate,
  readModelDB,
  readModelServiceKPI,
  readModelServiceSQL,
} from "./utils.js";

describe("Check e-service template read models", () => {
  it("should return -1 if the postgres schema is empty", async () => {
    const eserviceTemplate = getMockEServiceTemplate();

    await addOneEServiceTemplate({
      data: eserviceTemplate,
      metadata: { version: 1 },
    });

    const eServiceTemplates =
      await readModelServiceKPI.getAllEServiceTemplates();

    const postgresEServiceTemplates =
      await readModelServiceSQL.getAllEServiceTemplates();

    const res = compare({
      kpiItems: eServiceTemplates,
      postgresItems: postgresEServiceTemplates,
      schema: "eservice_template",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(-1);
  });

  it("should detect no differences if all the items are equal", async () => {
    const version: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      interface: getMockDocument(),
      docs: [getMockDocument()],
      publishedAt: undefined,
    };
    const eserviceTemplate: WithMetadata<EServiceTemplate> = {
      data: {
        ...getMockEServiceTemplate(),
        versions: [version],
      },
      metadata: { version: 1 },
    };

    await addOneEServiceTemplate(eserviceTemplate);

    await upsertEServiceTemplate(
      readModelDB,
      eserviceTemplate.data,
      eserviceTemplate.metadata.version
    );

    const eServiceTemplates =
      await readModelServiceKPI.getAllEServiceTemplates();

    const postgresEServiceTemplates =
      await readModelServiceSQL.getAllEServiceTemplates();

    const res = compare({
      kpiItems: eServiceTemplates,
      postgresItems: postgresEServiceTemplates,
      schema: "eservice_template",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(0);
  });

  it("should detect differences if the postgres item is not present", async () => {
    const version: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      interface: getMockDocument(),
      docs: [getMockDocument()],
      publishedAt: undefined,
    };
    const eserviceTemplate1: WithMetadata<EServiceTemplate> = {
      data: {
        ...getMockEServiceTemplate(),
        versions: [version],
      },
      metadata: { version: 1 },
    };

    const eserviceTemplate2: WithMetadata<EServiceTemplate> = {
      data: getMockEServiceTemplate(),
      metadata: { version: 1 },
    };

    await addOneEServiceTemplate(eserviceTemplate1);
    await addOneEServiceTemplate(eserviceTemplate2);

    await upsertEServiceTemplate(
      readModelDB,
      eserviceTemplate2.data,
      eserviceTemplate2.metadata.version
    );

    const eServiceTemplates =
      await readModelServiceKPI.getAllEServiceTemplates();

    const postgresEServiceTemplates =
      await readModelServiceSQL.getAllEServiceTemplates();

    const res = compare({
      kpiItems: eServiceTemplates,
      postgresItems: postgresEServiceTemplates,
      schema: "eservice_template",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });

  it("should detect differences if the kpi item is not present", async () => {
    const version: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      interface: getMockDocument(),
      docs: [getMockDocument()],
      publishedAt: undefined,
    };
    const eserviceTemplate1: WithMetadata<EServiceTemplate> = {
      data: {
        ...getMockEServiceTemplate(),
        versions: [version],
      },
      metadata: { version: 1 },
    };

    const eserviceTemplate2: WithMetadata<EServiceTemplate> = {
      data: getMockEServiceTemplate(),
      metadata: { version: 1 },
    };

    await addOneEServiceTemplate(eserviceTemplate1);

    await upsertEServiceTemplate(
      readModelDB,
      eserviceTemplate1.data,
      eserviceTemplate1.metadata.version
    );
    await upsertEServiceTemplate(
      readModelDB,
      eserviceTemplate2.data,
      eserviceTemplate2.metadata.version
    );

    const eServiceTemplates =
      await readModelServiceKPI.getAllEServiceTemplates();

    const postgresEServiceTemplates =
      await readModelServiceSQL.getAllEServiceTemplates();

    const res = compare({
      kpiItems: eServiceTemplates,
      postgresItems: postgresEServiceTemplates,
      schema: "eservice_template",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });

  it("should detect differences if the items are different", async () => {
    const version: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      interface: getMockDocument(),
      docs: [getMockDocument()],
      publishedAt: undefined,
    };
    const eserviceTemplate1: WithMetadata<EServiceTemplate> = {
      data: {
        ...getMockEServiceTemplate(),
        versions: [version],
      },
      metadata: { version: 1 },
    };

    const eserviceTemplate1InPostgresDb: WithMetadata<EServiceTemplate> = {
      data: {
        ...eserviceTemplate1.data,
        name: "different name",
      },
      metadata: eserviceTemplate1.metadata,
    };

    await addOneEServiceTemplate(eserviceTemplate1);

    await upsertEServiceTemplate(
      readModelDB,
      eserviceTemplate1InPostgresDb.data,
      eserviceTemplate1InPostgresDb.metadata.version
    );

    const eServiceTemplates =
      await readModelServiceKPI.getAllEServiceTemplates();

    const postgresEServiceTemplates =
      await readModelServiceSQL.getAllEServiceTemplates();

    const res = compare({
      kpiItems: eServiceTemplates,
      postgresItems: postgresEServiceTemplates,
      schema: "eservice_template",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });

  it("should detect differences if the items are equal but the version is different", async () => {
    const version: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      interface: getMockDocument(),
      docs: [getMockDocument()],
      publishedAt: undefined,
    };
    const eserviceTemplate1: WithMetadata<EServiceTemplate> = {
      data: {
        ...getMockEServiceTemplate(),
        versions: [version],
      },
      metadata: { version: 1 },
    };

    const eserviceTemplate1InPostgresDb: WithMetadata<EServiceTemplate> = {
      data: eserviceTemplate1.data,
      metadata: {
        version: 3,
      },
    };

    await addOneEServiceTemplate(eserviceTemplate1);

    await upsertEServiceTemplate(
      readModelDB,
      eserviceTemplate1InPostgresDb.data,
      eserviceTemplate1InPostgresDb.metadata.version
    );

    const eServiceTemplates =
      await readModelServiceKPI.getAllEServiceTemplates();

    const postgresEServiceTemplates =
      await readModelServiceSQL.getAllEServiceTemplates();

    const res = compare({
      kpiItems: eServiceTemplates,
      postgresItems: postgresEServiceTemplates,
      schema: "eservice_template",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });
});

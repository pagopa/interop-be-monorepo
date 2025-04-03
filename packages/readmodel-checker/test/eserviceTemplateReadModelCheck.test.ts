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
import { compare } from "../src/utils.js";
import {
  addOneEServiceTemplate,
  eserviceTemplateReadModelServiceSQL,
  readModelService,
  readModelServiceSQL,
} from "./utils.js";

describe("Check e-service template read models", () => {
  it("should return -1 if the postgres schema is empty", async () => {
    const eserviceTemplate = getMockEServiceTemplate();

    await addOneEServiceTemplate({
      data: eserviceTemplate,
      metadata: { version: 1 },
    });

    const collectionEServiceTemplates =
      await readModelService.getAllReadModelEServiceTemplates();

    const postgresEServiceTemplates =
      await readModelServiceSQL.getAllEServiceTemplates();

    const res = compare({
      collectionItems: collectionEServiceTemplates,
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

    await eserviceTemplateReadModelServiceSQL.upsertEServiceTemplate(
      eserviceTemplate.data,
      eserviceTemplate.metadata.version
    );

    const collectionEServiceTemplates =
      await readModelService.getAllReadModelEServiceTemplates();

    const postgresEServiceTemplates =
      await readModelServiceSQL.getAllEServiceTemplates();

    const res = compare({
      collectionItems: collectionEServiceTemplates,
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

    await eserviceTemplateReadModelServiceSQL.upsertEServiceTemplate(
      eserviceTemplate2.data,
      eserviceTemplate2.metadata.version
    );

    const collectionEServiceTemplates =
      await readModelService.getAllReadModelEServiceTemplates();

    const postgresEServiceTemplates =
      await readModelServiceSQL.getAllEServiceTemplates();

    const res = compare({
      collectionItems: collectionEServiceTemplates,
      postgresItems: postgresEServiceTemplates,
      schema: "eservice_template",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });

  it("should detect differences if the collection item is not present", async () => {
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

    await eserviceTemplateReadModelServiceSQL.upsertEServiceTemplate(
      eserviceTemplate1.data,
      eserviceTemplate1.metadata.version
    );
    await eserviceTemplateReadModelServiceSQL.upsertEServiceTemplate(
      eserviceTemplate2.data,
      eserviceTemplate2.metadata.version
    );

    const collectionEServiceTemplates =
      await readModelService.getAllReadModelEServiceTemplates();

    const postgresEServiceTemplates =
      await readModelServiceSQL.getAllEServiceTemplates();

    const res = compare({
      collectionItems: collectionEServiceTemplates,
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

    const eserviceTemplate1ForSQL: WithMetadata<EServiceTemplate> = {
      data: {
        ...eserviceTemplate1.data,
        name: "different name",
      },
      metadata: eserviceTemplate1.metadata,
    };

    await addOneEServiceTemplate(eserviceTemplate1);

    await eserviceTemplateReadModelServiceSQL.upsertEServiceTemplate(
      eserviceTemplate1ForSQL.data,
      eserviceTemplate1ForSQL.metadata.version
    );

    const collectionEServiceTemplates =
      await readModelService.getAllReadModelEServiceTemplates();

    const postgresEServiceTemplates =
      await readModelServiceSQL.getAllEServiceTemplates();

    const res = compare({
      collectionItems: collectionEServiceTemplates,
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

    const eserviceTemplate1ForSQL: WithMetadata<EServiceTemplate> = {
      data: eserviceTemplate1.data,
      metadata: {
        version: 3,
      },
    };

    await addOneEServiceTemplate(eserviceTemplate1);

    await eserviceTemplateReadModelServiceSQL.upsertEServiceTemplate(
      eserviceTemplate1ForSQL.data,
      eserviceTemplate1ForSQL.metadata.version
    );

    const collectionEServiceTemplates =
      await readModelService.getAllReadModelEServiceTemplates();

    const postgresEServiceTemplates =
      await readModelServiceSQL.getAllEServiceTemplates();

    const res = compare({
      collectionItems: collectionEServiceTemplates,
      postgresItems: postgresEServiceTemplates,
      schema: "eservice_template",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });
});

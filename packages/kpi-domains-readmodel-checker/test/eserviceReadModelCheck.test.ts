import {
  getMockDescriptor,
  getMockDocument,
  getMockEService,
} from "pagopa-interop-commons-test";
import { describe, expect, it } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import { Descriptor, EService, WithMetadata } from "pagopa-interop-models";
import { compare } from "../src/utils.js";
import {
  addOneEService,
  eserviceReadModelServiceSQL,
  readModelServiceKPI,
  readModelServiceSQL,
} from "./utils.js";

describe("Check catalog readmodels", () => {
  it("should return -1 if the postgres schema is empty", async () => {
    const eservice = getMockEService();

    await addOneEService({
      data: eservice,
      metadata: { version: 1 },
    });

    const eServices = await readModelServiceKPI.getAllEServices();

    const postgresEServices = await readModelServiceSQL.getAllEServices();

    const res = compare({
      kpiItems: eServices,
      postgresItems: postgresEServices,
      schema: "eservice",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(-1);
  });

  it("should detect no differences if all the items are equal", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      interface: getMockDocument(),
      docs: [getMockDocument()],
      publishedAt: undefined,
    };
    const eservice: WithMetadata<EService> = {
      data: {
        ...getMockEService(),
        descriptors: [descriptor],
      },
      metadata: { version: 1 },
    };

    await addOneEService(eservice);

    await eserviceReadModelServiceSQL.upsertEService(
      eservice.data,
      eservice.metadata.version
    );

    const eServices = await readModelServiceKPI.getAllEServices();

    const postgresEServices = await readModelServiceSQL.getAllEServices();

    const res = compare({
      kpiItems: eServices,
      postgresItems: postgresEServices,
      schema: "eservice",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(0);
  });

  it("should detect differences if the postgres item is not present", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      interface: getMockDocument(),
      docs: [getMockDocument()],
      publishedAt: undefined,
    };
    const eservice1: WithMetadata<EService> = {
      data: {
        ...getMockEService(),
        descriptors: [descriptor],
      },
      metadata: { version: 1 },
    };

    const eservice2: WithMetadata<EService> = {
      data: getMockEService(),
      metadata: { version: 1 },
    };

    await addOneEService(eservice1);
    await addOneEService(eservice2);

    await eserviceReadModelServiceSQL.upsertEService(
      eservice2.data,
      eservice2.metadata.version
    );

    const eServices = await readModelServiceKPI.getAllEServices();

    const postgresEServices = await readModelServiceSQL.getAllEServices();

    const res = compare({
      kpiItems: eServices,
      postgresItems: postgresEServices,
      schema: "eservice",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });

  it("should detect differences if the collection item is not present", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      interface: getMockDocument(),
      docs: [getMockDocument()],
      publishedAt: undefined,
    };
    const eservice1: WithMetadata<EService> = {
      data: {
        ...getMockEService(),
        descriptors: [descriptor],
      },
      metadata: { version: 1 },
    };

    const eservice2: WithMetadata<EService> = {
      data: getMockEService(),
      metadata: { version: 1 },
    };

    await addOneEService(eservice1);

    await eserviceReadModelServiceSQL.upsertEService(
      eservice1.data,
      eservice1.metadata.version
    );
    await eserviceReadModelServiceSQL.upsertEService(
      eservice2.data,
      eservice2.metadata.version
    );

    const eServices = await readModelServiceKPI.getAllEServices();

    const postgresEServices = await readModelServiceSQL.getAllEServices();

    const res = compare({
      kpiItems: eServices,
      postgresItems: postgresEServices,
      schema: "eservice",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });

  it("should detect differences if the items are different", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      interface: getMockDocument(),
      docs: [getMockDocument()],
      publishedAt: undefined,
    };
    const eservice1: WithMetadata<EService> = {
      data: {
        ...getMockEService(),
        descriptors: [descriptor],
      },
      metadata: { version: 1 },
    };

    const eservice1InPostgresDb: WithMetadata<EService> = {
      data: {
        ...eservice1.data,
        name: "different name",
      },
      metadata: eservice1.metadata,
    };

    await addOneEService(eservice1);

    await eserviceReadModelServiceSQL.upsertEService(
      eservice1InPostgresDb.data,
      eservice1InPostgresDb.metadata.version
    );

    const eServices = await readModelServiceKPI.getAllEServices();

    const postgresEServices = await readModelServiceSQL.getAllEServices();

    const res = compare({
      kpiItems: eServices,
      postgresItems: postgresEServices,
      schema: "eservice",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });

  it("should detect differences if the items are equal but the version is different", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      interface: getMockDocument(),
      docs: [getMockDocument()],
      publishedAt: undefined,
    };
    const eservice1: WithMetadata<EService> = {
      data: {
        ...getMockEService(),
        descriptors: [descriptor],
      },
      metadata: { version: 1 },
    };

    const eservice1InPostgresDb: WithMetadata<EService> = {
      data: eservice1.data,
      metadata: {
        version: 3,
      },
    };

    await addOneEService(eservice1);

    await eserviceReadModelServiceSQL.upsertEService(
      eservice1InPostgresDb.data,
      eservice1InPostgresDb.metadata.version
    );

    const eServices = await readModelServiceKPI.getAllEServices();

    const postgresEServices = await readModelServiceSQL.getAllEServices();

    const res = compare({
      kpiItems: eServices,
      postgresItems: postgresEServices,
      schema: "eservice",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });
});

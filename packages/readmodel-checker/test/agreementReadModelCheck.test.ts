import { getMockAgreement } from "pagopa-interop-commons-test";
import { describe, expect, it } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import { Agreement, WithMetadata, generateId } from "pagopa-interop-models";
import { compare } from "../src/utils.js";
import {
  addOneAgreement,
  agreementReadModelServiceSQL,
  readModelService,
  readModelServiceSQL,
} from "./utils.js";

describe("Check agreement readmodels", () => {
  it("should return -1 if the postgres schema is empty", async () => {
    const agreement = getMockAgreement();

    await addOneAgreement({
      data: agreement,
      metadata: { version: 1 },
    });

    const collectionAgreements =
      await readModelService.getAllReadModelAgreements();

    const postgresAgreements = await readModelServiceSQL.getAllAgreements();

    const res = compare({
      collectionItems: collectionAgreements,
      postgresItems: postgresAgreements,
      schema: "agreement",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(-1);
  });

  it("should detect no differences if all the items are equal", async () => {
    const agreement: WithMetadata<Agreement> = {
      data: getMockAgreement(),
      metadata: { version: 1 },
    };

    await addOneAgreement(agreement);

    await agreementReadModelServiceSQL.upsertAgreement(
      agreement.data,
      agreement.metadata.version
    );

    const collectionAgreements =
      await readModelService.getAllReadModelAgreements();

    const postgresAgreements = await readModelServiceSQL.getAllAgreements();

    const res = compare({
      collectionItems: collectionAgreements,
      postgresItems: postgresAgreements,
      schema: "agreement",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(0);
  });

  it("should detect differences if the postgres item is not present", async () => {
    const agreement1: WithMetadata<Agreement> = {
      data: getMockAgreement(),
      metadata: { version: 1 },
    };

    const agreement2: WithMetadata<Agreement> = {
      data: getMockAgreement(),
      metadata: { version: 1 },
    };

    await addOneAgreement(agreement1);
    await addOneAgreement(agreement2);

    await agreementReadModelServiceSQL.upsertAgreement(
      agreement2.data,
      agreement2.metadata.version
    );

    const collectionAgreements =
      await readModelService.getAllReadModelAgreements();

    const postgresAgreements = await readModelServiceSQL.getAllAgreements();

    const res = compare({
      collectionItems: collectionAgreements,
      postgresItems: postgresAgreements,
      schema: "agreement",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });

  it("should detect differences if the collection item is not present", async () => {
    const agreement1: WithMetadata<Agreement> = {
      data: getMockAgreement(),
      metadata: { version: 1 },
    };

    const agreement2: WithMetadata<Agreement> = {
      data: getMockAgreement(),
      metadata: { version: 1 },
    };

    await addOneAgreement(agreement1);

    await agreementReadModelServiceSQL.upsertAgreement(
      agreement1.data,
      agreement1.metadata.version
    );
    await agreementReadModelServiceSQL.upsertAgreement(
      agreement2.data,
      agreement2.metadata.version
    );

    const collectionAgreements =
      await readModelService.getAllReadModelAgreements();

    const postgresAgreements = await readModelServiceSQL.getAllAgreements();

    const res = compare({
      collectionItems: collectionAgreements,
      postgresItems: postgresAgreements,
      schema: "agreement",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });

  it("should detect differences if the items are different", async () => {
    const agreement1: WithMetadata<Agreement> = {
      data: getMockAgreement(),
      metadata: { version: 1 },
    };

    const agreement1ForSQL: WithMetadata<Agreement> = {
      data: {
        ...agreement1.data,
        descriptorId: generateId(),
      },
      metadata: agreement1.metadata,
    };

    await addOneAgreement(agreement1);

    await agreementReadModelServiceSQL.upsertAgreement(
      agreement1ForSQL.data,
      agreement1ForSQL.metadata.version
    );

    const collectionAgreements =
      await readModelService.getAllReadModelAgreements();

    const postgresAgreements = await readModelServiceSQL.getAllAgreements();

    const res = compare({
      collectionItems: collectionAgreements,
      postgresItems: postgresAgreements,
      schema: "agreement",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });

  it("should detect differences if the items are equal but the version is different", async () => {
    const agreement1: WithMetadata<Agreement> = {
      data: getMockAgreement(),
      metadata: { version: 1 },
    };

    const agreement1ForSQL: WithMetadata<Agreement> = {
      data: agreement1.data,
      metadata: {
        version: 3,
      },
    };

    await addOneAgreement(agreement1);

    await agreementReadModelServiceSQL.upsertAgreement(
      agreement1ForSQL.data,
      agreement1ForSQL.metadata.version
    );

    const collectionAgreements =
      await readModelService.getAllReadModelAgreements();

    const postgresAgreements = await readModelServiceSQL.getAllAgreements();

    const res = compare({
      collectionItems: collectionAgreements,
      postgresItems: postgresAgreements,
      schema: "agreement",
      loggerInstance: genericLogger,
    });

    expect(res).toEqual(1);
  });
});

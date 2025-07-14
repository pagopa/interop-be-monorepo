import {
  ClientId,
  DescriptorId,
  EServiceId,
  generateId,
  makeGSIPKEServiceIdDescriptorId,
  makePlatformStatesEServiceDescriptorPK,
  makeTokenGenerationStatesClientKidPK,
  makeTokenGenerationStatesClientKidPurposePK,
  PurposeId,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

describe("keys test", () => {
  it("makePlatformStatesEServiceDescriptorPK", () => {
    const eserviceId = generateId<EServiceId>();
    const descriptorId = generateId<DescriptorId>();
    const PK = makePlatformStatesEServiceDescriptorPK({
      eserviceId,
      descriptorId,
    });
    expect(PK).toEqual(`ESERVICEDESCRIPTOR#${eserviceId}#${descriptorId}`);
  });

  it("makeGSIPKEServiceIdDescriptorId", () => {
    const eserviceId = generateId<EServiceId>();
    const descriptorId = generateId<DescriptorId>();
    const GSI = makeGSIPKEServiceIdDescriptorId({
      eserviceId,
      descriptorId,
    });
    expect(GSI).toEqual(`${eserviceId}#${descriptorId}`);
  });

  it("makeTokenGenerationStatesClientKidPurposePK", () => {
    const clientId = generateId<ClientId>();
    const kid = `kid ${Math.random()}`;
    const purposeId = generateId<PurposeId>();
    const PK = makeTokenGenerationStatesClientKidPurposePK({
      clientId,
      kid,
      purposeId,
    });
    expect(PK).toEqual(`CLIENTKIDPURPOSE#${clientId}#${kid}#${purposeId}`);
  });

  it("makeTokenGenerationStatesClientKidPK", () => {
    const clientId = generateId<ClientId>();
    const kid = `kid ${Math.random()}`;
    const PK = makeTokenGenerationStatesClientKidPK({
      clientId,
      kid,
    });
    expect(PK).toEqual(`CLIENTKID#${clientId}#${kid}`);
  });
});

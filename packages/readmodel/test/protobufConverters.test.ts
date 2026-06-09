import {
  getMockAgreement,
  getMockAgreementAttribute,
  getMockAttribute,
  getMockCertifiedDiscreteTenantAttribute,
  getMockDescriptor,
  getMockEService,
  getMockEServiceAttribute,
  getMockEServiceAttributeCertifiedDiscrete,
  getMockEServiceTemplate,
  getMockEServiceTemplateAttribute,
  getMockEServiceTemplateAttributeCertifiedDiscrete,
  getMockEServiceTemplateVersion,
  getMockTenant,
  getMockTenantRemoteId,
  toAgreementV1,
} from "pagopa-interop-commons-test";
import {
  AgreementV1,
  AgreementV2,
  AttributeV1,
  EServiceTemplateV2,
  EServiceV2,
  TenantV2,
  attributeKind,
  fromAgreementV1,
  fromAgreementV2,
  fromAttributeV1,
  fromEServiceTemplateV2,
  fromEServiceV2,
  fromTenantV2,
  toAgreementV2,
  toAttributeV1,
  toEServiceTemplateV2,
  toEServiceV2,
  toTenantV2,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

describe("Protobuf converters", () => {
  it("should drop certified discrete agreement attributes when round-tripping through V1 protobuf (V1 is legacy and does not carry the field)", () => {
    const certifiedDiscreteAttribute = getMockAgreementAttribute();
    const agreement = {
      ...getMockAgreement(),
      certifiedDiscreteAttributes: [certifiedDiscreteAttribute],
      signedContract: undefined,
    };

    const protobuf = AgreementV1.fromBinary(
      AgreementV1.toBinary(toAgreementV1(agreement))
    );

    expect(fromAgreementV1(protobuf).certifiedDiscreteAttributes).toStrictEqual(
      []
    );
  });

  it("should preserve certified discrete agreement attributes through V2 protobuf", () => {
    const certifiedDiscreteAttribute = getMockAgreementAttribute();
    const agreement = {
      ...getMockAgreement(),
      certifiedDiscreteAttributes: [certifiedDiscreteAttribute],
    };

    const protobuf = AgreementV2.fromBinary(
      AgreementV2.toBinary(toAgreementV2(agreement))
    );

    expect(fromAgreementV2(protobuf).certifiedDiscreteAttributes).toStrictEqual(
      [certifiedDiscreteAttribute]
    );
  });

  it("should preserve certified discrete attribute kind through V1 protobuf", () => {
    const attribute = getMockAttribute(attributeKind.certifiedDiscrete);

    const protobuf = AttributeV1.fromBinary(
      AttributeV1.toBinary(toAttributeV1(attribute))
    );

    expect(fromAttributeV1(protobuf)).toStrictEqual(attribute);
  });

  it("should preserve certified discrete e-service descriptor attributes through V2 protobuf", () => {
    const certifiedAttribute = getMockEServiceAttribute();
    const certifiedDiscreteAttribute =
      getMockEServiceAttributeCertifiedDiscrete();
    const descriptor = {
      ...getMockDescriptor(),
      attributes: {
        certified: [[certifiedAttribute, certifiedDiscreteAttribute]],
        declared: [],
        verified: [],
      },
    };
    const eservice = getMockEService(undefined, undefined, [descriptor]);

    const protobuf = EServiceV2.fromBinary(
      EServiceV2.toBinary(toEServiceV2(eservice))
    );

    expect(
      fromEServiceV2(protobuf).descriptors[0].attributes.certified
    ).toStrictEqual([
      [
        { ...certifiedAttribute, dailyCallsPerConsumer: undefined },
        {
          ...certifiedDiscreteAttribute,
          dailyCallsPerConsumer: undefined,
        },
      ],
    ]);
  });

  it("should preserve certified discrete e-service template attributes through V2 protobuf", () => {
    const certifiedAttribute = getMockEServiceTemplateAttribute();
    const certifiedDiscreteAttribute =
      getMockEServiceTemplateAttributeCertifiedDiscrete();
    const version = {
      ...getMockEServiceTemplateVersion(),
      attributes: {
        certified: [[certifiedAttribute, certifiedDiscreteAttribute]],
        declared: [],
        verified: [],
      },
    };
    const eserviceTemplate = getMockEServiceTemplate(undefined, undefined, [
      version,
    ]);

    const protobuf = EServiceTemplateV2.fromBinary(
      EServiceTemplateV2.toBinary(toEServiceTemplateV2(eserviceTemplate))
    );

    expect(
      fromEServiceTemplateV2(protobuf).versions[0].attributes.certified
    ).toStrictEqual([[certifiedAttribute, certifiedDiscreteAttribute]]);
  });

  it("should preserve certified discrete tenant attributes and remote ids through V2 protobuf", () => {
    const certifiedDiscreteAttribute = {
      ...getMockCertifiedDiscreteTenantAttribute(),
      revocationTimestamp: new Date(),
      discreteValue: 1234,
    };
    const remoteId = getMockTenantRemoteId();
    const tenant = {
      ...getMockTenant(undefined, [certifiedDiscreteAttribute]),
      remoteIds: [remoteId],
    };

    const protobuf = TenantV2.fromBinary(TenantV2.toBinary(toTenantV2(tenant)));
    const actualTenant = fromTenantV2(protobuf);

    expect(actualTenant.attributes).toStrictEqual([certifiedDiscreteAttribute]);
    expect(actualTenant.remoteIds).toStrictEqual([remoteId]);
  });
});

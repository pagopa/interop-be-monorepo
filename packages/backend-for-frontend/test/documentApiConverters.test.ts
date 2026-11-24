import { generateMock } from "@anatine/zod-mock";
import { delegationApi, purposeApi } from "pagopa-interop-api-clients";
import {
  getMockedApiPurposeVersion,
  getMockedApiTenant,
} from "pagopa-interop-commons-test";
import { describe, expect, it } from "vitest";

import { toBffDelegationApiDelegation } from "../src/api/delegationApiConverter.js";
import { toBffApiPurposeVersion } from "../src/api/purposeApiConverter.js";
import { getMockDelegationApiDelegation } from "./mockUtils.js";

describe("BFF document metadata", () => {
  it("only exposes signed document metadata for a purpose version", () => {
    const version = getMockedApiPurposeVersion({
      riskAnalysis: generateMock(purposeApi.PurposeVersionDocument),
    });
    const signedContract = generateMock(
      purposeApi.PurposeVersionSignedDocument
    );

    const result = toBffApiPurposeVersion({ ...version, signedContract });

    expect(result).not.toHaveProperty("riskAnalysisDocument");
    expect(result.signedContract).toMatchObject({ id: signedContract.id });
  });

  it("only exposes signed activation and revocation documents for a delegation", () => {
    const activationSignedContract = generateMock(
      delegationApi.DelegationSignedContractDocument
    );
    const revocationSignedContract = generateMock(
      delegationApi.DelegationSignedContractDocument
    );
    const delegation = {
      ...getMockDelegationApiDelegation(),
      state: delegationApi.DelegationState.Values.REVOKED,
      activationContract: generateMock(
        delegationApi.DelegationContractDocument
      ),
      revocationContract: generateMock(
        delegationApi.DelegationContractDocument
      ),
      activationSignedContract,
      revocationSignedContract,
    };
    const tenant = getMockedApiTenant({ attributes: [] });

    const result = toBffDelegationApiDelegation(
      delegation,
      tenant,
      tenant,
      undefined,
      undefined,
      tenant
    );

    expect(result).not.toHaveProperty("activationContract");
    expect(result).not.toHaveProperty("revocationContract");
    expect(result).toMatchObject({
      activationSignedContract: { id: activationSignedContract.id },
      revocationSignedContract: { id: revocationSignedContract.id },
      isDocumentReady: true,
    });
  });
});

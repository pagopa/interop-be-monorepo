import { describe, expect, it } from "vitest";
import { selfcareV2ClientApi } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import { toApiSelfcareInstitution } from "../src/api/selfcareApiConverter.js";
import { selfcareEntityNotFilled } from "../src/model/errors.js";

describe("toApiSelfcareInstitution", () => {
  const validInstitution: selfcareV2ClientApi.UserInstitutionResource = {
    userId: generateId(),
    institutionId: generateId(),
    institutionDescription: "Valid institution",
    products: [{ productRole: "ADMIN" }],
  };

  const institutionWithoutId = { ...validInstitution };
  delete institutionWithoutId.institutionId;

  const institutionWithoutDescription = { ...validInstitution };
  delete institutionWithoutDescription.institutionDescription;

  const institutionWithoutProducts = { ...validInstitution };
  delete institutionWithoutProducts.products;

  it.each([
    {
      field: "institutionId",
      institution: institutionWithoutId,
    },
    {
      field: "institutionDescription",
      institution: institutionWithoutDescription,
    },
    {
      field: "products",
      institution: institutionWithoutProducts,
    },
  ])(
    "should throw an explicit error when $field is omitted",
    ({ field, institution }) => {
      expect(() => toApiSelfcareInstitution(institution)).toThrowError(
        selfcareEntityNotFilled("UserInstitutionResource", field)
      );
    }
  );
});

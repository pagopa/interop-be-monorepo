/* eslint-disable functional/no-let */
import { expect, describe, it } from "vitest";
import { DelegationId, generateId } from "pagopa-interop-models";
import { getMockDelegationProducer } from "pagopa-interop-commons-test/index.js";
import request from "supertest";
import app from "../src/app.js";
import { delegationToApiDelegation } from "../src/model/domain/apiConverter.js";
import { addOneDelegation } from "./utils.js";

// TODO move to common test utils
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function buildRequest(method: "get" | "post", path: string) {
  return request(app)
    [method](path)
    .set("X-Correlation-Id", "9999")
    .set("Authorization", `${process.env.VITE_JWT}`);
}

describe("get delegation by id", () => {
  it("should get the delegation if it exists", async () => {
    const delegation = getMockDelegationProducer();

    await addOneDelegation(delegation);

    const actualDelegation = await buildRequest(
      "get",
      `/producer/delegations/${delegation.id}`
    ).expect(200);

    expect(actualDelegation.body).toEqual(
      delegationToApiDelegation(delegation)
    );
  });

  it("should fail with delegationNotFound", async () => {
    const delegation = getMockDelegationProducer();

    await addOneDelegation(delegation);

    const notFoundId = generateId<DelegationId>();
    await buildRequest("get", `/producer/delegations/${notFoundId}`).expect(
      404,
      {
        detail: `Delegation ${notFoundId} not found`,
        errors: [
          {
            code: "0001",
            detail: `Delegation ${notFoundId} not found`,
          },
        ],
        status: 404,
        title: "Delegation not found",
        type: "about:blank",
      }
    );
  });
});

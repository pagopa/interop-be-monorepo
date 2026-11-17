import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { appBasePath } from "../../src/config/appBasePath.js";
import { api, clients } from "../vitest.api.setup.js";

describe("errorsToApiProblemsMiddleware", () => {
  beforeEach(() => {
    clients.purposeTemplateProcessClient.unsuspendPurposeTemplate = vi
      .fn()
      .mockResolvedValue(undefined);
    clients.purposeTemplateProcessClient.publishPurposeTemplate = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    path: string,
    headers: Record<string, string>,
    body: string | Buffer
  ): Promise<request.Response> =>
    request(api)
      .post(`${appBasePath}${path}`)
      .set("Authorization", `Bearer ${generateToken(authRole.ADMIN_ROLE)}`)
      .set("X-Correlation-Id", generateId())
      .set(headers)
      .send(body);

  it.each(["unsuspend", "publish"])(
    "Should return 400 for POST /purposeTemplates/{purposeTemplateId}/%s with an empty multipart body",
    async (action) => {
      const res = await makeRequest(
        `/purposeTemplates/00000000-0000-0000-0000-000000000000/${action}`,
        { "Content-Type": "multipart/form-data; boundary=xyz" },
        ""
      );

      expect(res.status).toBe(400);
      expect(res.body.title).toBe("Bad request");
    }
  );

  it.each<{
    name: string;
    headers: Record<string, string>;
    body: string | Buffer;
  }>([
    {
      name: "a truncated multipart part",
      headers: { "Content-Type": "multipart/form-data; boundary=xyz" },
      body: '--xyz\r\nContent-Disposition: form-data; name="a"\r\n\r\nvalue',
    },
    {
      name: "a malformed multipart part header",
      headers: { "Content-Type": "multipart/form-data; boundary=xyz" },
      body: "--xyz\r\nmalformed header\r\n\r\nvalue\r\n--xyz--\r\n",
    },
    {
      name: "a multipart Content-Type without boundary",
      headers: { "Content-Type": "multipart/form-data" },
      body: "value",
    },
    {
      name: "an invalid JSON body",
      headers: { "Content-Type": "application/json" },
      body: "{",
    },
    {
      name: "an invalid gzip JSON body",
      headers: {
        "Content-Type": "application/json",
        "Content-Encoding": "gzip",
      },
      body: Buffer.from("not gzip"),
    },
  ])("Should return 400 for $name", async ({ headers, body }) => {
    const res = await makeRequest(
      `/purposeTemplates/${generateId()}/unsuspend`,
      headers,
      body
    );

    expect(res.status).toBe(400);
    expect(res.body.title).toBe("Bad request");
  });

  it.each([
    {
      name: "a JSON body over the size limit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: "x".repeat(200 * 1024) }),
    },
    {
      name: "an urlencoded body with too many parameters",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: Array.from({ length: 1500 }, (_, i) => `p${i}=1`).join("&"),
    },
  ])("Should return 413 for $name", async ({ headers, body }) => {
    const res = await makeRequest(
      `/purposeTemplates/${generateId()}/unsuspend`,
      headers,
      body
    );

    expect(res.status).toBe(413);
    expect(res.body.title).toBe("Content too large");
  });

  it.each<{ name: string; headers: Record<string, string> }>([
    {
      name: "an unsupported JSON charset",
      headers: { "Content-Type": "application/json; charset=foo" },
    },
    {
      name: "an unsupported urlencoded charset",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=foo",
      },
    },
    {
      name: "an unsupported Content-Encoding",
      headers: {
        "Content-Type": "application/json",
        "Content-Encoding": "foo",
      },
    },
  ])("Should return 415 for $name", async ({ headers }) => {
    const res = await makeRequest(
      `/purposeTemplates/${generateId()}/unsuspend`,
      headers,
      "{}"
    );

    expect(res.status).toBe(415);
    expect(res.body.title).toBe("Unsupported media type");
  });
});

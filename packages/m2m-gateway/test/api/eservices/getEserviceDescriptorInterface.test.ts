import { describe, it, expect, vi } from "vitest";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { generateId } from "pagopa-interop-models";
import { api, mockEserviceService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  eserviceDescriptorInterfaceNotFound,
  eserviceDescriptorNotFound,
} from "../../../src/model/errors.js";
import { getMockFile } from "../../mockUtils.js";

describe("GET /eservice/:eserviceId/descriptors/:descriptorId/interface router test", () => {
  const mockFileName = "mockFileName.txt";
  const mockContentType = "text/plain";
  const mockFileContent = `This is a mock file content for testing purposes.
It simulates the content of an Eservice descriptor interface file.
On multiple lines.`;

  const mockFile = getMockFile({
    mockFileName,
    mockContentType,
    mockFileContent,
  });

  const makeRequest = async (
    token: string,
    eserviceId: string,
    descriptorId: string
  ) =>
    request(api)
      .get(
        `${appBasePath}/eservices/${eserviceId}/descriptors/${descriptorId}/interface`
      )
      .set("Authorization", `Bearer ${token}`)
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.once("end", function () {
          const buf = Buffer.concat(chunks);
          res.text = buf.toString("utf8");
          done(null, res);
        });
        res.once("error", done);
      });

  const authorizedRoles: AuthRole[] = [
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockEserviceService.getEServiceDescriptorInterface = vi
        .fn()
        .mockResolvedValue(mockFile);

      const token = generateToken(role);
      const res = await makeRequest(token, generateId(), generateId());

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(
        /^multipart\/form-data;\s*boundary=form-data-encoder-[A-Za-z0-9]+/
      );
      const boundary = res.headers["content-type"].match(/boundary=(.*)$/)![1];

      const CRLF = "\r\n";
      const expectedMultipart = [
        `--${boundary}`,
        `Content-Disposition: form-data; name="file"; filename="${mockFileName}"`,
        `Content-Type: ${mockContentType}`,
        ``,
        mockFileContent,
        `--${boundary}`,
        `Content-Disposition: form-data; name="filename"`,
        ``,
        mockFileName,
        `--${boundary}`,
        `Content-Disposition: form-data; name="contentType"`,
        ``,
        mockContentType,
        `--${boundary}--`,
        CRLF,
      ].join(CRLF);

      expect(res.text).toEqual(expectedMultipart);
      expect(res.headers["content-length"]).toBe(
        Buffer.byteLength(expectedMultipart, "utf8").toString()
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, generateId(), generateId());
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed an invalid eservice id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, "invalidId", generateId());

    expect(res.status).toBe(400);
  });

  it("Should return 400 if passed an invalid descriptor id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, generateId(), "invalidId");

    expect(res.status).toBe(400);
  });

  it.each([
    eserviceDescriptorNotFound(generateId(), generateId()),
    eserviceDescriptorInterfaceNotFound(generateId(), generateId()),
  ])("Should return 404 in case of $code error", async (error) => {
    mockEserviceService.getEServiceDescriptorInterface = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, generateId(), generateId());

    expect(res.status).toBe(404);
  });
});

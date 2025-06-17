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

describe("GET /eservice/:eserviceId/descriptors/:descriptorId/interface router test", () => {
  const mockM2MEserviceDescriptorInterfaceResponse = {
    file: Buffer.from(`This is a mock file content for testing purposes.
It simulates the content of an Eservice descriptor interface file.
On multiple lines.
`),
    filename: "mockFileName.txt",
    contentType: "text/plain",
  };

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
      .parse((res, cb) => {
        let data = Buffer.from("");
        res.on("data", function (chunk) {
          data = Buffer.concat([data, chunk]);
        });
        res.on("end", function () {
          res.text = data.toString();
          cb(null, res);
        });
        res.on("error", function (err) {
          cb(err, null);
        });
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
        .mockResolvedValue(mockM2MEserviceDescriptorInterfaceResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, generateId(), generateId());

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(
        /multipart\/form-data; boundary=form-data-encoder-*/
      );
      const boundary = res.headers["content-type"].match(/boundary=(.*)$/)![1];

      const expectedText =
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="${mockM2MEserviceDescriptorInterfaceResponse.filename}"\r\n` +
        `Content-Type: ${mockM2MEserviceDescriptorInterfaceResponse.contentType}\r\n` +
        `\r\n` +
        `${mockM2MEserviceDescriptorInterfaceResponse.file.toString()}\r\n` +
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="filename"\r\n` +
        `\r\n` +
        `${mockM2MEserviceDescriptorInterfaceResponse.filename}\r\n` +
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="contentType"\r\n` +
        `\r\n` +
        `${mockM2MEserviceDescriptorInterfaceResponse.contentType}\r\n` +
        `--${boundary}--\r\n` +
        `\r\n`;

      expect(res.body.text).toEqual(expectedText);
      expect(res.headers["content-length"]).toBe(
        expectedText.length.toString()
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

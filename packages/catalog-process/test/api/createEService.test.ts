import { describe, it, vi } from "vitest";
import request from "supertest";
import {
  getMockEService,
  randomArrayItem,
} from "pagopa-interop-commons-test/index.js";
import { match } from "ts-pattern";
import { api } from "../vitestAPISetup.js";
import { catalogService } from "../../src/routers/EServiceRouter.js";
import {
  buildDescriptorSeedForEserviceCreation,
  getMockDescriptor,
} from "../mockUtils.js";

describe("api create eservice", () => {
  const mockEService = getMockEService();

  vi.spyOn(catalogService, "createEService").mockImplementation(() =>
    Promise.resolve(mockEService)
  );

  it("should write on event-store for the creation of an eservice", async () => {
    const mockDescriptor = getMockDescriptor();
    const isSignalHubEnabled = randomArrayItem([false, true, undefined]);
    const isConsumerDelegable = randomArrayItem([false, true, undefined]);
    const isClientAccessDelegable = match(isConsumerDelegable)
      .with(undefined, () => undefined)
      .with(true, () => randomArrayItem([false, true, undefined]))
      .with(false, () => false)
      .exhaustive();

    await request(api)
      .post("/eservices")
      .set(
        "Authorization",
        "Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6ImF0K2p3dCIsImtpZCI6ImZjZDFiYWI5LWFlNGQtNDljZS05MjUyLTI2MmRiODY2ZTMyNyIsInVzZSI6InNpZyJ9.eyJleHRlcm5hbElkIjp7Im9yaWdpbiI6IklQQSIsInZhbHVlIjoiNU4yVFI1NTcifSwidXNlci1yb2xlcyI6ImFkbWluIiwic2VsZmNhcmVJZCI6IjE5NjJkMjFjLWM3MDEtNDgwNS05M2Y2LTUzYTg3Nzg5ODc1NiIsIm9yZ2FuaXphdGlvbklkIjoiNjllMjg2NWUtNjVhYi00ZTQ4LWE2MzgtMjAzN2E5ZWUyZWU3Iiwib3JnYW5pemF0aW9uIjp7ImlkIjoiMTk2MmQyMWMtYzcwMS00ODA1LTkzZjYtNTNhODc3ODk4NzU2IiwibmFtZSI6IlBhZ29QQSBTLnAuQS4iLCJyb2xlcyI6W3sicGFydHlSb2xlIjoiTUFOQUdFUiIsInJvbGUiOiJhZG1pbiJ9XSwiZmlzY2FsX2NvZGUiOiIxNTM3NjM3MTAwOSIsImlwYUNvZGUiOiI1TjJUUjU1NyJ9LCJ1aWQiOiJmMDdkZGI4Zi0xN2Y5LTQ3ZDQtYjMxZS0zNWQxYWMxMGU1MjEiLCJuYW1lIjoiTWFyaW8iLCJmYW1pbHlfbmFtZSI6IlJvc3NpIiwiZW1haWwiOiJtLnJvc3NpQHBzcC5pdCIsImlzcyI6InJlZmFjdG9yLmRldi5pbnRlcm9wLnBhZ29wYS5pdCIsImF1ZCI6InJlZmFjdG9yLmRldi5pbnRlcm9wLnBhZ29wYS5pdC91aSIsIm5iZiI6MTcyNjc1NTY2OSwiaWF0IjoxNzI2NzU1NjY5LCJleHAiOjEwMDE3MjY3NTU2NjgsImp0aSI6ImU1NGQ0MzkyLTNiMTEtNDg1My05MGI2LTQ0MzE0MWFjMTg1OSJ9.N7kNSu3EnLzhObcU10Z4rRimYIMPe02XtwmLlMJxAHa_cesInPlx0ZTXR5MJ2kv4oCwSmMQX26JjqgGG1lNUOccPfiICGRitn1OYGvSiF_NdLT41Bz7-rl4JXtyU-B2HnVlJaWi7NzJGWjpwnpMrlWNSJ5Cfmh9cjVge230TViWYFvv7VZA27dyqDdRZaM1RzRaqlaM9MH-l6HRh50gJgpyCDf50qWJAQ-0PkXPZsQ5yCXm_GbTwxuXpEVw5EodoPCGdpKWUlXgWu5EwTbUYDMeSTU6rzUbSnHlDry7T9PWV3VP77dNqU0Kit35KIU3Izfz507lt0Lr2mexOfP1a6w"
      )
      .set("X-Correlation-Id", "79eb4963-3866-422f-8ef0-87871e5f9a71")
      .send({
        name: mockEService.name,
        description: mockEService.description,
        technology: "REST",
        mode: "DELIVER",
        descriptor: buildDescriptorSeedForEserviceCreation(mockDescriptor),
        isSignalHubEnabled,
        isConsumerDelegable,
        isClientAccessDelegable,
      })
      .expect(200);
  });
});

import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { mockClient } from "aws-sdk-client-mock";
import { describe, it, expect, beforeEach } from "vitest";
import { initSesMailManager } from "pagopa-interop-commons";

const sesMock = mockClient(SESv2Client);

describe("initSesMailManager", () => {
  beforeEach(() => {
    sesMock.reset();
  });

  it("should send an email with correct parameters", async () => {
    // Setup the mock to return a successful response
    sesMock.on(SendEmailCommand).resolves({});

    const awsConfig = { awsRegion: "us-east-1" };
    const emailManager = initSesMailManager(awsConfig);

    const from = "test@example.com";
    const to = ["recipient@example.com"];
    const subject = "Test Subject";
    const body = "<h1>Hello World</h1>";

    await emailManager.send(from, to, subject, body);

    expect(sesMock.calls()).toHaveLength(1);

    const call = sesMock.calls()[0].args[0].input;
    expect(call).toEqual({
      Destination: {
        ToAddresses: to,
      },
      Content: {
        Simple: {
          Subject: {
            Data: subject,
          },
          Body: {
            Html: {
              Data: body,
            },
          },
        },
      },
      FromEmailAddress: from,
    });
  });
});

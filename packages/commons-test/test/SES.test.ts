/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  SESv2Client,
  SendEmailCommand,
  SendEmailCommandInput,
  TooManyRequestsException,
} from "@aws-sdk/client-sesv2";
import { mockClient } from "aws-sdk-client-mock";
import { describe, it, expect, beforeEach } from "vitest";
import {
  AWSSesConfig,
  initSesMailManager,
  logger,
} from "pagopa-interop-commons";

const sesMock = mockClient(SESv2Client);

describe("initSesMailManager", () => {
  beforeEach(() => {
    sesMock.reset();
  });

  it("should send an email with correct parameters", async () => {
    // Setup the mock to return a successful response
    sesMock.on(SendEmailCommand).resolves({});

    const awsSesConfig: AWSSesConfig = {
      awsRegion: "eu-south-1",
      awsSesEndpoint: undefined,
    };
    const emailManager = initSesMailManager(awsSesConfig);
    const loggerInstance = logger({});

    const from = "test@example.com";
    const to = ["recipient@example.com"];
    const subject = "Test Subject";
    const html = "<h1>Hello World</h1>";

    await emailManager.send({ from, to, subject, html }, loggerInstance);

    expect(sesMock.calls()).toHaveLength(1);

    const commandInput = sesMock.calls()[0].args[0]
      .input as SendEmailCommandInput;

    const rawData = commandInput.Content!.Raw!.Data;

    const emailString = Buffer.from(rawData!).toString();
    expect(emailString).toContain(`From: ${from}`);
    expect(emailString).toContain(`To: ${to[0]}`);
    expect(emailString).toContain(`Subject: ${subject}`);
    expect(emailString).toContain(html);
  });

  it("send an email throw generic exception", async () => {
    // Setup the mock to throws generic exception
    const expectedGenericError = new Error("Generic error");
    sesMock.on(SendEmailCommand).rejects(expectedGenericError);

    const awsSesConfig: AWSSesConfig = {
      awsRegion: "eu-south-1",
      awsSesEndpoint: undefined,
    };
    const emailManager = initSesMailManager(awsSesConfig);
    const loggerInstance = logger({});

    const from = "test@example.com";
    const to = ["recipient@example.com"];
    const subject = "Test Subject";
    const html = "<h1>Hello World</h1>";

    await expect(
      emailManager.send({ from, to, subject, html }, loggerInstance)
    ).rejects.toThrowError(expectedGenericError);

    expect(sesMock.calls()).toHaveLength(1);
  });

  it("should send an email if AWS SES response throws TooManyRequestsException", async () => {
    // Setup the mock to throws TooManyRequestsException
    sesMock.on(SendEmailCommand).resolves(
      new TooManyRequestsException({
        message: "Rate limit exceeded",
        $metadata: {
          httpStatusCode: 429,
          requestId: "request-id",
          extendedRequestId: "extended-request-id",
          cfId: "cf-id",
          attempts: 1,
          totalRetryDelay: 0,
        },
      })
    );

    const awsSesConfig: AWSSesConfig = {
      awsRegion: "eu-south-1",
      awsSesEndpoint: undefined,
    };
    const emailManager = initSesMailManager(awsSesConfig);
    const loggerInstance = logger({});

    const from = "test@example.com";
    const to = ["recipient@example.com"];
    const subject = "Test Subject";
    const html = "<h1>Hello World</h1>";

    await emailManager.send({ from, to, subject, html }, loggerInstance);

    expect(sesMock.calls()).toHaveLength(1);

    const commandInput = sesMock.calls()[0].args[0]
      .input as SendEmailCommandInput;

    const rawData = commandInput.Content!.Raw!.Data;

    const emailString = Buffer.from(rawData!).toString();
    expect(emailString).toContain(`From: ${from}`);
    expect(emailString).toContain(`To: ${to[0]}`);
    expect(emailString).toContain(`Subject: ${subject}`);
    expect(emailString).toContain(html);
  });
});

import sftp from "ssh2-sftp-client";
import { describe, expect, it } from "vitest";
import { SftpClient } from "../src/service/sftpService.js";
import { sftpConfigTest } from "./helpers.js";

describe("CSV getFileName", () => {
  const getMockFileInfo = (name?: string): sftp.FileInfo => ({
    type: "-",
    name: name || "",
    size: 0,
    modifyTime: 0,
    accessTime: 0,
    rights: {
      user: "user",
      group: "group",
      other: "other",
    },
    owner: 0,
    group: 0,
  });

  it("should retrieve last file (alphabetical order)", async () => {
    const sftpClient = new SftpClient({
      ...sftpConfigTest,
      forceFileName: undefined,
    });

    const fileList: sftp.FileInfo[] = [
      getMockFileInfo(`${sftpConfigTest.fileNamePrefix}-22221100.csv`),
      getMockFileInfo(`${sftpConfigTest.fileNamePrefix}-99998877.csv`),
      getMockFileInfo(`${sftpConfigTest.fileNamePrefix}-00001122.csv`),
      getMockFileInfo(`${sftpConfigTest.fileNamePrefix}-55554433.csv`),
    ];

    const result = await sftpClient.getFileName(async (_: string) =>
      Promise.resolve(fileList)
    );

    expect(result).toStrictEqual(
      `${sftpConfigTest.fileNamePrefix}-99998877.csv`
    );
  });

  it("should ignore files not respecting naming conventions", async () => {
    const sftpClient = new SftpClient({
      ...sftpConfigTest,
      forceFileName: undefined,
    });

    const fileList: sftp.FileInfo[] = [
      getMockFileInfo(`aaaa-22221100.csv`),
      getMockFileInfo(`${sftpConfigTest.fileNamePrefix}-99998877.csv`),
      getMockFileInfo(`zzzz-00001122.csv`),
      getMockFileInfo(`${sftpConfigTest.fileNamePrefix}-55554433.csv`),
    ];

    const result = await sftpClient.getFileName(async (_: string) =>
      Promise.resolve(fileList)
    );

    expect(result).toStrictEqual(
      `${sftpConfigTest.fileNamePrefix}-99998877.csv`
    );
  });

  it("should fail if there are not files in folder", async () => {
    const sftpClient = new SftpClient({
      ...sftpConfigTest,
      forceFileName: undefined,
    });

    const fileList: sftp.FileInfo[] = [];

    await expect(() =>
      sftpClient.getFileName(async (_: string) => Promise.resolve(fileList))
    ).rejects.toThrowError("No files found in folder");
  });

  it("should retrieve requested forced file", async () => {
    const sftpClient = new SftpClient({
      ...sftpConfigTest,
      forceFileName: "forced-file-name.csv",
    });

    const fileList: sftp.FileInfo[] = [
      getMockFileInfo(`${sftpConfigTest.fileNamePrefix}-22221100.csv`),
      getMockFileInfo(`${sftpConfigTest.fileNamePrefix}-99998877.csv`),
      getMockFileInfo(`${sftpConfigTest.fileNamePrefix}-00001122.csv`),
      getMockFileInfo(`${sftpConfigTest.fileNamePrefix}-55554433.csv`),
    ];

    const result = await sftpClient.getFileName(async (_: string) =>
      Promise.resolve(fileList)
    );

    expect(result).toStrictEqual("forced-file-name.csv");
  });
});

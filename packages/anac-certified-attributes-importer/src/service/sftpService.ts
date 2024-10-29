import sftp from "ssh2-sftp-client";
import { Logger } from "pagopa-interop-commons";
import { SftpConfig } from "../config/sftpConfig.js";

export class SftpClient {
  private fileNameRegex: RegExp;

  constructor(private config: SftpConfig) {
    this.fileNameRegex = new RegExp(
      "^" + this.config.fileNamePrefix + "-\\d{8}\\.csv$"
    );
  }

  public async downloadCSV(logger: Logger): Promise<string> {
    // Note: The file should be small enough to fit in memory

    const sftpClient = new sftp();

    await sftpClient.connect({
      host: this.config.host,
      port: this.config.port,
      username: this.config.username,
      password: this.config.password,
    });

    const fileName = await this.getFileName((folderPath) =>
      sftpClient.list(folderPath)
    );

    logger.info(`Loading file ${fileName}`);

    const file = await sftpClient.get(this.config.folderPath + fileName);

    await sftpClient.end();

    if (file instanceof Buffer) {
      // TODO Is this ok?
      return file.toString();
    }

    if (typeof file === "string") {
      return file;
    }

    throw Error("Unexpected stream returned from SFTP library");
  }

  public async getFileName(
    listFileNames: (folderPath: string) => Promise<sftp.FileInfo[]>
  ): Promise<string> {
    if (this.config.forceFileName) {
      return this.config.forceFileName;
    }

    const allFiles = await listFileNames(this.config.folderPath);
    const sortedFiles = allFiles
      .map((file) => file.name)
      .sort()
      .filter((n) => this.satisfiesNamingConvention(n));

    if (sortedFiles.length === 0) {
      throw Error(`No files found in folder ${this.config.folderPath}`);
    }

    return sortedFiles[sortedFiles.length - 1];
  }

  public satisfiesNamingConvention(fileName: string): boolean {
    return fileName.match(this.fileNameRegex) !== null;
  }
}

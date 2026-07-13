import axios from "axios";
import admZip from "adm-zip";
import { Logger } from "pagopa-interop-commons";

export class IstatClient {
  constructor(private downloadUrl: string) {}

  public async downloadNationalDataset(logger: Logger): Promise<string> {
    logger.info(`Download ISTAT dataset from: ${this.downloadUrl}`);

    try {
      const response = await axios.get(this.downloadUrl, {
        responseType: "arraybuffer",
      });
      const zip = new admZip(Buffer.from(response.data));

      const csvEntry = zip
        .getEntries()
        .find((entry) => entry.entryName.endsWith(".csv"));

      if (!csvEntry) {
        throw new Error("No CSV file found on ZIP archive");
      }

      logger.info(`File extracted: ${csvEntry.entryName}`);
      return csvEntry.getData().toString("utf8");
    } catch (error) {
      logger.error(`Error download ISTAT: ${error}`);
      throw error;
    }
  }
}

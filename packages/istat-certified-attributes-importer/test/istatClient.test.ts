import { vi, describe, it, expect, beforeEach } from "vitest";
import axios from "axios";
import AdmZip from "adm-zip";
import { IstatClient } from "../src/service/istatClient.js";
import { genericLogger } from "pagopa-interop-commons";

vi.mock("axios");
const mockedAxios = vi.mocked(axios);
const mockedGet = vi.mocked(axios.get);
describe("IstatClient", () => {
  const url = "https://istat.it/dataset.zip";
  const client = new IstatClient(url);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should download and extract the CSV correctly from a ZIP", async () => {
    const zip = new AdmZip();
    const csvContent = `"Codice comune";"Totale"
"001";"1000"`;
    zip.addFile("dati.csv", Buffer.from(csvContent, "utf-8"));
    const zipBuffer = zip.toBuffer();

    mockedGet.mockResolvedValue({ data: zipBuffer });

    const result = await client.downloadNationalDataset(genericLogger);

    expect(mockedAxios.get).toHaveBeenCalledWith(url, {
      responseType: "arraybuffer",
    });
    expect(result).toBe(csvContent);
  });

  it("should throw error if the ZIP does not contain a CSV", async () => {
    const zip = new AdmZip();
    zip.addFile("random.txt", Buffer.from("hello", "utf-8"));
    const zipBuffer = zip.toBuffer();

    mockedGet.mockResolvedValue({ data: zipBuffer });

    await expect(client.downloadNationalDataset(genericLogger)).rejects.toThrow(
      "No CSV file found on ZIP archive"
    );
  });

  it("should propagate error if axios fails", async () => {
    mockedGet.mockRejectedValue(new Error("Network Error"));
    await expect(client.downloadNationalDataset(genericLogger)).rejects.toThrow(
      "Network Error"
    );
  });
});

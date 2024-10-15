import axios from "axios";
import { expect, vi, describe, it, MockedFunction } from "vitest";
import { getAllInstitutions } from "../src/services/openDataExtractor.js";
import { agencyDataset, aooDataset, uoDataset } from "./dataset.js";
import { agency, aoo, uo } from "./expectation.js";

vi.mock("axios");

describe("OpenDataExtractor", async () => {
  it("getAllInstitutions should return an empty array if there's no open data", async () => {
    (axios.get as MockedFunction<typeof axios.get>).mockResolvedValue({
      data: {},
    });

    const institutions = await getAllInstitutions("Agency", new Map());

    expect(institutions).toEqual([]);
  });

  it("getAllInstitutions should extract the agency openData", async () => {
    (axios.get as MockedFunction<typeof axios.get>).mockResolvedValue({
      data: agencyDataset,
    });

    const institutions = await getAllInstitutions("Agency", new Map());

    expect(institutions).toEqual(agency);
  });

  it("getAllInstitutions should extract the aoo openData", async () => {
    (axios.get as MockedFunction<typeof axios.get>).mockResolvedValue({
      data: aooDataset,
    });

    const institutions = await getAllInstitutions(
      "AOO",
      new Map([
        ["ZZ9A7J5X", { category: "SA", kind: "Stazioni Appaltanti" }],
        ["YY9A7J6Y", { category: "L37", kind: "Gestori di Pubblici Servizi" }],
        ["XX9A7J7Z", { category: "L33", kind: "Pubbliche Amministrazioni" }],
        ["WW9A7J8A", { category: "SA", kind: "Stazioni Appaltanti" }],
        ["VV9A7J9B", { category: "SAG", kind: "Gestori di Pubblici Servizi" }],
      ])
    );

    expect(institutions).toEqual(aoo);
  });

  it("getAllInstitutions should extract the uo openData", async () => {
    (axios.get as MockedFunction<typeof axios.get>).mockResolvedValue({
      data: uoDataset,
    });

    const institutions = await getAllInstitutions(
      "UO",
      new Map([
        ["ZX9M2HJ7", { category: "SA", kind: "Stazioni Appaltanti" }],
        ["ZW0P9J2D", { category: "L37", kind: "Gestori di Pubblici Servizi" }],
        ["ZX7E8QSG", { category: "L33", kind: "Pubbliche Amministrazioni" }],
        ["ZZ8F4MT2", { category: "SA", kind: "Stazioni Appaltanti" }],
        ["ZZ7W1AB3", { category: "SAG", kind: "Gestori di Pubblici Servizi" }],
      ])
    );

    expect(institutions).toEqual(uo);
  });
});

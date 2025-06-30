import axios from "axios";
import { expect, vi, describe, it, MockedFunction } from "vitest";
import {
  getAllCategories,
  getAllInstitutions,
} from "../src/services/openDataExtractor.js";
import {
  agencyDataset,
  aooDataset,
  categoriesDataset,
  uoDataset,
} from "./dataset.js";
import { agency, aoo, categories, uo } from "./expectation.js";

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
        ["Z1234ABC", { category: "SA", kind: "Stazioni Appaltanti" }],
        ["Z5678DEF", { category: "L37", kind: "Gestori di Pubblici Servizi" }],
        ["Z9123GHI", { category: "L33", kind: "Pubbliche Amministrazioni" }],
        ["Z3456JKL", { category: "SA", kind: "Stazioni Appaltanti" }],
        ["Z6789MNO", { category: "SAG", kind: "Gestori di Pubblici Servizi" }],
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
        ["Z1234ABC", { category: "SA", kind: "Stazioni Appaltanti" }],
        ["Z5678DEF", { category: "L37", kind: "Gestori di Pubblici Servizi" }],
        ["Z9123GHI", { category: "L33", kind: "Pubbliche Amministrazioni" }],
        ["Z3456JKL", { category: "SA", kind: "Stazioni Appaltanti" }],
        ["Z6789MNO", { category: "SAG", kind: "Gestori di Pubblici Servizi" }],
      ])
    );

    expect(institutions).toEqual(uo);
  });

  it("getAllCategories should extract the categories openData", async () => {
    (axios.get as MockedFunction<typeof axios.get>).mockResolvedValue({
      data: categoriesDataset,
    });

    const extractedCategories = await getAllCategories();

    expect(extractedCategories).toEqual(categories);
  });
});

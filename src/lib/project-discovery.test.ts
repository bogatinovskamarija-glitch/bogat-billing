import { describe, it, expect } from "vitest";
import { isProjectFolderName, mergeProjectLists } from "./project-discovery";

describe("isProjectFolderName", () => {
  it("accepts the real project folder naming variants", () => {
    expect(isProjectFolderName("260821 - Arraigo")).toBe(true);
    expect(isProjectFolderName("260929-Cadence")).toBe(true);
    expect(isProjectFolderName("261001 - Amal Tower")).toBe(true);
  });

  it("rejects non-project folders", () => {
    expect(isProjectFolderName("Accounting")).toBe(false);
    expect(isProjectFolderName("Active Projects")).toBe(false);
    expect(isProjectFolderName("People & HR")).toBe(false);
  });
});

describe("mergeProjectLists", () => {
  const known = [
    { clickupListId: "1", clickupFolderId: "f1", isActive: true },
    { clickupListId: "2", clickupFolderId: "f2", isActive: true },
  ];

  it("adds newly discovered lists", () => {
    const merged = mergeProjectLists(known, [{ clickupListId: "3", clickupFolderId: "f3", isActive: true }]);
    expect(merged.map((m) => m.clickupListId).sort()).toEqual(["1", "2", "3"]);
  });

  it("lets a discovered entry override the registry, so a project moved to Completed goes inactive", () => {
    const merged = mergeProjectLists(known, [{ clickupListId: "2", clickupFolderId: "done", isActive: false }]);
    expect(merged.find((m) => m.clickupListId === "2")).toEqual({ clickupListId: "2", clickupFolderId: "done", isActive: false });
  });

  it("keeps registry entries that discovery didn't return", () => {
    expect(mergeProjectLists(known, [])).toHaveLength(2);
  });
});

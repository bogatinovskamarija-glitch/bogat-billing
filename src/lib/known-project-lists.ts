// Registry of ClickUp project task-lists this app syncs into Supabase
// `projects`. ClickUp's Active Projects folder nests one sub-folder per
// project (each holding a single task list); Completed Projects holds its
// lists directly. There's no reliable API-only way to auto-discover the
// Active Projects sub-folders (nested-folder listing isn't a stable v2
// endpoint), so new active projects are added here by hand when they start
// — this is the natural companion to the wiki's "Project Setup SOP" gap
// (duplicate template, assign team, set up comms channel) that already
// exists as a manual step.
//
// Every ID below was read directly from the live workspace during planning.

export interface KnownProjectList {
  clickupListId: string;
  clickupFolderId: string;
  isActive: boolean;
}

export const KNOWN_PROJECT_LISTS: KnownProjectList[] = [
  // Active Projects (901311447111)
  { clickupListId: "901328300383", clickupFolderId: "901318819127", isActive: true }, // Arraigo
  { clickupListId: "901328327401", clickupFolderId: "901318832004", isActive: true }, // Compass Village

  // Completed Projects (90130302578)
  { clickupListId: "901320638754", clickupFolderId: "90130302578", isActive: false }, // Chrysalis Resort
  { clickupListId: "901322580604", clickupFolderId: "90130302578", isActive: false }, // Janevski Residence
  { clickupListId: "901320610289", clickupFolderId: "90130302578", isActive: false }, // MOVE
  { clickupListId: "901305930932", clickupFolderId: "90130302578", isActive: false }, // BHEO
  { clickupListId: "901320638648", clickupFolderId: "90130302578", isActive: false }, // The Flow State EA Arena
  { clickupListId: "901305930745", clickupFolderId: "90130302578", isActive: false }, // Sugar Cove Park Pavillion
  { clickupListId: "901306047250", clickupFolderId: "90130302578", isActive: false }, // Apartment Regatta
  { clickupListId: "901322876130", clickupFolderId: "90130302578", isActive: false }, // Aurora Tower
  { clickupListId: "901306294033", clickupFolderId: "90130302578", isActive: false }, // House of the Future
  { clickupListId: "901306281842", clickupFolderId: "90130302578", isActive: false }, // 404 Condominium
  { clickupListId: "901306495188", clickupFolderId: "90130302578", isActive: false }, // Port St. Lucie Dispensary
  { clickupListId: "901307287228", clickupFolderId: "90130302578", isActive: false }, // Blue Star Way Sprint 2
  { clickupListId: "901307266202", clickupFolderId: "90130302578", isActive: false }, // Hallandale Beach Masterplan
  { clickupListId: "901310737001", clickupFolderId: "90130302578", isActive: false }, // Argo ALF
];

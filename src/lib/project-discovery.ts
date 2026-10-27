import { getFolder, listSpaceFolders } from "./clickup";
import { FOLDERS } from "./clickup-field-ids";
import { KNOWN_PROJECT_LISTS, KnownProjectList } from "./known-project-lists";

// Project folders are named "YYMMDD - Name" (e.g. "260929-Cadence"); every
// other folder in the space (Accounting, Tools, Marketing…) isn't a project.
export function isProjectFolderName(name: string): boolean {
  return /^\s*\d{6}\b/.test(name);
}

// Discovered lists win over the static registry (so a project moved to
// Completed flips to inactive on the next sync); registry entries nobody
// found any more are kept rather than silently dropped.
export function mergeProjectLists(known: KnownProjectList[], discovered: KnownProjectList[]): KnownProjectList[] {
  const byListId = new Map<string, KnownProjectList>();
  known.forEach((k) => byListId.set(k.clickupListId, k));
  discovered.forEach((d) => byListId.set(d.clickupListId, d));
  return Array.from(byListId.values());
}

// Finds project lists straight from ClickUp so a newly started project shows
// up on the Billing Board after the next sync, with no code change.
export async function discoverProjectLists(): Promise<KnownProjectList[]> {
  const activeFolder = await getFolder(FOLDERS.activeProjects);
  const spaceId = activeFolder.space?.id;
  if (!spaceId) throw new Error("Could not determine the ClickUp space of the Active Projects folder");

  const [folders, completed] = await Promise.all([listSpaceFolders(spaceId), getFolder(FOLDERS.completedProjects)]);

  const discovered: KnownProjectList[] = [];
  for (const folder of folders) {
    if (!isProjectFolderName(folder.name)) continue;
    for (const list of folder.lists) {
      discovered.push({ clickupListId: list.id, clickupFolderId: folder.id, isActive: true });
    }
  }
  for (const list of completed.lists) {
    discovered.push({ clickupListId: list.id, clickupFolderId: completed.id, isActive: false });
  }

  return mergeProjectLists(KNOWN_PROJECT_LISTS, discovered);
}

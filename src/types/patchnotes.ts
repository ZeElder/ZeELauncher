export interface PatchNoteItem {
  version: string;
  date: string;
  game: string;
  notes: string[];
}

export interface PatchNotesData {
  patches: PatchNoteItem[];
}
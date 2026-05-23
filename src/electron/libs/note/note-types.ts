// Note CRUD types — 简易笔记数据模型
// Source: project-internal CRUD demo for test workspace

export type Note = {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
};

export type NoteCreateInput = {
  title: string;
  content: string;
};

export type NoteUpdateInput = {
  title?: string;
  content?: string;
};

// IPC types for note CRUD
export type NoteServerEvent =
  | { type: "note.list"; payload: { notes: Note[] } }
  | { type: "note.created"; payload: { note: Note } }
  | { type: "note.updated"; payload: { note: Note } }
  | { type: "note.deleted"; payload: { noteId: string } }
  | { type: "note.error"; payload: { message: string } };

export type NoteClientEvent =
  | { type: "note.list" }
  | { type: "note.create"; payload: NoteCreateInput }
  | { type: "note.get"; payload: { noteId: string } }
  | { type: "note.update"; payload: { noteId: string; input: NoteUpdateInput } }
  | { type: "note.delete"; payload: { noteId: string } };

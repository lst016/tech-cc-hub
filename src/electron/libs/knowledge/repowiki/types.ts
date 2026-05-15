export type RepoWikiFileInfo = {
  path: string;
  absolutePath: string;
  size: number;
  language: string;
  lines: number;
  preview: string;
  content: string;
  isConfig: boolean;
  isEntrypoint: boolean;
};

export type RepoWikiProjectContext = {
  name: string;
  root: string;
  files: RepoWikiFileInfo[];
  fileTree: string;
  totalLines: number;
};

export type TechItem = {
  name: string;
  category?: string;
  version?: string;
};

export type ProjectOverview = {
  name?: string;
  one_liner?: string;
  description?: string;
  tech_stack?: TechItem[];
  setup_instructions?: string[];
  key_features?: string[];
};

export type SymbolDoc = {
  name: string;
  kind?: string;
  line?: number;
  description?: string;
};

export type FileDoc = {
  path: string;
  purpose?: string;
  key_symbols?: SymbolDoc[];
};

export type RelationshipDoc = {
  source: string;
  target: string;
  description?: string;
};

export type ConceptDoc = {
  name: string;
  explanation?: string;
};

export type ModuleDoc = {
  name: string;
  purpose?: string;
  description?: string;
  files?: FileDoc[];
  relationships?: RelationshipDoc[];
  key_concepts?: ConceptDoc[];
};

export type ArchitectureComponent = {
  name: string;
  purpose?: string;
  files?: string[];
};

export type ArchitectureDiagram = {
  architecture_type?: string;
  description?: string;
  components?: ArchitectureComponent[];
  mermaid_component?: string;
  mermaid_sequence?: string;
  data_flow?: string;
};

export type ReadingStep = {
  order: number;
  title: string;
  files?: string[];
  explanation?: string;
  time_estimate?: string;
};

export type ReadingGuide = {
  introduction?: string;
  steps?: ReadingStep[];
  tips?: string[];
};

export type WikiData = {
  overview: ProjectOverview;
  modules: ModuleDoc[];
  architecture: ArchitectureDiagram;
  reading_guide: ReadingGuide;
};

export type WikiPage = {
  id: string;
  title: string;
  content: string;
  parentId?: string;
  order: number;
};

export type SidebarItem = {
  title: string;
  pageId?: string;
  children: SidebarItem[];
};

export type RepoWiki = {
  pages: WikiPage[];
  sidebar: SidebarItem[];
  projectName: string;
};

export type RepoWikiSkippedFile = {
  path: string;
  reason: string;
};

export type RepoWikiScanResult = {
  project: RepoWikiProjectContext;
  skipped: RepoWikiSkippedFile[];
};

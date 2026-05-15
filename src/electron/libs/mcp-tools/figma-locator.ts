export type FigmaLocator = {
  fileKey: string;
  nodeIds: string[];
};

export function parseFigmaLocator(fileKeyOrUrl: string, explicitNodeIds: string[] = []): FigmaLocator {
  const raw = fileKeyOrUrl.trim();
  if (!raw) {
    throw new Error("Missing Figma file key or URL.");
  }

  const parsedNodeIds = explicitNodeIds.map(normalizeNodeId).filter(Boolean);
  try {
    const url = new URL(raw);
    if (!/figma\.com$/i.test(url.hostname) && !url.hostname.endsWith(".figma.com")) {
      throw new Error("Not a Figma URL.");
    }

    const segments = url.pathname.split("/").filter(Boolean);
    const keySegmentIndex = segments.findIndex((segment) => (
      segment === "design" ||
      segment === "file" ||
      segment === "board" ||
      segment === "slides" ||
      segment === "proto" ||
      segment === "make"
    ));
    const fileKey = keySegmentIndex >= 0 ? segments[keySegmentIndex + 1] : "";
    if (!fileKey) {
      throw new Error("Could not parse a Figma file key from the URL.");
    }

    const nodeIdFromUrl = normalizeNodeId(url.searchParams.get("node-id") ?? "");
    return {
      fileKey,
      nodeIds: parsedNodeIds.length > 0 ? parsedNodeIds : nodeIdFromUrl ? [nodeIdFromUrl] : [],
    };
  } catch (error) {
    if (error instanceof TypeError) {
      return { fileKey: raw, nodeIds: parsedNodeIds };
    }
    throw error;
  }
}

export function normalizeNodeId(nodeId: string): string {
  return nodeId.trim().replace(/-/g, ":");
}

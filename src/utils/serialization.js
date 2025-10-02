const EXPORT_TITLE = "OpenMindMap Export";

const ensureArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }
  return [];
};

const normaliseNode = (node) => ({
  id: String(node.id ?? ""),
  label: String(node.label ?? ""),
  children: ensureArray(node.children).map(normaliseNode),
});

export function serializeToJSON(nodes) {
  return JSON.stringify(ensureArray(nodes).map(normaliseNode), null, 2);
}

export function deserializeFromJSON(text) {
  if (!text) {
    return [];
  }

  try {
    const parsed = JSON.parse(text);
    return ensureArray(parsed).map(normaliseNode);
  } catch (error) {
    console.error("Impossible de parser le JSON fourni.", error);
    throw error;
  }
}

const escapeXml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const nodesToOutline = (nodes, depth = 4) => {
  const indent = (size) => " ".repeat(size);
  return ensureArray(nodes)
    .map((node) => {
      const children = node.children?.length
        ? `\n${nodesToOutline(node.children, depth + 2)}${indent(depth)}`
        : "";
      return `${indent(depth)}<outline text="${escapeXml(node.label)}" id="${escapeXml(
        node.id
      )}">${children}</outline>`;
    })
    .join("\n");
};

export function serializeToOPML(nodes) {
  const body = nodesToOutline(ensureArray(nodes));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">\n  <head>\n    <title>${escapeXml(
    EXPORT_TITLE
  )}</title>\n  </head>\n  <body>\n${body ? `${body}\n` : ""}  </body>\n</opml>`;
}

function parseXmlDocument(text) {
  const parser = typeof DOMParser !== "undefined" ? new DOMParser() : null;
  if (!parser) {
    throw new Error("DOMParser est indisponible dans cet environnement");
  }
  const doc = parser.parseFromString(text, "text/xml");
  const parserError = doc.querySelector("parsererror");
  if (parserError) {
    throw new Error(parserError.textContent ?? "Erreur de parsing OPML");
  }
  return doc;
}

const parseOutline = (element) => {
  const id = element.getAttribute("id") ?? element.getAttribute("_uid") ?? "";
  const label = element.getAttribute("text") ?? element.getAttribute("title") ?? "";
  const children = Array.from(element.children)
    .filter((child) => child.tagName?.toLowerCase() === "outline")
    .map(parseOutline);
  return normaliseNode({ id, label, children });
};

export function deserializeFromOPML(text) {
  if (!text) {
    return [];
  }
  const doc = parseXmlDocument(text);
  const outlines = Array.from(doc.querySelectorAll("body > outline"));
  return outlines.map(parseOutline);
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  deserializeFromJSON,
  deserializeFromOPML,
  serializeToJSON,
  serializeToOPML,
} from "./utils/serialization";

const STORAGE_KEY = "openmindmap:nodes";

const INITIAL_NODES = [
  {
    id: "root",
    label: "Idée principale",
    children: [
      { id: "node-1", label: "Sous-idée A", children: [] },
      { id: "node-2", label: "Sous-idée B", children: [] },
    ],
  },
];

const DOWNLOAD_FILENAME_JSON = "openmindmap.json";
const DOWNLOAD_FILENAME_OPML = "openmindmap.opml";

function downloadFile(filename, data, type = "application/json") {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [nodes, setNodes] = useState(INITIAL_NODES);
  const fileInputRef = useRef(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return;
      }
      const parsed = deserializeFromJSON(stored);
      if (parsed?.length) {
        setNodes(parsed);
      }
    } catch (error) {
      console.warn("Impossible de charger les données, utilisation des valeurs par défaut.", error);
      setNodes(INITIAL_NODES);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      const payload = serializeToJSON(nodes);
      window.localStorage.setItem(STORAGE_KEY, payload);
    } catch (error) {
      console.warn("Impossible de sauvegarder les données dans localStorage.", error);
    }
  }, [nodes]);

  const handleExportJSON = useCallback(() => {
    const payload = serializeToJSON(nodes);
    downloadFile(DOWNLOAD_FILENAME_JSON, payload, "application/json");
  }, [nodes]);

  const handleExportOPML = useCallback(() => {
    const payload = serializeToOPML(nodes);
    downloadFile(DOWNLOAD_FILENAME_OPML, payload, "text/xml");
  }, [nodes]);

  const handleImport = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      let imported;
      if (file.name.toLowerCase().endsWith(".opml")) {
        imported = deserializeFromOPML(text);
      } else {
        imported = deserializeFromJSON(text);
      }
      if (imported?.length) {
        setNodes(imported);
      }
    } catch (error) {
      console.error("Erreur lors de l'import du fichier.", error);
    } finally {
      event.target.value = "";
    }
  }, []);

  const handleTriggerImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const totalNodes = useMemo(() => {
    const countNodes = (items) =>
      items.reduce(
        (acc, item) => acc + 1 + (item.children ? countNodes(item.children) : 0),
        0
      );
    return countNodes(nodes);
  }, [nodes]);

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__metrics">
          <strong>Total de nœuds :</strong> {totalNodes}
        </div>
        <div className="app__actions">
          <button type="button" onClick={handleExportJSON}>
            Exporter (JSON)
          </button>
          <button type="button" onClick={handleExportOPML}>
            Exporter (OPML)
          </button>
          <button type="button" onClick={handleTriggerImport}>
            Importer
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json,text/xml,.opml"
            style={{ display: "none" }}
            onChange={handleImport}
          />
        </div>
      </header>
      <main>
        <pre>{JSON.stringify(nodes, null, 2)}</pre>
      </main>
    </div>
  );
}

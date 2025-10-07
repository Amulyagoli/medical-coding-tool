import { useState } from 'react';
import axios from 'axios';

interface ICDResult {
  code: string;
  title: string;
  includes?: string[] | null;
  excludes?: string[] | null;
  synonyms?: string[] | null;
}

interface ModifierResult {
  code: string;
  title: string;
  reason: string;
}

interface NCCIResult {
  cpt_a: string;
  cpt_b: string;
  status: string;
  message: string;
  modifier_required: boolean;
}

export default function Home() {
  // Base URL for the API; can be configured via environment variable
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

  // ICD search state
  const [icdQuery, setIcdQuery] = useState('');
  const [icdResults, setIcdResults] = useState<ICDResult[]>([]);
  const [icdLoading, setIcdLoading] = useState(false);

  // Modifier search state
  const [modQuery, setModQuery] = useState('');
  const [modResults, setModResults] = useState<ModifierResult[]>([]);
  const [modLoading, setModLoading] = useState(false);

  // NCCI check state
  const [codeA, setCodeA] = useState('');
  const [codeB, setCodeB] = useState('');
  const [ncciResult, setNcciResult] = useState<NCCIResult | null>(null);
  const [ncciLoading, setNcciLoading] = useState(false);

  // Perform ICD search
  const handleIcdSearch = async () => {
    if (!icdQuery.trim()) {
      setIcdResults([]);
      return;
    }
    setIcdLoading(true);
    try {
      const response = await axios.get<ICDResult[]>(`${apiBase}/search/icd10`, {
        params: { query: icdQuery, limit: 5 },
      });
      setIcdResults(response.data);
    } catch (error) {
      console.error('ICD search error', error);
      setIcdResults([]);
    } finally {
      setIcdLoading(false);
    }
  };

  // Perform modifier search
  const handleModifierSearch = async () => {
    if (!modQuery.trim()) {
      setModResults([]);
      return;
    }
    setModLoading(true);
    try {
      const response = await axios.get<ModifierResult[]>(`${apiBase}/search/modifier`, {
        params: { query: modQuery },
      });
      setModResults(response.data);
    } catch (error) {
      console.error('Modifier search error', error);
      setModResults([]);
    } finally {
      setModLoading(false);
    }
  };

  // Perform NCCI check
  const handleNcciCheck = async () => {
    if (!codeA.trim() || !codeB.trim()) {
      setNcciResult(null);
      return;
    }
    setNcciLoading(true);
    try {
      const response = await axios.get<NCCIResult>(`${apiBase}/check/ncci`, {
        params: { cpt_a: codeA, cpt_b: codeB },
      });
      setNcciResult(response.data);
    } catch (error) {
      console.error('NCCI check error', error);
      setNcciResult(null);
    } finally {
      setNcciLoading(false);
    }
  };

  return (
    <main className="p-6 mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold mb-4">Medical Coding Tool</h1>
      {/* ICD Search */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">ICD‑10‑CM Search</h2>
        <div className="flex space-x-2 mb-2">
          <input
            type="text"
            value={icdQuery}
            onChange={(e) => setIcdQuery(e.target.value)}
            placeholder="Enter a diagnosis description"
            className="flex-1 p-2 border border-gray-300 rounded"
          />
          <button
            onClick={handleIcdSearch}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Search
          </button>
        </div>
        {icdLoading && <p className="text-gray-500">Searching…</p>}
        <ul className="space-y-2">
          {icdResults.map((item) => (
            <li key={item.code} className="p-3 border rounded bg-white shadow-sm">
              <p className="font-medium">
                {item.code} – {item.title}
              </p>
              {item.includes && (
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Includes: </span>
                  {item.includes.join(', ')}
                </p>
              )}
              {item.excludes && (
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Excludes: </span>
                  {item.excludes.join(', ')}
                </p>
              )}
              {item.synonyms && (
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Synonyms: </span>
                  {item.synonyms.join(', ')}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Modifier suggestions */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Modifier Suggestions</h2>
        <div className="flex space-x-2 mb-2">
          <input
            type="text"
            value={modQuery}
            onChange={(e) => setModQuery(e.target.value)}
            placeholder="Describe the scenario (e.g. bilateral knee surgery)"
            className="flex-1 p-2 border border-gray-300 rounded"
          />
          <button
            onClick={handleModifierSearch}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Suggest
          </button>
        </div>
        {modLoading && <p className="text-gray-500">Processing…</p>}
        <ul className="space-y-2">
          {modResults.map((mod) => (
            <li key={mod.code} className="p-3 border rounded bg-white shadow-sm">
              <p className="font-medium">
                {mod.code} – {mod.title}
              </p>
              <p className="text-sm text-gray-600">{mod.reason}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* NCCI check */}
      <section>
        <h2 className="text-xl font-semibold mb-2">NCCI Pair Check</h2>
        <div className="flex space-x-2 mb-2">
          <input
            type="text"
            value={codeA}
            onChange={(e) => setCodeA(e.target.value)}
            placeholder="CPT code A"
            className="flex-1 p-2 border border-gray-300 rounded"
          />
          <input
            type="text"
            value={codeB}
            onChange={(e) => setCodeB(e.target.value)}
            placeholder="CPT code B"
            className="flex-1 p-2 border border-gray-300 rounded"
          />
          <button
            onClick={handleNcciCheck}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            Check
          </button>
        </div>
        {ncciLoading && <p className="text-gray-500">Checking…</p>}
        {ncciResult && (
          <div className="p-3 border rounded bg-white shadow-sm">
            <p className="font-medium">
              {ncciResult.cpt_a} + {ncciResult.cpt_b}
            </p>
            <p className="text-sm mb-1">
              Status: <span className="font-semibold">{ncciResult.status}</span>
            </p>
            <p className="text-sm">{ncciResult.message}</p>
            {ncciResult.modifier_required && (
              <p className="text-sm text-red-600 font-semibold mt-1">
                A modifier is required to unbundle these codes.
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
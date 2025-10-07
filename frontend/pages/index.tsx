import { useState } from 'react';

/*
 * In the original implementation the frontend made HTTP requests to a
 * separate FastAPI backend to retrieve ICD‑10 results, modifier
 * suggestions and NCCI pair checks. However, in the deployed
 * environment the API was not reachable, resulting in empty
 * responses. To make this demo self‑contained and functional
 * without relying on an external API, we define a handful of
 * in‑memory datasets that mirror the sample data used by the
 * backend and implement the search logic directly in the
 * frontend.  These structures and helper functions closely follow
 * the Python definitions in backend/main.py.
 */

// Sample ICD‑10‑CM codes.  In a full application this would be
// loaded from the CMS distribution.  Here we include a few
// representative entries for demonstration purposes.
const SAMPLE_ICD10_DATA: ICDResult[] = [
  {
    code: 'M25.561',
    title: 'Pain in right knee',
    includes: ['Right knee pain'],
    excludes: ['Pain in left knee (M25.562)'],
    synonyms: ['knee pain right', 'arthralgia right knee'],
  },
  {
    code: 'M25.562',
    title: 'Pain in left knee',
    includes: ['Left knee pain'],
    excludes: ['Pain in right knee (M25.561)'],
    synonyms: ['knee pain left', 'arthralgia left knee'],
  },
  {
    code: 'J10.1',
    title:
      'Influenza due to other identified influenza virus with other respiratory manifestations',
    includes: ['Influenza with pneumonia'],
    excludes: null,
    synonyms: ['flu with respiratory manifestations', 'influenza pneumonia'],
  },
  {
    code: 'M54.5',
    title: 'Low back pain',
    includes: ['Lumbago'],
    excludes: null,
    synonyms: ['back pain', 'lower back pain'],
  },
  {
    code: 'R07.9',
    title: 'Chest pain, unspecified',
    includes: ['Chest pain NOS'],
    excludes: null,
    synonyms: ['chest discomfort', 'unspecified chest pain'],
  },
];

// Sample modifier definitions.  A real system would include the full
// CPT/HCPCS modifier catalogue.  Each entry includes the code,
// description and a brief rationale.
const MODIFIER_TABLE: ModifierResult[] = [
  {
    code: '25',
    title:
      'Significant, separately identifiable evaluation and management service on the same day of the procedure',
    reason:
      'Use when a separately documented E/M service is performed on the same day as another procedure.',
  },
  {
    code: '59',
    title: 'Distinct procedural service',
    reason:
      'Indicates a procedure or service was distinct or independent from other services performed on the same day.',
  },
  {
    code: '50',
    title: 'Bilateral procedure',
    reason:
      'Used when the same procedure is performed on both sides of the body during the same session.',
  },
  {
    code: 'LT',
    title: 'Left side',
    reason: 'Procedures performed on the left side of the body.',
  },
  {
    code: 'RT',
    title: 'Right side',
    reason: 'Procedures performed on the right side of the body.',
  },
  {
    code: '76',
    title: 'Repeat procedure or service by same physician',
    reason: 'Indicates a repeat procedure by the same physician.',
  },
  {
    code: '77',
    title: 'Repeat procedure by another physician',
    reason: 'Indicates a repeat procedure by a different physician.',
  },
  {
    code: '26',
    title: 'Professional component',
    reason:
      'Used when only the professional component of a service is being billed (e.g., interpretation of radiologic studies).',
  },
  {
    code: 'TC',
    title: 'Technical component',
    reason:
      'Used when only the technical component of a service is being billed (e.g., use of equipment).',
  },
];

// Sample NCCI pair edits.  The keys of the outer object are CPT codes.
// Each inner object maps a second CPT code to a record describing the
// bundling status, explanatory message and whether a modifier is
// required to unbundle the codes.
interface NcciPairRecord {
  status: string;
  message: string;
  modifier_required: boolean;
}

const NCCI_PAIRS: { [codeA: string]: { [codeB: string]: NcciPairRecord } } = {
  '11719': {
    '11720': {
      status: 'denied',
      message:
        'CPT 11719 is bundled into 11720; they should not be billed together without appropriate modifier.',
      modifier_required: true,
    },
  },
  '17000': {
    '17110': {
      status: 'allowed',
      message:
        'CPT 17000 and 17110 may be reported together with modifier 59 if lesions are separate/distinct sites.',
      modifier_required: true,
    },
  },
  '71045': {
    '71046': {
      status: 'allowed',
      message: 'Two different chest X‑ray views are generally allowed together.',
      modifier_required: false,
    },
  },
};

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
  // This demo does not call an external API.  Instead all data lives
  // locally in memory (see SAMPLE_ICD10_DATA, MODIFIER_TABLE and
  // NCCI_PAIRS above), so there is no API base URL.

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

  // Perform ICD search using the local SAMPLE_ICD10_DATA.  The
  // search algorithm is similar to the backend: it assigns scores
  // based on substring matches in the code, title, includes/excludes
  // and synonyms.  The top 5 results (by score) are returned.
  const handleIcdSearch = () => {
    if (!icdQuery.trim()) {
      setIcdResults([]);
      return;
    }
    setIcdLoading(true);
    const q = icdQuery.trim().toLowerCase();
    const scored: { entry: ICDResult; score: number }[] = [];
    SAMPLE_ICD10_DATA.forEach((entry) => {
      let score = 0;
      if (entry.code.toLowerCase().includes(q)) {
        score += 2;
      }
      if (entry.title.toLowerCase().includes(q)) {
        score += 1.5;
      }
      (entry.includes ?? []).forEach((sec) => {
        if (sec.toLowerCase().includes(q)) {
          score += 1;
        }
      });
      (entry.excludes ?? []).forEach((sec) => {
        if (sec.toLowerCase().includes(q)) {
          score += 0.5;
        }
      });
      (entry.synonyms ?? []).forEach((sec) => {
        if (sec.toLowerCase().includes(q)) {
          score += 1;
        }
      });
      if (score > 0) {
        scored.push({ entry, score });
      }
    });
    scored.sort((a, b) => b.score - a.score);
    setIcdResults(scored.slice(0, 5).map((item) => item.entry));
    setIcdLoading(false);
  };

  // Perform modifier search using local keyword logic.  Based on
  // keywords in the query, this function returns appropriate
  // modifiers from the MODIFIER_TABLE.  Duplicate codes are removed.
  const handleModifierSearch = () => {
    if (!modQuery.trim()) {
      setModResults([]);
      return;
    }
    setModLoading(true);
    const q = modQuery.toLowerCase();
    const suggestions: ModifierResult[] = [];
    // Bilateral procedures
    if (['bilateral', 'both sides', 'both limbs'].some((word) => q.includes(word))) {
      const mod = MODIFIER_TABLE.find((m) => m.code === '50');
      if (mod) suggestions.push(mod);
    }
    // Left or right
    if (q.includes('left') || q.includes(' lt ')) {
      const mod = MODIFIER_TABLE.find((m) => m.code === 'LT');
      if (mod) suggestions.push(mod);
    }
    if (q.includes('right') || q.includes(' rt ')) {
      const mod = MODIFIER_TABLE.find((m) => m.code === 'RT');
      if (mod) suggestions.push(mod);
    }
    // Repeat
    if (q.includes('repeat') || q.includes('again')) {
      const mod = MODIFIER_TABLE.find((m) => m.code === '76');
      if (mod) suggestions.push(mod);
    }
    // Distinct or separate
    if (['distinct', 'different site', 'separate session'].some((word) => q.includes(word))) {
      const mod = MODIFIER_TABLE.find((m) => m.code === '59');
      if (mod) suggestions.push(mod);
    }
    // E/M separate from procedure
    if (q.includes('evaluation') || q.includes('e/m')) {
      const mod = MODIFIER_TABLE.find((m) => m.code === '25');
      if (mod) suggestions.push(mod);
    }
    // Professional component
    if (q.includes('interpretation') || q.includes('professional')) {
      const mod = MODIFIER_TABLE.find((m) => m.code === '26');
      if (mod) suggestions.push(mod);
    }
    // Technical component
    if (q.includes('equipment') || q.includes('technical')) {
      const mod = MODIFIER_TABLE.find((m) => m.code === 'TC');
      if (mod) suggestions.push(mod);
    }
    // Remove duplicates by code while preserving order
    const unique: ModifierResult[] = [];
    const seen = new Set<string>();
    for (const mod of suggestions) {
      if (!seen.has(mod.code)) {
        seen.add(mod.code);
        unique.push(mod);
      }
    }
    setModResults(unique);
    setModLoading(false);
  };

  // Perform NCCI check using the local sample table.  The codes are
  // treated as an unordered pair; if a matching record exists it is
  // returned, otherwise the pair is assumed allowed.  This mirrors
  // the behaviour of the backend sample.
  const handleNcciCheck = () => {
    if (!codeA.trim() || !codeB.trim()) {
      setNcciResult(null);
      return;
    }
    setNcciLoading(true);
    const a = codeA.trim();
    const b = codeB.trim();
    let result: NCCIResult;
    if (NCCI_PAIRS[a] && NCCI_PAIRS[a][b]) {
      const rec = NCCI_PAIRS[a][b];
      result = {
        cpt_a: a,
        cpt_b: b,
        status: rec.status,
        message: rec.message,
        modifier_required: rec.modifier_required,
      };
    } else if (NCCI_PAIRS[b] && NCCI_PAIRS[b][a]) {
      const rec = NCCI_PAIRS[b][a];
      result = {
        cpt_a: a,
        cpt_b: b,
        status: rec.status,
        message: rec.message,
        modifier_required: rec.modifier_required,
      };
    } else {
      result = {
        cpt_a: a,
        cpt_b: b,
        status: 'allowed',
        message: 'No known NCCI bundling issues between these CPT codes.',
        modifier_required: false,
      };
    }
    setNcciResult(result);
    setNcciLoading(false);
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
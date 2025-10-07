# Medical Coding Tool

This repository contains a simple proof‑of‑concept implementation of a medical
coding assistant.  It consists of a **FastAPI** backend providing search
endpoints for ICD‑10‑CM codes, modifier suggestions and basic National
Correct Coding Initiative (NCCI) pair checking, and a **Next.js** frontend
offering a minimal user interface to interact with these services.

The goal of this project is to illustrate how the architectural plans
described in the design document can be realised in a concrete codebase.  It
is **not** intended for clinical use; the datasets included here are small
samples and the rule logic is greatly simplified.  Nevertheless, the code
offers a solid starting point for experimentation and further development.

## Structure

```
medical-coding-tool/
├── backend/
│   ├── main.py            # FastAPI application with search and check endpoints
│   └── requirements.txt   # Python dependencies
├── frontend/
│   ├── pages/
│   │   ├── _app.tsx       # Next.js app wrapper
│   │   └── index.tsx      # Home page with search UI
│   ├── styles/
│   │   └── globals.css    # TailwindCSS styles
│   ├── tailwind.config.js # Tailwind configuration
│   ├── postcss.config.js  # PostCSS configuration
│   ├── package.json       # Node dependencies and scripts
│   └── tsconfig.json      # TypeScript configuration
└── README.md
```

## Prerequisites

To run the backend and frontend locally you need the following tools
installed:

* **Python 3.10+**
* **Node.js 18+**
* **npm** or **yarn**

You should also install **pipenv**, **virtualenv** or your preferred
environment manager to isolate the Python dependencies.

## Running the Backend

1. Change into the backend directory:

   ```sh
   cd backend
   ```

2. Create a virtual environment and install dependencies:

   ```sh
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

3. Start the FastAPI server using Uvicorn:

   ```sh
   uvicorn main:app --reload --port 8000
   ```

   The API will be available at `http://localhost:8000`.  A healthcheck
   endpoint is exposed at `/health`.

## Running the Frontend

1. Change into the frontend directory:

   ```sh
   cd frontend
   ```

2. Install Node dependencies:

   ```sh
   npm install
   # or
   yarn install
   ```

3. Create a `.env.local` file to configure the API base URL.  For
   development the backend runs on port 8000:

   ```dotenv
   NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
   ```

4. Start the Next.js development server:

   ```sh
   npm run dev
   ```

   The web application will be available at `http://localhost:3000`.

## Extending the Application

The current implementation uses small in‑memory datasets and very
simple matching logic.  To extend this into a more robust coding
assistant you might:

* Ingest the full ICD‑10‑CM dataset from CMS and implement a proper
  search index using trigram matching or embeddings.
* Incorporate licensed CPT/HCPCS code sets and build a comprehensive
  modifier rule engine.
* Integrate real NCCI PTP, MUE and LCD/NCD tables and expose
  endpoints for coverage and edit checks.
* Add authentication and PHI handling to support clinical workflows.
* Implement a claim builder page with fields for modifiers, units and
  diagnosis pointers, and export to CMS‑1500.

Feel free to use this repository as a starting point for those
improvements.

# Plain Language Agent

This tool takes complex institutional text — medical discharge instructions, legal contracts, insurance policies, government forms — and rewrites it to plain language standards. It targets Grade 6 for healthcare and children's content, Grade 8 for general government and public-facing content (the US Plain Writing Act standard), and Grade 10 for legal and technical professional content. The multi-agent workflow (Profiler, Paraphraser, Critic) iteratively rewrites and validates until the target Flesch-Kincaid grade level is reached.

🚀 **Live Deployment:** [https://plain-language-agent.onrender.com/](https://plain-language-agent.onrender.com/)
🎥 **Video Demonstration:** [YouTube Demo](https://youtu.be/17fMWKVvcSg)
🏆 **Kaggle Capstone Write-up:** [Kaggle Competition Write-up](https://kaggle.com/competitions/vibecoding-agents-capstone-project/writeups/plain-language-agent) (Created for the Kaggle 5 Days AI Agents Capstone Project)

For a detailed technical analysis of the execution lifecycle, loops, and design patterns, please refer to the [Architectural Blueprint & Technical Breakdown](./architectural_breakdown.md).

---

## Key Features

*   **Agentic LangGraph Workflow:** Implements a structured multi-agent StateGraph (Profiler, Paraphraser, and Critic) that iteratively refines and evaluates text readability.
*   **Gemini & Llama-3 Hybrid Inference:** Integrates Google Gemini (`gemini-2.5-flash`) for structural analysis/review, and Hugging Face Llama-3 (`Llama-3-8B-Instruct`) for copy generation.
*   **Model Context Protocol (MCP) Integration:** Queries a local stdio-based MCP server in real-time to fetch target plain-language rules based on grade levels.
*   **Terminal GUI Dashboard:** Serves an interactive monospaced retro-terminal interface to select grade targets, submit requests, and inspect live before-and-after Flesch-Kincaid grade scores alongside a dynamic simplification delta indicator.
*   **Pure JavaScript ESM Architecture:** Built entirely on vanilla Node.js ES Modules, running directly from source with zero build compilation overhead.

---

## Prerequisites
*   **Node.js:** version 20.6.0 or higher (required for native environment file loading).

---

## Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone <repo-url>
    cd plain-language-agent
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure API Keys:**
    Create a `.env` file in the root directory and add your access keys:
    ```env
    HUGGINGFACEHUB_API_TOKEN=your_huggingface_access_token_here
    GOOGLE_API_KEY=your_google_api_key_here
    ```

---

## Running the Application

### Launching the GUI Server
To run the interactive web interface (which reads from the environment and defaults to port 3000):
```bash
npm start
```
Open `http://localhost:3000` in your web browser.

---

## Model Context Protocol (MCP) Server

The project includes a built-in MCP server that implements a tool to retrieve replacement patterns.

*   **Location:** [mcp-server/index.js](file:///workspaces/agentic-humanizer/mcp-server/index.js)
*   **Execution Command:** `node mcp-server/index.js`
*   **Tool Name:** `get_plain_language_patterns`
    *   **Arguments:** `{"gradeLevel": "6" | "8" | "10"}` (Strict Zod validation)

---

## Local HTTP Router API

The GUI server also exposes local HTTP endpoints:

*   `GET /health` -> Returns `{ "ok": true }`
*   `POST /api/humanize` -> Invokes the compiled StateGraph workflow and returns plain language compliance results.

Example API request:
```bash
curl -s -X POST http://localhost:3000/api/humanize \
  -H 'Content-Type: application/json' \
  --data '{"text":"The patient is utilizing medications in order to alleviate hypertension.","gradeLevel":"6"}'
```

Response format:
```json
{
  "result": "The patient is taking medicine to lower high blood pressure.",
  "plainText": "The patient is taking medicine to lower high blood pressure.",
  "readabilityScores": {
    "before": 19.81,
    "after": 8.20
  },
  "gradeLevel": "6"
}
```

---

## Docker Deployment
The service is configured for single-stage Docker runtimes:
*   **Build command:** `docker build -t plain-language-agent .`
*   **Execution command:** `docker run -p 3000:3000 -e GOOGLE_API_KEY="<your_key>" -e HUGGINGFACEHUB_API_TOKEN="<your_token>" plain-language-agent`

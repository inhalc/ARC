# Related Paper Agent - Data Layer

Works with free OpenAlex & arXiv APIs, leveraging your local GPU stack later for embedding/indexing. This repo covers ingestion, caching, and sample dataset generation that will back the GitHub Pages demo.

## Folder layout
- `src/paper_agent/` - reusable Python package (config, cache, datasource clients)
- `scripts/fetch_sample.py` - CLI to pull & merge OpenAlex + arXiv results into cached JSON
- `data/` - auto-created storage (API cache + sample payloads ready for embedding/index builds)
- `tests/` - placeholder for upcoming unit tests

## Setup
1. `conda create -n rpa python=3.10` (or use `uv` / `venv`)
2. `pip install -e .[dev]` to get runtime + lint/test tools
3. optional environment variables:
   - `PAPER_AGENT_OPENALEX_MAILTO` - recommended contact email for OpenAlex
   - `PAPER_AGENT_ARXIV_EMAIL` - inserted in User-Agent per arXiv policy
   - `PAPER_AGENT_DATA_DIR` - custom storage directory (default `./data`)
   - `PAPER_AGENT_CACHE_TTL_HOURS` - cache expiry (72 h default, `0` disables)

## Usage
Fetch a blended dataset without touching cached responses:
```bash
python scripts/fetch_sample.py "multimodal large language model" --category cs.CL --category cs.AI --openalex 60 --arxiv 40
```
This writes `data/samples/multimodal-large-language-model.json` containing deduplicated papers plus metadata (title, abstract, DOI, categories, etc.).

Subsequent runs reuse the on-disk cache (`data/openalex/*.json`, `data/arxiv/*.json`). Delete those files to force a fresh download.

## Next steps
- Build embedding/indexer pipeline that reads `data/samples/*.json`
- Serve results through FastAPI + Streamlit for the class demo
- Add pytest coverage for datasource parsing and caching behavior

Everything stays within free-tier APIs; the heavier GPU tasks (embedding, rerank, summarise) run locally on your 4070 Ti.

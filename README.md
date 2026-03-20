## Stock Price Prediction Platform

<div align="center">

**End‑to‑end ML-powered stock prediction dashboard**

[![Dockerized](https://img.shields.io/badge/deploy-dockerized-blue)](https://www.docker.com/)
[![FastAPI](https://img.shields.io/badge/backend-FastAPI-009688)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/frontend-Next.js-black)](https://nextjs.org/)
[![Status](https://img.shields.io/badge/status-active-success)](#)

</div>

---

### Overview

- **Backend**: FastAPI with ML models (e.g. LSTM) exposed via typed REST APIs
- **Frontend**: Next.js/React trading-style dashboard for charts, predictions, and market views
- **Infrastructure**: Docker + `docker-compose`, Nginx gateway, and Makefile helpers for a smooth DX

This repository is designed as a **professional, production‑ready template** for time‑series / stock‑prediction projects, with clear separation between backend, frontend, and infrastructure.

---

### Tech Stack At A Glance

| Layer          | Technologies                                |
| ------------- | ------------------------------------------- |
| **Frontend**  | Next.js, React, TypeScript, modern UI/UX   |
| **Backend**   | FastAPI, Python, ML (e.g. LSTM)             |
| **Data**      | Finnhub, Alpha Vantage, local JSON fallback |
| **Infra/Tooling** | Native services, PostgreSQL, MongoDB (Redis optional) |

---

### Features

- **Machine Learning powered predictions**
  - LSTM-based model for stock price forecasting
  - Inference service exposed via REST API
- **Data integrations**
  - Finnhub and Alpha Vantage market data support
  - Simple local JSON data for demo/testing
- **Full-stack app**
  - API server (FastAPI) with typed routes and OpenAPI docs
  - Next.js UI for viewing prices, predictions, and portfolio
- **Native development setup**
  - Simple scripts to start all services
  - Next.js proxy handles API routing without Nginx

---

### Screenshots

<div align="center">

**Landing & How It Works**

![Landing and how it works](docs/images/landing-how-it-works.png)

**Stock Search & Popular Stocks**

![Stock search screen](docs/images/stock-search.png)

**Prediction Detail & Strategy**

![Prediction detail screen](docs/images/prediction-detail.png)

</div>

---

### Project Structure

```text
.
├── backend/           # FastAPI app, ML models, services
├── frontend/          # Next.js web UI
├── data/              # Sample/local data (non-sensitive)
├── start.sh           # Start all services
├── stop.sh            # Stop all services
└── README.md
```

---

### Prerequisites

- **Python 3.11+** and **Node.js 18+**
- **PostgreSQL** and **MongoDB** (Redis optional - has in-memory fallback)
- **API keys**:
  - Finnhub API key
  - Alpha Vantage API key

---

### Quick Start (No Docker)

Prerequisites: Python 3.11+, Node.js 18+, PostgreSQL, MongoDB (Redis optional)

1. **Clone the repo**

```bash
git clone https://github.com/Sharan0555/Stock-Price-Prediction.git
cd Stock-Price-Prediction
```

2. **Copy .env.example to .env and fill in API keys**

```bash
cp .env.example .env
# Edit .env and add your FINNHUB_API_KEY and ALPHAVANTAGE_API_KEY
```

3. **Run database setup**

```bash
bash backend/setup_db.sh
```

4. **Start everything**

```bash
bash start.sh
```

5. **Open http://localhost:3000**

**Stop everything**: `bash stop.sh`

---

### Services & URLs

Once the stack is running:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8001
- **API Docs**: http://localhost:8001/api/docs
- **Example endpoint**: http://localhost:8001/api/v1/stocks/fx/inr?base=USD

---

### Local Development (Manual)

If you prefer to run services individually:

- **Backend**:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

- **Frontend**:

```bash
cd frontend
npm install
npm run dev
```

---

### Tests

Backend tests (example with `pytest`):

```bash
cd backend
pytest
```

---

### Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m "feat: add my feature"`
4. Push the branch: `git push origin feature/my-feature`
5. Open a Pull Request on GitHub

---

### License

This project is currently **unlicensed**.  
If you plan to make it open source, consider adding a license file (e.g. MIT) at the repository root.


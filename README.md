# Lentera Wicaksana Pinjol

A modern, production-ready web application for analyzing online loan risks, built with **Angular 21**, **Node.js 24 LTS**, **Express**, and **Google Gemini 2.5 Flash**. Designed for transparency, security, and extensibility.

> 🎓 **Program**: Capstone project for [Hacktiv8 — Maju Bareng AI Bersama Hacktiv8](https://www.hacktiv8.com/projects/avpn-asia) — Full-Stack JavaScript Development Program

---

## 🚀 Features

- **Loan Risk Analysis**: Calculates APR, DTI, monthly payments, and risk scores
- **OJK Data Integration**: Real-time verification of lender legality via [community OJK API](https://github.com/Namchee/ojk-invest-api) (⚠️ not official; see [official OJK](https://www.ojk.go.id/) for verified data)
- **AI-Powered Explanations**: Google Gemini 2.5 Flash generates financial advice in Bahasa Indonesia
- **Multimodal Chat**: Upload images, PDFs, or audio for AI analysis
- **Zero Data Persistence**: No user data is stored; all operations are in-memory
- **Production Security**: Helmet.js, CORS, rate limiting, HTTPS, and environment-based config
- **Responsive UI**: Tailwind CSS v4, mobile-first

---

## 📸 Screenshots

![Application Screenshot](images/screencapture.png)

---

## 🏗️ Architecture Overview

```
project-root/
├── frontend/         # Angular 21 SPA
│   ├── src/app/
│   │   ├── components/   # Loan form, results, multimodal chat
│   │   ├── services/     # Calculator, OJK validator, AI client
│   │   └── ...
│   ├── public/
│   ├── nginx.conf
│   ├── Dockerfile
│   └── ...
├── backend/          # Node.js 24 Express API
│   ├── index.js      # Main server
│   ├── package.json
│   ├── .env          # API keys (not in git)
│   ├── Dockerfile
│   └── ...
├── docker-compose.yml
└── README.md
```

---

## 🛠️ Local Development

### Prerequisites

- Node.js 24 LTS & npm 11+
- Angular CLI 21
- Docker & Docker Compose (for containerized workflow)
- Google Gemini API key ([get one](https://aistudio.google.com/apikey))

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env # or create .env
# Set GEMINI_API_KEY in .env
npm start
# Runs at http://localhost:3000
```

### Frontend Setup

```bash
cd frontend
npm install
ng serve --host 0.0.0.0
# Runs at http://localhost:4200
# /api is proxied to backend
```

---

## 🐳 Dockerized Deployment (Recommended)

### 1. Configure Environment

```bash
cd backend
cp .env.example .env
# Edit .env and set GEMINI_API_KEY=your_key_here
```

### 2. Build & Run

```bash
docker compose up --build
```

- Frontend: http://localhost (port 80, HTTPS enabled)
- Backend: http://localhost:3000 (proxied)

---

## 📋 API Endpoints (Backend)

- `GET /api/health` — Health check
- `POST /api/chat` — AI chat/explanation
- `POST /api/chat-multimodal` — AI chat with file upload (image, PDF, audio)
- `POST /api/verify-lender` — OJK lender verification
- `GET /api/ojk/apps` — List of legal lenders (via [community API](https://github.com/Namchee/ojk-invest-api))
- `GET /api/ojk/illegals` — List of illegal lenders (via [community API](https://github.com/Namchee/ojk-invest-api))
- `GET /api/ojk/products` — List of legal products (via [community API](https://github.com/Namchee/ojk-invest-api))
- `GET /api/ojk/status` — Community OJK API health check

See [backend/index.js](backend/index.js) for full details and request/response formats.

---

## 🧑‍💻 Developer Workflow

- **Frontend**: Angular 21, standalone components, Signals, OnPush, Tailwind v4
- **Backend**: Node.js 24, Express, Google Gemini SDK, OJK API proxy
- **Multimodal**: File uploads (image, PDF, audio) via memory storage (Multer)
- **Security**: Helmet, CORS, rate limiting, HTTPS (self-signed in dev)
- **Testing**: Deterministic calculations, API health checks, Docker healthchecks

### Key Files

- `frontend/src/app/components/loan-form.ts` — Loan input, OJK autocomplete, verify button
- `frontend/src/app/components/multimodal-chat.ts` — Multimodal AI chat
- `frontend/src/app/services/ojk-validator.ts` — OJK API integration
- `backend/index.js` — All API endpoints

---

## 📝 Environment Variables

**backend/.env**

```
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3000
NODE_ENV=production
CORS_ORIGIN=http://localhost,https://yourdomain.com
```

---

## 🧩 Extending & Contributing

1. **Fork this repo**
2. `git checkout -b feature/your-feature`
3. Make changes (see architecture above)
4. Add/modify tests if needed
5. `docker compose up --build` or run locally
6. Submit a pull request!

### Coding Standards

- Use Angular standalone components and Signals
- Use TypeScript strict mode
- Use async/await or RxJS for all async flows
- Keep backend stateless (no DB)
- Use environment variables for all secrets

---

## 🐞 Troubleshooting

- **Backend not starting**: Check `.env` and Gemini API key, run `docker logs lentera-pinjol-backend`
- **Frontend can't reach backend**: Check proxy config, CORS, and nginx logs
- **OJK data issues**: Check `/api/ojk/status` and backend logs. Note: Uses [community OJK API](https://github.com/Namchee/ojk-invest-api); for official OJK data, visit [ojk.go.id](https://www.ojk.go.id/)
- **AI not responding**: Check Gemini API key and backend logs

---

## 📚 Technology Stack

| Component   | Technology         | Version   |
| ----------- | ------------------ | --------- |
| Runtime     | Node.js            | 24 LTS    |
| Framework   | Express            | 4.19+     |
| Frontend    | Angular            | 21        |
| AI Engine   | Google Gemini      | 2.5 Flash |
| Styling     | Tailwind CSS       | v4        |
| Container   | Docker             | Latest    |
| Web Server  | Nginx              | Alpine    |
| Security    | Helmet.js          | 7.1.0     |
| Rate Limit  | express-rate-limit | 7.3+      |
| File Upload | Multer             | 1.4.5-lts |

---

## 📄 License

MIT License — see LICENSE

---

## 🤝 Support & Contact

- Open an issue or discussion on GitHub
- PRs and suggestions welcome!

---

## ⚠️ Important Notes

- **OJK API Status (as of Feb 20, 2026)**: There is no official public API from OJK. This application uses a community-maintained API from [Namchee/ojk-invest-api](https://github.com/Namchee/ojk-invest-api) for demonstration purposes.
- **Official OJK Resources**: Visit [www.ojk.go.id](https://www.ojk.go.id/) for official, verified lender information and compliance details.
- **Educational Use**: This application is designed as a financial education tool. Always verify lender legitimacy through official OJK channels before taking any loan.

---

**Last updated:** February 2026

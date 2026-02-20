import express from "express";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Load environment variables
dotenv.config();

// ===========================
// Configuration & Constants
// ===========================
const PORT = process.env.PORT || 3000;
const OJK_API_BASE = "https://ojk-invest-api.vercel.app/api";
const CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 hours
const FETCH_TIMEOUT = 10000; // 10 seconds timeout for external calls

// In-memory Cache Store
const ojkCache = {
  apps: { data: null, timestamp: 0 },
  illegals: { data: null, timestamp: 0 },
  products: { data: null, timestamp: 0 },
};

// ===========================
// Environment Variables Check
// ===========================
if (!process.env.GEMINI_API_KEY) {
  console.error("FATAL ERROR: GEMINI_API_KEY is not defined.");
  process.exit(1);
}

const app = express();

// ===========================
// Security & Middleware
// ===========================
app.use(helmet());
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = (process.env.CORS_ORIGIN || "*")
      .split(",")
      .map((o) => o.trim());

    // Allow requests with no origin (e.g., mobile apps, curl requests)
    if (!origin || allowedOrigins.includes("*")) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Terlalu banyak permintaan, silakan coba lagi nanti." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", limiter);

// Multer Configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "text/plain",
      "audio/mpeg",
      "audio/wav",
      "audio/ogg",
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Format file tidak didukung"));
    }
  },
});

// ===========================
// Google Generative AI Setup
// ===========================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL_NAME = "gemini-2.5-flash"; // Updated to latest efficient model
const model = genAI.getGenerativeModel({ model: MODEL_NAME });

// ===========================
// Helper Functions
// ===========================

/**
 * Fetch wrapper with timeout
 */
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

/**
 * Get OJK data with in-memory caching
 * @param {string} endpoint - 'apps', 'illegals', or 'products'
 */
async function getOjkDataWithCache(endpoint) {
  const now = Date.now();
  const cacheKey = endpoint;

  // Return cached data if valid
  if (
    ojkCache[cacheKey].data &&
    now - ojkCache[cacheKey].timestamp < CACHE_DURATION
  ) {
    return ojkCache[cacheKey].data;
  }

  // Fetch fresh data
  try {
    console.log(`Cache miss for ${endpoint}. Fetching from OJK API...`);
    const response = await fetchWithTimeout(`${OJK_API_BASE}/${endpoint}`);
    if (!response.ok) throw new Error(`OJK API Error: ${response.statusText}`);

    const json = await response.json();

    // Update cache
    ojkCache[cacheKey] = {
      data: json.data?.[endpoint] || [],
      timestamp: now,
    };

    return ojkCache[cacheKey].data;
  } catch (error) {
    console.error(`Failed to fetch ${endpoint}:`, error.message);
    // Return stale data if available, otherwise empty array
    return ojkCache[cacheKey].data || [];
  }
}

/**
 * Helper to proxy OJK requests with query params
 */
async function proxyOjkRequest(req, res, endpoint) {
  try {
    const { name, limit, offset } = req.query;
    let url = `${OJK_API_BASE}/${endpoint}`;
    const params = new URLSearchParams();

    if (name) params.append("name", name);
    if (limit) params.append("limit", limit);
    if (offset) params.append("offset", offset);
    if (params.toString()) url += "?" + params.toString();

    const response = await fetchWithTimeout(url);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error(`API /ojk/${endpoint} Error:`, error.message);
    res.status(500).json({
      error: `Gagal mengambil data ${endpoint} OJK`,
      details: error.message,
    });
  }
}

const SYSTEM_PROMPT = `Anda adalah penasihat literasi keuangan profesional di Indonesia bernama Lentera Wicaksana. 
Tugas Anda adalah menganalisis data pinjaman, menjelaskan risiko dalam Bahasa Indonesia yang sederhana, dan memberikan peringatan jika berbahaya.
Panduan:
- Nada netral, profesional, bertanggung jawab.
- Jangan mendorong pengguna untuk meminjam.
- Jangan mengarang angka.
- Fokus edukasi dan risiko.
- Jika status OJK TIDAK TERDAFTAR/ILEGAL, berikan peringatan keras.
- Batasi 200-300 kata.`;

// ===========================
// API Endpoints
// ===========================

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Backend API is running" });
});

// 1. Verify Lender (Optimized with Cache)
app.post("/api/verify-lender", async (req, res) => {
  try {
    const { lenderName } = req.body;

    if (!lenderName || typeof lenderName !== "string") {
      return res
        .status(400)
        .json({ error: "Lender name is required (string)" });
    }

    const normalizedSearch = lenderName
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");

    // Parallel fetch from cache (or API if cache empty)
    const [apps, illegals] = await Promise.all([
      getOjkDataWithCache("apps"),
      getOjkDataWithCache("illegals"),
    ]);

    // 1. Check Registered Apps
    const matchingApp = apps.find(
      (app) =>
        app.name.toLowerCase().includes(normalizedSearch) ||
        normalizedSearch.includes(app.name.toLowerCase()),
    );

    if (matchingApp) {
      return res.json({
        isRegistered: true,
        lenderName: matchingApp.name,
        owner: matchingApp.owner,
        url: matchingApp.url,
        message: "Lender terdaftar di OJK",
      });
    }

    // 2. Check Illegal List
    const matchingIllegal = illegals.find((illegal) => {
      const nameMatch =
        illegal.name.toLowerCase().includes(normalizedSearch) ||
        normalizedSearch.includes(illegal.name.toLowerCase());

      const aliasMatch =
        illegal.alias &&
        illegal.alias.some(
          (alias) =>
            alias.toLowerCase().includes(normalizedSearch) ||
            normalizedSearch.includes(alias.toLowerCase()),
        );

      return nameMatch || aliasMatch;
    });

    if (matchingIllegal) {
      return res.json({
        isRegistered: false,
        isIllegal: true,
        lenderName: matchingIllegal.name,
        message: "WARNING: Lender telah dinyatakan ILEGAL oleh OJK",
        details: matchingIllegal.description,
      });
    }

    // 3. Not Found
    return res.json({
      isRegistered: false,
      isIllegal: false,
      lenderName,
      message:
        "Lender tidak ditemukan dalam data OJK. Verifikasi lebih lanjut diperlukan.",
    });
  } catch (error) {
    console.error("API /verify-lender Error:", error.message);
    res.status(500).json({
      error: "Gagal memverifikasi lender",
      details: error.message,
    });
  }
});

app.get("/api/ojk/apps", (req, res) => proxyOjkRequest(req, res, "apps"));
app.get("/api/ojk/illegals", (req, res) =>
  proxyOjkRequest(req, res, "illegals"),
);
app.get("/api/ojk/products", (req, res) =>
  proxyOjkRequest(req, res, "products"),
);

app.get("/api/ojk/status", async (req, res) => {
  try {
    const response = await fetchWithTimeout(`${OJK_API_BASE}/status`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Gagal mengambil status OJK API" });
  }
});

// Chat Endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const { messages, temperature = 0.3 } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res
        .status(400)
        .json({ error: "Valid messages array is required" });
    }

    // Construct conversation with System Prompt
    const contents = [
      {
        role: "user",
        parts: [
          {
            text:
              SYSTEM_PROMPT +
              "\n\n---\n\nKonteks Pengguna:\n" +
              messages[0].content,
          },
        ],
      },
      ...messages.slice(1).map((msg) => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      })),
    ];

    const response = await model.generateContent({
      contents,
      generationConfig: {
        temperature: Math.max(0.1, Math.min(1, parseFloat(temperature))),
      },
    });

    res.json({
      result: response.response?.text() || "Gagal memproses penjelasan AI",
    });
  } catch (error) {
    console.error("API /chat Error:", error.message);
    res.status(500).json({ error: "Gagal memproses percakapan" });
  }
});

// Simple Text Generation
app.post("/api/generate-text", async (req, res) => {
  try {
    const { prompt, temperature = 0.3 } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    const response = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: parseFloat(temperature) },
    });

    res.json({ result: response.response?.text() || "No response" });
  } catch (error) {
    res.status(500).json({ error: "Gagal membuat teks" });
  }
});

// Multimodal Chat
app.post("/api/chat-multimodal", upload.single("file"), async (req, res) => {
  try {
    const { message, conversationHistory = "[]", temperature = 0.3 } = req.body;

    if (!message) return res.status(400).json({ error: "Message is required" });

    let history = [];
    try {
      const parsed = JSON.parse(conversationHistory);
      if (Array.isArray(parsed)) history = parsed;
    } catch (e) {
      /* ignore invalid json */
      console.error("invalid json Error:", error.message);
    }

    // Prepare current message parts
    const currentMessageParts = [{ text: message }];
    if (req.file) {
      currentMessageParts.push({
        inlineData: {
          mimeType: req.file.mimetype,
          data: req.file.buffer.toString("base64"),
        },
      });
    }

    // Construct contents: System Prompt -> History -> New Message (Text+File)
    const contents = [
      {
        role: "user",
        parts: [{ text: SYSTEM_PROMPT + "\n\n---\n\nPercakapan dimulai:" }],
      },
      ...history.map((msg) => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      })),
      {
        role: "user",
        parts: currentMessageParts,
      },
    ];

    const response = await model.generateContent({
      contents,
      generationConfig: {
        temperature: Math.max(0.1, Math.min(1, parseFloat(temperature))),
      },
    });

    const result = response.response?.text() || "Gagal memproses permintaan";

    res.json({
      result,
      conversationHistory: [
        ...history,
        { role: "user", content: message },
        { role: "assistant", content: result },
      ],
    });
  } catch (error) {
    console.error("API /chat-multimodal Error:", error.message);
    res.status(500).json({ error: "Gagal memproses permintaan multimodal" });
  }
});

// Image Generation
app.post(
  "/api/generate-from-image",
  upload.single("image"),
  async (req, res) => {
    processMediaRequest(req, res, "image", "Describe this image in detail");
  },
);

// Document Generation
app.post(
  "/api/generate-from-document",
  upload.single("document"),
  async (req, res) => {
    processMediaRequest(req, res, "document", "Summarize this document");
  },
);

// Audio Generation
app.post(
  "/api/generate-from-audio",
  upload.single("audio"),
  async (req, res) => {
    processMediaRequest(
      req,
      res,
      "audio",
      "Transcribe and summarize this audio",
    );
  },
);

/**
 * Generic handler for single-file media generation endpoints
 */
async function processMediaRequest(req, res, fieldName, defaultPrompt) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: `${fieldName} file is required` });
    }

    const { prompt = defaultPrompt } = req.body;

    // Determine mime type (handle PDF specific case if needed, otherwise use file.mimetype)
    const mimeType =
      fieldName === "document" && req.file.mimetype === "application/pdf"
        ? "application/pdf"
        : req.file.mimetype;

    const response = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: req.file.buffer.toString("base64"),
              },
            },
          ],
        },
      ],
    });

    res.json({ result: response.response?.text() || "No response generated" });
  } catch (error) {
    console.error(`API /generate-from-${fieldName} Error:`, error.message);
    res.status(500).json({
      error: `Gagal memproses ${fieldName}`,
      details: error.message,
    });
  }
}

// ===========================
// Error Handling
// ===========================
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  if (err instanceof multer.MulterError) {
    return res
      .status(400)
      .json({ error: "File upload error", details: err.message });
  }
  res.status(err.status || 500).json({ error: "Internal Server Error" });
});

app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// ===========================
// Start Server
// ===========================
app.listen(PORT, () => {
  console.log(`Backend API running on port ${PORT}`);
});

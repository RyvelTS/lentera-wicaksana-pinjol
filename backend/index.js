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
// OJK API Configuration
// ===========================
const OJK_API_BASE = "https://ojk-invest-api.vercel.app/api";
const OJK_CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 hours (as per API documentation)
let ojkAppsCache = null;
let ojkAppsCacheTime = 0;
let ojkIllegalCache = null;
let ojkIllegalCacheTime = 0;

// ===========================
// Environment Variables Check
// ===========================
if (!process.env.GEMINI_API_KEY) {
  console.error(
    "FATAL ERROR: GEMINI_API_KEY is not defined in your .env file.",
  );
  console.error("Please add it before starting the server.");
  process.exit(1);
}

const app = express();
const port = process.env.PORT || 3000;

// ===========================
// Security Middleware
// ===========================
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// ===========================
// Rate Limiting
// ===========================
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: { error: "Terlalu banyak permintaan, silakan coba lagi nanti." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", limiter);

// ===========================
// Multer Configuration (Memory Storage)
// ===========================
const upload = multer({
  storage: multer.memoryStorage(),
  // Disarankan 10MB untuk memory storage agar tidak membebani RAM server.
  // Jika memang butuh 50MB, ubah angka 10 di bawah menjadi 50.
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Allow common file types
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
// Initialize Google Generative AI Client
// ===========================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL_NAME = "gemini-2.5-flash";
console.log("GoogleGenerativeAI client initialized for model:", MODEL_NAME);
const model = genAI.getGenerativeModel({ model: MODEL_NAME });

// ===========================
// API Endpoints
// ===========================

// Health Check Endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Backend API is running" });
});

/**
 * POST /api/verify-lender
 * Verify if a lender is registered with OJK
 * Expects: { lenderName: string }
 */
app.post("/api/verify-lender", async (req, res) => {
  try {
    const { lenderName } = req.body;

    if (!lenderName || typeof lenderName !== "string") {
      return res
        .status(400)
        .json({ error: "Lender name is required (string)" });
    }

    console.log("Verifying lender:", lenderName);

    // Fetch registered apps from OJK API
    const appsResponse = await fetch(`${OJK_API_BASE}/apps`);
    if (!appsResponse.ok) {
      console.error("Failed to fetch OJK apps:", appsResponse.statusText);
      return res.status(500).json({
        error: "Gagal memeriksa data OJK",
        isRegistered: false,
        details: "OJK API tidak tersedia",
      });
    }

    const appsData = await appsResponse.json();
    const apps = appsData.data?.apps || [];

    // Normalize lender name for matching
    const normalizedSearch = lenderName
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");

    // Search for matching app (case-insensitive, partial match)
    const matchingApp = apps.find(
      (app) =>
        app.name.toLowerCase().includes(normalizedSearch) ||
        normalizedSearch.includes(app.name.toLowerCase()),
    );

    if (matchingApp) {
      console.log("Lender found in OJK registry:", matchingApp.name);
      return res.json({
        isRegistered: true,
        lenderName: matchingApp.name,
        owner: matchingApp.owner,
        url: matchingApp.url,
        message: "Lender terdaftar di OJK",
      });
    }

    // Check if lender is in illegal list
    const illegalsResponse = await fetch(`${OJK_API_BASE}/illegals`);
    if (illegalsResponse.ok) {
      const illegalsData = await illegalsResponse.json();
      const illegals = illegalsData.data?.illegals || [];

      const matchingIllegal = illegals.find(
        (illegal) =>
          illegal.name.toLowerCase().includes(normalizedSearch) ||
          normalizedSearch.includes(illegal.name.toLowerCase()) ||
          (illegal.alias &&
            illegal.alias.some(
              (alias) =>
                alias.toLowerCase().includes(normalizedSearch) ||
                normalizedSearch.includes(alias.toLowerCase()),
            )),
      );

      if (matchingIllegal) {
        console.log("Lender found in ILLEGAL list:", matchingIllegal.name);
        return res.json({
          isRegistered: false,
          isIllegal: true,
          lenderName: matchingIllegal.name,
          message: "WARNING: Lender telah dinyatakan ILEGAL oleh OJK",
          details: matchingIllegal.description,
        });
      }
    }

    console.log("Lender not found in OJK registry:", lenderName);
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

/**
 * GET /api/ojk/apps
 * Proxy to OJK API - Get registered investment apps
 * Query params: name (search), limit, offset
 */
app.get("/api/ojk/apps", async (req, res) => {
  try {
    const { name, limit, offset } = req.query;
    let url = `${OJK_API_BASE}/apps`;
    const params = new URLSearchParams();

    if (name) params.append("name", name);
    if (limit) params.append("limit", limit);
    if (offset) params.append("offset", offset);

    if (params.toString()) {
      url += "?" + params.toString();
    }

    console.log("Fetching OJK apps from:", url);
    const response = await fetch(url);
    const data = await response.json();

    res.json(data);
  } catch (error) {
    console.error("API /ojk/apps Error:", error.message);
    res.status(500).json({
      error: "Gagal mengambil data aplikasi OJK",
      details: error.message,
    });
  }
});

/**
 * GET /api/ojk/illegals
 * Proxy to OJK API - Get illegal investment products
 * Query params: name (search), limit, offset
 */
app.get("/api/ojk/illegals", async (req, res) => {
  try {
    const { name, limit, offset } = req.query;
    let url = `${OJK_API_BASE}/illegals`;
    const params = new URLSearchParams();

    if (name) params.append("name", name);
    if (limit) params.append("limit", limit);
    if (offset) params.append("offset", offset);

    if (params.toString()) {
      url += "?" + params.toString();
    }

    console.log("Fetching OJK illegals from:", url);
    const response = await fetch(url);
    const data = await response.json();

    res.json(data);
  } catch (error) {
    console.error("API /ojk/illegals Error:", error.message);
    res.status(500).json({
      error: "Gagal mengambil data produk ilegal OJK",
      details: error.message,
    });
  }
});

/**
 * GET /api/ojk/products
 * Proxy to OJK API - Get legal investment products
 * Query params: name (search), limit, offset
 */
app.get("/api/ojk/products", async (req, res) => {
  try {
    const { name, limit, offset } = req.query;
    let url = `${OJK_API_BASE}/products`;
    const params = new URLSearchParams();

    if (name) params.append("name", name);
    if (limit) params.append("limit", limit);
    if (offset) params.append("offset", offset);

    if (params.toString()) {
      url += "?" + params.toString();
    }

    console.log("Fetching OJK products from:", url);
    const response = await fetch(url);
    const data = await response.json();

    res.json(data);
  } catch (error) {
    console.error("API /ojk/products Error:", error.message);
    res.status(500).json({
      error: "Gagal mengambil data produk OJK",
      details: error.message,
    });
  }
});

/**
 * GET /api/ojk/status
 * Proxy to OJK API - Get API status
 */
app.get("/api/ojk/status", async (req, res) => {
  try {
    console.log("Fetching OJK API status...");
    const response = await fetch(`${OJK_API_BASE}/status`);
    const data = await response.json();

    res.json(data);
  } catch (error) {
    console.error("API /ojk/status Error:", error.message);
    res.status(500).json({
      error: "Gagal mengambil status OJK API",
      details: error.message,
    });
  }
});

/**
 * POST /api/chat
 * Generate AI explanation for loan analysis
 * Expects: { messages: Array<{role: string, content: string}>, temperature?: number }
 */
app.post("/api/chat", async (req, res) => {
  try {
    const { messages, temperature = 0.3 } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Messages array is required" });
    }

    if (messages.length === 0) {
      return res.status(400).json({ error: "Messages array cannot be empty" });
    }

    console.log("Chat request received with", messages.length, "message(s)");

    // System Prompt for Financial Advisory Compliance
    const systemPrompt = `Anda adalah penasihat literasi keuangan profesional di Indonesia bernama Lentera Wicaksana. 
Tugas Anda adalah menganalisis data pinjaman yang diberikan, menjelaskan risikonya dalam Bahasa Indonesia yang sederhana dan mudah dipahami, dan memberikan peringatan yang jelas jika pinjaman tersebut berbahaya. 

Panduan Anda:
- Gunakan nada yang netral, profesional, dan bertanggung jawab
- Jangan pernah mendorong pengguna untuk meminjam
- Jangan mengarang atau mengubah angka-angka numerik yang diberikan
- Fokus pada edukasi dan risiko
- Jika status OJK adalah TIDAK TERDAFTAR atau risikonya tinggi, berikan peringatan keras
- Gunakan Bahasa Indonesia yang jelas dan standar
- Batasi penjelasan hingga 200-300 kata
- Berikan saran praktis untuk keputusan finansial yang lebih baik`;

    // Build conversation array with system instruction prepended
    const contents = [
      {
        role: "user",
        parts: [{ text: systemPrompt + "\n\n---\n\n" + messages[0].content }],
      },
      ...messages.slice(1).map((msg) => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      })),
    ];

    console.log("Sending request to Gemini API...");
    const response = await model.generateContent({
      contents,
      generationConfig: {
        temperature: Math.max(0.1, Math.min(1, parseFloat(temperature))),
        // No output limit - allow full responses
      },
    });

    const result = response.response?.text() || "Gagal memproses penjelasan AI";

    console.log("AI response received successfully");
    res.json({ result });
  } catch (error) {
    console.error("API /chat Error:", error.message);
    res.status(500).json({
      error: "Gagal memproses percakapan",
      details: error.message,
    });
  }
});

/**
 * POST /api/generate-text
 * Simple text generation endpoint
 * Expects: { prompt: string, temperature?: number }
 */
app.post("/api/generate-text", async (req, res) => {
  try {
    const { prompt, temperature = 0.3 } = req.body;

    if (!prompt || typeof prompt !== "string") {
      return res
        .status(400)
        .json({ error: "Prompt is required and must be a string" });
    }

    const response = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: Math.max(0.1, Math.min(1, parseFloat(temperature))),
      },
    });

    const result = response.response?.text() || "No response generated";

    res.json({ result });
  } catch (error) {
    console.error("API /generate-text Error:", error.message);
    res.status(500).json({
      error: "Gagal membuat teks",
      details: error.message,
    });
  }
});

/**
 * POST /api/chat-multimodal
 * Multimodal chat with file upload support
 * Accepts text messages, images, documents, and audio
 * Expects: multipart/form-data with:
 *   - message: text message (required)
 *   - conversationHistory: JSON string of previous messages
 *   - file: optional file (image/document/audio)
 *   - temperature: optional temperature setting
 */
app.post("/api/chat-multimodal", upload.single("file"), async (req, res) => {
  try {
    const { message, conversationHistory = "[]", temperature = 0.3 } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required" });
    }

    console.log("Multimodal chat request received");

    // Parse conversation history
    let history = [];
    try {
      history = JSON.parse(conversationHistory);
      if (!Array.isArray(history)) history = [];
    } catch (e) {
      console.log("Invalid conversation history, starting fresh");
    }

    // Build message parts (text + optional file)
    const messageParts = [{ text: message }];

    if (req.file) {
      console.log("File attached:", req.file.originalname, req.file.mimetype);
      const base64Data = req.file.buffer.toString("base64");

      messageParts.push({
        inlineData: {
          mimeType: req.file.mimetype,
          data: base64Data,
        },
      });
    }

    // System Prompt for Financial Advisory
    const systemPrompt = `Anda adalah penasihat literasi keuangan profesional di Indonesia bernama Lentera Wicaksana. 
Tugas Anda adalah menganalisis data pinjaman yang diberikan, menjelaskan risikonya dalam Bahasa Indonesia yang sederhana dan mudah dipahami, dan memberikan peringatan yang jelas jika pinjaman tersebut berbahaya.

Jika pengguna mengunggah file (gambar, dokumen, atau audio), analisis konten tersebut dalam konteks keuangan dan pinjaman.

Panduan Anda:
- Gunakan nada yang netral, profesional, dan bertanggung jawab
- Jangan pernah mendorong pengguna untuk meminjam
- Jangan mengarang atau mengubah angka-angka numerik yang diberikan
- Fokus pada edukasi dan risiko
- Jika status OJK adalah TIDAK TERDAFTAR atau risikonya tinggi, berikan peringatan keras
- Gunakan Bahasa Indonesia yang jelas dan standar
- Berikan saran praktis untuk keputusan finansial yang lebih baik`;

    // Build contents array with system prompt + history + current message
    const contents = [
      {
        role: "user",
        parts: [
          {
            text: systemPrompt + "\n\n---\n\nPercakapan dimulai:\n\n" + message,
          },
        ],
      },
      ...history.map((msg) => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      })),
      {
        role: "user",
        parts: messageParts,
      },
    ];

    console.log("Sending multimodal request to Gemini API...");
    const response = await model.generateContent({
      contents,
      generationConfig: {
        temperature: Math.max(0.1, Math.min(1, parseFloat(temperature))),
      },
    });

    const result =
      response.response?.text() || "Gagal memproses permintaan multimodal";

    console.log("Multimodal response received successfully");
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
    res.status(500).json({
      error: "Gagal memproses permintaan multimodal",
      details: error.message,
    });
  }
});

/**
 * POST /api/generate-from-image
 * Generate content from image file
 * Expects: multipart/form-data with 'image' field
 */
app.post(
  "/api/generate-from-image",
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Image file is required" });
      }

      const { prompt = "Describe this image in detail" } = req.body;
      const base64Image = req.file.buffer.toString("base64");

      const response = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: req.file.mimetype,
                  data: base64Image,
                },
              },
            ],
          },
        ],
        generationConfig: {
          // No output limit - allow full responses
        },
      });

      const result = response.response?.text() || "No response generated";

      res.json({ result });
    } catch (error) {
      console.error("API /generate-from-image Error:", error.message);
      res.status(500).json({
        error: "Gagal memproses gambar",
        details: error.message,
      });
    }
  },
);

/**
 * POST /api/generate-from-document
 * Generate content from document file (PDF/TXT)
 * Expects: multipart/form-data with 'document' field
 */
app.post(
  "/api/generate-from-document",
  upload.single("document"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Document file is required" });
      }

      const { prompt = "Summarize this document" } = req.body;
      const base64Document = req.file.buffer.toString("base64");

      const response = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType:
                    req.file.mimetype === "application/pdf"
                      ? "application/pdf"
                      : "text/plain",
                  data: base64Document,
                },
              },
            ],
          },
        ],
        generationConfig: {
          // No output limit - allow full responses
        },
      });

      const result = response.response?.text() || "No response generated";

      res.json({ result });
    } catch (error) {
      console.error("API /generate-from-document Error:", error.message);
      res.status(500).json({
        error: "Gagal memproses dokumen",
        details: error.message,
      });
    }
  },
);

/**
 * POST /api/generate-from-audio
 * Generate content from audio file
 * Expects: multipart/form-data with 'audio' field
 */
app.post(
  "/api/generate-from-audio",
  upload.single("audio"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Audio file is required" });
      }

      const { prompt = "Transcribe and summarize this audio" } = req.body;
      const base64Audio = req.file.buffer.toString("base64");

      const response = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: req.file.mimetype,
                  data: base64Audio,
                },
              },
            ],
          },
        ],
        generationConfig: {
          // No output limit - allow full responses
        },
      });

      const result = response.response?.text() || "No response generated";

      res.json({ result });
    } catch (error) {
      console.error("API /generate-from-audio Error:", error.message);
      res.status(500).json({
        error: "Gagal memproses audio",
        details: error.message,
      });
    }
  },
);

// ===========================
// Error Handling Middleware
// ===========================
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);

  // Catch multer errors (file too large or invalid format)
  if (err instanceof multer.MulterError) {
    return res
      .status(400)
      .json({ error: "File upload error", details: err.message });
  }

  res.status(err.status || 500).json({
    error: "Internal Server Error",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "An error occurred",
  });
});

// ===========================
// 404 Handler
// ===========================
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// ===========================
// Start Server
// ===========================
app.listen(port, () => {
  console.log(`Backend API running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`Ready to accept requests on http://localhost:${port}`);
});

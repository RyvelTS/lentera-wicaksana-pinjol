# Product Requirements Document (PRD): Multimodal AI Chatbot Integration

### 1. Project Objective

The technical objective is to develop a **RESTful API** using **ExpressJS** that integrates with the **Google Gemini 2.5 Flash** model to process natural language and multimodal inputs. The system must function as a **middleware** between client requests and the Gemini AI API, enabling real-time, context-aware responses.

### 2. Technical Stack

| Component              | Technology              | Version       | Purpose                                |
| ---------------------- | ----------------------- | ------------- | -------------------------------------- |
| **Runtime**            | Node.js                 | 18 or higher. | JavaScript runtime environment         |
| **Backend Framework**  | ExpressJS               | 4.x+          | REST API development                   |
| **Frontend Framework** | Angular                 | 21.x          | Client-side UI and state management    |
| **AI Engine**          | Google Gemini           | 2.5 Flash     | Multimodal AI processing               |
| **AI SDK**             | @google/genai           | Latest        | Google's official GenAI package        |
| **File Upload**        | Multer                  | 1.4.5-lts+    | multipart/form-data handling           |
| **HTTP Client**        | Angular HttpClient      | -             | Frontend-to-backend communication      |
| **Security**           | CORS, Rate Limiting     | -             | Cross-origin & request protection      |
| **Environment**        | dotenv                  | -             | Secure API key storage                 |
| **Testing**            | Vitest                  | -             | Frontend unit testing                  |
| **Containerization**   | Docker + Docker Compose | Latest        | Container deployment and orchestration |

### 3. Functional Requirements (API Architecture)

The backend must expose specific endpoints to handle various input modalities, processing files through **memory buffers** and converting them to **Base64** for Gemini compatibility.

#### 3.1 Text Processing (`/generate-text`)

- Accepts text-based prompts via `req.body`.
- Utilizes the `generateContent()` method to return AI-generated text in JSON format.

#### 3.2 Multimodal Processing

- **Images (`/generate-from-image`):** Handles uploads via Multer; converts image buffers to Base64 to build multimodal inputs for visual description.
- **Documents (`/generate-from-document`):** Processes PDF or TXT files; converts to Base64 to generate summaries or data analysis.
- **Audio (`/generate-from-audio`):** Accepts MP3 or WAV files; converts to Base64 to provide transcriptions or audio analysis.

#### 3.3 Conversational Logic (`/api/chat`)

- Supports **multi-turn conversations** by receiving an array of messages representing the conversation history.
- Must implement **System Instructions** to define the AI's persona, tone (formal/casual), and operational constraints.
- Configurable creative parameters, specifically **Temperature** (e.g., 0.9), to control response randomness.

### 4. System Architecture & Project Structure

The project must follow a specific directory layout to separate frontend assets from backend logic.

#### 4.1 Directory Layout

- `/public`: Contains static frontend files (**index.html**, **script.js**, **style.css**).
- `/uploads`: Managed automatically by Multer for temporary multimodal file processing.
- **index.js**: The central controller initializing Express, CORS, and the Gemini AI client.
- **.env**: Storage for the `GEMINI_API_KEY`.
- **package.json**: Must include `"type": "module"` to enable ES Modules syntax (`import`/`export`).

#### 4.2 Frontend Logic

- Must implement a loading state (e.g., "Thinking...") during asynchronous API calls.
- Uses `POST` methods to send JSON payloads to backend endpoints.

### 5. Security & Submission Standards

- **Credential Protection:** Sensitive keys must be stored in a `.env` file and **never** hardcoded.
- **Version Control:** A `.gitignore` file must be implemented to exclude `node_modules/`, `package-lock.json`, and `.env` from public repositories.
- **Deliverables:**
  1.  A link to the public or private **GitHub Repository**.
  2.  **Screenshots** of the functional User Interface.

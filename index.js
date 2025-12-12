require("dotenv").config();
const express = require("express");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
const controller = require("./src/controller");
const cors = require("cors");
const swaggerDocument = YAML.load("./swagger.yaml");

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
      .map((o) => o.trim())
      .filter(Boolean)
  : [];
const allowAllOrigins =
  process.env.ALLOWED_ORIGINS === "*" || allowedOrigins.length === 0;

const corsOptions = {
  origin: function (origin, callback) {
    // Log origin to help debugging CORS issues
    console.log("CORS check for origin:", origin);
    if (!origin || allowAllOrigins) {
      callback(null, true);
      return;
    }
    // Allow exact matches and allow if PUBLIC_API_URL matches (swagger served from same host)
    const publicUrl = process.env.PUBLIC_API_URL;
    if (
      allowedOrigins.includes(origin) ||
      (publicUrl && origin === publicUrl) ||
      allowedOrigins.some((o) => origin.endsWith(o))
    ) {
      callback(null, true);
    } else {
      console.warn("Bloqueado por CORS policy:", origin);
      callback(new Error("Acesso bloqueado por CORS policy"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

const app = express();
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));
app.use(cors(corsOptions));
app.use(express.static("public")); // Serve arquivos estáticos do frontend

try {
  const serverUrl = process.env.PUBLIC_API_URL;

  if (serverUrl) {
    swaggerDocument.servers = [
      {
        url: serverUrl,
        description: "Servidor de Produção (Render)",
      },
    ];
    console.log(`Swagger configurado para: ${serverUrl}`);
  }

  app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} catch (e) {
  console.log("Swagger não configurado ou arquivo não encontrado.", e.message);
}

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date(),
  });
});

app.get("/api-docs.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerDocument);
});

app.post("/generate-pdf", controller.generatePdf);

// Endpoint para upload de imagens (multipart/form-data)
const fs = require("fs");
const path = require("path");
const multer = require("multer");

// cria diretório de uploads se não existir
const uploadsDir = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

app.post("/upload-image", upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });
  const publicUrl = `${req.protocol}://${req.get("host")}/uploads/${
    req.file.filename
  }`;
  res.json({ url: publicUrl });
});

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`Serviço rodando na porta ${PORT}`);
  console.log(`Documentação: http://localhost:${PORT}/docs`);
  console.log(`Health Check: http://localhost:${PORT}/health`);
});

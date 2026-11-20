
const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const swaggerUi = require("swagger-ui-express");

const { pool } = require("./db");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const clientRoutes = require("./routes/clients");
const contractRoutes = require("./routes/contracts");
const auditRoutes = require("./routes/audit");
const empresasRoutes = require("./routes/empresas");
const rolesRoutes = require("./routes/roles");
const empresaUsuariosRoutes = require("./routes/empresa_usuarios");
const metricasRoutes = require("./routes/metricas");

const app = express();

// Ocultar información tecnológica de Express.
app.disable("x-powered-by");

// Cabeceras de seguridad.
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  next();
});

// Configuración CORS: permitir únicamente el frontend de Atlas.
app.use(cors({
  origin: "http://localhost:3350",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204
}));

app.use(express.json());
app.use(morgan("dev"));

// Crear directorio para archivos de contratos.
const uploadsDir = path.join(
  __dirname,
  "..",
  "uploads",
  "contracts"
);

fs.mkdirSync(uploadsDir, { recursive: true });

// Rutas de la API.
app.use("/autenticacion", authRoutes);
app.use("/usuarios", userRoutes);
app.use("/clientes", clientRoutes);
app.use("/contratos", contractRoutes);
app.use("/auditoria", auditRoutes);
app.use("/empresas", empresasRoutes);
app.use("/roles", rolesRoutes);
app.use("/empresa-usuarios", empresaUsuariosRoutes);
app.use("/metricas", metricasRoutes);

// Documentación de la API.
const openapi = require("./openapi.json");

app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapi));

app.get("/openapi.json", (req, res) => {
  res.json(openapi);
});

// Archivos de contratos.
app.use("/files/contracts", express.static(uploadsDir));

// Ruta principal.
app.get("/", (req, res) => {
  res.json({
    name: "Atlas",
    status: "ok"
  });
});

// Iniciar servidor.
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Atlas API escuchando en puerto ${PORT}`);
});

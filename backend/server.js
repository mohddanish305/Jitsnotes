import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import adminRoutes from "./routes/admin.routes.js";
import publicRoutes from "./routes/public.routes.js";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware.js";
import { logger } from "./utils/logger.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("combined"));

app.get("/health", (_req, res) => {
  res.json({ success: true, message: "JitsNotes backend is running" });
});

app.use("/api", publicRoutes);
app.use("/api/admin", adminRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.port, () => {
  logger.info(`Server running on port ${env.port} (${env.nodeEnv})`);
});


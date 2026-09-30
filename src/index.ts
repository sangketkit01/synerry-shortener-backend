import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { rootRouter } from "./routes";
import { publicRouter } from "./routes/public-route";
import { apiLimiter } from "./middlewares/rate-limit.middleware";

const app = express();

// Middlewares
app.use(
  cors({
    origin: [env.FRONTEND_URL, "http://localhost:3000"],
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply rate limiter to API routes
app.use("/api/v1", apiLimiter, rootRouter);

// Direct root redirection route (e.g. domain/s/:shortCode)
app.use("/", publicRouter);

// Start server
app.listen(env.PORT, () => {
  console.log(`[Backend API] Running on port ${env.PORT} in ${env.NODE_ENV} mode`);
});

export default app;

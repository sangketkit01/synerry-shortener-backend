import { Router } from "express";
import { redirectLimiter } from "../middlewares/rate-limit.middleware";

export const publicRouter = Router();

// Base public health check
publicRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Short URL redirection placeholder (high-throughput route)
publicRouter.get("/s/:shortCode", redirectLimiter, (req, res) => {
  const { shortCode } = req.params;
  // Redirection business logic will be implemented here
  res.json({ message: "Redirect endpoint", shortCode });
});

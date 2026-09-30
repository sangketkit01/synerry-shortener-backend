import { Router } from "express";
import { UrlController } from "../controllers/url.controller";
import { redirectLimiter } from "../middlewares/rate-limit.middleware";

export const publicRouter = Router();

// Base public health check
publicRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Guest URL shortening
publicRouter.post("/shorten", UrlController.create);

// High-speed short URL redirection (e.g. /s/:shortCode)
publicRouter.get("/s/:shortCode", redirectLimiter, UrlController.redirect);

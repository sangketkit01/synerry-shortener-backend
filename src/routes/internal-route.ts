import { Router, Request, Response, NextFunction } from "express";
import { env } from "../config/env";

export const internalRouter = Router();

// Internal middleware guarding against unauthorized extraction
function requireInternalKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers["x-internal-key"];
  if (!apiKey || apiKey !== env.INTERNAL_PIPELINE_KEY) {
    res.status(403).json({ success: false, message: "Forbidden: Invalid internal key" });
    return;
  }
  next();
}

internalRouter.use(requireInternalKey);

// Endpoint for Python ETL service to pull raw clicks
internalRouter.get("/clicks/raw", (_req, res) => {
  res.json({ message: "Raw clicks extraction placeholder", events: [] });
});

import { Router, Request, Response } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { prisma } from "../config/prisma";
import { env } from "../config/env";

export const analyticsRouter = Router();

const ANALYTICS_SERVICE_URL = process.env.ANALYTICS_SERVICE_URL || "http://localhost:8000";

// Protect all analytics routes with authentication
analyticsRouter.use(authenticate);

/**
 * Validates ownership of URL if requested by a standard user.
 */
async function verifyUrlOwnership(
  userId: string,
  role: string,
  shortCode?: string,
  urlId?: string
): Promise<boolean> {
  if (role === "ADMIN") return true;

  if (shortCode) {
    const url = await prisma.url.findFirst({
      where: { shortCode, userId, deletedAt: null },
    });
    return !!url;
  }

  if (urlId) {
    const url = await prisma.url.findFirst({
      where: { id: urlId, userId, deletedAt: null },
    });
    return !!url;
  }

  return true;
}

/**
 * Proxy helper to forward authorized requests to FastAPI Analytics microservice.
 */
async function forwardToAnalytics(req: Request, res: Response, endpoint: string) {
  try {
    const user = req.user!;
    const shortCode = req.query.short_code as string | undefined;
    const urlId = req.query.url_id as string | undefined;

    // Verify ownership to completely eliminate IDOR
    const isOwner = await verifyUrlOwnership(user.userId, user.role, shortCode, urlId);
    if (!isOwner) {
      res.status(403).json({
        success: false,
        message: "Forbidden: You do not have permission to view analytics for this URL.",
      });
      return;
    }

    const queryParams = new URLSearchParams(req.query as Record<string, string>);

    // If standard user, enforce user_id scoping to prevent system-wide data leak
    if (user.role !== "ADMIN") {
      queryParams.set("user_id", user.userId);
    }

    const targetUrl = `${ANALYTICS_SERVICE_URL}/api/v1/analytics/${endpoint}?${queryParams.toString()}`;

    const forwardHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "x-internal-key": env.INTERNAL_PIPELINE_KEY,
    };
    if (user.role === "ADMIN") {
      forwardHeaders["x-admin-request"] = "true";
    }

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
    });

    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("text/csv")) {
      const contentDisposition = response.headers.get("content-disposition");
      if (contentDisposition) {
        res.setHeader("Content-Disposition", contentDisposition);
      }
      res.setHeader("Content-Type", "text/csv");
      const text = await response.text();
      res.status(response.status).send(text);
      return;
    }

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error: any) {
    console.error(`[Analytics Gateway Error on /${endpoint}]:`, error);
    res.status(502).json({
      success: false,
      message: "Analytics service unavailable or unreachable",
    });
  }
}

// Analytics endpoints
analyticsRouter.get("/summary", (req, res) => forwardToAnalytics(req, res, "summary"));
analyticsRouter.get("/breakdown", (req, res) => forwardToAnalytics(req, res, "breakdown"));
analyticsRouter.get("/export", (req, res) => forwardToAnalytics(req, res, "export"));
analyticsRouter.get("/recent-clicks", (req, res) => forwardToAnalytics(req, res, "recent-clicks"));

// Pipeline monitoring endpoints (Administrator only)
analyticsRouter.get("/pipeline/status", async (req, res) => {
  if (req.user?.role !== "ADMIN") {
    res.status(403).json({ success: false, message: "Forbidden: Admin role required" });
    return;
  }

  try {
    const response = await fetch(`${ANALYTICS_SERVICE_URL}/api/v1/analytics/pipeline/status`);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error: any) {
    res.status(502).json({ success: false, message: "Failed to fetch pipeline status" });
  }
});

// On-demand pipeline trigger (Only accessible by Administrator)
analyticsRouter.post("/pipeline/trigger", async (req, res) => {
  if (req.user?.role !== "ADMIN") {
    res.status(403).json({ success: false, message: "Forbidden: Admin role required" });
    return;
  }

  try {
    const response = await fetch(`${ANALYTICS_SERVICE_URL}/api/v1/analytics/pipeline/trigger`, {
      method: "POST",
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error: any) {
    res.status(502).json({ success: false, message: "Failed to trigger pipeline" });
  }
});

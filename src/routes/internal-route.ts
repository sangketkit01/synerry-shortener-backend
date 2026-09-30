import { Router, Request, Response, NextFunction } from "express";
import { env } from "../config/env";
import { prisma } from "../config/prisma";

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

// Endpoint for Python ETL service to pull unprocessed raw clicks
internalRouter.get("/clicks/raw", async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(1000, Math.max(1, parseInt((req.query.limit as string) || "500", 10)));

    const clicks = await prisma.rawClick.findMany({
      where: { isProcessed: false },
      take: limit,
      orderBy: { clickedAt: "asc" },
      include: {
        url: {
          select: {
            id: true,
            originalUrl: true,
            shortCode: true,
            customAlias: true,
            userId: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      count: clicks.length,
      clicks,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to extract raw clicks",
    });
  }
});

// Endpoint for Python ETL service to mark processed clicks
internalRouter.post("/clicks/mark-processed", async (req: Request, res: Response): Promise<void> => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ success: false, message: "ids array is required" });
      return;
    }

    const result = await prisma.rawClick.updateMany({
      where: { id: { in: ids } },
      data: { isProcessed: true },
    });

    res.status(200).json({
      success: true,
      updatedCount: result.count,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to mark clicks processed",
    });
  }
});

import { Request, Response, NextFunction } from "express";

export function requireRole(...allowedRoles: ("USER" | "ADMIN")[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: "Forbidden: You do not have permission to access this resource",
      });
      return;
    }

    next();
  };
}

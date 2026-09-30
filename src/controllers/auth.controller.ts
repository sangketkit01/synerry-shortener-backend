import { Request, Response } from "express";
import { z } from "zod";
import { AuthService } from "../services/auth.service";

const registerSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export class AuthController {
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || "Validation error" });
        return;
      }

      const ipAddress = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress;
      const userAgent = req.headers["user-agent"];

      const result = await AuthService.register(parsed.data.email, parsed.data.password, ipAddress, userAgent);

      // Set Refresh Token in HttpOnly cookie
      res.cookie("refreshToken", result.refreshToken, COOKIE_OPTIONS);

      res.status(201).json({
        success: true,
        message: "Registration successful",
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || "Registration failed" });
    }
  }

  static async login(req: Request, res: Response): Promise<void> {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || "Validation error" });
        return;
      }

      const ipAddress = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress;
      const userAgent = req.headers["user-agent"];

      const result = await AuthService.login(parsed.data.email, parsed.data.password, ipAddress, userAgent);

      // Set Refresh Token in HttpOnly cookie
      res.cookie("refreshToken", result.refreshToken, COOKIE_OPTIONS);

      res.status(200).json({
        success: true,
        message: "Login successful",
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      });
    } catch (error: any) {
      const statusCode = error.statusCode || 401;
      res.status(statusCode).json({ success: false, message: error.message || "Authentication failed" });
    }
  }

  static async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const token = req.cookies?.refreshToken || req.body?.refreshToken;
      if (!token) {
        res.status(401).json({ success: false, message: "Refresh token missing" });
        return;
      }

      const ipAddress = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress;
      const userAgent = req.headers["user-agent"];

      const result = await AuthService.rotateRefreshToken(token, ipAddress, userAgent);

      // Set rotated new Refresh Token cookie
      res.cookie("refreshToken", result.refreshToken, COOKIE_OPTIONS);

      res.status(200).json({
        success: true,
        message: "Token refreshed successfully",
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      });
    } catch (error: any) {
      res.clearCookie("refreshToken", COOKIE_OPTIONS);
      const statusCode = error.statusCode || 401;
      res.status(statusCode).json({ success: false, message: error.message || "Token refresh failed" });
    }
  }

  static async logout(req: Request, res: Response): Promise<void> {
    try {
      const token = req.cookies?.refreshToken || req.body?.refreshToken;
      await AuthService.logout(token);
      res.clearCookie("refreshToken", COOKIE_OPTIONS);
      res.status(200).json({ success: true, message: "Logged out successfully" });
    } catch (error: any) {
      res.status(500).json({ success: false, message: "Logout failed" });
    }
  }

  static async me(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const user = await AuthService.getUserProfile(req.user.userId);
      res.status(200).json({ success: true, data: { user } });
    } catch (error: any) {
      res.status(404).json({ success: false, message: error.message || "User not found" });
    }
  }
}

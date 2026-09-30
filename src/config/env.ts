import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default("5000").transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid connection string"),
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters long for security"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  INTERNAL_PIPELINE_KEY: z.string().min(16, "INTERNAL_PIPELINE_KEY is required"),
  FRONTEND_URL: z.string().default("http://localhost:3000"),
  ANALYTICS_SERVICE_URL: z
    .string()
    .default(
      process.env.NODE_ENV === "production"
        ? "http://analytics-service:8000"
        : "http://127.0.0.1:8000"
    ),
});

export const env = envSchema.parse(process.env);

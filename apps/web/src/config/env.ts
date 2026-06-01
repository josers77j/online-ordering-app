import { z } from "zod";

const envSchema = z.object({
  VITE_API_BASE_URL: z.url(
    "La variable VITE_API_BASE_URL debe ser una URL valida",
  ),
});

const result = envSchema.safeParse(import.meta.env);

if (!result.success) throw new Error("Variables de entorno invalidas");

export const API_BASE = result.data.VITE_API_BASE_URL;

import z from "zod";

export class EnvironmentValidation {
  static envSchema = z.object({
    NODE_ENV: z.string().default("development"),
    APPLICATION_PORT: z.coerce.number().default(3001),
    APPLICATION_HOST: z.string().default("127.0.0.1"),
    DB_HOST: z.string(),
    DB_PORT: z.coerce.number(),
    DB_USERNAME: z.string(),
    DB_PASSWORD: z.string(),
    DB_NAME: z.string(),
    INVENTORY_URL: z.string().url({
      message: "INVENTORY_URL harus berupa URL yang valid",
    }),
    // Sisa autentikasi RS256 lama; JWT kini HS256 dengan SECRET_KEY (authorization-sdk), jadi opsional.
    PUBLIC_KEY: z.string().optional(),
    PRIVATE_KEY: z.string().optional(),
  });
}
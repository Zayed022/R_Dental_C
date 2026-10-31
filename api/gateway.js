import { app, ensureDatabase } from "../server/index.js";

export default async function handler(req, res) {
  try {
    // Vercel will pass the original API path through this query parameter.
    const incoming = new URL(
      req.url || "/",
      `https://${req.headers.host || "localhost"}`
    );

    const apiPath = incoming.searchParams.get("__api_path");

    if (!apiPath) {
      return res.status(400).json({
        error: "Missing API route path."
      });
    }

    const cleanPath = apiPath.replace(/^\/+/, "");

    if (
      !cleanPath ||
      cleanPath.split("/").some(segment => segment === "..")
    ) {
      return res.status(400).json({
        error: "Invalid API route path."
      });
    }

    // Preserve regular query parameters, such as ?date=... or ?doctorId=...
    incoming.searchParams.delete("__api_path");

    const query = incoming.searchParams.toString();

    // Restore the original /api/... path before handing it to Express.
    req.url = `/api/${cleanPath}${query ? `?${query}` : ""}`;

    await ensureDatabase();

    return app(req, res);
  } catch (error) {
    console.error(
      "[API gateway]",
      error?.message || "Unknown API startup error"
    );

    if (!res.headersSent) {
      return res.status(503).json({
        error: "The clinic service is temporarily unavailable.",
        code: "CLINIC_API_UNAVAILABLE"
      });
    }
  }
}
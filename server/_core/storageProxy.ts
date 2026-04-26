import type { Express } from "express";
import { storageGetSignedUrl } from "../storage";

export function registerStorageProxy(app: Express) {
  // Keep /manus-storage/* for backward compatibility with existing saved URLs,
  // but serve files from Cloudflare R2 instead of Manus Forge.
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as unknown as { [k: string]: string })[0];

    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    try {
      const url = await storageGetSignedUrl(key);
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] R2 failed:", err);
      res.status(502).send(
        err instanceof Error ? err.message : "Storage proxy error",
      );
    }
  });
}

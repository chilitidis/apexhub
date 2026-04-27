import type { Express } from "express";
import { storageConfigured, storageGetSignedUrl } from "../storage";

export function registerStorageProxy(app: Express) {
  // Keep /manus-storage/* for backward compatibility with existing saved URLs.
  // When R2 is configured, redirect to a signed URL; otherwise return a clean
  // 404 so the UI simply shows the broken-thumbnail fallback instead of the
  // scary 502 `Screenshot storage is not configured` message that surfaced in
  // production toasts.
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as unknown as { [k: string]: string })[0];

    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    if (!storageConfigured()) {
      // Legacy URL referencing an object that was never persisted (because the
      // scanner now uses inline data URLs). Respond 404 quietly.
      res.set("Cache-Control", "no-store");
      res.status(404).end();
      return;
    }

    try {
      const url = await storageGetSignedUrl(key);
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] signed URL failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

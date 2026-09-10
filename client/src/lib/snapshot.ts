/**
 * snapshot.ts — capture a live DOM node into a styled PNG blob.
 *
 * html2canvas re-applies the page's stylesheets inside its cloned iframe,
 * which breaks with Tailwind v4 (@layer + oklch) and cross-origin font CSS —
 * the capture came out completely unstyled. The fix: before rendering, walk
 * the clone and inline every node's COMPUTED style (already resolved to
 * plain rgb()/px values by the browser), so the capture never needs to read
 * a stylesheet at all.
 */
import html2canvas from "html2canvas-pro";

function inlineComputedStyles(source: Element, target: Element) {
  if (target instanceof HTMLElement || target instanceof SVGElement) {
    const cs = window.getComputedStyle(source);
    let css = "";
    for (let i = 0; i < cs.length; i += 1) {
      const prop = cs[i];
      css += `${prop}:${cs.getPropertyValue(prop)};`;
    }
    target.setAttribute("style", css);
  }
  const sc = source.children;
  const tc = target.children;
  for (let i = 0; i < sc.length && i < tc.length; i += 1) {
    inlineComputedStyles(sc[i], tc[i]);
  }
}

export async function captureNodeToBlob(node: HTMLElement): Promise<Blob> {
  const canvas = await html2canvas(node, {
    backgroundColor: "#0A1628",
    scale: 2,
    useCORS: true,
    allowTaint: false,
    logging: false,
    imageTimeout: 4000,
    onclone: (_doc, cloned) => {
      inlineComputedStyles(node, cloned);
    },
  });
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))),
      "image/png",
      0.95,
    );
  });
}

// @vitest-environment jsdom
import React from "react";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ThemeProvider, useTheme } from "./ThemeContext";

// Silence unused-React warning under classic runtime; tsx tests run through
// esbuild and need the explicit import for JSX.
void React;

function Probe({
  onReady,
}: {
  onReady: (api: ReturnType<typeof useTheme>) => void;
}) {
  const api = useTheme();
  onReady(api);
  return null;
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove("dark", "light");
  });
  afterEach(() => {
    document.documentElement.classList.remove("dark", "light");
  });

  it("applies the default theme class on mount when switchable", () => {
    render(
      <ThemeProvider defaultTheme="dark" switchable>
        <Probe onReady={() => undefined} />
      </ThemeProvider>,
    );
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("exposes a toggleTheme that flips dark <-> light", () => {
    let captured: ReturnType<typeof useTheme> | null = null;
    render(
      <ThemeProvider defaultTheme="dark" switchable>
        <Probe onReady={(x) => (captured = x)} />
      </ThemeProvider>,
    );
    expect(captured).not.toBeNull();
    expect(captured!.toggleTheme).toBeTypeOf("function");

    act(() => captured!.toggleTheme!());
    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    act(() => captured!.toggleTheme!());
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("persists theme changes to localStorage when switchable", () => {
    let captured: ReturnType<typeof useTheme> | null = null;
    render(
      <ThemeProvider defaultTheme="dark" switchable>
        <Probe onReady={(x) => (captured = x)} />
      </ThemeProvider>,
    );
    act(() => captured!.toggleTheme!());
    expect(window.localStorage.getItem("theme")).toBe("light");
  });

  it("does not expose toggleTheme when not switchable", () => {
    let captured: ReturnType<typeof useTheme> | null = null;
    render(
      <ThemeProvider defaultTheme="dark">
        <Probe onReady={(x) => (captured = x)} />
      </ThemeProvider>,
    );
    expect(captured!.toggleTheme).toBeUndefined();
  });
});

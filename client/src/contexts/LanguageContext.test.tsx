// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <LanguageProvider>{children}</LanguageProvider>
);

describe("LanguageContext", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to English", () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });
    expect(result.current.lang).toBe("en");
  });

  it("persists a language change to localStorage", () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });
    act(() => result.current.setLang("el"));
    expect(result.current.lang).toBe("el");
    expect(localStorage.getItem("utj_lang")).toBe("el");
  });

  it("reads the persisted language on mount", () => {
    localStorage.setItem("utj_lang", "el");
    const { result } = renderHook(() => useLanguage(), { wrapper });
    expect(result.current.lang).toBe("el");
  });

  it("toggles between en and el", () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });
    act(() => result.current.toggleLang());
    expect(result.current.lang).toBe("el");
    act(() => result.current.toggleLang());
    expect(result.current.lang).toBe("en");
  });

  it("translates via the t() helper for the active language", () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });
    expect(result.current.t("nav.pricing")).toBe("Pricing");
    act(() => result.current.setLang("el"));
    expect(result.current.t("nav.pricing")).toBe("Τιμές");
  });
});

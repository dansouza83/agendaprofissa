"use client";

import { useLayoutEffect } from "react";

export function LandingMotion() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const elements = Array.from(document.querySelectorAll<HTMLElement>(".landing [data-reveal]"));

    if (reduceMotion || !("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("is-visible"));
      return;
    }

    root.classList.add("landing-motion-ready");
    elements.forEach((element) => {
      const delay = Math.min(Math.max(Number(element.dataset.revealDelay ?? 0), 0), 6);
      element.style.setProperty("--reveal-delay", `${delay * 70}ms`);
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        (entry.target as HTMLElement).classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -9%", threshold: 0.12 });

    elements.forEach((element) => observer.observe(element));
    return () => {
      observer.disconnect();
      root.classList.remove("landing-motion-ready");
    };
  }, []);

  return null;
}

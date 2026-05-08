"use client";

import { useEffect } from "react";

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function findCardContainer(element: HTMLElement) {
  let current: HTMLElement | null = element;

  for (let depth = 0; depth < 8 && current; depth += 1) {
    const text = normalizeText(current.innerText || "");
    const className = current.getAttribute("class") || "";

    const looksLikeCard =
      className.includes("rounded") ||
      className.includes("shadow") ||
      className.includes("border") ||
      className.includes("bg-white");

    if (looksLikeCard && text.includes("profile completion")) {
      return current;
    }

    current = current.parentElement;
  }

  return element.closest("section, article, div") as HTMLElement | null;
}

export default function BwcHomeCompletionCleanup() {
  useEffect(() => {
    function cleanup() {
      const allElements = Array.from(document.querySelectorAll<HTMLElement>("body *"));
      const bodyText = normalizeText(document.body.innerText || "");

      const profileIsComplete =
        bodyText.includes("profile completion") &&
        (bodyText.includes("profile completion 100%") || bodyText.includes("100%"));

      if (!profileIsComplete) return;

      for (const element of allElements) {
        const text = normalizeText(element.innerText || "");

        if (text === "profile completion" || text.includes("profile completion 100%")) {
          const card = findCardContainer(element);

          if (card) {
            card.style.display = "none";
            card.setAttribute("data-bwc-hidden-profile-completion", "true");
          }
        }
      }

      for (const element of allElements) {
        const text = normalizeText(element.innerText || "");
        const tagName = element.tagName.toLowerCase();

        if (
          text === "lengkapi data" &&
          ["button", "a"].includes(tagName)
        ) {
          element.style.display = "none";
          element.setAttribute("data-bwc-hidden-lengkapi-data", "true");
        }
      }
    }

    cleanup();

    const interval = window.setInterval(cleanup, 600);
    const observer = new MutationObserver(cleanup);

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      window.clearInterval(interval);
      observer.disconnect();
    };
  }, []);

  return null;
}

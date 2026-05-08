"use client";

import { useEffect } from "react";

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function getLabels(element: HTMLElement) {
  return Array.from(element.querySelectorAll<HTMLElement>("button, a, [role='button']"))
    .map((item) => normalize(item.innerText || item.getAttribute("aria-label") || ""))
    .filter(Boolean);
}

function looksLikeLegacyMemberNav(element: HTMLElement) {
  if (element.closest(".bwc-mobile-bottom-nav")) return false;
  if (element.classList.contains("bwc-mobile-bottom-nav")) return false;

  const labels = getLabels(element);
  if (labels.length < 5 || labels.length > 12) return false;

  const joined = labels.join(" ");
  const hasCore =
    joined.includes("home") &&
    joined.includes("qr") &&
    (joined.includes("schedule") || joined.includes("acara")) &&
    (joined.includes("profile") || joined.includes("profil"));

  const hasExtra =
    joined.includes("cool") ||
    joined.includes("forum") ||
    joined.includes("contact") ||
    joined.includes("pelayanan") ||
    joined.includes("group");

  if (!hasCore || !hasExtra) return false;

  const rect = element.getBoundingClientRect();
  if (rect.height > 170) return false;
  if (rect.width < 220) return false;

  return true;
}

function markLegacyNavs() {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>("nav, div, section"));

  for (const element of candidates) {
    if (looksLikeLegacyMemberNav(element)) {
      element.setAttribute("data-bwc-legacy-member-nav", "true");
      element.classList.add("bwc-legacy-member-nav-mobile-hide");
    }
  }
}

function markMobilePages() {
  const targets = [
    "personal chat",
    "bwc contacts",
    "group chat pelayanan",
    "bwc department group",
    "my attendance qr",
    "digital member card",
    "jadwal pelayanan",
    "my cool",
    "update data pribadi",
    "attendance qr",
  ];

  for (const section of Array.from(document.querySelectorAll<HTMLElement>("main section, section"))) {
    const text = normalize(section.innerText || "");
    if (targets.some((target) => text.includes(target))) {
      section.classList.add("bwc-mobile-page-fix");
    }
  }
}

export default function BwcMobileRuntimeLayoutFix() {
  useEffect(() => {
    function run() {
      markLegacyNavs();
      markMobilePages();
    }

    run();

    const interval = window.setInterval(run, 800);
    const observer = new MutationObserver(run);

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

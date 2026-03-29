"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "batibarr_read_ids";

function loadReadIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

export function useReadEmails() {
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setReadIds(loadReadIds());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveReadIds(readIds);
  }, [readIds, hydrated]);

  const markAsRead = useCallback((id: string) => {
    setReadIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const markAllAsRead = useCallback((ids: Iterable<string>) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
  }, []);

  const resetRead = useCallback(() => {
    setReadIds(new Set());
  }, []);

  return { readIds, markAsRead, markAllAsRead, resetRead };
}

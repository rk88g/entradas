"use client";

import { useDeferredValue, useEffect, useState } from "react";
import { VisitorSearchOption } from "@/lib/types";

type RemoteVisitorSearchFieldProps = {
  name: string;
  selected: VisitorSearchOption | null;
  onSelect: (option: VisitorSearchOption | null) => void;
  placeholder?: string;
  disabled?: boolean;
};

export function RemoteVisitorSearchField({
  name,
  selected,
  onSelect,
  placeholder = "Buscar visita por nombre",
  disabled = false
}: RemoteVisitorSearchFieldProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VisitorSearchOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    const normalized = deferredQuery.trim();
    if (!normalized) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    let active = true;

    async function runSearch() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(
          `/api/visitors/search?q=${encodeURIComponent(normalized)}&limit=8`,
          {
            cache: "no-store",
            signal: controller.signal
          }
        );

        if (!response.ok) {
          throw new Error("No se pudo buscar la visita.");
        }

        const payload = (await response.json()) as { items?: VisitorSearchOption[] };
        if (!active) {
          return;
        }

        setResults(payload.items ?? []);
      } catch (searchError) {
        if (!active || controller.signal.aborted) {
          return;
        }

        setResults([]);
        setError(searchError instanceof Error ? searchError.message : "No se pudo buscar la visita.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void runSearch();

    return () => {
      active = false;
      controller.abort();
    };
  }, [deferredQuery]);

  function clearSearch() {
    setQuery("");
    setResults([]);
    setError(null);
  }

  return (
    <div className="field remote-search-field">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            clearSearch();
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
        disabled={disabled}
      />
      <input type="hidden" name={name} value={selected?.id ?? ""} />
      <div className="inline-search-list">
        {!deferredQuery.trim() ? (
          <div className="inline-search-empty">Escribe parte del nombre de la visita.</div>
        ) : loading ? (
          <div className="inline-search-empty">Loading...</div>
        ) : error ? (
          <div className="inline-search-empty">{error}</div>
        ) : results.length === 0 ? (
          <div className="inline-search-empty">Sin resultados.</div>
        ) : (
          results.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`inline-search-item ${selected?.id === option.id ? "active" : ""}`}
              onClick={() => {
                onSelect(option);
                clearSearch();
              }}
              disabled={disabled}
            >
              <strong>{option.fullName}</strong>
              <span className="muted">
                {option.currentInternalName
                  ? `${option.currentInternalName} · ${option.currentInternalLocation ?? "Sin ubicacion"}`
                  : "Sin interno activo"}
              </span>
            </button>
          ))
        )}
      </div>
      {selected ? (
        <div className="record-pill record-pill-inline">
          <div>
            <strong>{selected.fullName}</strong>
            <span>
              {selected.currentInternalName
                ? `${selected.currentInternalName} · ${selected.currentInternalLocation ?? "Sin ubicacion"}`
                : "Sin interno activo"}
            </span>
          </div>
          <button type="button" className="button-soft" onClick={() => onSelect(null)} disabled={disabled}>
            Quitar
          </button>
        </div>
      ) : null}
    </div>
  );
}

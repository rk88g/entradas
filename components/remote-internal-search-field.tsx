"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { InternalSearchOption } from "@/lib/types";

type RemoteInternalSearchFieldProps = {
  name: string;
  selected: InternalSearchOption | null;
  onSelect: (option: InternalSearchOption | null) => void;
  placeholder?: string;
  disabled?: boolean;
  excludeIds?: string[];
  emptySelectionLabel?: string;
  showEmptySelection?: boolean;
};

export function RemoteInternalSearchField({
  name,
  selected,
  onSelect,
  placeholder = "Buscar interno por nombre o ubicación",
  disabled = false,
  excludeIds = [],
  emptySelectionLabel = "Vacante",
  showEmptySelection = false
}: RemoteInternalSearchFieldProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<InternalSearchOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);

  const visibleResults = useMemo(
    () => results.filter((item) => !excludeIds.includes(item.id)),
    [excludeIds, results]
  );

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
          `/api/internals/search?q=${encodeURIComponent(normalized)}&limit=8`,
          {
            cache: "no-store",
            signal: controller.signal
          }
        );

        if (!response.ok) {
          throw new Error("No se pudo buscar el interno.");
        }

        const payload = (await response.json()) as { items?: InternalSearchOption[] };
        if (!active) {
          return;
        }

        setResults(payload.items ?? []);
      } catch (searchError) {
        if (!active || controller.signal.aborted) {
          return;
        }

        setResults([]);
        setError(searchError instanceof Error ? searchError.message : "No se pudo buscar el interno.");
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
        {showEmptySelection ? (
          <button
            type="button"
            className={`inline-search-item ${selected ? "" : "active"}`}
            onClick={() => onSelect(null)}
            disabled={disabled}
          >
            <strong>{emptySelectionLabel}</strong>
          </button>
        ) : null}
        {!deferredQuery.trim() ? (
          <div className="inline-search-empty">Escribe parte del nombre o la ubicación.</div>
        ) : loading ? (
          <div className="inline-search-empty">Loading...</div>
        ) : error ? (
          <div className="inline-search-empty">{error}</div>
        ) : visibleResults.length === 0 ? (
          <div className="inline-search-empty">Sin resultados.</div>
        ) : (
          visibleResults.map((option) => (
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
                {option.ubicacion} · {option.estatus}
              </span>
            </button>
          ))
        )}
      </div>
      {selected ? (
        <div className="record-pill record-pill-inline">
          <div>
            <strong>{selected.fullName}</strong>
            <span>{selected.ubicacion}</span>
          </div>
          <button type="button" className="button-soft" onClick={() => onSelect(null)} disabled={disabled}>
            Quitar
          </button>
        </div>
      ) : null}
    </div>
  );
}


"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { InternalProfile, VisitorRecord } from "@/lib/types";
import { formatLongDate, getVisitorAvailabilityLabel } from "@/lib/utils";

function formatCurrentInternalLabel(name?: string | null, location?: string | null) {
  const normalizedName = String(name ?? "").trim();
  const normalizedLocation = String(location ?? "").trim();

  if (!normalizedName) {
    return "-";
  }

  return normalizedLocation ? `${normalizedName} [${normalizedLocation}]` : normalizedName;
}

function navigateToSearchTarget(pathname: string, params: URLSearchParams) {
  const target = params.size ? `${pathname}?${params.toString()}` : pathname;
  window.location.assign(target);
}

export function ComparatorPanel({
  internals,
  visitors,
  internalQuery,
  visitorQuery
}: {
  internals: InternalProfile[];
  visitors: VisitorRecord[];
  internalQuery: string;
  visitorQuery: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [internalQueryInput, setInternalQueryInput] = useState(internalQuery);
  const [visitorQueryInput, setVisitorQueryInput] = useState(visitorQuery);
  const [selectedInternalId, setSelectedInternalId] = useState<string | null>(internals[0]?.id ?? null);
  const [selectedVisitorId, setSelectedVisitorId] = useState<string | null>(visitors[0]?.id ?? null);

  useEffect(() => {
    setInternalQueryInput(internalQuery);
  }, [internalQuery]);

  useEffect(() => {
    setVisitorQueryInput(visitorQuery);
  }, [visitorQuery]);

  useEffect(() => {
    setSelectedInternalId((current) =>
      current && internals.some((item) => item.id === current) ? current : internals[0]?.id ?? null
    );
  }, [internals]);

  useEffect(() => {
    setSelectedVisitorId((current) =>
      current && visitors.some((item) => item.id === current) ? current : visitors[0]?.id ?? null
    );
  }, [visitors]);

  const selectedInternal = internals.find((item) => item.id === selectedInternalId) ?? null;
  const selectedVisitor = visitors.find((item) => item.id === selectedVisitorId) ?? null;

  function applyCombinedSearch(rawInternalValue: string, rawVisitorValue: string) {
    const normalizedInternal = rawInternalValue.trim();
    const normalizedVisitor = rawVisitorValue.trim();
    const params = new URLSearchParams(searchParams.toString());

    params.delete("q");

    if (normalizedInternal) {
      params.set("iq", normalizedInternal);
    } else {
      params.delete("iq");
    }

    if (normalizedVisitor) {
      params.set("vq", normalizedVisitor);
    } else {
      params.delete("vq");
    }

    navigateToSearchTarget(pathname, params);
  }

  return (
    <section className="module-grid module-grid-single">
      <article className="data-card">
        <div
          className="actions-row"
          style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}
        >
          <strong className="section-title">Comparador</strong>
          <span className="muted">
            {internals.length} internos · {visitors.length} visitas
          </span>
        </div>

        <form
          className="actions-row"
          style={{ alignItems: "stretch", gap: "0.8rem", flexWrap: "wrap" }}
          onSubmit={(event) => {
            event.preventDefault();
            applyCombinedSearch(internalQueryInput, visitorQueryInput);
          }}
        >
          <div className="field" style={{ flex: "1 1 320px" }}>
            <input
              value={internalQueryInput}
              onChange={(event) => setInternalQueryInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  setInternalQueryInput("");
                }
              }}
              placeholder="Buscar interno"
              autoComplete="off"
            />
          </div>

          <div className="field" style={{ flex: "1 1 320px" }}>
            <input
              value={visitorQueryInput}
              onChange={(event) => setVisitorQueryInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  setVisitorQueryInput("");
                }
              }}
              placeholder="Buscar visita"
              autoComplete="off"
            />
          </div>

          <button type="submit" className="button-soft">
            Buscar
          </button>
        </form>
      </article>

      <section className="two-column-section">
        <article className="data-card">
          <div
            className="actions-row"
            style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}
          >
            <strong className="section-title">Ultimos 20 internos</strong>
            <span className="muted">{internals.length} resultados</span>
          </div>

          <div className="table-wrap compact-table">
            <table>
              <thead>
                <tr>
                  <th>Interno</th>
                  <th>Ubicacion</th>
                  <th>Edad</th>
                  <th>Estatus</th>
                </tr>
              </thead>
              <tbody>
                {internals.length === 0 ? (
                  <tr>
                    <td colSpan={4}>Sin resultados.</td>
                  </tr>
                ) : (
                  internals.map((internal) => (
                    <tr
                      key={internal.id}
                      onClick={() => setSelectedInternalId(internal.id)}
                      style={{
                        cursor: "pointer",
                        background: selectedInternalId === internal.id ? "rgba(15, 23, 42, 0.06)" : undefined
                      }}
                    >
                      <td>{internal.fullName}</td>
                      <td>{internal.ubicacion}</td>
                      <td>{internal.edad}</td>
                      <td>{internal.estatus}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <article className="data-card" style={{ marginTop: "0.9rem" }}>
            <strong style={{ display: "block", marginBottom: "0.7rem" }}>Detalle de interno</strong>
            {selectedInternal ? (
              <div className="mini-list">
                <div className="mini-row">
                  <span>Nombre</span>
                  <strong>{selectedInternal.fullName}</strong>
                </div>
                <div className="mini-row">
                  <span>Ubicacion</span>
                  <strong>{selectedInternal.ubicacion}</strong>
                </div>
                <div className="mini-row">
                  <span>Edad</span>
                  <strong>{selectedInternal.edad}</strong>
                </div>
                <div className="mini-row">
                  <span>Estatus</span>
                  <strong>{selectedInternal.estatus}</strong>
                </div>
                <div className="mini-row">
                  <span>Expediente</span>
                  <strong>{selectedInternal.expediente}</strong>
                </div>
                <div className="mini-row">
                  <span>Llego</span>
                  <strong>{formatLongDate(selectedInternal.llego)}</strong>
                </div>
                <div className="mini-row">
                  <span>Nacimiento</span>
                  <strong>{formatLongDate(selectedInternal.nacimiento)}</strong>
                </div>
                <div className="mini-row">
                  <span>Observaciones</span>
                  <strong>{selectedInternal.observaciones || "Sin observaciones"}</strong>
                </div>
              </div>
            ) : (
              <span className="muted">Sin interno seleccionado.</span>
            )}
          </article>
        </article>

        <article className="data-card">
          <div
            className="actions-row"
            style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}
          >
            <strong className="section-title">Ultimas 20 visitas</strong>
            <span className="muted">{visitors.length} resultados</span>
          </div>

          <div className="table-wrap compact-table">
            <table>
              <thead>
                <tr>
                  <th>Visita</th>
                  <th>Interno</th>
                  <th>Edad</th>
                  <th>Estatus</th>
                </tr>
              </thead>
              <tbody>
                {visitors.length === 0 ? (
                  <tr>
                    <td colSpan={4}>Sin resultados.</td>
                  </tr>
                ) : (
                  visitors.map((visitor) => (
                    <tr
                      key={visitor.id}
                      onClick={() => setSelectedVisitorId(visitor.id)}
                      style={{
                        cursor: "pointer",
                        background: selectedVisitorId === visitor.id ? "rgba(15, 23, 42, 0.06)" : undefined
                      }}
                    >
                      <td>{visitor.fullName}</td>
                      <td>{formatCurrentInternalLabel(visitor.currentInternalName, visitor.currentInternalLocation)}</td>
                      <td>{visitor.edad}</td>
                      <td>{getVisitorAvailabilityLabel(visitor.betada)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <article className="data-card" style={{ marginTop: "0.9rem" }}>
            <strong style={{ display: "block", marginBottom: "0.7rem" }}>Detalle de visita</strong>
            {selectedVisitor ? (
              <div className="mini-list">
                <div className="mini-row">
                  <span>Nombre</span>
                  <strong>{selectedVisitor.fullName}</strong>
                </div>
                <div className="mini-row">
                  <span>Interno actual</span>
                  <strong>
                    {formatCurrentInternalLabel(
                      selectedVisitor.currentInternalName,
                      selectedVisitor.currentInternalLocation
                    )}
                  </strong>
                </div>
                <div className="mini-row">
                  <span>Parentesco</span>
                  <strong>{selectedVisitor.parentesco}</strong>
                </div>
                <div className="mini-row">
                  <span>Edad</span>
                  <strong>{selectedVisitor.edad}</strong>
                </div>
                <div className="mini-row">
                  <span>Nacimiento</span>
                  <strong>{formatLongDate(selectedVisitor.fechaNacimiento)}</strong>
                </div>
                <div className="mini-row">
                  <span>Estatus</span>
                  <strong>{getVisitorAvailabilityLabel(selectedVisitor.betada)}</strong>
                </div>
                <div className="mini-row">
                  <span>Fecha no disponible</span>
                  <strong>{selectedVisitor.fechaBetada ? formatLongDate(selectedVisitor.fechaBetada) : "No aplica"}</strong>
                </div>
                <div className="mini-row">
                  <span>Observaciones</span>
                  <strong>{selectedVisitor.notas || "Sin observaciones"}</strong>
                </div>
              </div>
            ) : (
              <span className="muted">Sin visita seleccionada.</span>
            )}
          </article>
        </article>
      </section>
    </section>
  );
}


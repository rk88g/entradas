"use client";

import { useMemo, useState } from "react";
import { listado } from "@/lib/mock-data";
import { AccessArea } from "@/lib/types";
import {
  formatLongDate,
  formatShortDate,
  getTomorrowDate,
  sortVisitorsByAge
} from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";

const areaLabels: Record<AccessArea, string> = {
  "618": "Pases 618",
  INTIMA: "Pases sueltos INTIMA"
};

export function PassListing() {
  const [activeArea, setActiveArea] = useState<AccessArea>("618");
  const [selectedDate, setSelectedDate] = useState(getTomorrowDate());

  const filtered = useMemo(() => {
    return listado.filter((item) => item.area === activeArea && item.fechaVisita === selectedDate);
  }, [activeArea, selectedDate]);

  return (
    <section className="module-panel">
      <div className="pass-controls hide-print">
        <div className="toolbar">
          <div className="segmented">
            {(["618", "INTIMA"] as AccessArea[]).map((area) => (
              <button
                key={area}
                type="button"
                className={`segmented-button ${area === activeArea ? "active" : ""}`}
                onClick={() => setActiveArea(area)}
              >
                {areaLabels[area]}
              </button>
            ))}
          </div>
          <div className="field" style={{ minWidth: "220px" }}>
            <label htmlFor="fecha-listado">Fecha de visita</label>
            <input
              id="fecha-listado"
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </div>
          <button type="button" className="button-secondary" onClick={() => window.print()}>
            Imprimir pases
          </button>
        </div>
        <div className="note-box">
          <strong>Vista del listado</strong>
          <p className="mini-copy">
            El sistema te muestra por defecto los pases del día siguiente. Cada interno aparece
            agrupado en su rectángulo con visitantes ordenados de mayor a menor edad.
          </p>
        </div>
      </div>

      <div className="print-zone passes-grid">
        {filtered.length === 0 ? (
          <div className="data-card">
            <h3>Sin pases para esta combinación</h3>
            <p className="muted" style={{ color: "var(--muted)" }}>
              Cambia la fecha o el apartado para revisar otros pases capturados.
            </p>
          </div>
        ) : (
          filtered.map((pass) => {
            const visitors = sortVisitorsByAge(pass.visitantes);
            const blocked = visitors.some((visitor) => visitor.betada);

            return (
              <article key={pass.id} className="pass-card">
                <div className="pass-head">
                  <div>
                    <span className="eyebrow" style={{ color: "#7c2d12", background: "#fef3c7" }}>
                      {areaLabels[pass.area]}
                    </span>
                    <h3 className="pass-title" style={{ marginTop: "0.7rem" }}>
                      Pase de terraza
                    </h3>
                    <div className="muted" style={{ color: "var(--muted)", marginTop: "0.4rem" }}>
                      Fecha: {formatLongDate(pass.fechaVisita)}
                    </div>
                  </div>
                  <div className="stack" style={{ justifyItems: "end" }}>
                    <StatusBadge
                      variant={
                        pass.status === "impreso"
                          ? "ok"
                          : pass.status === "autorizado"
                            ? "warn"
                            : "off"
                      }
                    >
                      {pass.status}
                    </StatusBadge>
                    {blocked ? <StatusBadge variant="danger">Hay visita betada</StatusBadge> : null}
                  </div>
                </div>

                <div className="pass-body stack">
                  <div className="record-title">
                    <strong>{pass.internoNombre}</strong>
                    <span>Listado del {formatShortDate(pass.fechaVisita)}</span>
                  </div>

                  <div className="visitor-list">
                    {visitors.map((visitor) => (
                      <div
                        key={`${pass.id}-${visitor.visitorId}`}
                        className={`visitor-row ${visitor.edad < 12 ? "minor" : ""}`}
                      >
                        <strong>{visitor.nombre}</strong>
                        <span>{visitor.parentesco}</span>
                        <span>{visitor.edad} años</span>
                        <span>{visitor.menor ? "Menor" : "Adulto"}</span>
                        <span>{visitor.betada ? "Betada" : "Activa"}</span>
                      </div>
                    ))}
                  </div>

                  {pass.area === "INTIMA" && pass.menciones ? (
                    <div className="alert-box">
                      <strong>Mención para pase suelto</strong>
                      <p className="mini-copy">{pass.menciones}</p>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}


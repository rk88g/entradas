"use client";

import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { AccessArea, ListingRecord } from "@/lib/types";
import { formatLongDate, formatShortDate, sortListingsForPrint } from "@/lib/utils";

type PrintMode = "agrupado" | "separado";

const areaLabels: Record<AccessArea, string> = {
  "618": "Pases 618",
  INTIMA: "Pases sueltos"
};

export function PassListing({
  listings,
  initialDate
}: {
  listings: ListingRecord[];
  initialDate: string;
}) {
  const [activeArea, setActiveArea] = useState<AccessArea>("618");
  const [printMode, setPrintMode] = useState<PrintMode>("agrupado");
  const [selectedDate, setSelectedDate] = useState(initialDate);

  const filtered = useMemo(() => {
    const byDate = listings.filter((item) => item.fechaVisita === selectedDate);
    const sorted = sortListingsForPrint(byDate);
    return activeArea === "618" ? sorted.byLocation : sorted.sueltos;
  }, [activeArea, listings, selectedDate]);

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

          <div className="segmented">
            {(["agrupado", "separado"] as PrintMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`segmented-button ${mode === printMode ? "active" : ""}`}
                onClick={() => setPrintMode(mode)}
              >
                {mode === "agrupado" ? "Por interno" : "Hombres / Mujeres"}
              </button>
            ))}
          </div>

          <div className="field" style={{ minWidth: "220px" }}>
            <label htmlFor="fecha-listado">Fecha</label>
            <input
              id="fecha-listado"
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </div>
          <button type="button" className="button-secondary" onClick={() => window.print()}>
            Imprimir
          </button>
        </div>
      </div>

      <div className="print-zone passes-grid">
        {filtered.length === 0 ? (
          <div className="data-card">
            <h3>Sin pases</h3>
          </div>
        ) : printMode === "agrupado" ? (
          filtered.map((pass) => (
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
                  {pass.area === "618" && pass.numeroPase ? (
                    <span className="chip">No. {pass.numeroPase}</span>
                  ) : null}
                  <StatusBadge
                    variant={
                      pass.status === "impreso"
                        ? "ok"
                        : pass.status === "autorizado"
                          ? "warn"
                          : pass.status === "cancelado"
                            ? "danger"
                            : "off"
                    }
                  >
                    {pass.status}
                  </StatusBadge>
                </div>
              </div>

              <div className="pass-body stack">
                <div className="record-title">
                  <strong>
                    {pass.internoNombre} · Ubicacion {pass.internoUbicacion}
                  </strong>
                  <span>Listado del {formatShortDate(pass.fechaVisita)}</span>
                </div>

                <div className="visitor-list">
                  {pass.visitantes.map((visitor) => (
                    <div
                      key={`${pass.id}-${visitor.visitorId}`}
                      className={`visitor-row ${visitor.edad < 12 ? "minor" : ""}`}
                    >
                      <strong>{visitor.nombre}</strong>
                      <span>{visitor.parentesco}</span>
                      <span>{visitor.edad} años</span>
                      <span>{visitor.menor ? "Menor" : "Adulto"}</span>
                      <span>{visitor.sexo}</span>
                    </div>
                  ))}
                </div>

                {pass.menciones ? (
                  <div className="alert-box">
                    <strong>Mencion</strong>
                    <p className="mini-copy">{pass.menciones}</p>
                  </div>
                ) : null}
              </div>
            </article>
          ))
        ) : (
          filtered.map((pass) => {
            const men = pass.visitantes.filter((item) => item.sexo === "hombre" && !item.menor);
            const womenAndMinors = pass.visitantes.filter(
              (item) => item.sexo === "mujer" || item.menor || item.sexo === "sin-definir"
            );

            return (
              <article key={pass.id} className="pass-card">
                <div className="pass-head">
                  <div>
                    <span className="eyebrow" style={{ color: "#7c2d12", background: "#fef3c7" }}>
                      {areaLabels[pass.area]}
                    </span>
                    <h3 className="pass-title" style={{ marginTop: "0.7rem" }}>
                      Registro por sexo
                    </h3>
                    <div className="muted" style={{ color: "var(--muted)", marginTop: "0.4rem" }}>
                      {pass.internoNombre} · Ubicacion {pass.internoUbicacion}
                    </div>
                  </div>
                  {pass.area === "618" && pass.numeroPase ? (
                    <span className="chip">No. {pass.numeroPase}</span>
                  ) : null}
                </div>

                <div className="split-grid">
                  <div className="data-card" style={{ padding: "1rem" }}>
                    <h3 style={{ marginTop: 0 }}>Hombres</h3>
                    <div className="mini-list">
                      {men.length === 0 ? (
                        <div className="mini-row">
                          <span>Sin registros</span>
                          <span className="chip">0</span>
                        </div>
                      ) : (
                        men.map((visitor) => (
                          <div key={visitor.visitorId} className="mini-row">
                            <div className="record-title">
                              <strong>{visitor.nombre}</strong>
                              <span>
                                {visitor.parentesco} · {visitor.edad} años
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="data-card" style={{ padding: "1rem" }}>
                    <h3 style={{ marginTop: 0 }}>Mujeres y menores</h3>
                    <div className="mini-list">
                      {womenAndMinors.length === 0 ? (
                        <div className="mini-row">
                          <span>Sin registros</span>
                          <span className="chip">0</span>
                        </div>
                      ) : (
                        womenAndMinors.map((visitor) => (
                          <div
                            key={visitor.visitorId}
                            className="mini-row"
                            style={{
                              background: visitor.edad < 12 ? "rgba(255,225,225,0.82)" : undefined,
                              color: visitor.edad < 12 ? "#7f1d1d" : undefined,
                              borderRadius: "12px",
                              paddingInline: "0.75rem"
                            }}
                          >
                            <div className="record-title">
                              <strong>{visitor.nombre}</strong>
                              <span>
                                {visitor.parentesco} · {visitor.edad} años
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {pass.menciones ? (
                  <div className="alert-box" style={{ marginTop: "1rem" }}>
                    <strong>Mencion</strong>
                    <p className="mini-copy">{pass.menciones}</p>
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

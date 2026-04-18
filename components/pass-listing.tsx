"use client";

import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { AccessArea, ListingRecord } from "@/lib/types";
import {
  formatLongDate,
  formatShortDate,
  getTomorrowDate,
  sortListingsForPrint
} from "@/lib/utils";

type PrintMode = "agrupado" | "separado" | "entrega";

const areaLabels: Record<AccessArea, string> = {
  "618": "Pases 618",
  INTIMA: "Pases sueltos"
};

function get618VisibleVisitors(pass: ListingRecord) {
  const listedVisitors = pass.visitantes.filter((visitor) => visitor.edad >= 12);
  const underTwelveCount = pass.visitantes.filter((visitor) => visitor.edad < 12).length;

  return {
    listedVisitors,
    underTwelveCount
  };
}

function renderCompactPass(pass: ListingRecord) {
  const { listedVisitors, underTwelveCount } = get618VisibleVisitors(pass);

  return (
    <article key={pass.id} className="pass-card pass-card-618">
      <div className="compact-pass-head">
        <div className="compact-pass-title">
          <strong>
            {pass.internoUbicacion} {pass.internoNombre}
          </strong>
          <span>{formatShortDate(pass.fechaVisita)}</span>
        </div>
        <div className="compact-pass-number">{pass.area === "618" ? pass.numeroPase ?? "-" : ""}</div>
      </div>

      <div className="compact-pass-visitors">
        {listedVisitors.map((visitor) => (
          <div
            key={`${pass.id}-${visitor.visitorId}`}
            className={`compact-pass-visitor ${visitor.edad < 18 ? "minor" : ""}`}
          >
            <span>{visitor.nombre}</span>
          </div>
        ))}

        {underTwelveCount > 0 ? (
          <div className="compact-pass-children">+ {underTwelveCount} menores</div>
        ) : null}

        {pass.area === "INTIMA" && pass.menciones ? (
          <div className="compact-pass-note">{pass.menciones}</div>
        ) : null}
      </div>
    </article>
  );
}

export function PassListing({
  listings,
  initialDate
}: {
  listings: ListingRecord[];
  initialDate: string;
}) {
  const tomorrowDate = getTomorrowDate();
  const [activeArea, setActiveArea] = useState<AccessArea>("618");
  const [printMode, setPrintMode] = useState<PrintMode>("agrupado");
  const [selectedDate, setSelectedDate] = useState(initialDate || tomorrowDate);

  const filtered = useMemo(() => {
    const targetDate = printMode === "entrega" ? tomorrowDate : selectedDate;
    const byDate = listings.filter((item) => item.fechaVisita === targetDate);
    const sorted = sortListingsForPrint(byDate);
    return activeArea === "618" ? sorted.byLocation : sorted.sueltos;
  }, [activeArea, listings, printMode, selectedDate, tomorrowDate]);

  function printTomorrowList() {
    setActiveArea("618");
    setPrintMode("entrega");
    setSelectedDate(tomorrowDate);
    window.setTimeout(() => window.print(), 80);
  }

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
            {(["agrupado", "separado"] as Exclude<PrintMode, "entrega">[]).map((mode) => (
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
            <label htmlFor="fecha-listado">Fecha de pases</label>
            <input
              id="fecha-listado"
              type="date"
              value={selectedDate}
              onChange={(event) => {
                setPrintMode("agrupado");
                setSelectedDate(event.target.value);
              }}
              autoComplete="off"
            />
          </div>

          <button type="button" className="button-secondary" onClick={() => window.print()}>
            Imprimir
          </button>
          <button type="button" className="button-secondary" onClick={printTomorrowList}>
            Lista sig. dia
          </button>
        </div>
      </div>

      <div
        className={`print-zone passes-grid ${printMode === "agrupado" ? "compact-pass-grid" : ""}`}
      >
        {filtered.length === 0 ? (
          <div className="data-card">
            <h3>Sin pases</h3>
          </div>
        ) : printMode === "entrega" ? (
          <article className="pass-card delivery-print">
            <div className="pass-head">
              <div>
                <span className="eyebrow" style={{ color: "#7c2d12", background: "#fef3c7" }}>
                  Lista de entrega
                </span>
                <h3 className="pass-title" style={{ marginTop: "0.7rem" }}>
                  Pases del dia siguiente
                </h3>
                <div className="muted" style={{ color: "var(--muted)", marginTop: "0.4rem" }}>
                  Fecha: {formatLongDate(tomorrowDate)}
                </div>
              </div>
            </div>

            <div className="table-wrap hide-print" style={{ marginTop: "1rem" }}>
              <table>
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>Ubicacion</th>
                    <th>Interno</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((pass) => (
                    <tr key={pass.id}>
                      <td>{pass.numeroPase ?? "-"}</td>
                      <td>{pass.internoUbicacion}</td>
                      <td>{pass.internoNombre}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="delivery-print-list">
              <div className="delivery-print-head">
                <span>No.</span>
                <span>Ubicacion</span>
                <span>Interno</span>
              </div>
              <div className="delivery-print-body">
                {filtered.map((pass) => (
                  <div key={pass.id} className="delivery-print-row">
                    <span>{pass.numeroPase ?? "-"}</span>
                    <span>{pass.internoUbicacion}</span>
                    <span>{pass.internoNombre}</span>
                  </div>
                ))}
              </div>
            </div>
          </article>
        ) : printMode === "agrupado" ? (
          filtered.map((pass) => renderCompactPass(pass))
        ) : (
          filtered.map((pass) => {
            const men = pass.visitantes.filter((item) => item.sexo === "hombre" && !item.menor);
            const womenAndMinors = pass.visitantes.filter(
              (item) => item.sexo === "mujer" || item.menor || item.sexo === "sin-definir"
            );
            const groups = [
              { key: "hombres", title: "Hombres", items: men },
              { key: "mujeres", title: "Mujeres y menores", items: womenAndMinors }
            ].filter((group) => group.items.length > 0);

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
                      {pass.internoNombre} - Ubicacion {pass.internoUbicacion}
                    </div>
                  </div>
                  {pass.area === "618" && pass.numeroPase ? (
                    <span className="chip">No. {pass.numeroPase}</span>
                  ) : null}
                </div>

                <div
                  className="split-grid"
                  style={{ gridTemplateColumns: groups.length === 1 ? "minmax(0, 1fr)" : undefined }}
                >
                  {groups.map((group) => (
                    <div key={group.key} className="data-card" style={{ padding: "1rem" }}>
                      <h3 style={{ marginTop: 0 }}>{group.title}</h3>
                    <div className="mini-list">
                      {group.items.map((visitor) => (
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
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

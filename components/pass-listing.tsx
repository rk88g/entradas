"use client";

import { useMemo, useState } from "react";
import { AccessArea, ListingRecord } from "@/lib/types";
import { formatLongDate, formatShortDate, sortListingsForPrint } from "@/lib/utils";

type PrintMode = "agrupado" | "separado" | "entrega";

const activeButtonStyle = {
  background: "#dbe3ee",
  color: "#12233c",
  borderColor: "#dbe3ee"
} as const;

const listingButtonStyle = {
  flex: "1 1 180px",
  minWidth: "180px",
  justifyContent: "center",
  background: "var(--primary)",
  color: "white",
  borderColor: "var(--primary)"
} as const;

function get618VisibleVisitors(pass: ListingRecord) {
  const listedVisitors = pass.visitantes.filter((visitor) => visitor.edad >= 12);
  const underTwelveCount = pass.visitantes.filter((visitor) => visitor.edad < 12).length;

  return {
    listedVisitors,
    underTwelveCount
  };
}

function formatCompactVisitorName(visitor: ListingRecord["visitantes"][number]) {
  if (visitor.edad >= 12 && visitor.edad <= 17) {
    return `${visitor.nombre} ${visitor.edad} años`;
  }

  return visitor.nombre;
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
            <span>{formatCompactVisitorName(visitor)}</span>
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

function renderLoosePass(pass: ListingRecord) {
  const { listedVisitors, underTwelveCount } = get618VisibleVisitors(pass);

  return (
    <article key={pass.id} className="pass-card">
      <div className="pass-head">
        <div>
          <span className="eyebrow">Pases sueltos</span>
          <h3 className="pass-title" style={{ marginTop: "0.75rem" }}>
            {pass.internoUbicacion} {pass.internoNombre}
          </h3>
          <div className="muted" style={{ color: "var(--muted)", marginTop: "0.3rem" }}>
            {formatLongDate(pass.fechaVisita)}
          </div>
        </div>
      </div>

      <div className="visitor-stack">
        {listedVisitors.map((visitor) => (
          <div
            key={`${pass.id}-${visitor.visitorId}`}
            className={`visitor-pill ${visitor.edad < 18 ? "minor" : ""}`}
          >
            {formatCompactVisitorName(visitor)}
          </div>
        ))}

        {underTwelveCount > 0 ? (
          <div className="compact-pass-children">+ {underTwelveCount} menores</div>
        ) : null}
      </div>

      {pass.menciones ? (
        <div
          className="compact-pass-note"
          style={{
            marginTop: "1rem",
            border: "1px solid rgba(15, 23, 42, 0.16)",
            background: "#fff8e8"
          }}
        >
          {pass.menciones}
        </div>
      ) : null}
    </article>
  );
}

function renderSeparatedCompactPass(pass: ListingRecord) {
  const { listedVisitors, underTwelveCount } = get618VisibleVisitors(pass);
  const men = listedVisitors.filter((visitor) => visitor.sexo === "hombre");
  const womenAndMinors = listedVisitors.filter((visitor) => visitor.sexo !== "hombre");
  const columns = [
    { key: "men", items: men },
    { key: "women", items: womenAndMinors }
  ].filter((column) => column.items.length > 0);

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

      <div
        className="compact-pass-columns"
        style={{ gridTemplateColumns: columns.length === 1 ? "minmax(0, 1fr)" : undefined }}
      >
        {columns.map((column) => (
          <div key={column.key} className="compact-pass-column">
            {column.items.map((visitor) => (
              <div
                key={`${pass.id}-${visitor.visitorId}`}
                className={`compact-pass-visitor ${visitor.edad < 18 ? "minor" : ""}`}
              >
                <span>{formatCompactVisitorName(visitor)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {underTwelveCount > 0 ? (
        <div className="compact-pass-children">+ {underTwelveCount} menores</div>
      ) : null}
    </article>
  );
}

export function PassListing({
  listings,
  nextDate,
  openDate
}: {
  listings: ListingRecord[];
  nextDate: string;
  openDate: string;
}) {
  const [activeArea, setActiveArea] = useState<AccessArea>("618");
  const [printMode, setPrintMode] = useState<PrintMode>("agrupado");

  const filtered = useMemo(() => {
    const targetDate = printMode === "entrega" || activeArea === "618" ? nextDate : openDate;
    const byDate = listings.filter((item) => item.fechaVisita === targetDate);
    const sorted = sortListingsForPrint(byDate);
    if (printMode === "entrega") {
      return sorted.byLocation.filter((item) => item.area === "618");
    }

    return activeArea === "618"
      ? sorted.byLocation.filter((item) => item.area === "618")
      : sorted.sueltos.filter((item) => item.area === "INTIMA");
  }, [activeArea, listings, nextDate, openDate, printMode]);

  function selectDeliveryNumbers() {
    setActiveArea("618");
    setPrintMode("entrega");
  }

  function select618() {
    setActiveArea("618");
    setPrintMode("agrupado");
  }

  function selectSeparated618() {
    setActiveArea("618");
    setPrintMode("separado");
  }

  function selectSueltos() {
    setActiveArea("INTIMA");
    setPrintMode("agrupado");
  }

  return (
    <section className="module-panel">
      <div className="pass-controls hide-print">
        <div className="toolbar">
          <button
            type="button"
            className="button-secondary"
            onClick={select618}
            style={{
              ...listingButtonStyle,
              ...(activeArea === "618" && printMode === "agrupado" ? activeButtonStyle : {})
            }}
          >
            618
          </button>

          <button
            type="button"
            className="button-secondary"
            onClick={selectSeparated618}
            style={{
              ...listingButtonStyle,
              ...(activeArea === "618" && printMode === "separado" ? activeButtonStyle : {})
            }}
          >
            Hombres / Mujeres
          </button>

          <button
            type="button"
            className="button-secondary"
            onClick={selectSueltos}
            style={{
              ...listingButtonStyle,
              ...(activeArea === "INTIMA" && printMode === "agrupado" ? activeButtonStyle : {})
            }}
          >
            Pases sueltos
          </button>

          <button
            type="button"
            className="button-secondary"
            onClick={selectDeliveryNumbers}
            style={{
              ...listingButtonStyle,
              ...(printMode === "entrega" ? activeButtonStyle : {})
            }}
          >
            Numeros de pase
          </button>

          <button
            type="button"
            className="button-secondary"
            onClick={() => window.print()}
            style={listingButtonStyle}
          >
            Imprimir
          </button>
        </div>
      </div>

      <div
        className={`print-zone passes-grid ${printMode !== "entrega" ? "compact-pass-grid" : ""}`}
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
                  Fecha: {formatLongDate(nextDate)}
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
          filtered.map((pass) => (pass.area === "INTIMA" ? renderLoosePass(pass) : renderCompactPass(pass)))
        ) : (
          filtered.map((pass) => renderSeparatedCompactPass(pass))
        )}
      </div>
    </section>
  );
}

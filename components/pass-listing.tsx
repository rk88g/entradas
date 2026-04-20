"use client";

import { useMemo, useState } from "react";
import { ListingRecord } from "@/lib/types";
import { formatLongDate, sortListingsForPrint } from "@/lib/utils";

type PrintMode = "listado" | "sexos" | "numeros" | "menciones";

function getVisibleVisitors(pass: ListingRecord) {
  const visibleVisitors = pass.visitantes.filter((visitor) => visitor.edad >= 12);
  const underTwelveCount = pass.visitantes.filter((visitor) => visitor.edad < 12).length;
  return { visibleVisitors, underTwelveCount };
}

function getCompactVisibleVisitors(pass: ListingRecord) {
  const { visibleVisitors, underTwelveCount } = getVisibleVisitors(pass);
  return {
    listedVisitors: visibleVisitors.slice(0, 8),
    hiddenVisitorsCount: Math.max(0, visibleVisitors.length - 8),
    underTwelveCount
  };
}

function formatVisitorLine(visitor: ListingRecord["visitantes"][number]) {
  if (visitor.edad >= 12 && visitor.edad <= 17) {
    return `${visitor.nombre} ${visitor.edad} años`;
  }

  return visitor.nombre;
}

function splitMentions(menciones?: string) {
  const lines = (menciones ?? "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  const basic: string[] = [];
  const special: string[] = [];

  lines.forEach((line) => {
    if (/^(especial|esp|!|#)\s*[:\-]/i.test(line)) {
      special.push(line.replace(/^(especial|esp|!|#)\s*[:\-]\s*/i, "").trim() || line);
      return;
    }

    basic.push(line);
  });

  return { basic, special };
}

function formatDeviceItems(pass: ListingRecord) {
  return pass.deviceItems.map((item) => `${item.quantity} ${item.name}`);
}

function formatDeviceSummary(pass: ListingRecord) {
  if (pass.deviceItems.length === 0) {
    return null;
  }

  return pass.deviceItems
    .map((item) => `${item.name} [${item.quantity}]`)
    .join(", ");
}

function renderMainPass(pass: ListingRecord) {
  const { listedVisitors, hiddenVisitorsCount, underTwelveCount } = getCompactVisibleVisitors(pass);
  const { basic, special } = splitMentions(pass.menciones);
  const extraSpecials = splitMentions(pass.especiales);
  const specialLines = [
    ...extraSpecials.basic,
    ...extraSpecials.special,
    ...special,
    ...(!pass.especiales?.trim() && formatDeviceSummary(pass) ? [formatDeviceSummary(pass) as string] : [])
  ];

  return (
    <article key={pass.id} className="pass-card apoyo-pass-card">
      <div className="apoyo-pass-header">
        <div className="apoyo-pass-headline">
          <div className="apoyo-pass-kicker">Registro pase para terraza</div>
          <div className="apoyo-pass-date">{formatLongDate(pass.fechaVisita)}</div>
        </div>
        <div className="apoyo-pass-number">{pass.numeroPase ?? "-"}</div>
      </div>

      <div className="apoyo-pass-meta">
        <div>
          <strong>PPL:</strong> {pass.internoNombre}
        </div>
        <div>
          <strong>Ubicacion:</strong> {pass.internoUbicacion}
        </div>
      </div>

      <div className="apoyo-pass-section visits-section">
        <strong>Visitas:</strong>
        <div className="apoyo-pass-list">
          {listedVisitors.map((visitor) => (
            <div
              key={`${pass.id}-${visitor.visitorId}`}
              className={`apoyo-pass-line ${visitor.edad < 18 ? "minor" : ""}`}
            >
              {formatVisitorLine(visitor)}
            </div>
          ))}
          {underTwelveCount > 0 ? (
            <div className="apoyo-pass-line minor">
              + {underTwelveCount} {underTwelveCount === 1 ? "menor" : "menores"}
            </div>
          ) : null}
          {hiddenVisitorsCount > 0 ? (
            <div className="apoyo-pass-line warning">
              + {hiddenVisitorsCount} visitas en Hombres / Mujeres
            </div>
          ) : null}
        </div>
      </div>

      {basic.length > 0 ? (
        <div className="apoyo-pass-section basic-section">
          <strong>Peticion:</strong>
          <div className="apoyo-pass-list">
            {basic.map((item, index) => (
              <div key={`${pass.id}-basic-${index}`} className="apoyo-pass-line warning ellipsis-block">
                {item}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {specialLines.length > 0 ? (
        <div className="apoyo-pass-section special-section">
          <strong>Peticion especial:</strong>
          <div className="apoyo-pass-list">
            {specialLines.map((item, index) => (
              <div key={`${pass.id}-special-${index}`} className="apoyo-pass-line minor ellipsis-block">
                {item}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function renderSeparatedPasses(pass: ListingRecord) {
  const { visibleVisitors, underTwelveCount } = getVisibleVisitors(pass);
  const men = visibleVisitors.filter((visitor) => visitor.sexo === "hombre");
  const womenAndTeens = visibleVisitors.filter((visitor) => visitor.sexo !== "hombre");
  const sections = [
    { key: "men", label: "Hombres", visitors: men, childrenCount: 0 },
    { key: "women", label: "Mujeres y menores", visitors: womenAndTeens, childrenCount: underTwelveCount }
  ].filter((section) => section.visitors.length > 0 || section.childrenCount > 0);

  return sections.map((section) => (
    <article key={`${pass.id}-${section.key}`} className="pass-card apoyo-pass-card">
      <div className="apoyo-pass-header">
        <div className="apoyo-pass-headline">
          <div className="apoyo-pass-kicker">{section.label}</div>
          <div className="apoyo-pass-date">{formatLongDate(pass.fechaVisita)}</div>
        </div>
        <div className="apoyo-pass-number">{pass.numeroPase ?? "-"}</div>
      </div>

      <div className="apoyo-pass-meta">
        <div>
          <strong>PPL:</strong> {pass.internoNombre}
        </div>
        <div>
          <strong>Ubicacion:</strong> {pass.internoUbicacion}
        </div>
      </div>

      <div className="apoyo-pass-section">
        <div className="apoyo-pass-list">
          {section.visitors.map((visitor) => (
            <div
              key={`${pass.id}-${section.key}-${visitor.visitorId}`}
              className={`apoyo-pass-line ${visitor.edad < 18 ? "minor" : ""}`}
            >
              {formatVisitorLine(visitor)}
            </div>
          ))}
          {section.childrenCount > 0 ? (
            <div className="apoyo-pass-line minor">
              + {section.childrenCount} {section.childrenCount === 1 ? "menor" : "menores"}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  ));
}

function renderMentionPass(pass: ListingRecord) {
  const { basic, special } = splitMentions(pass.menciones);
  const extraSpecials = splitMentions(pass.especiales);
  const mergedSpecialLines = [
    ...special,
    ...extraSpecials.basic,
    ...extraSpecials.special,
    ...(!pass.especiales?.trim() && formatDeviceSummary(pass) ? [formatDeviceSummary(pass) as string] : [])
  ];

  return (
    <article key={pass.id} className="pass-card apoyo-pass-card mention-pass-card">
      <div className="apoyo-pass-header">
        <div className="apoyo-pass-headline">
          <div className="apoyo-pass-kicker">Menciones</div>
          <div className="apoyo-pass-date">{formatLongDate(pass.fechaVisita)}</div>
        </div>
        <div className="apoyo-pass-number">{pass.numeroPase ?? "-"}</div>
      </div>

      <div className="apoyo-pass-meta">
        <div>
          <strong>PPL:</strong> {pass.internoNombre}
        </div>
        <div>
          <strong>Ubicacion:</strong> {pass.internoUbicacion}
        </div>
      </div>

      {basic.length > 0 || mergedSpecialLines.length > 0 ? (
        <div className="apoyo-pass-section">
          <strong>Mencion</strong>
          <div className="apoyo-pass-list support-note-list">
            {basic.map((item, index) => (
              <div key={`${pass.id}-mention-basic-${index}`} className="apoyo-pass-line warning">
                {item}
              </div>
            ))}
            {mergedSpecialLines.length > 0 ? (
              <div className="support-note-block">
                <strong>Mencion especial</strong>
                {mergedSpecialLines.map((item, index) => (
                  <div key={`${pass.id}-mention-special-${index}`} className="apoyo-pass-line minor">
                    {item}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function PassListing({
  listings,
  printDate
}: {
  listings: ListingRecord[];
  printDate: string;
}) {
  const [printMode, setPrintMode] = useState<PrintMode>("listado");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const byDate = listings
      .filter((item) => item.fechaVisita === printDate)
      .filter(
        (item) =>
          !normalized ||
          item.internoNombre.toLowerCase().includes(normalized) ||
          item.internoUbicacion.toLowerCase().includes(normalized)
      );
    const sorted = sortListingsForPrint(byDate);
    if (printMode === "menciones") {
      return sorted.filter(
        (item) =>
          item.menciones?.trim() ||
          item.especiales?.trim() ||
          item.deviceItems.length > 0
      );
    }

    return sorted;
  }, [listings, printDate, printMode]);

  return (
    <section className="module-panel">
      <div className="pass-controls hide-print">
        <div className="toolbar">
          <button
            type="button"
            className={`button-secondary listing-toggle ${printMode === "listado" ? "active" : ""}`}
            onClick={() => setPrintMode("listado")}
          >
            Listado
          </button>
          <button
            type="button"
            className={`button-secondary listing-toggle ${printMode === "sexos" ? "active" : ""}`}
            onClick={() => setPrintMode("sexos")}
          >
            Hombres / Mujeres
          </button>
          <button
            type="button"
            className={`button-secondary listing-toggle ${printMode === "numeros" ? "active" : ""}`}
            onClick={() => setPrintMode("numeros")}
          >
            Numero de Pase
          </button>
          <button
            type="button"
            className={`button-secondary listing-toggle ${printMode === "menciones" ? "active" : ""}`}
            onClick={() => setPrintMode("menciones")}
          >
            Menciones
          </button>
          <button
            type="button"
            className="button-secondary listing-toggle"
            onClick={() => window.print()}
          >
            Imprimir
          </button>
        </div>
        <div className="field" style={{ marginTop: "0.8rem" }}>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setQuery("");
                  }
                }}
                placeholder="Buscar pase por interno"
                autoComplete="off"
              />
        </div>
      </div>

      <div
        className={`print-zone ${
          printMode === "listado"
            ? "apoyo-print-grid"
            : printMode === "numeros"
              ? "apoyo-numbers-grid"
              : "apoyo-secondary-grid"
        }`}
      >
        {filtered.length === 0 ? (
          <div className="data-card">
            <h3>Sin pases</h3>
          </div>
        ) : printMode === "listado" ? (
          filtered.map((pass) => renderMainPass(pass))
        ) : printMode === "sexos" ? (
          filtered.flatMap((pass) => renderSeparatedPasses(pass))
        ) : printMode === "menciones" ? (
          filtered.map((pass) => renderMentionPass(pass))
        ) : (
          <article className="pass-card delivery-print">
            <div className="numbers-print-list">
              {filtered.map((pass) => (
                <div key={pass.id} className="numbers-print-row">
                  <span>{pass.internoUbicacion}</span>
                  <span>{pass.internoNombre}</span>
                  <span className="numbers-print-value">{pass.numeroPase ?? "-"}</span>
                </div>
              ))}
            </div>
          </article>
        )}
      </div>

      {printMode === "listado" ? (
        <div className="print-sheet-footer">
          <div>#70-TODO LO NO AGREGADO EN LA PETICION DE SU PASE NO TENDRA AUTORIZACION PARA ENTRAR.</div>
          <div>#70-TODO LO QUE VENGA EN PETICION ESPECIAL / ENTREGAR A ADUANA PARA SU REVISION.</div>
        </div>
      ) : null}
    </section>
  );
}

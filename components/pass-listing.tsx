"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { updatePassAction } from "@/app/sistema/actions";
import { FullscreenLoading } from "@/components/fullscreen-loading";
import { LoadingButton } from "@/components/loading-button";
import { MutationBanner } from "@/components/mutation-banner";
import { ListingRecord, MutationState, PassEditData, RoleKey } from "@/lib/types";
import { formatLongDate, sortListingsForPrint } from "@/lib/utils";

type PrintMode = "listado" | "sexos" | "numeros" | "menciones";
const mutationInitialState: MutationState = { success: null, error: null };

function normalizeSearchText(value?: string | null) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

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

function chunkListingPages<T>(items: T[], size: number) {
  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    pages.push(items.slice(index, index + size));
  }

  return pages;
}

function renderSeparatedPasses(pass: ListingRecord) {
  const { visibleVisitors, underTwelveCount } = getVisibleVisitors(pass);
  const hasMen = visibleVisitors.some((visitor) => visitor.sexo === "hombre");
  const hasWomen = visibleVisitors.some((visitor) => visitor.sexo !== "hombre");
  const men = visibleVisitors.filter(
    (visitor) => visitor.sexo === "hombre" || (hasMen && visitor.edad >= 16 && visitor.edad < 18)
  );
  const womenAndTeens = visibleVisitors.filter((visitor) => !men.some((item) => item.visitorId === visitor.visitorId));
  const menChildrenCount =
    underTwelveCount > 0 && men.length > 0 && !hasWomen
      ? underTwelveCount
      : 0;
  const womenChildrenCount =
    underTwelveCount > 0
      ? menChildrenCount > 0
        ? 0
        : underTwelveCount
      : 0;
  const sections = [
    { key: "men", label: "Hombres", visitors: men, childrenCount: menChildrenCount },
    { key: "women", label: "Mujeres y menores", visitors: womenAndTeens, childrenCount: womenChildrenCount }
  ].filter((section) => section.visitors.length > 0 || section.childrenCount > 0);

  return sections.map((section) => (
    <article key={`${pass.id}-${section.key}`} className="pass-card apoyo-pass-card">
      <div className="apoyo-pass-header">
        <div className="apoyo-pass-headline">
          <div className="apoyo-pass-kicker">{section.label}</div>
          <div className="apoyo-pass-date">{formatLongDate(pass.fechaVisita)}</div>
        </div>
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
          <strong className="mention-title">Mencion</strong>
          <div className="apoyo-pass-list support-note-list">
            {basic.map((item, index) => (
              <div key={`${pass.id}-mention-basic-${index}`} className="apoyo-pass-line warning">
                {item}
              </div>
            ))}
            {mergedSpecialLines.length > 0 ? (
              <div className="support-note-block">
                <strong className="mention-title">Mencion especial</strong>
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
  printDate,
  initialMode = "listado",
  autoPrint = false,
  roleKey
}: {
  listings: ListingRecord[];
  printDate: string;
  initialMode?: PrintMode;
  autoPrint?: boolean;
  roleKey: RoleKey;
}) {
  const router = useRouter();
  const [printMode, setPrintMode] = useState<PrintMode>(initialMode);
  const [query, setQuery] = useState("");
  const [editData, setEditData] = useState<PassEditData | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editScreenLoading, setEditScreenLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editVisitorQuery, setEditVisitorQuery] = useState("");
  const [editSelectedVisitorIds, setEditSelectedVisitorIds] = useState<string[]>([]);
  const [articleQuantities, setArticleQuantities] = useState<Record<string, number>>({});
  const [updateState, updateAction, updatePending] = useActionState(updatePassAction, mutationInitialState);

  useEffect(() => {
    setPrintMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (!autoPrint) {
      return;
    }

    const timeout = window.setTimeout(() => {
      window.print();
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [autoPrint, printMode]);

  useEffect(() => {
    if (updateState.success) {
      setEditScreenLoading(false);
      setEditData(null);
      setEditVisitorQuery("");
      setEditSelectedVisitorIds([]);
      setArticleQuantities({});
      router.refresh();
      return;
    }

    if (updateState.error) {
      setEditScreenLoading(false);
    }
  }, [router, updateState.error, updateState.success]);

  const filtered = useMemo(() => {
    const normalized = normalizeSearchText(query);
    const byDate = listings
      .filter((item) => item.fechaVisita === printDate)
      .filter(
        (item) =>
          !normalized ||
          normalizeSearchText(item.internoNombre).includes(normalized) ||
          normalizeSearchText(item.internoUbicacion).includes(normalized) ||
          String(item.numeroPase ?? "").includes(normalized) ||
          item.visitantes.some((visitor) =>
            normalizeSearchText(visitor.nombre).includes(normalized)
          ) ||
          normalizeSearchText(item.menciones).includes(normalized) ||
          normalizeSearchText(item.especiales).includes(normalized)
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
  }, [listings, printDate, printMode, query]);
  const listingPages = useMemo(
    () => (printMode === "listado" ? chunkListingPages(filtered, 5) : []),
    [filtered, printMode]
  );

  const filteredEditVisitors = useMemo(() => {
    if (!editData) {
      return [];
    }

    const normalized = normalizeSearchText(editVisitorQuery);
    return editData.linkedVisitors.filter((visitor) => {
      if (!normalized) {
        return true;
      }

      return normalizeSearchText(`${visitor.nombre} ${visitor.parentesco} ${visitor.edad}`).includes(normalized);
    });
  }, [editData, editVisitorQuery]);

  const selectedEditAdults = useMemo(
    () =>
      (editData?.linkedVisitors ?? []).filter(
        (visitor) => editSelectedVisitorIds.includes(visitor.visitorId) && visitor.edad >= 18
      ),
    [editData, editSelectedVisitorIds]
  );

  async function openEditModal(passId: string) {
    setEditLoading(true);
    setEditError(null);

    try {
      const response = await fetch(`/api/listado/${passId}/edit`, { cache: "no-store" });
      const payload = (await response.json()) as PassEditData & { error?: string };

      if (!response.ok || payload.error) {
        setEditError(payload.error || "No se pudo cargar el pase.");
        return;
      }

      setEditData(payload);
      setEditSelectedVisitorIds(payload.pass.visitantes.map((visitor) => visitor.visitorId));
      setArticleQuantities(
        payload.pass.deviceItems.reduce<Record<string, number>>((acc, item) => {
          acc[item.deviceTypeId] = item.quantity;
          return acc;
        }, {})
      );
      setEditVisitorQuery("");
    } catch {
      setEditError("No se pudo cargar el pase.");
    } finally {
      setEditLoading(false);
    }
  }

  function closeEditModal() {
    setEditData(null);
    setEditError(null);
    setEditVisitorQuery("");
    setEditSelectedVisitorIds([]);
    setArticleQuantities({});
  }

  function toggleEditVisitor(visitorId: string) {
    setEditSelectedVisitorIds((current) =>
      current.includes(visitorId) ? current.filter((item) => item !== visitorId) : [...current, visitorId]
    );
  }

  return (
    <section className={`module-panel print-module-panel print-mode-${printMode}`}>
      <FullscreenLoading active={editScreenLoading || editLoading} label="Loading..." />
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

      {editError && !editData ? <div className="alert-box hide-print">{editError}</div> : null}

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
          listingPages.map((page, pageIndex) => (
            <section
              key={`listing-page-${pageIndex}`}
              className={`listing-print-page ${pageIndex < listingPages.length - 1 ? "listing-print-page-break" : ""}`}
            >
              <div className="listing-print-page-body">
                {page.map((pass) => (
                  <div key={pass.id} className="listing-card-stack">
                    {roleKey === "super-admin" ? (
                      <div className="listing-card-actions hide-print">
                        <button type="button" className="button-soft" onClick={() => void openEditModal(pass.id)}>
                          Editar pase
                        </button>
                      </div>
                    ) : null}
                    {renderMainPass(pass)}
                  </div>
                ))}
              </div>
              <div className="print-sheet-footer listing-page-footer">
                <div>#70-TODO LO NO AGREGADO EN LA PETICION DE SU PASE NO TENDRA AUTORIZACION PARA ENTRAR.</div>
                <div>#70-TODO LO QUE VENGA EN PETICION ESPECIAL / ENTREGAR A ADUANA PARA SU REVISION.</div>
              </div>
            </section>
          ))
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

        {editData ? (
        <div className="modal-backdrop hide-print" onClick={closeEditModal}>
          <section className="modal-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <strong>Editar pase</strong>
                <div className="muted">
                  {editData.pass.internoNombre} · {formatLongDate(editData.pass.fechaVisita)}
                </div>
              </div>
              <button type="button" className="button-soft" onClick={closeEditModal}>
                Cerrar
              </button>
            </div>

            {editError ? <div className="alert-box">{editError}</div> : null}
            <MutationBanner state={updateState} resetKey={editData.pass.id} stateKey={editData.pass.id} />

            <form
              action={updateAction}
              className="field-grid"
              autoComplete="off"
              onSubmitCapture={() => setEditScreenLoading(true)}
            >
              <input type="hidden" name="listado_id" value={editData.pass.id} />
              <input type="hidden" name="interno_id" value={editData.pass.internoId} />
              {editSelectedVisitorIds.map((visitorId) => (
                <input key={visitorId} type="hidden" name="visitor_ids" value={visitorId} />
              ))}
              {Object.entries(articleQuantities)
                .filter(([, quantity]) => quantity > 0)
                .map(([deviceTypeId, quantity]) => (
                  <input key={deviceTypeId} type="hidden" name={`article_qty_${deviceTypeId}`} value={quantity} />
                ))}

              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <textarea name="menciones" defaultValue={editData.pass.menciones ?? ""} placeholder="Peticiones basicas" />
              </div>
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <textarea name="especiales" defaultValue={editData.pass.especiales ?? ""} placeholder="Peticiones especiales" />
              </div>

              <section className="two-column-section visitor-columns-section" style={{ gridColumn: "1 / -1" }}>
                <article className="data-card visitor-column-card">
                  <strong style={{ display: "block", marginBottom: "0.7rem" }}>Visitas del interno</strong>
                  <div className="field visitor-search-field">
                    <input
                      value={editVisitorQuery}
                      onChange={(event) => setEditVisitorQuery(event.target.value)}
                      placeholder="Buscar visita"
                      autoComplete="off"
                    />
                  </div>
                  <div className="visitor-choice-grid visitor-column-list">
                    {filteredEditVisitors.map((visitor) => (
                      <button
                        key={`${editData.pass.id}-${visitor.visitorId}`}
                        type="button"
                        className={`visitor-choice-item ${editSelectedVisitorIds.includes(visitor.visitorId) ? "selected" : ""}`}
                        onClick={() => toggleEditVisitor(visitor.visitorId)}
                      >
                        <strong>{visitor.nombre}</strong>
                        <span className="muted">
                          {visitor.parentesco} · {visitor.edad} años
                        </span>
                      </button>
                    ))}
                  </div>
                </article>

                <article className="data-card visitor-column-card">
                  <strong style={{ display: "block", marginBottom: "0.7rem" }}>Articulos del pase</strong>
                  <div className="field-grid">
                    {editData.passArticles.map((article) => (
                      <div key={article.id} className="field">
                        <label htmlFor={`edit-article-${article.id}`}>{article.name}</label>
                        <input
                          id={`edit-article-${article.id}`}
                          type="number"
                          min={0}
                          value={articleQuantities[article.id] ?? 0}
                          onChange={(event) =>
                            setArticleQuantities((current) => ({
                              ...current,
                              [article.id]: Math.max(0, Number(event.target.value) || 0)
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                </article>
              </section>

              <div className="actions-row" style={{ gridColumn: "1 / -1" }}>
                <LoadingButton
                  pending={updatePending}
                  label="Guardar cambios"
                  loadingLabel="Loading..."
                  className="button"
                  disabled={editSelectedVisitorIds.length === 0 || selectedEditAdults.length === 0}
                />
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}

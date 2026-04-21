import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { ListingRecord, PassVisitor } from "@/lib/types";
import { formatLongDate, sortListingsForPrint } from "@/lib/utils";

export type ListingPdfMode = "listado" | "sexos" | "numeros" | "menciones";

const PT_PER_MM = 72 / 25.4;
const PAGE_WIDTH = 8.5 * 72;
const PAGE_HEIGHT = 14 * 72;
const MARGINS = {
  top: 8 * PT_PER_MM,
  bottom: 8.5 * PT_PER_MM,
  left: 5 * PT_PER_MM,
  right: 5 * PT_PER_MM
};
const COLORS = {
  text: rgb(0.09, 0.13, 0.2),
  muted: rgb(0.34, 0.43, 0.55),
  border: rgb(0.06, 0.09, 0.16),
  warning: rgb(0.79, 0.34, 0.1),
  danger: rgb(0.76, 0.19, 0.19)
};

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

function formatDeviceSummary(pass: ListingRecord) {
  if (pass.deviceItems.length === 0) {
    return null;
  }

  return pass.deviceItems.map((item) => `${item.name} [${item.quantity}]`).join(", ");
}

function formatVisitorLine(visitor: PassVisitor) {
  if (visitor.edad >= 12 && visitor.edad <= 17) {
    return `${visitor.nombre} ${visitor.edad} años`;
  }
  return visitor.nombre;
}

function filterListingsForPdf(
  listings: ListingRecord[],
  printDate: string,
  mode: ListingPdfMode,
  query?: string | null
) {
  const normalized = normalizeSearchText(query);
  const byDate = listings
    .filter((item) => item.fechaVisita === printDate)
    .filter(
      (item) =>
        !normalized ||
        normalizeSearchText(item.internoNombre).includes(normalized) ||
        normalizeSearchText(item.internoUbicacion).includes(normalized) ||
        String(item.numeroPase ?? "").includes(normalized) ||
        item.visitantes.some((visitor) => normalizeSearchText(visitor.nombre).includes(normalized)) ||
        normalizeSearchText(item.menciones).includes(normalized) ||
        normalizeSearchText(item.especiales).includes(normalized)
    );

  const sorted = sortListingsForPrint(byDate);
  if (mode === "menciones") {
    return sorted.filter((item) => item.menciones?.trim() || item.especiales?.trim() || item.deviceItems.length > 0);
  }
  return sorted;
}

function chunkItems<T>(items: T[], size: number) {
  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    pages.push(items.slice(index, index + size));
  }
  return pages;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) {
    return [];
  }

  const words = clean.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
      current = "";
    }

    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      current = word;
      continue;
    }

    let fragment = "";
    for (const character of word) {
      const piece = `${fragment}${character}`;
      if (font.widthOfTextAtSize(piece, size) <= maxWidth) {
        fragment = piece;
      } else {
        if (fragment) {
          lines.push(fragment);
        }
        fragment = character;
      }
    }
    current = fragment;
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function ellipsizeLine(text: string, font: PDFFont, size: number, maxWidth: number) {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) {
    return text;
  }

  let value = text;
  while (value.length > 1 && font.widthOfTextAtSize(`${value}…`, size) > maxWidth) {
    value = value.slice(0, -1);
  }
  return `${value}…`;
}

function drawTextLine(
  page: PDFPage,
  text: string,
  x: number,
  top: number,
  size: number,
  font: PDFFont,
  color = COLORS.text
) {
  page.drawText(text, {
    x,
    y: PAGE_HEIGHT - top - size,
    size,
    font,
    color
  });
}

function drawWrappedBlock(options: {
  page: PDFPage;
  font: PDFFont;
  text: string;
  x: number;
  top: number;
  width: number;
  size: number;
  color?: ReturnType<typeof rgb>;
  maxLines?: number;
  lineGap?: number;
}) {
  const { page, font, text, x, width, size, maxLines = Number.MAX_SAFE_INTEGER } = options;
  const color = options.color ?? COLORS.text;
  const lineGap = options.lineGap ?? size * 0.28;
  const allLines = wrapText(text, font, size, width);
  const lines = allLines.slice(0, maxLines).map((line, index) =>
    index === maxLines - 1 && allLines.length > maxLines ? ellipsizeLine(line, font, size, width) : line
  );
  let currentTop = options.top;

  lines.forEach((line) => {
    drawTextLine(page, line, x, currentTop, size, font, color);
    currentTop += size + lineGap;
  });

  return currentTop;
}

function drawFooter(page: PDFPage, regularFont: PDFFont) {
  const footerSize = 5.2;
  let top = PAGE_HEIGHT - MARGINS.bottom - 20;
  drawTextLine(
    page,
    "#70-TODO LO NO AGREGADO EN LA PETICION DE SU PASE NO TENDRA AUTORIZACION PARA ENTRAR.",
    MARGINS.left,
    top,
    footerSize,
    regularFont,
    COLORS.danger
  );
  top += footerSize + 1.5;
  drawTextLine(
    page,
    "#70-TODO LO QUE VENGA EN PETICION ESPECIAL / ENTREGAR A ADUANA PARA SU REVISION.",
    MARGINS.left,
    top,
    footerSize,
    regularFont,
    COLORS.danger
  );
}

function drawMainListingCard(options: {
  page: PDFPage;
  pass: ListingRecord;
  top: number;
  cardHeight: number;
  regularFont: PDFFont;
  boldFont: PDFFont;
}) {
  const { page, pass, top, cardHeight, regularFont, boldFont } = options;
  const x = MARGINS.left;
  const width = PAGE_WIDTH - MARGINS.left - MARGINS.right;
  const y = PAGE_HEIGHT - top - cardHeight;
  const innerX = x + 8;
  const innerWidth = width - 16;
  const rightX = x + width - 34;

  page.drawRectangle({
    x,
    y,
    width,
    height: cardHeight,
    borderColor: COLORS.border,
    borderWidth: 1.5
  });

  const { listedVisitors, hiddenVisitorsCount, underTwelveCount } = getCompactVisibleVisitors(pass);
  const { basic, special } = splitMentions(pass.menciones);
  const extraSpecials = splitMentions(pass.especiales);
  const specialLines = [
    ...extraSpecials.basic,
    ...extraSpecials.special,
    ...special,
    ...(!pass.especiales?.trim() && formatDeviceSummary(pass) ? [formatDeviceSummary(pass) as string] : [])
  ];

  let cursorTop = top + 8;
  drawTextLine(page, "REGISTRO PASE PARA TERRAZA", innerX, cursorTop, 10.2, boldFont);
  drawTextLine(page, formatLongDate(pass.fechaVisita), innerX + 168, cursorTop, 10.2, regularFont, COLORS.muted);
  drawTextLine(page, String(pass.numeroPase ?? "-"), rightX, top + 6, 29, boldFont);

  cursorTop += 22;
  drawTextLine(page, "PPL:", innerX, cursorTop, 10.2, boldFont);
  drawTextLine(page, pass.internoNombre, innerX + 28, cursorTop, 10.2, regularFont);

  cursorTop += 18;
  drawTextLine(page, "Ubicacion:", innerX, cursorTop, 10.2, boldFont);
  drawTextLine(page, pass.internoUbicacion, innerX + 54, cursorTop, 10.2, regularFont);

  cursorTop += 20;
  drawTextLine(page, "Visitas:", innerX, cursorTop, 10.2, boldFont);
  cursorTop += 14;

  listedVisitors.forEach((visitor) => {
    cursorTop = drawWrappedBlock({
      page,
      font: regularFont,
      text: formatVisitorLine(visitor),
      x: innerX,
      top: cursorTop,
      width: innerWidth,
      size: 9.6,
      maxLines: 1
    });
  });

  if (underTwelveCount > 0) {
    cursorTop = drawWrappedBlock({
      page,
      font: regularFont,
      text: `+ ${underTwelveCount} ${underTwelveCount === 1 ? "menor" : "menores"}`,
      x: innerX,
      top: cursorTop,
      width: innerWidth,
      size: 9.6,
      color: COLORS.danger,
      maxLines: 1
    });
  }

  if (hiddenVisitorsCount > 0) {
    cursorTop = drawWrappedBlock({
      page,
      font: regularFont,
      text: `+ ${hiddenVisitorsCount} visitas en Hombres / Mujeres`,
      x: innerX,
      top: cursorTop,
      width: innerWidth,
      size: 9.6,
      color: COLORS.warning,
      maxLines: 1
    });
  }

  if (basic.length > 0) {
    cursorTop += 8;
    drawTextLine(page, "Peticion:", innerX, cursorTop, 10.2, boldFont);
    cursorTop += 14;
    basic.slice(0, 2).forEach((item) => {
      cursorTop = drawWrappedBlock({
        page,
        font: regularFont,
        text: item,
        x: innerX,
        top: cursorTop,
        width: innerWidth,
        size: 9.2,
        color: COLORS.warning,
        maxLines: 1
      });
    });
  }

  if (specialLines.length > 0) {
    cursorTop += 8;
    drawTextLine(page, "Peticion especial:", innerX, cursorTop, 10.2, boldFont);
    cursorTop += 14;
    specialLines.slice(0, 2).forEach((item) => {
      cursorTop = drawWrappedBlock({
        page,
        font: regularFont,
        text: item,
        x: innerX,
        top: cursorTop,
        width: innerWidth,
        size: 9.2,
        color: COLORS.danger,
        maxLines: 1
      });
    });
  }
}

function getSexSections(pass: ListingRecord) {
  const { visibleVisitors, underTwelveCount } = getVisibleVisitors(pass);
  const hasMen = visibleVisitors.some((visitor) => visitor.sexo === "hombre");
  const hasWomen = visibleVisitors.some((visitor) => visitor.sexo !== "hombre");
  const men = visibleVisitors.filter(
    (visitor) => visitor.sexo === "hombre" || (hasMen && visitor.edad >= 16 && visitor.edad < 18)
  );
  const womenAndTeens = visibleVisitors.filter((visitor) => !men.some((item) => item.visitorId === visitor.visitorId));
  const menChildrenCount = underTwelveCount > 0 && men.length > 0 && !hasWomen ? underTwelveCount : 0;
  const womenChildrenCount = underTwelveCount > 0 ? (menChildrenCount > 0 ? 0 : underTwelveCount) : 0;

  return [
    { key: "men", label: "HOMBRES", visitors: men, childrenCount: menChildrenCount },
    { key: "women", label: "MUJERES Y MENORES", visitors: womenAndTeens, childrenCount: womenChildrenCount }
  ].filter((section) => section.visitors.length > 0 || section.childrenCount > 0);
}

function drawSecondaryCard(options: {
  page: PDFPage;
  top: number;
  cardHeight: number;
  title: string;
  date: string;
  internalName: string;
  location: string;
  bodyLines: { text: string; color?: ReturnType<typeof rgb>; bold?: boolean }[];
  regularFont: PDFFont;
  boldFont: PDFFont;
}) {
  const { page, top, cardHeight, title, date, internalName, location, bodyLines, regularFont, boldFont } = options;
  const x = MARGINS.left;
  const width = PAGE_WIDTH - MARGINS.left - MARGINS.right;
  const y = PAGE_HEIGHT - top - cardHeight;
  const innerX = x + 10;
  const innerWidth = width - 20;

  page.drawLine({
    start: { x, y },
    end: { x: x + width, y },
    thickness: 1.1,
    color: COLORS.danger
  });

  let cursorTop = top + 8;
  drawTextLine(page, title, innerX, cursorTop, 9.2, boldFont);
  drawTextLine(page, date, innerX + 98, cursorTop, 9.2, regularFont, COLORS.muted);
  cursorTop += 18;
  drawTextLine(page, "PPL:", innerX, cursorTop, 9.2, boldFont);
  drawTextLine(page, internalName, innerX + 24, cursorTop, 9.2, regularFont);
  cursorTop += 16;
  drawTextLine(page, "Ubicacion:", innerX, cursorTop, 9.2, boldFont);
  drawTextLine(page, location, innerX + 50, cursorTop, 9.2, regularFont);
  cursorTop += 18;

  bodyLines.slice(0, 8).forEach((line) => {
    cursorTop = drawWrappedBlock({
      page,
      font: line.bold ? boldFont : regularFont,
      text: line.text,
      x: innerX,
      top: cursorTop,
      width: innerWidth,
      size: 9.2,
      color: line.color ?? COLORS.text,
      maxLines: 2
    });
  });
}

function drawNumbersRow(options: {
  page: PDFPage;
  top: number;
  rowHeight: number;
  pass: ListingRecord;
  regularFont: PDFFont;
  boldFont: PDFFont;
}) {
  const { page, top, rowHeight, pass, regularFont, boldFont } = options;
  const x = MARGINS.left;
  const width = PAGE_WIDTH - MARGINS.left - MARGINS.right;
  const y = PAGE_HEIGHT - top - rowHeight;
  const leftWidth = 58;
  const rightWidth = 64;
  const middleWidth = width - leftWidth - rightWidth - 24;

  page.drawRectangle({
    x,
    y,
    width,
    height: rowHeight,
    borderColor: COLORS.border,
    borderWidth: 1.5
  });

  const textTop = top + rowHeight / 2 - 10;
  drawWrappedBlock({
    page,
    font: regularFont,
    text: pass.internoUbicacion,
    x: x + 10,
    top: textTop,
    width: leftWidth - 12,
    size: 10.125,
    maxLines: 1
  });
  drawWrappedBlock({
    page,
    font: regularFont,
    text: pass.internoNombre,
    x: x + leftWidth + 4,
    top: textTop,
    width: middleWidth,
    size: 10.125,
    maxLines: 2
  });
  drawTextLine(page, String(pass.numeroPase ?? "-"), x + width - rightWidth + 18, top + rowHeight / 2 - 18, 28, boldFont);
}

function drawListadoMode(pdf: PDFDocument, listings: ListingRecord[], regularFont: PDFFont, boldFont: PDFFont) {
  const footerHeight = 22;
  const gap = 6;
  const cardsPerPage = 5;
  const availableHeight = PAGE_HEIGHT - MARGINS.top - MARGINS.bottom - footerHeight - gap * (cardsPerPage - 1);
  const cardHeight = availableHeight / cardsPerPage;

  for (const pageItems of chunkItems(listings, cardsPerPage)) {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pageItems.forEach((pass, index) => {
      const top = MARGINS.top + index * (cardHeight + gap);
      drawMainListingCard({ page, pass, top, cardHeight, regularFont, boldFont });
    });
    drawFooter(page, regularFont);
  }
}

function drawSexosMode(pdf: PDFDocument, listings: ListingRecord[], regularFont: PDFFont, boldFont: PDFFont) {
  const cards = listings.flatMap((pass) =>
    getSexSections(pass).map((section) => ({
      pass,
      title: section.label,
      bodyLines: [
        ...section.visitors.map((visitor) => ({ text: formatVisitorLine(visitor) })),
        ...(section.childrenCount > 0
          ? [{ text: `+ ${section.childrenCount} ${section.childrenCount === 1 ? "menor" : "menores"}`, color: COLORS.danger }]
          : [])
      ]
    }))
  );
  const cardsPerPage = 6;
  const gap = 8;
  const cardHeight = (PAGE_HEIGHT - MARGINS.top - MARGINS.bottom - gap * (cardsPerPage - 1)) / cardsPerPage;

  for (const pageCards of chunkItems(cards, cardsPerPage)) {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pageCards.forEach((card, index) => {
      const top = MARGINS.top + index * (cardHeight + gap);
      drawSecondaryCard({
        page,
        top,
        cardHeight,
        title: card.title,
        date: formatLongDate(card.pass.fechaVisita),
        internalName: card.pass.internoNombre,
        location: card.pass.internoUbicacion,
        bodyLines: card.bodyLines,
        regularFont,
        boldFont
      });
    });
  }
}

function drawMentionsMode(pdf: PDFDocument, listings: ListingRecord[], regularFont: PDFFont, boldFont: PDFFont) {
  const cards = listings.map((pass) => {
    const { basic, special } = splitMentions(pass.menciones);
    const extraSpecials = splitMentions(pass.especiales);
    const mergedSpecialLines = [
      ...special,
      ...extraSpecials.basic,
      ...extraSpecials.special,
      ...(!pass.especiales?.trim() && formatDeviceSummary(pass) ? [formatDeviceSummary(pass) as string] : [])
    ];
    const bodyLines = [
      ...(basic.length > 0 ? [{ text: "Mencion", color: COLORS.danger, bold: true }] : []),
      ...basic.map((item) => ({ text: item, color: COLORS.warning })),
      ...(mergedSpecialLines.length > 0 ? [{ text: "Mencion especial", color: COLORS.danger, bold: true }] : []),
      ...mergedSpecialLines.map((item) => ({ text: item, color: COLORS.danger }))
    ];
    return {
      pass,
      bodyLines
    };
  });
  const cardsPerPage = 6;
  const gap = 8;
  const cardHeight = (PAGE_HEIGHT - MARGINS.top - MARGINS.bottom - gap * (cardsPerPage - 1)) / cardsPerPage;

  for (const pageCards of chunkItems(cards, cardsPerPage)) {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pageCards.forEach((card, index) => {
      const top = MARGINS.top + index * (cardHeight + gap);
      drawSecondaryCard({
        page,
        top,
        cardHeight,
        title: "MENCIONES",
        date: formatLongDate(card.pass.fechaVisita),
        internalName: card.pass.internoNombre,
        location: card.pass.internoUbicacion,
        bodyLines: card.bodyLines,
        regularFont,
        boldFont
      });
    });
  }
}

function drawNumerosMode(pdf: PDFDocument, listings: ListingRecord[], regularFont: PDFFont, boldFont: PDFFont) {
  const rowsPerPage = 16;
  const gap = 6;
  const rowHeight = (PAGE_HEIGHT - MARGINS.top - MARGINS.bottom - gap * (rowsPerPage - 1)) / rowsPerPage;

  for (const pageRows of chunkItems(listings, rowsPerPage)) {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pageRows.forEach((pass, index) => {
      const top = MARGINS.top + index * (rowHeight + gap);
      drawNumbersRow({ page, top, rowHeight, pass, regularFont, boldFont });
    });
  }
}

export async function generateListingPdf(options: {
  listings: ListingRecord[];
  printDate: string;
  mode: ListingPdfMode;
  query?: string | null;
}) {
  const pdf = await PDFDocument.create();
  const regularFont = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const filtered = filterListingsForPdf(options.listings, options.printDate, options.mode, options.query);

  if (options.mode === "listado") {
    drawListadoMode(pdf, filtered, regularFont, boldFont);
  } else if (options.mode === "sexos") {
    drawSexosMode(pdf, filtered, regularFont, boldFont);
  } else if (options.mode === "menciones") {
    drawMentionsMode(pdf, filtered, regularFont, boldFont);
  } else {
    drawNumerosMode(pdf, filtered, regularFont, boldFont);
  }

  if (pdf.getPageCount() === 0) {
    pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  }

  return pdf.save();
}

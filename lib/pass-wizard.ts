import {
  ModuleDeviceType,
  PassWizardState,
  PassWizardVisit,
  WizardCard
} from "@/lib/types";

export const DOCUMENT_OPTIONS = [
  "CURP",
  "Acta de nacimiento",
  "Cartilla de vacunacion",
  "Credencial escolar",
  "Credencial laboral",
  "Pasaporte",
  "INE vencida",
  "INE en tramite",
  "Sin INE",
  "Licencia",
  "Otro documento"
] as const;

export const CONDITION_OPTIONS = [
  "Acompanado por abuela",
  "Acompanado por abuelo",
  "Acompanado por mama",
  "Acompanado por papa",
  "Acompanado por hermano mayor",
  "Acompanado por hermana mayor",
  "Acompanado por tio/tia",
  "Acompanado por tutor",
  "Silla de ruedas",
  "Discapacidad",
  "Muletas",
  "Embarazo",
  "ECO reciente",
  "Faja medica",
  "Yeso / venda",
  "Cirugia reciente",
  "Medicamento",
  "Visita foranea",
  "Horario especial",
  "Diferente horario",
  "Se queda de noche",
  "Permiso especial"
] as const;

export const BASIC_ARTICLE_CATALOG = [
  {
    group: "Alimentos",
    items: [
      "Comida preparada",
      "Despensa",
      "Carnes/proteinas",
      "Frutas/verduras",
      "Pan/tortillas",
      "Lacteos",
      "Botanas/dulces",
      "Bebidas",
      "Condimentos"
    ]
  },
  {
    group: "Higiene",
    items: [
      "Aseo personal",
      "Papel/toallitas",
      "Limpieza ropa",
      "Limpieza domestica",
      "Cuidado basico"
    ]
  },
  {
    group: "Ropa",
    items: [
      "Ropa permitida",
      "Cambio ropa",
      "Calzado",
      "Gorras",
      "Textiles"
    ]
  },
  {
    group: "Bebe",
    items: [
      "Panalera",
      "Panales",
      "Carriola",
      "Leche/biberones",
      "Ropa bebe",
      "Accesorios bebe"
    ]
  },
  {
    group: "Personales",
    items: [
      "Bolsa/mochila",
      "Cosmeticos",
      "Accesorios",
      "Recipientes",
      "Carrito"
    ]
  }
] as const;

export const SPECIAL_ARTICLE_CATALOG = [
  {
    group: "Especiales",
    items: [
      "33 economico",
      "Diferente horario",
      "Autorizacion especial",
      "Clave o folio",
      "Pieza electrica",
      "Celular",
      "Cargador",
      "Audifonos",
      "Bocina",
      "Radio",
      "Tablet",
      "Producto en polvo",
      "Objeto grande",
      "Objeto no comun",
      "Revision especial"
    ]
  }
] as const;

export const SIMPLE_SPECIAL_OPTIONS = [
  "33 economico",
  "Diferente horario",
  "Autorizacion especial",
  "Clave o folio",
  "Revision especial"
] as const;

export const QUANTITY_SPECIAL_OPTIONS = [
  "Pieza electrica",
  "Celular",
  "Cargador",
  "Audifonos",
  "Bocina",
  "Radio",
  "Tablet",
  "Producto en polvo",
  "Objeto grande",
  "Objeto no comun"
] as const;

const GENERAL_TARGET_KEY = "__general__";

const SIMPLE_SPECIAL_SET = new Set<string>(SIMPLE_SPECIAL_OPTIONS);

const CONDITION_WITH_ACCESSORY = new Set([
  "Silla de ruedas",
  "Discapacidad",
  "Muletas",
  "Faja medica",
  "Yeso / venda",
  "Cirugia reciente",
  "Medicamento"
]);

const CONDITION_WITH_STATUS = new Set([
  "Visita foranea",
  "Horario especial",
  "Diferente horario",
  "Permiso especial"
]);

const SPECIAL_ARTICLE_ALIASES: Record<string, string[]> = {
  celular: ["celular"],
  cargador: ["cargador"],
  audifonos: ["audifonos"],
  bocina: ["bocina", "sonido"],
  radio: ["radio", "sonido"],
  tablet: ["tablet"],
  "pieza electrica": ["pieza electrica"],
  "otro aparato": ["otro aparato"]
};

function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s/]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lowerFirst(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (/^[A-ZÁÉÍÓÚÜÑ]{2,}/u.test(trimmed)) {
    return trimmed;
  }

  return `${trimmed.charAt(0).toLocaleLowerCase("es-MX")}${trimmed.slice(1)}`;
}

function withPeriod(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function joinSpanishList(items: string[]) {
  const normalized = items.map((item) => item.trim()).filter(Boolean);
  if (normalized.length === 0) {
    return "";
  }

  if (normalized.length === 1) {
    return normalized[0];
  }

  if (normalized.length === 2) {
    return `${normalized[0]} y ${normalized[1]}`;
  }

  return `${normalized.slice(0, -1).join(", ")} y ${normalized[normalized.length - 1]}`;
}

function uniquePreserveOrder(values: string[]) {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}

function isMinor(visit: PassWizardVisit) {
  return visit.edad < 18;
}

function makeMinorLead(visit: PassWizardVisit) {
  return `${visit.sexo === "mujer" ? "La menor" : "El menor"} ${visit.visitante_nombre}`;
}

function makeNamedSubject(visit: PassWizardVisit) {
  return isMinor(visit) ? makeMinorLead(visit) : visit.visitante_nombre;
}

function buildDocumentationSentence(card: WizardCard, visit: PassWizardVisit | null) {
  if (!visit) {
    if (card.valor === "Sin INE") {
      return withPeriod("Ingresan sin INE");
    }

    return withPeriod(`Ingresan con ${card.valor}`);
  }

  if (card.valor === "Sin INE") {
    return withPeriod(`${visit.visitante_nombre} ingresa sin INE`);
  }

  if (card.valor === "INE vencida") {
    return withPeriod(`${visit.visitante_nombre} ingresa con INE vencida`);
  }

  if (card.valor === "INE en tramite") {
    return withPeriod(`${visit.visitante_nombre} ingresa con INE en tramite`);
  }

  return withPeriod(`${makeNamedSubject(visit)} ingresa con ${card.valor}`);
}

function buildCompanionSentence(card: WizardCard, visit: PassWizardVisit | null) {
  const companion = lowerFirst(card.valor.replace(/^Acompanado por\s+/u, ""));
  if (!visit) {
    return withPeriod(`Ingresan acompanados por su ${companion}`);
  }

  const subject = isMinor(visit) ? makeMinorLead(visit) : visit.visitante_nombre;
  return withPeriod(`${subject} ingresa acompanado por su ${companion}`);
}

function buildConditionSentence(card: WizardCard, visit: PassWizardVisit | null) {
  if (card.valor.startsWith("Acompanado por ")) {
    return buildCompanionSentence(card, visit);
  }

  if (card.valor === "Se queda de noche") {
    if (!visit) {
      return withPeriod("Se quedan de noche");
    }

    return withPeriod(`${visit.visitante_nombre} se queda de noche`);
  }

  if (CONDITION_WITH_ACCESSORY.has(card.valor) || CONDITION_WITH_STATUS.has(card.valor)) {
    if (!visit) {
      return withPeriod(`Ingresan con ${lowerFirst(card.valor)}`);
    }

    return withPeriod(`${visit.visitante_nombre} ingresa con ${lowerFirst(card.valor)}`);
  }

  if (!visit) {
    return withPeriod(`Ingresan con ${lowerFirst(card.valor)}`);
  }

  return withPeriod(`${visit.visitante_nombre} ingresa con ${lowerFirst(card.valor)}`);
}

function buildPregnancySentence(visit: PassWizardVisit | null) {
  if (!visit) {
    return withPeriod("Ingresan con embarazo y ECO reciente");
  }

  return withPeriod(`${visit.visitante_nombre} ingresa con embarazo y ECO reciente`);
}

function buildSimpleSpecialSentence(card: WizardCard, visit: PassWizardVisit | null) {
  if (card.valor === "33 economico") {
    if (visit) {
      return withPeriod(`${visit.visitante_nombre} ingresa con 33 economico`);
    }

    return withPeriod("Ingresa 33 economico");
  }

  if (!visit) {
    return withPeriod(`Ingresan con ${lowerFirst(card.valor)}`);
  }

  return withPeriod(`${visit.visitante_nombre} ingresa con ${lowerFirst(card.valor)}`);
}

function buildQuantitySpecialPhrase(card: WizardCard, quantity: number) {
  const detail = card.detalle.trim() ? ` (${card.detalle.trim()})` : "";
  const review = card.requiere_revision ? " para revision" : "";
  return `${Math.max(1, quantity || 1)} ${lowerFirst(card.valor)}${review}${detail}`;
}

function buildFinalText(generated: string, manual: string) {
  const generatedText = generated.trim();
  const manualText = manual.trim();
  if (!generatedText) {
    return manualText;
  }

  if (!manualText) {
    return generatedText;
  }

  return `${generatedText}\n${manualText}`;
}

function sortCardsByWizardOrder(cards: WizardCard[]) {
  const priorityMap: Record<WizardCard["type"], number> = {
    documentacion: 0,
    condicion: 1,
    articulo_basico: 2,
    articulo_especial: 3
  };

  return [...cards].sort((left, right) => {
    const priorityDiff = priorityMap[left.type] - priorityMap[right.type];
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    const leftTarget = left.visitante_id ?? GENERAL_TARGET_KEY;
    const rightTarget = right.visitante_id ?? GENERAL_TARGET_KEY;
    if (leftTarget !== rightTarget) {
      return leftTarget.localeCompare(rightTarget);
    }

    return left.id.localeCompare(right.id);
  });
}

export function createEmptyWizardState(): PassWizardState {
  return {
    fecha_visita: "",
    interno_id: "",
    ubicacion: "",
    visitas_seleccionadas: [],
    cards: [],
    menciones_basicas_generadas: "",
    menciones_especiales_generadas: "",
    menciones_basicas_manual: "",
    menciones_especiales_manual: "",
    menciones_basicas_final: "",
    menciones_especiales_final: ""
  };
}

export function generateMenciones(wizardState: PassWizardState) {
  const visitMap = new Map(
    wizardState.visitas_seleccionadas.map((visit) => [visit.visitante_id, visit] as const)
  );

  const basicSentences: string[] = [];
  const specialSentences: string[] = [];
  const sortedCards = sortCardsByWizardOrder(wizardState.cards);

  for (const card of sortedCards.filter((item) => item.type === "documentacion")) {
    const visit = card.visitante_id ? visitMap.get(card.visitante_id) ?? null : null;
    basicSentences.push(buildDocumentationSentence(card, visit));
  }

  const conditionGroups = new Map<string, WizardCard[]>();
  for (const card of sortedCards.filter((item) => item.type === "condicion")) {
    const key = card.visitante_id ?? GENERAL_TARGET_KEY;
    const current = conditionGroups.get(key) ?? [];
    current.push(card);
    conditionGroups.set(key, current);
  }

  for (const [groupKey, cards] of conditionGroups) {
    const visit = groupKey === GENERAL_TARGET_KEY ? null : visitMap.get(groupKey) ?? null;
    const hasPregnancy = cards.some((item) => item.valor === "Embarazo");
    const hasEco = cards.some((item) => item.valor === "ECO reciente");

    if (hasPregnancy && hasEco) {
      basicSentences.push(buildPregnancySentence(visit));
    }

    for (const card of cards) {
      if ((card.valor === "Embarazo" || card.valor === "ECO reciente") && hasPregnancy && hasEco) {
        continue;
      }

      basicSentences.push(buildConditionSentence(card, visit));
    }
  }

  const generalBasicCards = sortedCards.filter(
    (item) => item.type === "articulo_basico" && !item.visitante_id
  );
  if (generalBasicCards.length > 0) {
    basicSentences.push(
      withPeriod(
        `Ingresan con ${joinSpanishList(uniquePreserveOrder(generalBasicCards.map((item) => lowerFirst(item.valor))))}`
      )
    );
  }

  const basicByVisit = new Map<string, string[]>();
  for (const card of sortedCards.filter(
    (item) => item.type === "articulo_basico" && item.visitante_id
  )) {
    const visit = card.visitante_id ? visitMap.get(card.visitante_id) ?? null : null;
    if (!visit) {
      continue;
    }

    const current = basicByVisit.get(visit.visitante_id) ?? [];
    current.push(lowerFirst(card.valor));
    basicByVisit.set(visit.visitante_id, current);
  }

  for (const [visitId, values] of basicByVisit) {
    const visit = visitMap.get(visitId);
    if (!visit) {
      continue;
    }

    basicSentences.push(
      withPeriod(`${visit.visitante_nombre} ingresa con ${joinSpanishList(uniquePreserveOrder(values))}`)
    );
  }

  const groupedQuantitySpecials = new Map<
    string,
    Map<string, { card: WizardCard; quantity: number }>
  >();

  for (const card of sortedCards.filter((item) => item.type === "articulo_especial")) {
    const visit = card.visitante_id ? visitMap.get(card.visitante_id) ?? null : null;

    if (SIMPLE_SPECIAL_SET.has(card.valor)) {
      specialSentences.push(buildSimpleSpecialSentence(card, visit));
      continue;
    }

    const targetKey = card.visitante_id ?? GENERAL_TARGET_KEY;
    const currentTargetItems = groupedQuantitySpecials.get(targetKey) ?? new Map();
    const aggregateKey = `${normalizeKey(card.valor)}|${card.requiere_revision ? "1" : "0"}|${card.detalle.trim()}`;
    const existing = currentTargetItems.get(aggregateKey);

    if (existing) {
      existing.quantity += Math.max(1, Number(card.cantidad || 1));
    } else {
      currentTargetItems.set(aggregateKey, {
        card,
        quantity: Math.max(1, Number(card.cantidad || 1))
      });
    }

    groupedQuantitySpecials.set(targetKey, currentTargetItems);
  }

  const generalQuantitySpecials = groupedQuantitySpecials.get(GENERAL_TARGET_KEY);
  if (generalQuantitySpecials && generalQuantitySpecials.size > 0) {
    specialSentences.push(
      withPeriod(
        `Ingresan con ${joinSpanishList(
          [...generalQuantitySpecials.values()].map(({ card, quantity }) =>
            buildQuantitySpecialPhrase(card, quantity)
          )
        )}`
      )
    );
  }

  for (const [visitId, items] of groupedQuantitySpecials) {
    if (visitId === GENERAL_TARGET_KEY) {
      continue;
    }

    const visit = visitMap.get(visitId);
    if (!visit) {
      continue;
    }

    specialSentences.push(
      withPeriod(
        `${visit.visitante_nombre} ingresa con ${joinSpanishList(
          [...items.values()].map(({ card, quantity }) => buildQuantitySpecialPhrase(card, quantity))
        )}`
      )
    );
  }

  const menciones_basicas_generadas = basicSentences.filter(Boolean).join(" ").trim();
  const menciones_especiales_generadas = specialSentences.filter(Boolean).join(" ").trim();
  const menciones_basicas_final = buildFinalText(
    menciones_basicas_generadas,
    wizardState.menciones_basicas_manual
  );
  const menciones_especiales_final = buildFinalText(
    menciones_especiales_generadas,
    wizardState.menciones_especiales_manual
  );

  return {
    menciones_basicas_generadas,
    menciones_especiales_generadas,
    menciones_basicas_final,
    menciones_especiales_final
  };
}

export function buildPassArticleQuantitiesFromCards(
  cards: WizardCard[],
  passArticles: ModuleDeviceType[]
) {
  const articleMap = new Map(
    passArticles.map((article) => [normalizeKey(article.name), article.id] as const)
  );
  const totals = new Map<string, number>();

  for (const card of cards.filter((item) => item.type === "articulo_especial")) {
    const aliases = SPECIAL_ARTICLE_ALIASES[normalizeKey(card.valor)] ?? [card.valor];
    const matchId =
      aliases
        .map((alias) => articleMap.get(normalizeKey(alias)))
        .find(Boolean) ?? articleMap.get(normalizeKey(card.valor));

    if (!matchId) {
      continue;
    }

    totals.set(matchId, (totals.get(matchId) ?? 0) + Math.max(1, Number(card.cantidad || 1)));
  }

  return [...totals.entries()].map(([deviceTypeId, quantity]) => ({
    deviceTypeId,
    quantity
  }));
}

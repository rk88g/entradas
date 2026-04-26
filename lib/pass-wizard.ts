import {
  ModuleDeviceType,
  PassWizardState,
  PassWizardVisit,
  WizardCard
} from "@/lib/types";

export const DOCUMENT_OPTIONS = [
  "CURP",
  "Acta de nacimiento",
  "Cartilla de vacunación",
  "Credencial escolar",
  "Credencial laboral",
  "Pasaporte",
  "INE vencida",
  "INE en trámite",
  "Sin INE",
  "Licencia",
  "Otro documento"
] as const;

export const CONDITION_OPTIONS = [
  "Acompañado por abuela",
  "Acompañado por abuelo",
  "Acompañado por mamá",
  "Acompañado por papá",
  "Acompañado por hermano mayor",
  "Acompañado por hermana mayor",
  "Acompañado por tío/tía",
  "Acompañado por tutor",
  "Silla de ruedas",
  "Discapacidad",
  "Muletas",
  "Embarazo",
  "ECO reciente",
  "Faja médica",
  "Yeso / venda",
  "Cirugía reciente",
  "Medicamento",
  "Visita foránea",
  "Horario especial",
  "Diferente horario",
  "Se queda de noche",
  "Permiso especial"
] as const;

export const BASIC_ARTICLE_CATALOG = [
  {
    group: "Alimentos y despensa",
    items: [
      "Comida preparada",
      "Despensa",
      "Carnes y proteínas",
      "Frutas y verduras",
      "Pan / tortillas / cereales",
      "Lácteos",
      "Botanas y dulces",
      "Bebidas",
      "Condimentos"
    ]
  },
  {
    group: "Higiene y limpieza",
    items: [
      "Aseo personal",
      "Papel / toallitas",
      "Limpieza de ropa",
      "Limpieza doméstica",
      "Cuidado básico"
    ]
  },
  {
    group: "Ropa y calzado",
    items: [
      "Ropa permitida",
      "Cambio de ropa",
      "Calzado",
      "Gorras / accesorios",
      "Textiles"
    ]
  },
  {
    group: "Bebé / infantil",
    items: [
      "Pañalera",
      "Pañales",
      "Carriola",
      "Alimentación de bebé",
      "Ropa de bebé / niño",
      "Accesorios de bebé"
    ]
  },
  {
    group: "Artículos personales",
    items: [
      "Bolsa / mochila / maleta",
      "Cosméticos / belleza",
      "Accesorios personales",
      "Recipientes",
      "Carrito de carga"
    ]
  }
] as const;

export const SPECIAL_ARTICLE_CATALOG = [
  {
    group: "Aparatos / electrónica",
    items: [
      "Celular",
      "Cargador",
      "Audífonos",
      "Bocina",
      "Radio",
      "Tablet",
      "Pieza eléctrica",
      "Otro aparato"
    ]
  },
  {
    group: "Objetos revisables",
    items: [
      "Herramienta",
      "Objeto metálico",
      "Objeto grande",
      "Producto en polvo",
      "Objeto no común",
      "Artículo decorativo",
      "Revisión especial"
    ]
  },
  {
    group: "Administrativo",
    items: [
      "Autorización especial",
      "Clave o folio",
      "33 económico",
      "Entrega especial",
      "Horario especial",
      "Diferente horario"
    ]
  }
] as const;

const CONDITION_WITH_ACCESSORY = new Set([
  "Silla de ruedas",
  "Discapacidad",
  "Muletas",
  "Embarazo",
  "ECO reciente",
  "Faja médica",
  "Yeso / venda",
  "Cirugía reciente",
  "Medicamento"
]);

const CONDITION_WITH_STATUS = new Set([
  "Visita foránea",
  "Horario especial",
  "Diferente horario",
  "Permiso especial"
]);

const SPECIAL_ARTICLE_ALIASES: Record<string, string[]> = {
  celular: ["celular"],
  cargador: ["cargador"],
  audifonos: ["audífonos", "audifonos"],
  bocina: ["bocina", "sonido"],
  radio: ["radio", "sonido"],
  tablet: ["tablet"],
  "pieza electrica": ["pieza eléctrica", "pieza electrica"],
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

function makeSubject(visit: PassWizardVisit | null) {
  if (!visit) {
    return "Ingresan";
  }

  if (visit.menor) {
    return `${visit.sexo === "mujer" ? "La menor" : "El menor"} ${visit.visitante_nombre}`;
  }

  return visit.visitante_nombre;
}

function buildConditionSentence(card: WizardCard, visit: PassWizardVisit | null) {
  if (card.valor.startsWith("Acompañado por ")) {
    const companion = lowerFirst(card.valor.replace(/^Acompañado por\s+/u, ""));
    if (visit) {
      return withPeriod(`${makeSubject(visit)} ingresa acompañado por su ${companion}`);
    }

    return withPeriod(`Ingresan acompañados por su ${companion}`);
  }

  if (card.valor === "Se queda de noche") {
    if (visit) {
      return withPeriod(`${makeSubject(visit)} se queda de noche`);
    }

    return withPeriod("Se quedan de noche");
  }

  if (CONDITION_WITH_STATUS.has(card.valor)) {
    if (visit) {
      return withPeriod(`${makeSubject(visit)} cuenta con ${lowerFirst(card.valor)}`);
    }

    return withPeriod(`Ingresan con ${lowerFirst(card.valor)}`);
  }

  if (CONDITION_WITH_ACCESSORY.has(card.valor)) {
    if (visit) {
      return withPeriod(`${makeSubject(visit)} ingresa con ${lowerFirst(card.valor)}`);
    }

    return withPeriod(`Ingresan con ${lowerFirst(card.valor)}`);
  }

  if (visit) {
    return withPeriod(`${makeSubject(visit)} cuenta con ${lowerFirst(card.valor)}`);
  }

  return withPeriod(`Ingresan con ${lowerFirst(card.valor)}`);
}

function buildSpecialPhrase(card: WizardCard, quantity: number) {
  const value = lowerFirst(card.valor);
  const qty = Math.max(1, quantity || 1);
  const review = card.requiere_revision ? " para revisión" : "";
  const detail = card.detalle.trim() ? ` (${card.detalle.trim()})` : "";
  return `${qty} ${value}${review}${detail}`;
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

  for (const card of wizardState.cards.filter((item) => item.type === "documentacion")) {
    const visit = card.visitante_id ? visitMap.get(card.visitante_id) ?? null : null;
    if (!visit) {
      continue;
    }

    basicSentences.push(withPeriod(`${makeSubject(visit)} ingresa con ${card.valor}`));
  }

  for (const card of wizardState.cards.filter((item) => item.type === "condicion")) {
    const visit = card.visitante_id ? visitMap.get(card.visitante_id) ?? null : null;
    basicSentences.push(buildConditionSentence(card, visit));
  }

  const generalBasicArticles = wizardState.cards.filter(
    (item) => item.type === "articulo_basico" && !item.visitante_id
  );
  if (generalBasicArticles.length > 0) {
    const labels = [...new Set(generalBasicArticles.map((item) => lowerFirst(item.valor)))];
    basicSentences.push(withPeriod(`Ingresan con ${joinSpanishList(labels)}`));
  }

  const basicByVisit = new Map<string, string[]>();
  for (const card of wizardState.cards.filter(
    (item) => item.type === "articulo_basico" && item.visitante_id
  )) {
    const visit = visitMap.get(String(card.visitante_id));
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

    basicSentences.push(withPeriod(`${visit.visitante_nombre} ingresa con ${joinSpanishList([...new Set(values)])}`));
  }

  const generalSpecials = new Map<string, { card: WizardCard; quantity: number }>();
  const visitSpecials = new Map<string, Map<string, { card: WizardCard; quantity: number }>>();

  for (const card of wizardState.cards.filter((item) => item.type === "articulo_especial")) {
    const aggregateKey = `${normalizeKey(card.valor)}|${card.requiere_revision ? "1" : "0"}|${card.detalle.trim()}`;
    if (!card.visitante_id) {
      const existing = generalSpecials.get(aggregateKey);
      if (existing) {
        existing.quantity += Math.max(1, Number(card.cantidad || 1));
      } else {
        generalSpecials.set(aggregateKey, {
          card,
          quantity: Math.max(1, Number(card.cantidad || 1))
        });
      }
      continue;
    }

    const visit = visitMap.get(card.visitante_id);
    if (!visit) {
      continue;
    }

    const current = visitSpecials.get(visit.visitante_id) ?? new Map();
    const existing = current.get(aggregateKey);
    if (existing) {
      existing.quantity += Math.max(1, Number(card.cantidad || 1));
    } else {
      current.set(aggregateKey, {
        card,
        quantity: Math.max(1, Number(card.cantidad || 1))
      });
    }
    visitSpecials.set(visit.visitante_id, current);
  }

  if (generalSpecials.size > 0) {
    const phrases = [...generalSpecials.values()].map(({ card, quantity }) => buildSpecialPhrase(card, quantity));
    specialSentences.push(withPeriod(`Ingresan con ${joinSpanishList(phrases)}`));
  }

  for (const [visitId, items] of visitSpecials) {
    const visit = visitMap.get(visitId);
    if (!visit) {
      continue;
    }

    const phrases = [...items.values()].map(({ card, quantity }) => buildSpecialPhrase(card, quantity));
    specialSentences.push(withPeriod(`${visit.visitante_nombre} ingresa con ${joinSpanishList(phrases)}`));
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

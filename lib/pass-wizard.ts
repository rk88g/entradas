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
    group: "Alimentos",
    items: [
      "Comida preparada",
      "Despensa",
      "Carnes/proteínas",
      "Frutas/verduras",
      "Pan/tortillas",
      "Lácteos",
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
      "Limpieza doméstica",
      "Cuidado básico"
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
    group: "Bebé",
    items: [
      "Pañalera",
      "Pañales",
      "Carriola",
      "Leche/biberones",
      "Ropa bebé",
      "Accesorios bebé"
    ]
  },
  {
    group: "Personales",
    items: [
      "Bolsa/mochila",
      "Cosméticos",
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
      "33 económico",
      "Diferente horario",
      "Autorización especial",
      "Clave o folio",
      "Pieza eléctrica",
      "Celular",
      "Cargador",
      "Audífonos",
      "Bocina",
      "Radio",
      "Tablet",
      "Producto en polvo",
      "Objeto grande",
      "Objeto no común",
      "Revisión especial"
    ]
  }
] as const;

export const SIMPLE_SPECIAL_OPTIONS = [
  "33 económico",
  "Diferente horario",
  "Autorización especial",
  "Clave o folio",
  "Revisión especial"
] as const;

export const QUANTITY_SPECIAL_OPTIONS = [
  "Pieza eléctrica",
  "Celular",
  "Cargador",
  "Audífonos",
  "Bocina",
  "Radio",
  "Tablet",
  "Producto en polvo",
  "Objeto grande",
  "Objeto no común"
] as const;

const GENERAL_TARGET_KEY = "__general__";

type VisitCohortKey = "minors" | "adults";

const SIMPLE_SPECIAL_SET = new Set<string>(SIMPLE_SPECIAL_OPTIONS);

const CONDITION_WITH_ACCESSORY = new Set([
  "Silla de ruedas",
  "Discapacidad",
  "Muletas",
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

function uniquePreserveOrder(values: string[]) {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}

function isMinor(visit: PassWizardVisit) {
  return visit.edad < 18;
}

function getVisitCohortKey(visit: PassWizardVisit): VisitCohortKey {
  return isMinor(visit) ? "minors" : "adults";
}

function getCohortLabel(cohort: VisitCohortKey) {
  return cohort === "minors" ? "Los menores" : "Los adultos";
}

function getCohortVisits(visits: PassWizardVisit[], cohort: VisitCohortKey) {
  return visits.filter((visit) => getVisitCohortKey(visit) === cohort);
}

function cardsCoverWholeCohort(
  cards: WizardCard[],
  visits: PassWizardVisit[],
  visitMap: Map<string, PassWizardVisit>,
  cohort: VisitCohortKey
) {
  const cohortVisitIds = getCohortVisits(visits, cohort)
    .map((visit) => visit.visitante_id)
    .sort();

  if (cohortVisitIds.length < 2) {
    return false;
  }

  const cardVisitIds = uniquePreserveOrder(
    cards
      .map((card) => card.visitante_id ?? "")
      .filter(Boolean)
      .filter((visitId) => {
        const visit = visitMap.get(visitId);
        return Boolean(visit) && getVisitCohortKey(visit!) === cohort;
      })
  ).sort();

  if (cardVisitIds.length !== cohortVisitIds.length) {
    return false;
  }

  return cardVisitIds.every((visitId, index) => visitId === cohortVisitIds[index]);
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

  if (card.valor === "INE en trámite") {
    return withPeriod(`${visit.visitante_nombre} ingresa con INE en trámite`);
  }

  return withPeriod(`${makeNamedSubject(visit)} ingresa con ${card.valor}`);
}

function buildDocumentationGroupSentence(card: WizardCard, cohort: VisitCohortKey) {
  const lead = getCohortLabel(cohort);
  if (card.valor === "Sin INE") {
    return withPeriod(`${lead} ingresan sin INE`);
  }

  if (card.valor === "INE vencida") {
    return withPeriod(`${lead} ingresan con INE vencida`);
  }

  if (card.valor === "INE en trámite") {
    return withPeriod(`${lead} ingresan con INE en trámite`);
  }

  return withPeriod(`${lead} ingresan con ${card.valor}`);
}

function buildCompanionSentence(card: WizardCard, visit: PassWizardVisit | null) {
  const companion = lowerFirst(card.valor.replace(/^Acompañado por\s+/u, ""));
  if (!visit) {
    return withPeriod(`Ingresan acompañados por su ${companion}`);
  }

  const subject = isMinor(visit) ? makeMinorLead(visit) : visit.visitante_nombre;
  return withPeriod(`${subject} ingresa acompañado por su ${companion}`);
}

function buildCompanionGroupSentence(card: WizardCard, cohort: VisitCohortKey) {
  const companion = lowerFirst(card.valor.replace(/^Acompañado por\s+/u, ""));
  return withPeriod(`${getCohortLabel(cohort)} ingresan acompañados por su ${companion}`);
}

function buildConditionSentence(card: WizardCard, visit: PassWizardVisit | null) {
  if (card.valor.startsWith("Acompañado por ")) {
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

function buildConditionGroupSentence(card: WizardCard, cohort: VisitCohortKey) {
  if (card.valor.startsWith("Acompañado por ")) {
    return buildCompanionGroupSentence(card, cohort);
  }

  if (card.valor === "Se queda de noche") {
    return withPeriod(`${getCohortLabel(cohort)} se quedan de noche`);
  }

  return withPeriod(`${getCohortLabel(cohort)} ingresan con ${lowerFirst(card.valor)}`);
}

function buildPregnancySentence(visit: PassWizardVisit | null) {
  if (!visit) {
    return withPeriod("Ingresan con embarazo y ECO reciente");
  }

  return withPeriod(`${visit.visitante_nombre} ingresa con embarazo y ECO reciente`);
}

function buildSimpleSpecialSentence(card: WizardCard, visit: PassWizardVisit | null) {
  if (card.valor === "33 económico") {
    if (visit) {
      return withPeriod(`${visit.visitante_nombre} ingresa con 33 económico`);
    }

    return withPeriod("Ingresa 33 económico");
  }

  if (!visit) {
    return withPeriod(`Ingresan con ${lowerFirst(card.valor)}`);
  }

  return withPeriod(`${visit.visitante_nombre} ingresa con ${lowerFirst(card.valor)}`);
}

function buildSimpleSpecialGroupSentence(card: WizardCard, cohort: VisitCohortKey) {
  return withPeriod(`${getCohortLabel(cohort)} ingresan con ${lowerFirst(card.valor)}`);
}

function buildQuantitySpecialPhrase(card: WizardCard, quantity: number) {
  const detail = card.detalle.trim() ? ` (${card.detalle.trim()})` : "";
  const review = card.requiere_revision ? " para revisión" : "";
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

function serializeStringList(values: string[]) {
  return JSON.stringify(uniquePreserveOrder(values.map((value) => normalizeKey(value))));
}

function serializeQuantityEntries(items: Map<string, { card: WizardCard; quantity: number }>) {
  return JSON.stringify(
    [...items.values()]
      .map(({ card, quantity }) => ({
        valor: normalizeKey(card.valor),
        detalle: card.detalle.trim(),
        revision: card.requiere_revision ? 1 : 0,
        quantity
      }))
      .sort((left, right) => {
        const valueDiff = left.valor.localeCompare(right.valor);
        if (valueDiff !== 0) {
          return valueDiff;
        }

        const detailDiff = left.detalle.localeCompare(right.detalle);
        if (detailDiff !== 0) {
          return detailDiff;
        }

        return left.quantity - right.quantity;
      })
  );
}

function groupCardsByNormalizedValue(cards: WizardCard[]) {
  return cards.reduce<Map<string, WizardCard[]>>((groups, card) => {
    const key = normalizeKey(card.valor);
    const current = groups.get(key) ?? [];
    current.push(card);
    groups.set(key, current);
    return groups;
  }, new Map());
}

function pushWholeCohortSentences(options: {
  visits: PassWizardVisit[];
  visitMap: Map<string, PassWizardVisit>;
  cards: WizardCard[];
  buildSentence: (card: WizardCard, cohort: VisitCohortKey) => string;
  ignoreValues?: Set<string>;
}) {
  const handledCardIds = new Set<string>();
  const groups = groupCardsByNormalizedValue(options.cards);

  groups.forEach((group) => {
    const normalizedValue = normalizeKey(group[0]?.valor ?? "");
    if (options.ignoreValues?.has(normalizedValue)) {
      return;
    }

    for (const cohort of ["minors", "adults"] as const) {
      const cohortCards = group.filter((card) => {
        const visit = card.visitante_id ? options.visitMap.get(card.visitante_id) ?? null : null;
        return visit ? getVisitCohortKey(visit) === cohort : false;
      });

      if (cardsCoverWholeCohort(cohortCards, options.visits, options.visitMap, cohort)) {
        handledCardIds; // keep TS narrow on mutation pattern
        cohortCards.forEach((card) => handledCardIds.add(card.id));
      }
    }
  });

  const sentences: string[] = [];
  groups.forEach((group) => {
    const normalizedValue = normalizeKey(group[0]?.valor ?? "");
    if (options.ignoreValues?.has(normalizedValue)) {
      return;
    }

    for (const cohort of ["minors", "adults"] as const) {
      const cohortCards = group.filter((card) => {
        const visit = card.visitante_id ? options.visitMap.get(card.visitante_id) ?? null : null;
        return visit ? getVisitCohortKey(visit) === cohort : false;
      });

      if (cardsCoverWholeCohort(cohortCards, options.visits, options.visitMap, cohort)) {
        sentences.push(options.buildSentence(cohortCards[0], cohort));
      }
    }
  });

  return { handledCardIds, sentences };
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
  const visits = wizardState.visitas_seleccionadas;
  const visitMap = new Map(visits.map((visit) => [visit.visitante_id, visit] as const));
  const basicSentences: string[] = [];
  const specialSentences: string[] = [];
  const sortedCards = sortCardsByWizardOrder(wizardState.cards);

  const documentationCards = sortedCards.filter((item) => item.type === "documentacion");
  documentationCards
    .filter((card) => !card.visitante_id)
    .forEach((card) => basicSentences.push(buildDocumentationSentence(card, null)));

  const personDocumentationCards = documentationCards.filter((card) => card.visitante_id);
  const documentationWholeCohort = pushWholeCohortSentences({
    visits,
    visitMap,
    cards: personDocumentationCards,
    buildSentence: buildDocumentationGroupSentence
  });
  basicSentences.push(...documentationWholeCohort.sentences);

  personDocumentationCards.forEach((card) => {
    if (documentationWholeCohort.handledCardIds.has(card.id)) {
      return;
    }

    const visit = card.visitante_id ? visitMap.get(card.visitante_id) ?? null : null;
    basicSentences.push(buildDocumentationSentence(card, visit));
  });

  const conditionCards = sortedCards.filter((item) => item.type === "condicion");
  const ignoredConditionValues = new Set([normalizeKey("Embarazo"), normalizeKey("ECO reciente")]);
  conditionCards
    .filter((card) => !card.visitante_id)
    .forEach((card) => basicSentences.push(buildConditionSentence(card, null)));

  const personConditionCards = conditionCards.filter((card) => card.visitante_id);
  const conditionWholeCohort = pushWholeCohortSentences({
    visits,
    visitMap,
    cards: personConditionCards,
    buildSentence: buildConditionGroupSentence,
    ignoreValues: ignoredConditionValues
  });
  basicSentences.push(...conditionWholeCohort.sentences);

  const remainingConditionGroups = new Map<string, WizardCard[]>();
  personConditionCards.forEach((card) => {
    if (conditionWholeCohort.handledCardIds.has(card.id)) {
      return;
    }

    const key = card.visitante_id ?? GENERAL_TARGET_KEY;
    const current = remainingConditionGroups.get(key) ?? [];
    current.push(card);
    remainingConditionGroups.set(key, current);
  });

  for (const [groupKey, cards] of remainingConditionGroups) {
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
  sortedCards
    .filter((item) => item.type === "articulo_basico" && item.visitante_id)
    .forEach((card) => {
      const visit = card.visitante_id ? visitMap.get(card.visitante_id) ?? null : null;
      if (!visit) {
        return;
      }

      const current = basicByVisit.get(visit.visitante_id) ?? [];
      current.push(lowerFirst(card.valor));
      basicByVisit.set(visit.visitante_id, current);
    });

  const handledBasicVisitIds = new Set<string>();
  for (const cohort of ["minors", "adults"] as const) {
    const cohortVisits = getCohortVisits(visits, cohort);
    if (cohortVisits.length < 2) {
      continue;
    }

    const serializedSets = cohortVisits.map((visit) => serializeStringList(basicByVisit.get(visit.visitante_id) ?? []));
    const firstSet = serializedSets[0];
    if (!firstSet || firstSet === "[]") {
      continue;
    }

    if (serializedSets.every((value) => value === firstSet)) {
      basicSentences.push(
        withPeriod(
          `${getCohortLabel(cohort)} ingresan con ${joinSpanishList(
            uniquePreserveOrder(basicByVisit.get(cohortVisits[0].visitante_id) ?? [])
          )}`
        )
      );
      cohortVisits.forEach((visit) => handledBasicVisitIds.add(visit.visitante_id));
    }
  }

  for (const [visitId, values] of basicByVisit) {
    if (handledBasicVisitIds.has(visitId)) {
      continue;
    }

    const visit = visitMap.get(visitId);
    if (!visit) {
      continue;
    }

    basicSentences.push(
      withPeriod(`${visit.visitante_nombre} ingresa con ${joinSpanishList(uniquePreserveOrder(values))}`)
    );
  }

  const specialCards = sortedCards.filter((item) => item.type === "articulo_especial");
  const generalSimpleSpecialCards = specialCards.filter(
    (card) => !card.visitante_id && SIMPLE_SPECIAL_SET.has(card.valor)
  );
  generalSimpleSpecialCards.forEach((card) => specialSentences.push(buildSimpleSpecialSentence(card, null)));

  const personSimpleSpecialCards = specialCards.filter(
    (card) => card.visitante_id && SIMPLE_SPECIAL_SET.has(card.valor)
  );
  const simpleSpecialWholeCohort = pushWholeCohortSentences({
    visits,
    visitMap,
    cards: personSimpleSpecialCards,
    buildSentence: buildSimpleSpecialGroupSentence
  });
  specialSentences.push(...simpleSpecialWholeCohort.sentences);

  personSimpleSpecialCards.forEach((card) => {
    if (simpleSpecialWholeCohort.handledCardIds.has(card.id)) {
      return;
    }

    const visit = card.visitante_id ? visitMap.get(card.visitante_id) ?? null : null;
    specialSentences.push(buildSimpleSpecialSentence(card, visit));
  });

  const groupedQuantitySpecials = new Map<
    string,
    Map<string, { card: WizardCard; quantity: number }>
  >();

  specialCards
    .filter((card) => !SIMPLE_SPECIAL_SET.has(card.valor))
    .forEach((card) => {
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
    });

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

  const handledQuantityVisitIds = new Set<string>();
  for (const cohort of ["minors", "adults"] as const) {
    const cohortVisits = getCohortVisits(visits, cohort);
    if (cohortVisits.length < 2) {
      continue;
    }

    const serializedMaps = cohortVisits.map((visit) =>
      serializeQuantityEntries(groupedQuantitySpecials.get(visit.visitante_id) ?? new Map())
    );
    const firstMap = serializedMaps[0];
    if (!firstMap || firstMap === "[]") {
      continue;
    }

    if (serializedMaps.every((value) => value === firstMap)) {
      const firstVisitItems = groupedQuantitySpecials.get(cohortVisits[0].visitante_id);
      if (firstVisitItems && firstVisitItems.size > 0) {
        specialSentences.push(
          withPeriod(
            `${getCohortLabel(cohort)} ingresan con ${joinSpanishList(
              [...firstVisitItems.values()].map(({ card, quantity }) =>
                buildQuantitySpecialPhrase(card, quantity)
              )
            )}`
          )
        );
        cohortVisits.forEach((visit) => handledQuantityVisitIds.add(visit.visitante_id));
      }
    }
  }

  for (const [visitId, items] of groupedQuantitySpecials) {
    if (visitId === GENERAL_TARGET_KEY || handledQuantityVisitIds.has(visitId)) {
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

  const menciones_basicas_generadas = basicSentences.filter(Boolean).join("\n").trim();
  const menciones_especiales_generadas = specialSentences.filter(Boolean).join("\n").trim();
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

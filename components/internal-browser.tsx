"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createInternalAction,
  createPassAction,
  createVisitorAction,
  updateInternalStatusAction
} from "@/app/sistema/actions";
import { FullscreenLoading } from "@/components/fullscreen-loading";
import { LoadingButton } from "@/components/loading-button";
import { MutationBanner } from "@/components/mutation-banner";
import { StatusBadge } from "@/components/status-badge";
import {
  DateRecord,
  InternalHistoryPayload,
  InternalProfile,
  ModuleDeviceType,
  MutationState,
  PassWizardState,
  PassWizardVisit,
  RoleKey,
  WizardCard
} from "@/lib/types";
import {
  BASIC_ARTICLE_CATALOG,
  CONDITION_OPTIONS,
  DOCUMENT_OPTIONS,
  SPECIAL_ARTICLE_CATALOG,
  buildPassArticleQuantitiesFromCards,
  createEmptyWizardState,
  generateMenciones
} from "@/lib/pass-wizard";
import {
  canManageMentions,
  formatLongDate,
  formatLongDateWithWeekday,
  getDefaultDateStatusForRole,
  getInternalStatusMeta,
  maskPrivateText,
  maskValue,
  shouldMaskSensitiveInternal
} from "@/lib/utils";

const mutationInitialState: MutationState = {
  success: null,
  error: null
};

function getDateOptions(extraDates: DateRecord[] = [], openDate?: DateRecord | null, nextDate?: DateRecord | null) {
  const unique = new Map<string, DateRecord>();

  [...extraDates, openDate, nextDate].forEach((item) => {
    if (item) {
      unique.set(item.fechaCompleta, item);
    }
  });

  return [...unique.values()].sort((left, right) => right.fechaCompleta.localeCompare(left.fechaCompleta));
}

function canUseClosedPassDates(roleKey: RoleKey) {
  return roleKey === "super-admin";
}

function getDefaultDateValue(
  roleKey: RoleKey,
  openDate?: DateRecord | null,
  nextDate?: DateRecord | null,
  extraDates: DateRecord[] = []
) {
  const preferredStatus = getDefaultDateStatusForRole(roleKey);
  if (preferredStatus === "proximo") {
    return nextDate?.fechaCompleta ?? openDate?.fechaCompleta ?? extraDates[0]?.fechaCompleta ?? "";
  }

  return openDate?.fechaCompleta ?? nextDate?.fechaCompleta ?? extraDates[0]?.fechaCompleta ?? "";
}

function getPassForDate(
  profile: InternalProfile,
  dateValue: string,
  openDate?: DateRecord | null,
  nextDate?: DateRecord | null
) {
  if (openDate?.fechaCompleta === dateValue) {
    return profile.openDatePass ?? null;
  }

  if (nextDate?.fechaCompleta === dateValue) {
    return profile.nextDatePass ?? null;
  }

  return profile.recentPasses.find((item) => item.fechaVisita === dateValue) ?? null;
}

function compactMoney(value?: number | null) {
  return `$${Number(value ?? 0).toFixed(2)}`;
}

function normalizeVisitorSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getEstimatedBirthDateFromAge(ageValue: string) {
  const age = Number(ageValue);
  if (!Number.isFinite(age) || age < 0 || age > 120) {
    return "";
  }

  return `01/01/${new Date().getFullYear() - age}`;
}

function getPassBadge(passExists: boolean) {
  return passExists ? (
    <StatusBadge variant="warn">Con pase</StatusBadge>
  ) : (
    <StatusBadge variant="ok">Sin pase</StatusBadge>
  );
}

function getPassSubmitIssue(options: {
  selectedDateValue: string;
  selectedVisitorCount: number;
  selectedAdultCount: number;
  duplicateRequiresAuthorization: boolean;
  allowDuplicatePass: boolean;
  selectedDateClosed: boolean;
  canUseClosedDate: boolean;
}) {
  if (!options.selectedDateValue) {
    return "Debes elegir la fecha del pase.";
  }

  if (options.selectedDateClosed && !options.canUseClosedDate) {
    return "Solo super-admin puede capturar pases en fechas cerradas.";
  }

  if (options.selectedVisitorCount === 0) {
    return "Debes elegir al menos una visita.";
  }

  if (options.selectedAdultCount === 0) {
    return "Debes incluir al menos un adulto en el pase.";
  }

  if (options.duplicateRequiresAuthorization && !options.allowDuplicatePass) {
    return "Marca la autorizacion para generar un pase duplicado en esa fecha.";
  }

  return null;
}

function getMaskedInternalLabel(roleKey: RoleKey, internalId: string, value: string) {
  return maskPrivateText(value, shouldMaskSensitiveInternal(roleKey, internalId));
}

const PASS_WIZARD_STEPS = [
  { key: "visitas", label: "Visitas" },
  { key: "documentacion", label: "Documentación" },
  { key: "condiciones", label: "Condiciones" },
  { key: "articulos", label: "Artículos" },
  { key: "especiales", label: "Especiales y vista previa" }
] as const;

const PASS_WIZARD_READ_ONLY_STEPS = [
  { key: "visitas", label: "Visitas" },
  { key: "especiales", label: "Vista previa" }
] as const;

const WIZARD_GENERAL_TARGET = "__general__";

function buildWizardCardId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `wizard-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function maskWizardVisitorName(value: string, shouldMask: boolean) {
  return maskPrivateText(value, shouldMask);
}

function getWizardCardLabel(card: WizardCard, shouldMask: boolean) {
  const pieces = [card.valor];
  if (card.cantidad > 1) {
    pieces.push(`x${card.cantidad}`);
  }
  if (card.requiere_revision) {
    pieces.push("Revisión");
  }
  if (card.detalle.trim()) {
    pieces.push(card.detalle.trim());
  }

  const title = pieces.join(" · ");
  if (!card.visitante_nombre) {
    return title;
  }

  return `${maskWizardVisitorName(card.visitante_nombre, shouldMask)} · ${title}`;
}

export function InternalBrowser({
  profiles,
  query,
  page,
  totalPages,
  extraDates = [],
  nextDate,
  openDate,
  passArticles,
  roleKey,
  canViewSensitiveData
}: {
  profiles: InternalProfile[];
  query: string;
  page: number;
  totalPages: number;
  extraDates?: DateRecord[];
  nextDate?: DateRecord | null;
  openDate?: DateRecord | null;
  passArticles: ModuleDeviceType[];
  roleKey: RoleKey;
  canViewSensitiveData: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [queryInput, setQueryInput] = useState(query);
  const [modalInternalId, setModalInternalId] = useState<string | null>(null);
  const [selectedVisitorIds, setSelectedVisitorIds] = useState<string[]>([]);
  const [selectedDateValue, setSelectedDateValue] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historySections, setHistorySections] = useState<Record<string, boolean>>({});
  const [historyCache, setHistoryCache] = useState<Record<string, InternalHistoryPayload | undefined>>({});
  const [historyLoading, setHistoryLoading] = useState(false);
  const [formSeed, setFormSeed] = useState(0);
  const [modalBannerResetKey, setModalBannerResetKey] = useState(0);
  const [visitorBannerStateKey, setVisitorBannerStateKey] = useState(0);
  const [passBannerStateKey, setPassBannerStateKey] = useState(0);
  const [statusBannerStateKey, setStatusBannerStateKey] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);
  const [screenLoading, setScreenLoading] = useState(false);
  const [passLocalError, setPassLocalError] = useState<string | null>(null);
  const [visitorQuery, setVisitorQuery] = useState("");
  const [allowDuplicatePass, setAllowDuplicatePass] = useState(false);
  const [recentCreatedPass, setRecentCreatedPass] = useState<{ internoId: string; fechaVisita: string } | null>(null);
  const [visitorBirthInputMode, setVisitorBirthInputMode] = useState<"fecha" | "edad">("edad");
  const [visitorNameInput, setVisitorNameInput] = useState("");
  const [visitorAgeInput, setVisitorAgeInput] = useState("");
  const [visitorBirthDateInput, setVisitorBirthDateInput] = useState("");
  const [visitorSexInput, setVisitorSexInput] = useState("");
  const [visitorParentescoInput, setVisitorParentescoInput] = useState("");
  const [wizardStepIndex, setWizardStepIndex] = useState(0);
  const [wizardState, setWizardState] = useState<PassWizardState>(createEmptyWizardState());
  const [wizardAutoSync, setWizardAutoSync] = useState({ basicas: true, especiales: true });
  const [docVisitorId, setDocVisitorId] = useState("");
  const [docValue, setDocValue] = useState("");
  const [conditionVisitorId, setConditionVisitorId] = useState(WIZARD_GENERAL_TARGET);
  const [conditionValue, setConditionValue] = useState("");
  const [conditionDetail, setConditionDetail] = useState("");
  const [basicArticleVisitorId, setBasicArticleVisitorId] = useState(WIZARD_GENERAL_TARGET);
  const [basicArticleValue, setBasicArticleValue] = useState("");
  const [specialArticleVisitorId, setSpecialArticleVisitorId] = useState(WIZARD_GENERAL_TARGET);
  const [specialArticleValue, setSpecialArticleValue] = useState("");
  const [specialArticleQuantity, setSpecialArticleQuantity] = useState("1");
  const [specialArticleReview, setSpecialArticleReview] = useState(true);
  const [specialArticleDetail, setSpecialArticleDetail] = useState("");
  const [createState, createAction, createPending] = useActionState(createInternalAction, mutationInitialState);
  const [passState, passAction, passPending] = useActionState(createPassAction, mutationInitialState);
  const [visitorState, visitorAction, visitorPending] = useActionState(createVisitorAction, mutationInitialState);
  const [statusState, statusAction, statusPending] = useActionState(updateInternalStatusAction, mutationInitialState);
  const visitorFormRef = useRef<HTMLFormElement>(null);
  const internalFormRef = useRef<HTMLFormElement>(null);
  const handledPassSuccessKeyRef = useRef<number | null>(null);
  const pendingPassContextRef = useRef<{ internoId: string; fechaVisita: string } | null>(null);
  const canManageVisitorAvailability = roleKey === "super-admin" || roleKey === "control";
  const canUseFallbackParentesco = canManageVisitorAvailability;
  const canUseClosedDate = canUseClosedPassDates(roleKey);

  const availableDates = useMemo(
    () => getDateOptions(extraDates, openDate, nextDate).filter((date) => !date.cierre || canUseClosedDate),
    [extraDates, openDate, nextDate, canUseClosedDate]
  );
  const selected = profiles.find((item) => item.id === modalInternalId) ?? null;
  const selectedIsSensitive = shouldMaskSensitiveInternal(roleKey, selected?.id);
  const selectedDateRecord = availableDates.find((item) => item.fechaCompleta === selectedDateValue) ?? null;
  const selectedPass =
    selected && selectedDateValue
      ? getPassForDate(selected, selectedDateValue, openDate, nextDate)
      : null;
  const selectedHistory = selected ? historyCache[selected.id] ?? null : null;
  const selectedVisitors =
    selected?.visitors.filter((item) => selectedVisitorIds.includes(item.visitaId)) ?? [];
  const availableVisitors =
    selected?.visitors.filter((item) => !selectedVisitorIds.includes(item.visitaId)) ?? [];
  const normalizedVisitorQuery = normalizeVisitorSearch(visitorQuery);
  const filteredAvailableVisitors = availableVisitors.filter((item) => {
    if (!normalizedVisitorQuery) {
      return true;
    }

    return normalizeVisitorSearch(
      `${item.visitor.fullName} ${item.parentesco} ${item.visitor.edad}`
    ).includes(normalizedVisitorQuery);
  });
  const filteredSelectedVisitors = selectedVisitors.filter((item) => {
    if (!normalizedVisitorQuery) {
      return true;
    }

    return normalizeVisitorSearch(
      `${item.visitor.fullName} ${item.parentesco} ${item.visitor.edad}`
    ).includes(normalizedVisitorQuery);
  });
  const selectedAdults = selectedVisitors.filter((item) => item.visitor.edad >= 18);
  const selectedDateClosed = Boolean(selectedDateRecord?.cierre);
  const canRenderPassButton =
    Boolean(selectedDateRecord) &&
    (!selectedPass || roleKey === "super-admin") &&
    (!selectedDateClosed || canUseClosedDate);
  const duplicateRequiresAuthorization = roleKey === "super-admin" && Boolean(selectedPass);
  const passSubmitIssue = getPassSubmitIssue({
    selectedDateValue,
    selectedVisitorCount: selectedVisitors.length,
    selectedAdultCount: selectedAdults.length,
    duplicateRequiresAuthorization,
    allowDuplicatePass,
    selectedDateClosed,
    canUseClosedDate
  });
  const canSubmitPass =
    Boolean(selected) &&
    !passSubmitIssue;
  const canCaptureWizardMentions = canManageMentions(roleKey);
  const wizardSteps = canCaptureWizardMentions ? PASS_WIZARD_STEPS : PASS_WIZARD_READ_ONLY_STEPS;
  const currentWizardStep = wizardSteps[Math.min(wizardStepIndex, wizardSteps.length - 1)]?.key ?? "visitas";
  const selectedWizardVisits = useMemo<PassWizardVisit[]>(
    () =>
      selectedVisitors
        .map((item) => ({
          visitante_id: item.visitaId,
          visitante_nombre: item.visitor.fullName,
          parentesco: item.parentesco,
          edad: item.visitor.edad,
          menor: item.visitor.menor,
          sexo: item.visitor.sexo
        }))
        .sort((left, right) => right.edad - left.edad),
    [selectedVisitors]
  );
  const wizardArticlePayload = useMemo(
    () => buildPassArticleQuantitiesFromCards(wizardState.cards, passArticles),
    [passArticles, wizardState.cards]
  );
  const selectedWizardVisitOptions = wizardState.visitas_seleccionadas;
  const filteredDocumentCards = wizardState.cards.filter((item) => item.type === "documentacion");
  const filteredConditionCards = wizardState.cards.filter((item) => item.type === "condicion");
  const filteredBasicArticleCards = wizardState.cards.filter((item) => item.type === "articulo_basico");
  const filteredSpecialCards = wizardState.cards.filter((item) => item.type === "articulo_especial");
  const hasVisitorBirthValue =
    visitorBirthInputMode === "edad"
      ? Boolean(visitorAgeInput.trim()) && Boolean(getEstimatedBirthDateFromAge(visitorAgeInput))
      : Boolean(visitorBirthDateInput.trim());
  const canSubmitVisitor =
    Boolean(visitorNameInput.trim()) &&
    Boolean(visitorSexInput.trim()) &&
    hasVisitorBirthValue &&
    (canUseFallbackParentesco || Boolean(visitorParentescoInput.trim()));
  const shouldSuppressExistingPassAlert =
    Boolean(
      selected &&
        selectedPass &&
        recentCreatedPass &&
        recentCreatedPass.internoId === selected.id &&
        recentCreatedPass.fechaVisita === selectedPass.fechaVisita &&
        passState.success
    );

  function rebuildWizardState(
    nextBase: PassWizardState,
    sync = wizardAutoSync
  ) {
    const generated = generateMenciones(nextBase);
    const nextState: PassWizardState = {
      ...nextBase,
      menciones_basicas_generadas: generated.menciones_basicas_generadas,
      menciones_especiales_generadas: generated.menciones_especiales_generadas,
      menciones_basicas_final: sync.basicas
        ? generated.menciones_basicas_final
        : nextBase.menciones_basicas_final,
      menciones_especiales_final: sync.especiales
        ? generated.menciones_especiales_final
        : nextBase.menciones_especiales_final
    };

    return nextState;
  }

  function updateWizardState(
    updater: (current: PassWizardState) => PassWizardState,
    sync = wizardAutoSync
  ) {
    setWizardState((current) => {
      const next = rebuildWizardState(updater(current), sync);
      return JSON.stringify(current) === JSON.stringify(next) ? current : next;
    });
  }

  function resetWizardAuxiliaryInputs() {
    setDocVisitorId("");
    setDocValue("");
    setConditionVisitorId(WIZARD_GENERAL_TARGET);
    setConditionValue("");
    setConditionDetail("");
    setBasicArticleVisitorId(WIZARD_GENERAL_TARGET);
    setBasicArticleValue("");
    setSpecialArticleVisitorId(WIZARD_GENERAL_TARGET);
    setSpecialArticleValue("");
    setSpecialArticleQuantity("1");
    setSpecialArticleReview(true);
    setSpecialArticleDetail("");
  }

  useEffect(() => {
    if (!passState.success) {
      return;
    }

    if (handledPassSuccessKeyRef.current === passBannerStateKey) {
      return;
    }

    handledPassSuccessKeyRef.current = passBannerStateKey;
    const pendingContext = pendingPassContextRef.current;
    if (pendingContext) {
      setRecentCreatedPass(pendingContext);
    }
    pendingPassContextRef.current = null;
    setSelectedVisitorIds([]);
    setWizardStepIndex(0);
    setWizardAutoSync({ basicas: true, especiales: true });
    setWizardState(createEmptyWizardState());
    resetWizardAuxiliaryInputs();
    router.refresh();
  }, [passState.success, passBannerStateKey, router]);

  useEffect(() => {
    if (passState.error) {
      pendingPassContextRef.current = null;
    }
  }, [passState.error]);

  useEffect(() => {
    if (!passSubmitIssue) {
      setPassLocalError(null);
    }
  }, [passSubmitIssue]);

  useEffect(() => {
    if (!selected) {
      setWizardState(createEmptyWizardState());
      return;
    }

    const allowedVisitorIds = new Set(selectedWizardVisits.map((item) => item.visitante_id));
    updateWizardState((current) => ({
      ...current,
      fecha_visita: selectedDateValue,
      interno_id: selected.id,
      ubicacion: selected.ubicacion,
      visitas_seleccionadas: selectedWizardVisits,
      cards: current.cards.filter((card) => !card.visitante_id || allowedVisitorIds.has(card.visitante_id))
    }));
  }, [selected?.id, selected?.ubicacion, selectedDateValue, selectedWizardVisits]);

  useEffect(() => {
    const validIds = new Set(selectedWizardVisits.map((item) => item.visitante_id));

    if (docVisitorId && !validIds.has(docVisitorId)) {
      setDocVisitorId("");
    }

    if (conditionVisitorId !== WIZARD_GENERAL_TARGET && !validIds.has(conditionVisitorId)) {
      setConditionVisitorId(WIZARD_GENERAL_TARGET);
    }

    if (basicArticleVisitorId !== WIZARD_GENERAL_TARGET && !validIds.has(basicArticleVisitorId)) {
      setBasicArticleVisitorId(WIZARD_GENERAL_TARGET);
    }

    if (specialArticleVisitorId !== WIZARD_GENERAL_TARGET && !validIds.has(specialArticleVisitorId)) {
      setSpecialArticleVisitorId(WIZARD_GENERAL_TARGET);
    }
  }, [selectedWizardVisits, docVisitorId, conditionVisitorId, basicArticleVisitorId, specialArticleVisitorId]);

  useEffect(() => {
    if (visitorState.success) {
      visitorFormRef.current?.reset();
      setFormSeed((current) => current + 1);
      setVisitorBirthInputMode("edad");
      setVisitorNameInput("");
      setVisitorAgeInput("");
      setVisitorBirthDateInput("");
      setVisitorSexInput("");
      setVisitorParentescoInput("");
      router.refresh();
    }
  }, [router, visitorState.success]);

  useEffect(() => {
    if (createState.success) {
      internalFormRef.current?.reset();
    }
  }, [createState.success]);

  useEffect(() => {
    if (statusState.success) {
      router.refresh();
    }
  }, [router, statusState.success]);

  useEffect(() => {
    if (!createPending && !passPending && !visitorPending && !statusPending) {
      setScreenLoading(false);
    }
  }, [createPending, passPending, visitorPending, statusPending]);

  useEffect(() => {
    if (!modalInternalId) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setModalInternalId(null);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [modalInternalId]);

  useEffect(() => {
    setQueryInput(query);
    setSearchLoading(false);
  }, [query, page, totalPages]);

  useEffect(() => {
    if (!modalInternalId || availableDates.length === 0) {
      return;
    }

    const hasSelectedDate = availableDates.some((item) => item.fechaCompleta === selectedDateValue);
    if (!selectedDateValue || !hasSelectedDate) {
      setSelectedDateValue(getDefaultDateValue(roleKey, openDate, nextDate, availableDates));
    }
  }, [modalInternalId, availableDates, selectedDateValue, roleKey, openDate, nextDate]);

  useEffect(() => {
    if (wizardStepIndex <= wizardSteps.length - 1) {
      return;
    }

    setWizardStepIndex(Math.max(0, wizardSteps.length - 1));
  }, [wizardStepIndex, wizardSteps.length]);

  function openInternalModal(profile: InternalProfile) {
    setModalInternalId(profile.id);
    setSelectedVisitorIds([]);
    setSelectedDateValue(getDefaultDateValue(roleKey, openDate, nextDate, availableDates));
    setVisitorQuery("");
    setAllowDuplicatePass(false);
    setPassLocalError(null);
    setHistoryOpen(false);
    setHistorySections({});
    setFormSeed((current) => current + 1);
    setVisitorBirthInputMode("edad");
    setVisitorNameInput("");
    setVisitorAgeInput("");
    setVisitorBirthDateInput("");
    setVisitorSexInput("");
    setVisitorParentescoInput("");
    setWizardStepIndex(0);
    setWizardAutoSync({ basicas: true, especiales: true });
    setWizardState(createEmptyWizardState());
    resetWizardAuxiliaryInputs();
    setModalBannerResetKey((current) => current + 1);
    setRecentCreatedPass(null);
    pendingPassContextRef.current = null;
    handledPassSuccessKeyRef.current = null;
  }

  function toggleVisitor(visitaId: string) {
    setSelectedVisitorIds((current) =>
      current.includes(visitaId)
        ? current.filter((item) => item !== visitaId)
        : [...current, visitaId]
    );
  }

  function appendWizardCard(card: WizardCard) {
    updateWizardState((current) => ({
      ...current,
      cards: [...current.cards, card]
    }));
  }

  function removeWizardCard(cardId: string) {
    updateWizardState((current) => ({
      ...current,
      cards: current.cards.filter((card) => card.id !== cardId)
    }));
  }

  function handleAddDocumentCard() {
    const visit = selectedWizardVisitOptions.find((item) => item.visitante_id === docVisitorId);
    if (!visit || !docValue.trim()) {
      return;
    }

    appendWizardCard({
      id: buildWizardCardId(),
      type: "documentacion",
      visitante_id: visit.visitante_id,
      visitante_nombre: visit.visitante_nombre,
      categoria: "Documentación",
      valor: docValue.trim(),
      cantidad: 1,
      requiere_revision: false,
      detalle: "",
      target: "basicas"
    });
    setDocValue("");
  }

  function handleAddConditionCard() {
    if (!conditionValue.trim()) {
      return;
    }

    const visit =
      conditionVisitorId === WIZARD_GENERAL_TARGET
        ? null
        : selectedWizardVisitOptions.find((item) => item.visitante_id === conditionVisitorId) ?? null;

    appendWizardCard({
      id: buildWizardCardId(),
      type: "condicion",
      visitante_id: visit?.visitante_id ?? null,
      visitante_nombre: visit?.visitante_nombre ?? null,
      categoria: "Condiciones",
      valor: conditionValue.trim(),
      cantidad: 1,
      requiere_revision: false,
      detalle: conditionDetail.trim(),
      target: "basicas"
    });
    setConditionValue("");
    setConditionDetail("");
  }

  function handleAddBasicArticleCard() {
    if (!basicArticleValue.trim()) {
      return;
    }

    const visit =
      basicArticleVisitorId === WIZARD_GENERAL_TARGET
        ? null
        : selectedWizardVisitOptions.find((item) => item.visitante_id === basicArticleVisitorId) ?? null;

    appendWizardCard({
      id: buildWizardCardId(),
      type: "articulo_basico",
      visitante_id: visit?.visitante_id ?? null,
      visitante_nombre: visit?.visitante_nombre ?? null,
      categoria: "Artículos básicos",
      valor: basicArticleValue.trim(),
      cantidad: 1,
      requiere_revision: false,
      detalle: "",
      target: "basicas"
    });
    setBasicArticleValue("");
  }

  function handleAddSpecialCard() {
    if (!specialArticleValue.trim()) {
      return;
    }

    const visit =
      specialArticleVisitorId === WIZARD_GENERAL_TARGET
        ? null
        : selectedWizardVisitOptions.find((item) => item.visitante_id === specialArticleVisitorId) ?? null;

    appendWizardCard({
      id: buildWizardCardId(),
      type: "articulo_especial",
      visitante_id: visit?.visitante_id ?? null,
      visitante_nombre: visit?.visitante_nombre ?? null,
      categoria: "Artículos especiales",
      valor: specialArticleValue.trim(),
      cantidad: Math.max(1, Number(specialArticleQuantity || 1)),
      requiere_revision: specialArticleReview,
      detalle: specialArticleDetail.trim(),
      target: "especiales"
    });
    setSpecialArticleValue("");
    setSpecialArticleQuantity("1");
    setSpecialArticleReview(true);
    setSpecialArticleDetail("");
  }

  function restoreWizardPreview(target: "basicas" | "especiales") {
    const nextSync = {
      basicas: target === "basicas" ? true : wizardAutoSync.basicas,
      especiales: target === "especiales" ? true : wizardAutoSync.especiales
    };
    setWizardAutoSync(nextSync);
    updateWizardState((current) => current, nextSync);
  }

  useEffect(() => {
    if (!selectedPass) {
      setAllowDuplicatePass(false);
    }
  }, [selectedPass]);

  function toggleHistorySection(sectionKey: string) {
    setHistorySections((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey]
    }));
  }

  async function toggleHistoryPanel() {
    if (!selected) {
      return;
    }

    const nextState = !historyOpen;
    setHistoryOpen(nextState);

    if (!nextState || historyCache[selected.id] || roleKey !== "super-admin") {
      return;
    }

    try {
      setHistoryLoading(true);
      const response = await fetch(`/api/internals/${selected.id}/history`, {
        cache: "no-store"
      });
      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as InternalHistoryPayload;
      setHistoryCache((current) => ({
        ...current,
        [selected.id]: payload
      }));
    } finally {
      setHistoryLoading(false);
    }
  }

  function goToPage(nextPage: number) {
    if (nextPage === page) {
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    const params = new URLSearchParams(searchParams.toString());
    if (query.trim()) {
      params.set("q", query.trim());
    } else {
      params.delete("q");
    }

    if (nextPage <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(nextPage));
    }

    router.replace(params.size ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
  }

  function applySearch(rawValue: string) {
    const normalized = rawValue.trim();
    if (normalized === query.trim() && page === 1) {
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    const params = new URLSearchParams(searchParams.toString());
    if (normalized) {
      params.set("q", normalized);
    } else {
      params.delete("q");
    }
    params.delete("page");
    router.replace(params.size ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
  }

  function openSupportTicketForInternal() {
    if (!selected) {
      return;
    }

    const params = new URLSearchParams({
      new: "1",
      type: "correccion",
      module: "internos",
      entityType: "interno",
      entityId: selected.id,
      label: getMaskedInternalLabel(roleKey, selected.id, selected.fullName),
      subtitle: `Ubicacion ${getMaskedInternalLabel(roleKey, selected.id, selected.ubicacion)}`
    });

    setModalInternalId(null);
    router.push(`/sistema/tickets?${params.toString()}`);
  }

  function renderWizardCards(cards: WizardCard[], emptyMessage: string) {
    if (cards.length === 0) {
      return <span className="muted">{emptyMessage}</span>;
    }

    return (
      <div className="wizard-card-grid">
        {cards.map((card) => (
          <div key={card.id} className={`wizard-card wizard-card-${card.target}`}>
            <div className="wizard-card-copy">
              <strong>{getWizardCardLabel(card, selectedIsSensitive)}</strong>
              <small>{card.categoria}</small>
            </div>
            <button
              type="button"
              className="button-soft wizard-card-remove"
              onClick={() => removeWizardCard(card.id)}
            >
              Quitar
            </button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <FullscreenLoading active={searchLoading || screenLoading || createPending || passPending || visitorPending || statusPending} />
      <section className="module-grid module-grid-single">
        <article className="data-card">
          <div className="actions-row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
            <strong className="section-title">Internos</strong>
          </div>

          <form
            className="actions-row"
            style={{ marginBottom: "0.8rem", alignItems: "stretch" }}
            onSubmit={(event) => {
              event.preventDefault();
              applySearch(queryInput);
            }}
          >
            <div className="field" style={{ flex: 1 }}>
              <input
                id="internal-search"
                value={queryInput}
                onChange={(event) => setQueryInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  setQueryInput("");
                  applySearch("");
                  return;
                }

                if (event.key === "Enter") {
                  event.preventDefault();
                  applySearch(queryInput);
                }
              }}
                placeholder="Buscar por nombre o ubicacion"
                autoComplete="off"
              />
            </div>
            <button type="submit" className="button-soft">
              Buscar
            </button>
          </form>

          <div className="table-wrap compact-table">
            <table>
              <thead>
                <tr>
                  <th>Interno</th>
                  <th>Ubicacion</th>
                  <th>Edad</th>
                </tr>
              </thead>
              <tbody>
                {profiles.length === 0 ? (
                  <tr>
                    <td colSpan={3}>Sin resultados.</td>
                  </tr>
                ) : (
                  profiles.map((profile) => (
                    <tr key={profile.id} onClick={() => openInternalModal(profile)} style={{ cursor: "pointer" }}>
                      <td>
                        <div className="record-title inline">
                          <strong>{getMaskedInternalLabel(roleKey, profile.id, profile.fullName)}</strong>
                          <span>
                            <StatusBadge variant={getInternalStatusMeta(profile.estatus).variant}>
                              {getInternalStatusMeta(profile.estatus).label}
                            </StatusBadge>
                          </span>
                        </div>
                      </td>
                      <td>{getMaskedInternalLabel(roleKey, profile.id, profile.ubicacion)}</td>
                      <td>{maskValue(profile.edad, canViewSensitiveData && !shouldMaskSensitiveInternal(roleKey, profile.id))}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="actions-row" style={{ marginTop: "0.8rem", justifyContent: "space-between" }}>
            <span className="muted">Pagina {page} de {totalPages}</span>
            <div className="actions-row">
              <button type="button" className="button-soft" onClick={() => goToPage(Math.max(1, page - 1))} disabled={page === 1}>
                Anterior
              </button>
              <button type="button" className="button-soft" onClick={() => goToPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>
                Siguiente
              </button>
            </div>
          </div>
        </article>

        <article className="form-card">
          <strong className="section-title">Nuevo interno</strong>
          <MutationBanner state={createState} />
          <form ref={internalFormRef} action={createAction} className="field-grid" style={{ marginTop: "0.8rem" }} autoComplete="off" onSubmitCapture={() => setScreenLoading(true)}>
            <div className="field">
              <input name="nombres" placeholder="Nombres" autoComplete="off" />
            </div>
            <div className="field">
              <input name="apellido_pat" placeholder="Apellido paterno" autoComplete="off" />
            </div>
            <div className="field">
              <input name="apellido_mat" placeholder="Apellido materno" autoComplete="off" />
            </div>
            <div className="field">
                <input name="ubicacion" placeholder="Ubicacion 1-101 o I-00" autoComplete="off" />
            </div>
            <div className="field">
              <input name="edad" type="number" placeholder="Edad" autoComplete="off" />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <textarea name="observaciones" placeholder="Observaciones" autoComplete="off" />
            </div>
            <div className="actions-row">
              <LoadingButton pending={createPending} label="Guardar" loadingLabel="Loading..." className="button" />
            </div>
          </form>
        </article>
      </section>

      {selected ? (
        <div
          className="modal-backdrop"
          onClick={() => setModalInternalId(null)}
        >
          <div
            className="form-card profile-shell compact"
            style={{ width: "min(100%, 1180px)", maxHeight: "92vh", overflow: "auto" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="profile-top">
              <div className="record-title">
                <strong className="section-title">{getMaskedInternalLabel(roleKey, selected!.id, selected.fullName)}</strong>
                <span>
                  Ubicacion {getMaskedInternalLabel(roleKey, selected!.id, selected.ubicacion)} · {maskValue(selected.edad, canViewSensitiveData && !selectedIsSensitive)} años
                </span>
              </div>
              <div className="actions-row">
                <button type="button" className="button-soft" onClick={openSupportTicketForInternal}>
                  Ticket
                </button>
                {roleKey === "super-admin" ? (
                  <button type="button" className="button-soft" onClick={toggleHistoryPanel}>
                    Historial
                  </button>
                ) : null}
                <button type="button" className="button-soft" onClick={() => setModalInternalId(null)}>
                  Cerrar
                </button>
              </div>
            </div>

            <section className="collapse-stack" style={{ marginTop: "1rem" }}>
              <article className="data-card">
                <div className="mini-list">
                  <div className="mini-row">
                    <span>Estatus</span>
                    <strong>
                      <StatusBadge variant={getInternalStatusMeta(selected.estatus).variant}>
                        {getInternalStatusMeta(selected.estatus).label}
                      </StatusBadge>
                    </strong>
                  </div>
                  <div className="mini-row">
                    <span>Pase</span>
                    <strong>{getPassBadge(Boolean(selectedPass))}</strong>
                  </div>
                  <div className="mini-row"><span>Fecha</span><strong>{selectedDateValue ? formatLongDateWithWeekday(selectedDateValue) : "Sin fecha"}</strong></div>
                  <div className="mini-row"><span>Laborando</span><strong>{selected.laborando ? "Si" : "No"}</strong></div>
                  <div className="mini-row"><span>Telefono</span><strong>{maskValue(selected.telefono || "No aplica", canViewSensitiveData && !selectedIsSensitive)}</strong></div>
                </div>
              </article>

                {selectedPass && !shouldSuppressExistingPassAlert ? (
                  <MutationBanner
                    state={{
                      success: null,
                      error:
                        roleKey === "super-admin"
                          ? `Ese interno ya tiene pase para ${formatLongDateWithWeekday(selectedPass.fechaVisita)}. Si necesitas otro, autorizalo aqui mismo para generar un nuevo pase.`
                          : `Ese interno ya tiene pase para ${formatLongDateWithWeekday(selectedPass.fechaVisita)}.`
                    }}
                  />
                ) : null}

              {!canSubmitPass && selectedVisitors.length > 0 && selectedAdults.length === 0 ? (
                <MutationBanner state={{ success: null, error: "Debes incluir al menos un adulto en el pase." }} />
              ) : null}

              {false ? <section className="two-column-section visitor-columns-section">
              <div className="field visitor-search-field" style={{ gridColumn: "1 / -1" }}>
                <input
                  value={visitorQuery}
                  onChange={(event) => setVisitorQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setVisitorQuery("");
                    }
                  }}
                  placeholder="Buscar visita del interno"
                  autoComplete="off"
                />
              </div>
              <article className="data-card visitor-column-card">
                <strong style={{ display: "block", marginBottom: "0.7rem" }}>No vendran</strong>
                <div className="visitor-choice-grid visitor-column-list">
                  {filteredAvailableVisitors.length === 0 ? <span className="muted visitor-column-empty">Sin registros.</span> : filteredAvailableVisitors.map((item) => (
                    <button key={item.id} type="button" className="visitor-choice-item available" onClick={() => toggleVisitor(item.visitaId)}>
                      <strong>{maskPrivateText(item.visitor.fullName, selectedIsSensitive)}</strong>
                      <span className="muted">{maskValue(item.visitor.edad, canViewSensitiveData && !selectedIsSensitive)} años</span>
                    </button>
                  ))}
                </div>
              </article>

              <article className="data-card visitor-column-card">
                <strong style={{ display: "block", marginBottom: "0.7rem" }}>Vendran</strong>
                <div className="visitor-choice-grid visitor-column-list">
                  {filteredSelectedVisitors.length === 0 ? <span className="muted visitor-column-empty">Sin registros.</span> : filteredSelectedVisitors.map((item) => (
                    <button key={item.id} type="button" className="visitor-choice-item selected" onClick={() => toggleVisitor(item.visitaId)}>
                      <strong>{maskPrivateText(item.visitor.fullName, selectedIsSensitive)}</strong>
                      <span className="muted">{maskValue(item.visitor.edad, canViewSensitiveData && !selectedIsSensitive)} años</span>
                    </button>
                  ))}
                </div>
              </article>
              </section> : null}


              <article className="data-card">
                <strong style={{ display: "block", marginBottom: "0.7rem" }}>Nueva visita</strong>
                <MutationBanner
                  state={visitorState}
                  resetKey={modalBannerResetKey}
                  stateKey={visitorBannerStateKey}
                />
                <form
                  key={`visitor-form-${selected!.id}-${formSeed}`}
                  ref={visitorFormRef}
                  action={visitorAction}
                  className="field-grid"
                  autoComplete="off"
                  onSubmitCapture={() => {
                    setVisitorBannerStateKey((current) => current + 1);
                    setScreenLoading(true);
                  }}
                  >
                    <input type="hidden" name="interno_id" value={selected!.id} />
                    <div className="field" style={{ gridColumn: "1 / -1" }}><input name="nombreCompleto" placeholder="Nombre completo" autoComplete="off" required value={visitorNameInput} onChange={(event) => setVisitorNameInput(event.target.value)} /></div>
                    <div className="field">
                      <select
                        name="birth_input_mode"
                        value={visitorBirthInputMode}
                        onChange={(event) => setVisitorBirthInputMode(event.target.value as "fecha" | "edad")}
                      >
                        <option value="fecha">Capturar por fecha</option>
                        <option value="edad">Capturar por edad</option>
                      </select>
                    </div>
                    {visitorBirthInputMode === "fecha" ? (
                      <div className="field"><input name="fecha_nacimiento" type="date" autoComplete="off" required value={visitorBirthDateInput} onChange={(event) => setVisitorBirthDateInput(event.target.value)} /></div>
                    ) : (
                      <div className="field">
                        <input
                          name="edad"
                          type="number"
                          min={0}
                          max={120}
                          placeholder="Edad"
                          autoComplete="off"
                          required
                          value={visitorAgeInput}
                          onChange={(event) => setVisitorAgeInput(event.target.value)}
                        />
                        {visitorAgeInput ? (
                          <small className="muted">Nacimiento estimado: {getEstimatedBirthDateFromAge(visitorAgeInput) || "Edad invalida"}</small>
                        ) : null}
                      </div>
                    )}
                    <div className="field">
                      <select name="sexo" value={visitorSexInput} onChange={(event) => setVisitorSexInput(event.target.value)} required>
                        <option value="" disabled>Sexo</option>
                        <option value="hombre">Hombre</option>
                        <option value="mujer">Mujer</option>
                      </select>
                    </div>
                    <div className="field">
                      <input
                        name="parentesco"
                        placeholder={canUseFallbackParentesco ? "Parentesco o SN" : "Parentesco"}
                        autoComplete="off"
                        required={!canUseFallbackParentesco}
                        value={visitorParentescoInput}
                        onChange={(event) => setVisitorParentescoInput(event.target.value)}
                      />
                      {canUseFallbackParentesco ? <small className="muted">Si lo dejas vacio se guardara como SN.</small> : null}
                    </div>
                  {canManageVisitorAvailability ? (
                    <div className="field">
                      <select name="betada" defaultValue="false">
                        <option value="false">Activo</option>
                        <option value="true">No disponible</option>
                      </select>
                    </div>
                  ) : null}
                  <div className="field" style={{ gridColumn: "1 / -1" }}>
                    <textarea name="notas" placeholder="Notas" autoComplete="off" />
                  </div>
                  <div className="actions-row">
                    <LoadingButton pending={visitorPending} label="Guardar visita" loadingLabel="Loading..." className="button-secondary" disabled={!canSubmitVisitor} />
                  </div>
                </form>
              </article>

              <article className="data-card">
                <strong style={{ display: "block", marginBottom: "0.7rem" }}>Wizard de pase</strong>
                {passLocalError ? <MutationBanner state={{ success: null, error: passLocalError }} stateKey={`local-pass-${passLocalError}`} /> : null}
                <MutationBanner
                  state={passState}
                  resetKey={modalBannerResetKey}
                  stateKey={passBannerStateKey}
                />
                <form
                  key={`pass-form-wizard-${selected!.id}-${formSeed}`}
                  action={passAction}
                  className="field-grid"
                  autoComplete="off"
                  onSubmitCapture={(event) => {
                    if (!canSubmitPass) {
                      event.preventDefault();
                      setPassLocalError(passSubmitIssue ?? "No se puede crear el pase todavia.");
                      setScreenLoading(false);
                      return;
                    }

                    setPassLocalError(null);
                    setPassBannerStateKey((current) => current + 1);
                    pendingPassContextRef.current = selected
                      ? {
                          internoId: selected!.id,
                          fechaVisita: selectedDateValue
                        }
                      : null;
                    setScreenLoading(true);
                  }}
                >
                  <input type="hidden" name="interno_id" value={selected!.id} />
                  <input type="hidden" name="fecha_visita" value={selectedDateValue} />
                  <input type="hidden" name="allow_duplicate_pass" value={allowDuplicatePass ? "true" : "false"} />
                  <input type="hidden" name="wizard_mode" value="true" />
                  <input type="hidden" name="menciones" value={wizardState.menciones_basicas_final} />
                  <input type="hidden" name="especiales" value={wizardState.menciones_especiales_final} />
                  {selectedVisitorIds.map((visitorId) => (
                    <input key={visitorId} type="hidden" name="visitor_ids" value={visitorId} />
                  ))}
                  {wizardArticlePayload.map((item) => (
                    <input
                      key={item.deviceTypeId}
                      type="hidden"
                      name={`article_qty_${item.deviceTypeId}`}
                      value={String(item.quantity)}
                    />
                  ))}

                  <div className="wizard-step-strip" style={{ gridColumn: "1 / -1" }}>
                    {wizardSteps.map((step, index) => (
                      <button
                        key={step.key}
                        type="button"
                        className={`wizard-step-chip${index === wizardStepIndex ? " active" : ""}`}
                        onClick={() => setWizardStepIndex(index)}
                      >
                        {index + 1}. {step.label}
                      </button>
                    ))}
                  </div>

                  {currentWizardStep === "visitas" ? (
                    <>
                      <div className="field">
                        <label htmlFor="fecha_visita_modal">Fecha del pase</label>
                        <select
                          id="fecha_visita_modal"
                          value={selectedDateValue}
                          onChange={(event) => setSelectedDateValue(event.target.value)}
                        >
                          {availableDates.map((date) => (
                            <option key={date.id} value={date.fechaCompleta}>
                              {formatLongDateWithWeekday(date.fechaCompleta)}
                            </option>
                          ))}
                        </select>
                      </div>

                      {roleKey === "super-admin" && selectedPass ? (
                        <label className="duplicate-pass-approval">
                          <input
                            type="checkbox"
                            className="duplicate-pass-approval-input"
                            checked={allowDuplicatePass}
                            onChange={(event) => setAllowDuplicatePass(event.target.checked)}
                          />
                          <span className="duplicate-pass-approval-box" aria-hidden="true" />
                          <span className="duplicate-pass-approval-copy">
                            <strong>Autorizar pase duplicado</strong>
                            <small>Generar otro pase para este interno en la misma fecha.</small>
                          </span>
                        </label>
                      ) : null}

                      <div className="field visitor-search-field" style={{ gridColumn: "1 / -1" }}>
                        <input
                          value={visitorQuery}
                          onChange={(event) => setVisitorQuery(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Escape") {
                              event.preventDefault();
                              setVisitorQuery("");
                            }
                          }}
                          placeholder="Buscar visita del interno"
                          autoComplete="off"
                        />
                      </div>

                      <section className="two-column-section visitor-columns-section" style={{ gridColumn: "1 / -1" }}>
                        <article className="data-card visitor-column-card">
                          <strong style={{ display: "block", marginBottom: "0.7rem" }}>No vendrán</strong>
                          <div className="visitor-choice-grid visitor-column-list">
                            {filteredAvailableVisitors.length === 0 ? (
                              <span className="muted visitor-column-empty">Sin registros.</span>
                            ) : (
                              filteredAvailableVisitors.map((item) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  className="visitor-choice-item available"
                                  onClick={() => toggleVisitor(item.visitaId)}
                                >
                                  <strong>{maskPrivateText(item.visitor.fullName, selectedIsSensitive)}</strong>
                                  <span className="muted">
                                    {maskValue(item.visitor.edad, canViewSensitiveData && !selectedIsSensitive)} años
                                  </span>
                                </button>
                              ))
                            )}
                          </div>
                        </article>

                        <article className="data-card visitor-column-card">
                          <strong style={{ display: "block", marginBottom: "0.7rem" }}>Vendrán</strong>
                          <div className="visitor-choice-grid visitor-column-list">
                            {filteredSelectedVisitors.length === 0 ? (
                              <span className="muted visitor-column-empty">Sin registros.</span>
                            ) : (
                              filteredSelectedVisitors.map((item) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  className="visitor-choice-item selected"
                                  onClick={() => toggleVisitor(item.visitaId)}
                                >
                                  <strong>{maskPrivateText(item.visitor.fullName, selectedIsSensitive)}</strong>
                                  <span className="muted">
                                    {maskValue(item.visitor.edad, canViewSensitiveData && !selectedIsSensitive)} años
                                  </span>
                                </button>
                              ))
                            )}
                          </div>
                        </article>
                      </section>

                      <div className="record-pill" style={{ gridColumn: "1 / -1" }}>
                        <strong>{selectedVisitors.length} visitas seleccionadas</strong>
                        <span>{selectedAdults.length} adultos · {Math.max(0, selectedVisitors.length - selectedAdults.length)} menores</span>
                      </div>

                      {!canCaptureWizardMentions ? (
                        <div className="record-pill" style={{ gridColumn: "1 / -1" }}>
                          <strong>Tu rol puede guardar el pase</strong>
                          <span>Las menciones automáticas quedan reservadas para control y super-admin.</span>
                        </div>
                      ) : null}
                    </>
                  ) : null}

                  {currentWizardStep === "documentacion" && canCaptureWizardMentions ? (
                    <>
                      <div className="field">
                        <label>Visita</label>
                        <select value={docVisitorId} onChange={(event) => setDocVisitorId(event.target.value)}>
                          <option value="">Selecciona visita</option>
                          {selectedWizardVisitOptions.map((visit) => (
                            <option key={visit.visitante_id} value={visit.visitante_id}>
                              {maskWizardVisitorName(visit.visitante_nombre, selectedIsSensitive)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label>Documento</label>
                        <select value={docValue} onChange={(event) => setDocValue(event.target.value)}>
                          <option value="">Selecciona documento</option>
                          {DOCUMENT_OPTIONS.map((item) => (
                            <option key={item} value={item}>{item}</option>
                          ))}
                        </select>
                      </div>
                      <div className="actions-row" style={{ gridColumn: "1 / -1" }}>
                        <button type="button" className="button-soft" onClick={handleAddDocumentCard} disabled={!docVisitorId || !docValue}>
                          Agregar tarjeta
                        </button>
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        {renderWizardCards(filteredDocumentCards, "Sin tarjetas de documentación.")}
                      </div>
                    </>
                  ) : null}

                  {currentWizardStep === "condiciones" && canCaptureWizardMentions ? (
                    <>
                      <div className="field">
                        <label>Aplica a</label>
                        <select value={conditionVisitorId} onChange={(event) => setConditionVisitorId(event.target.value)}>
                          <option value={WIZARD_GENERAL_TARGET}>General</option>
                          {selectedWizardVisitOptions.map((visit) => (
                            <option key={visit.visitante_id} value={visit.visitante_id}>
                              {maskWizardVisitorName(visit.visitante_nombre, selectedIsSensitive)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label>Condición</label>
                        <select value={conditionValue} onChange={(event) => setConditionValue(event.target.value)}>
                          <option value="">Selecciona condición</option>
                          {CONDITION_OPTIONS.map((item) => (
                            <option key={item} value={item}>{item}</option>
                          ))}
                        </select>
                      </div>
                      <div className="field" style={{ gridColumn: "1 / -1" }}>
                        <input
                          value={conditionDetail}
                          onChange={(event) => setConditionDetail(event.target.value)}
                          placeholder="Detalle opcional"
                          autoComplete="off"
                        />
                      </div>
                      <div className="actions-row" style={{ gridColumn: "1 / -1" }}>
                        <button type="button" className="button-soft" onClick={handleAddConditionCard} disabled={!conditionValue}>
                          Agregar tarjeta
                        </button>
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        {renderWizardCards(filteredConditionCards, "Sin tarjetas de condiciones.")}
                      </div>
                    </>
                  ) : null}

                  {currentWizardStep === "articulos" && canCaptureWizardMentions ? (
                    <>
                      <div className="field">
                        <label>Aplica a</label>
                        <select value={basicArticleVisitorId} onChange={(event) => setBasicArticleVisitorId(event.target.value)}>
                          <option value={WIZARD_GENERAL_TARGET}>General</option>
                          {selectedWizardVisitOptions.map((visit) => (
                            <option key={visit.visitante_id} value={visit.visitante_id}>
                              {maskWizardVisitorName(visit.visitante_nombre, selectedIsSensitive)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label>Artículo básico</label>
                        <select value={basicArticleValue} onChange={(event) => setBasicArticleValue(event.target.value)}>
                          <option value="">Selecciona artículo</option>
                          {BASIC_ARTICLE_CATALOG.map((group) => (
                            <optgroup key={group.group} label={group.group}>
                              {group.items.map((item) => (
                                <option key={item} value={item}>{item}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                      <div className="actions-row" style={{ gridColumn: "1 / -1" }}>
                        <button type="button" className="button-soft" onClick={handleAddBasicArticleCard} disabled={!basicArticleValue}>
                          Agregar tarjeta
                        </button>
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        {renderWizardCards(filteredBasicArticleCards, "Sin artículos básicos.")}
                      </div>
                    </>
                  ) : null}

                  {currentWizardStep === "especiales" ? (
                    <>
                      {canCaptureWizardMentions ? (
                        <>
                          <div className="field">
                            <label>Aplica a</label>
                            <select value={specialArticleVisitorId} onChange={(event) => setSpecialArticleVisitorId(event.target.value)}>
                              <option value={WIZARD_GENERAL_TARGET}>General</option>
                              {selectedWizardVisitOptions.map((visit) => (
                                <option key={visit.visitante_id} value={visit.visitante_id}>
                                  {maskWizardVisitorName(visit.visitante_nombre, selectedIsSensitive)}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="field">
                            <label>Artículo especial</label>
                            <select
                              value={specialArticleValue}
                              onChange={(event) => setSpecialArticleValue(event.target.value)}
                            >
                              <option value="">Selecciona artículo</option>
                              {SPECIAL_ARTICLE_CATALOG.map((group) => (
                                <optgroup key={group.group} label={group.group}>
                                  {group.items.map((item) => (
                                    <option key={item} value={item}>{item}</option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                          </div>
                          <div className="field">
                            <label>Cantidad</label>
                            <input
                              type="number"
                              min="1"
                              value={specialArticleQuantity}
                              onChange={(event) => setSpecialArticleQuantity(event.target.value)}
                              autoComplete="off"
                            />
                          </div>
                          <label className="duplicate-pass-approval">
                            <input
                              type="checkbox"
                              className="duplicate-pass-approval-input"
                              checked={specialArticleReview}
                              onChange={(event) => setSpecialArticleReview(event.target.checked)}
                            />
                            <span className="duplicate-pass-approval-box" aria-hidden="true" />
                            <span className="duplicate-pass-approval-copy">
                              <strong>Requiere revisión</strong>
                              <small>Úsalo para marcar aparatos u objetos especiales.</small>
                            </span>
                          </label>
                          <div className="field" style={{ gridColumn: "1 / -1" }}>
                            <input
                              value={specialArticleDetail}
                              onChange={(event) => setSpecialArticleDetail(event.target.value)}
                              placeholder="Detalle opcional"
                              autoComplete="off"
                            />
                          </div>
                          <div className="actions-row" style={{ gridColumn: "1 / -1" }}>
                            <button
                              type="button"
                              className="button-soft"
                              onClick={handleAddSpecialCard}
                              disabled={!specialArticleValue}
                            >
                              Agregar tarjeta
                            </button>
                          </div>
                          <div style={{ gridColumn: "1 / -1" }}>
                            {renderWizardCards(filteredSpecialCards, "Sin artículos especiales.")}
                          </div>

                          <div className="field" style={{ gridColumn: "1 / -1" }}>
                            <label>Peticiones básicas manuales</label>
                            <textarea
                              value={wizardState.menciones_basicas_manual}
                              onChange={(event) =>
                                updateWizardState((current) => ({
                                  ...current,
                                  menciones_basicas_manual: event.target.value
                                }))
                              }
                              placeholder="Texto adicional para básicas"
                              autoComplete="off"
                              style={{ borderColor: "#d97706", boxShadow: "0 0 0 3px rgba(217,119,6,0.10)" }}
                            />
                          </div>
                          <div className="field" style={{ gridColumn: "1 / -1" }}>
                            <label>Peticiones especiales manuales</label>
                            <textarea
                              value={wizardState.menciones_especiales_manual}
                              onChange={(event) =>
                                updateWizardState((current) => ({
                                  ...current,
                                  menciones_especiales_manual: event.target.value
                                }))
                              }
                              placeholder="Texto adicional para especiales"
                              autoComplete="off"
                              style={{ borderColor: "#c23030", boxShadow: "0 0 0 3px rgba(194,48,48,0.10)" }}
                            />
                          </div>

                          <div className="field" style={{ gridColumn: "1 / -1" }}>
                            <label>Generado básicas</label>
                            <textarea value={wizardState.menciones_basicas_generadas} readOnly />
                          </div>
                          <div className="field" style={{ gridColumn: "1 / -1" }}>
                            <label>Generado especiales</label>
                            <textarea value={wizardState.menciones_especiales_generadas} readOnly />
                          </div>

                          <div className="field" style={{ gridColumn: "1 / -1" }}>
                            <div className="actions-row" style={{ justifyContent: "space-between", marginBottom: "0.4rem" }}>
                              <label style={{ marginBottom: 0 }}>Menciones básicas finales</label>
                              <button type="button" className="button-soft" onClick={() => restoreWizardPreview("basicas")}>
                                Restaurar vista previa
                              </button>
                            </div>
                            <textarea
                              value={wizardState.menciones_basicas_final}
                              onChange={(event) => {
                                setWizardAutoSync((current) => ({ ...current, basicas: false }));
                                setWizardState((current) => ({
                                  ...current,
                                  menciones_basicas_final: event.target.value
                                }));
                              }}
                              placeholder="Vista final de menciones básicas"
                              autoComplete="off"
                              style={{ borderColor: "#d97706", boxShadow: "0 0 0 3px rgba(217,119,6,0.10)" }}
                            />
                          </div>
                          <div className="field" style={{ gridColumn: "1 / -1" }}>
                            <div className="actions-row" style={{ justifyContent: "space-between", marginBottom: "0.4rem" }}>
                              <label style={{ marginBottom: 0 }}>Menciones especiales finales</label>
                              <button type="button" className="button-soft" onClick={() => restoreWizardPreview("especiales")}>
                                Restaurar vista previa
                              </button>
                            </div>
                            <textarea
                              value={wizardState.menciones_especiales_final}
                              onChange={(event) => {
                                setWizardAutoSync((current) => ({ ...current, especiales: false }));
                                setWizardState((current) => ({
                                  ...current,
                                  menciones_especiales_final: event.target.value
                                }));
                              }}
                              placeholder="Vista final de menciones especiales"
                              autoComplete="off"
                              style={{ borderColor: "#c23030", boxShadow: "0 0 0 3px rgba(194,48,48,0.10)" }}
                            />
                          </div>
                        </>
                      ) : (
                        <div className="record-pill" style={{ gridColumn: "1 / -1" }}>
                          <strong>Vista previa restringida</strong>
                          <span>Tu rol puede seleccionar visitas y guardar el pase, pero no generar menciones automáticas.</span>
                        </div>
                      )}
                    </>
                  ) : null}

                  <div className="actions-row" style={{ gridColumn: "1 / -1", justifyContent: "space-between", marginTop: "0.4rem" }}>
                    <div className="actions-row">
                      <button
                        type="button"
                        className="button-soft"
                        onClick={() => setWizardStepIndex((current) => Math.max(0, current - 1))}
                        disabled={wizardStepIndex === 0}
                      >
                        Anterior
                      </button>
                      <button
                        type="button"
                        className="button-soft"
                        onClick={() => setWizardStepIndex((current) => Math.min(wizardSteps.length - 1, current + 1))}
                        disabled={wizardStepIndex >= wizardSteps.length - 1}
                      >
                        Siguiente
                      </button>
                    </div>

                    {canRenderPassButton && currentWizardStep === wizardSteps[wizardSteps.length - 1]?.key ? (
                      <LoadingButton pending={passPending} label="CREAR PASE" loadingLabel="Loading..." className="button" />
                    ) : null}
                  </div>
                </form>
              </article>

              {false ? <article className="data-card">
                <strong style={{ display: "block", marginBottom: "0.7rem" }}>Crear pase</strong>
                {passLocalError ? <MutationBanner state={{ success: null, error: passLocalError }} stateKey={`local-pass-${passLocalError}`} /> : null}
                <MutationBanner
                  state={passState}
                  resetKey={modalBannerResetKey}
                  stateKey={passBannerStateKey}
                />
                <form
                  key={`pass-form-${selected!.id}-${formSeed}`}
                  action={passAction}
                  className="field-grid"
                  autoComplete="off"
                  onSubmitCapture={(event) => {
                    if (!canSubmitPass) {
                      event.preventDefault();
                      setPassLocalError(passSubmitIssue ?? "No se puede crear el pase todavia.");
                      setScreenLoading(false);
                      return;
                    }

                    setPassLocalError(null);
                    setPassBannerStateKey((current) => current + 1);
                    pendingPassContextRef.current = selected
                      ? {
                          internoId: selected!.id,
                          fechaVisita: selectedDateValue
                        }
                      : null;
                    setScreenLoading(true);
                  }}
                >
                      <input type="hidden" name="interno_id" value={selected!.id} />
                      <input type="hidden" name="fecha_visita" value={selectedDateValue} />
                      <input type="hidden" name="allow_duplicate_pass" value={allowDuplicatePass ? "true" : "false"} />
                      {selectedVisitorIds.map((visitorId) => (
                        <input key={visitorId} type="hidden" name="visitor_ids" value={visitorId} />
                      ))}

                    <div className="field">
                      <label htmlFor="fecha_visita_modal">Fecha del pase</label>
                      <select id="fecha_visita_modal" value={selectedDateValue} onChange={(event) => setSelectedDateValue(event.target.value)}>
                        {availableDates.map((date) => (
                          <option key={date.id} value={date.fechaCompleta}>
                            {formatLongDateWithWeekday(date.fechaCompleta)}
                          </option>
                        ))}
                      </select>
                      </div>

                        {roleKey === "super-admin" && selectedPass ? (
                          <label
                            className="duplicate-pass-approval"
                          >
                            <input
                              type="checkbox"
                              className="duplicate-pass-approval-input"
                              checked={allowDuplicatePass}
                              onChange={(event) => setAllowDuplicatePass(event.target.checked)}
                            />
                            <span className="duplicate-pass-approval-box" aria-hidden="true" />
                            <span className="duplicate-pass-approval-copy">
                              <strong>Autorizar pase duplicado</strong>
                              <small>Generar otro pase para este interno en la misma fecha.</small>
                            </span>
                          </label>
                        ) : null}

                      {canManageMentions(roleKey) ? (
                      <>
                        <div className="field" style={{ gridColumn: "1 / -1" }}>
                          <textarea name="menciones" placeholder="Peticiones basicas" autoComplete="off" style={{ borderColor: "#d97706", boxShadow: "0 0 0 3px rgba(217,119,6,0.10)" }} />
                        </div>
                        <div className="field" style={{ gridColumn: "1 / -1" }}>
                          <textarea name="especiales" placeholder="Peticiones especiales" autoComplete="off" style={{ borderColor: "#c23030", boxShadow: "0 0 0 3px rgba(194,48,48,0.10)" }} />
                        </div>
                        <div className="field" style={{ gridColumn: "1 / -1" }}>
                          <label>Articulos</label>
                          <div className="article-grid">
                            {passArticles.map((article) => (
                              <div key={article.id} className="field">
                                <label htmlFor={`article_${article.id}`}>{article.name}</label>
                                <input id={`article_${article.id}`} type="number" min="0" name={`article_qty_${article.id}`} placeholder="0" autoComplete="off" />
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : null}

                      {canRenderPassButton ? (
                        <div className="actions-row">
                          <LoadingButton pending={passPending} label="CREAR PASE" loadingLabel="Loading..." className="button" />
                        </div>
                      ) : null}
                  </form>
              </article> : null}

              {roleKey === "super-admin" && historyOpen ? (
                <section className="profile-history-stack">
                  {historyLoading && !selectedHistory ? (
                    <div className="record-pill">
                      <strong>Loading...</strong>
                      <span>Estamos cargando el historial del interno.</span>
                    </div>
                  ) : null}
                  {[
                    {
                      key: "visitas",
                      title: "Visitas",
                      count: selectedHistory?.visitors.length ?? 0,
                      content: !selectedHistory || selectedHistory.visitors.length === 0 ? <span className="muted">Sin visitas.</span> : selectedHistory.visitors.map((item) => (
                        <div key={item.id} className="record-pill">
                          <strong>{item.visitor.fullName}</strong>
                          <span>{item.parentesco}</span>
                        </div>
                      ))
                    },
                    {
                      key: "aparatos",
                      title: "Aparatos registrados",
                      count: selectedHistory?.devices.length ?? 0,
                      content: !selectedHistory || selectedHistory.devices.length === 0 ? <span className="muted">Sin aparatos.</span> : selectedHistory.devices.map((item) => (
                        <div key={item.id} className="record-pill">
                          <strong>{item.deviceTypeName}</strong>
                          <span>{item.moduleKey} · {item.quantity}</span>
                          <small>{[item.brand, item.model].filter(Boolean).join(" / ") || "Sin detalle"}</small>
                        </div>
                      ))
                    },
                    {
                      key: "trabajo",
                      title: "Negocios y oficinas",
                      count: selectedHistory?.workplaceAssignments.length ?? 0,
                      content: !selectedHistory || selectedHistory.workplaceAssignments.length === 0 ? <span className="muted">Sin asignaciones.</span> : selectedHistory.workplaceAssignments.map((item) => (
                        <div key={item.id} className="record-pill">
                          <strong>{item.workplaceName}</strong>
                          <span>{item.title}</span>
                          <small>{item.workplaceType} · ${item.salary.toFixed(2)}</small>
                        </div>
                      ))
                    },
                    {
                      key: "pases",
                      title: "Historico de visitas y pases",
                      count: selectedHistory?.recentPasses.length ?? 0,
                      content: !selectedHistory || selectedHistory.recentPasses.length === 0 ? <span className="muted">Sin historial.</span> : selectedHistory.recentPasses.map((item) => (
                        <div key={item.id} className="record-pill">
                          <strong>{formatLongDate(item.fechaVisita)}</strong>
                          <span>{item.visitantes.length} visitas</span>
                        </div>
                      ))
                    },
                    {
                      key: "pagos",
                      title: "Pagos semanales",
                      count: selectedHistory?.weeklyPayments.length ?? 0,
                      content: !selectedHistory || selectedHistory.weeklyPayments.length === 0 ? <span className="muted">Sin pagos.</span> : selectedHistory.weeklyPayments.map((item) => (
                        <div key={item.id} className="record-pill">
                          <strong>{item.deviceTypeName}</strong>
                          <span>{compactMoney(item.amount)} · {item.status}</span>
                        </div>
                      ))
                    },
                    {
                      key: "escaleras",
                      title: "Escaleras",
                      count: selectedHistory?.escalerasHistory.length ?? 0,
                      content: !selectedHistory || selectedHistory.escalerasHistory.length === 0 ? <span className="muted">Sin registros.</span> : selectedHistory.escalerasHistory.map((item) => (
                        <div key={item.id} className="record-pill">
                          <strong>{formatLongDate(item.fechaVisita)}</strong>
                          <span>{item.status}</span>
                        </div>
                      ))
                    },
                    {
                      key: "multas",
                      title: "Multas y decomisos",
                      count: (selectedHistory?.fines.length ?? 0) + (selectedHistory?.seizures.length ?? 0),
                      content: !selectedHistory || (selectedHistory.fines.length === 0 && selectedHistory.seizures.length === 0) ? <span className="muted">Sin registros.</span> : (
                        <>
                          {selectedHistory.fines.map((item) => (
                            <div key={item.id} className="record-pill">
                              <strong>{item.concept}</strong>
                              <span>{compactMoney(item.amount)} · {item.status}</span>
                            </div>
                          ))}
                          {selectedHistory.seizures.map((item) => (
                            <div key={item.id} className="record-pill">
                              <strong>{item.concept}</strong>
                              <span>{item.status}</span>
                            </div>
                          ))}
                        </>
                      )
                    },
                    {
                      key: "movimientos",
                      title: "Cambios, venta, renta y compra",
                      count: selectedHistory?.equipmentMovements.length ?? 0,
                      content: !selectedHistory || selectedHistory.equipmentMovements.length === 0 ? <span className="muted">Sin movimientos.</span> : selectedHistory.equipmentMovements.map((item) => (
                        <div key={item.id} className="record-pill">
                          <strong>{item.movementType}</strong>
                          <span>{item.description}</span>
                          <small>{item.amount ? compactMoney(item.amount) : "Sin monto"}</small>
                        </div>
                      ))
                    },
                    {
                      key: "cambios",
                      title: "Cambios de datos",
                      count: selectedHistory?.changeLogs.length ?? 0,
                      content: !selectedHistory || selectedHistory.changeLogs.length === 0 ? <span className="muted">Sin cambios.</span> : selectedHistory.changeLogs.map((item) => (
                        <div key={item.id} className="record-pill">
                          <strong>{item.title}</strong>
                          <span>{formatLongDate(item.createdAt.slice(0, 10))}</span>
                          <small>{item.notes}</small>
                        </div>
                      ))
                    },
                    {
                      key: "notas",
                      title: "Notas y temporalidad",
                      count: selectedHistory?.notes.length ?? 0,
                      content: !selectedHistory || selectedHistory.notes.length === 0 ? <span className="muted">Sin notas.</span> : selectedHistory.notes.map((item) => (
                        <div key={item.id} className="record-pill">
                          <strong>{item.title}</strong>
                          <span>{item.sourceModule}</span>
                          <small>{item.notes}</small>
                        </div>
                      ))
                    }
                  ].map((section) => {
                    const isOpen = Boolean(historySections[section.key]);
                    return (
                      <article key={section.key} className="data-card section-collapse">
                        <button
                          type="button"
                          className="button-soft collapse-trigger"
                          onClick={() => toggleHistorySection(section.key)}
                        >
                          <span>{section.title}</span>
                          <span>{section.count} {isOpen ? "−" : "+"}</span>
                        </button>
                        {isOpen ? (
                          <div className="record-stack" style={{ marginTop: "0.9rem" }}>
                            {section.content}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </section>
              ) : null}

              {roleKey === "super-admin" ? (
                <details className="data-card section-collapse">
                  <summary>
                    <span>Cambiar estatus</span>
                    <span>{getInternalStatusMeta(selected.estatus).label}</span>
                  </summary>
                  <div className="section-collapse-body">
                    <MutationBanner
                      state={statusState}
                      resetKey={modalBannerResetKey}
                      stateKey={statusBannerStateKey}
                    />
                    <form
                      action={statusAction}
                      className="actions-row"
                      autoComplete="off"
                      onSubmitCapture={() => {
                        setStatusBannerStateKey((current) => current + 1);
                        setScreenLoading(true);
                      }}
                    >
                      <input type="hidden" name="interno_id" value={selected.id} />
                      <div className="field" style={{ flex: 1 }}>
                        <select name="estatus" defaultValue={selected.estatus}>
                          <option value="activo">Activo</option>
                          <option value="150">150</option>
                          <option value="retenido">Retenido</option>
                          <option value="baja">Baja</option>
                        </select>
                      </div>
                      <LoadingButton pending={statusPending} label="Guardar estatus" loadingLabel="Loading..." className="button-soft" />
                    </form>
                  </div>
                </details>
              ) : null}
            </section>
          </div>
        </div>
      ) : null}
    </>
  );
}

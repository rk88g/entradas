"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getCurrentUserProfile,
  getDateByValue,
  getFechas,
  getListado,
  getNextDate,
  getOpenDate
} from "@/lib/supabase/queries";
import { MutationState } from "@/lib/types";
import {
  getAllowedModuleDeviceNames,
  canManageMentions,
  compareInternalLocations,
  getDateOffset,
  isValidInternalLocation,
  getWeekRangeFromCutoff,
  normalizeDeviceTypeName
} from "@/lib/utils";

function success(message: string): MutationState {
  return { success: message, error: null };
}

function failure(message: string): MutationState {
  return { success: null, error: message };
}

function parseDateParts(dateValue: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day)
  };
}

function buildBirthDateFromAge(age: number) {
  const currentYear = new Date().getFullYear();
  return `${currentYear - age}-01-01`;
}

function buildInternalExpediente() {
  return `INT-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function buildForcedPassword() {
  return `${randomBytes(24).toString("base64url")}!Aa9`;
}

function normalizeFullName(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

const VISITOR_NAME_PARTICLES = new Set([
  "da",
  "das",
  "de",
  "del",
  "der",
  "di",
  "do",
  "dos",
  "el",
  "la",
  "las",
  "los",
  "mac",
  "mc",
  "san",
  "santa",
  "van",
  "von",
  "y"
]);

function capitalizeWords(value: string) {
  const normalized = normalizeFullName(value).toLocaleLowerCase("es-MX");
  return normalized.replace(/(^|[\s-])([\p{L}])/gu, (_match, prefix: string, letter: string) => {
    return `${prefix}${letter.toLocaleUpperCase("es-MX")}`;
  });
}

function normalizeParentesco(value: string) {
  const normalized = capitalizeWords(value);
  return normalized.toUpperCase() === "SN" ? "SN" : normalized;
}

function capitalizeFirstLetterPerLine(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => {
      const normalized = line.trim();
      if (!normalized) {
        return "";
      }

      return normalized.replace(/^([^\p{L}\p{N}]*)([\p{L}])/u, (_match, prefix: string, letter: string) => {
        return `${prefix}${letter.toLocaleUpperCase("es-MX")}`;
      });
    })
    .join("\n")
    .trim();
}

function normalizeVisitorComparisonName(value: string) {
  return normalizeFullName(value)
    .toLocaleLowerCase("es-MX")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getVisitorComparisonTokens(value: string, ignoreParticles = false) {
  const normalizedTokens = normalizeVisitorComparisonName(value).split(" ").filter(Boolean);
  if (!ignoreParticles) {
    return normalizedTokens;
  }

  const filteredTokens = normalizedTokens.filter((token) => !VISITOR_NAME_PARTICLES.has(token));
  return filteredTokens.length > 0 ? filteredTokens : normalizedTokens;
}

function getLevenshteinDistance(left: string, right: string) {
  if (left === right) {
    return 0;
  }

  if (!left.length) {
    return right.length;
  }

  if (!right.length) {
    return left.length;
  }

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = new Array(right.length + 1).fill(0);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + substitutionCost
      );
    }

    for (let index = 0; index < previous.length; index += 1) {
      previous[index] = current[index];
    }
  }

  return previous[right.length];
}

function getVisitorTokenDuplicateScore(leftTokens: string[], rightTokens: string[]) {
  if (leftTokens.length < 2 || leftTokens.length !== rightTokens.length) {
    return 0;
  }

  let totalDistance = 0;
  let exactMatches = 0;
  let maxDistance = 0;

  for (let index = 0; index < leftTokens.length; index += 1) {
    const distance = getLevenshteinDistance(leftTokens[index] ?? "", rightTokens[index] ?? "");

    if (distance === 0) {
      exactMatches += 1;
      continue;
    }

    if (distance > 2) {
      return 0;
    }

    totalDistance += distance;
    maxDistance = Math.max(maxDistance, distance);
  }

  if (totalDistance === 0) {
    return 240;
  }

  if (totalDistance > 2 || maxDistance > 2 || exactMatches < leftTokens.length - 2) {
    return 0;
  }

  return 140 + exactMatches * 10 - totalDistance;
}

function getVisitorDuplicateScore(leftName: string, rightName: string) {
  const normalizedLeft = normalizeVisitorComparisonName(leftName);
  const normalizedRight = normalizeVisitorComparisonName(rightName);

  if (!normalizedLeft || !normalizedRight) {
    return 0;
  }

  if (normalizedLeft === normalizedRight) {
    return 300;
  }

  const rawScore = getVisitorTokenDuplicateScore(
    getVisitorComparisonTokens(normalizedLeft),
    getVisitorComparisonTokens(normalizedRight)
  );

  const filteredLeft = getVisitorComparisonTokens(normalizedLeft, true);
  const filteredRight = getVisitorComparisonTokens(normalizedRight, true);
  const filteredExact = filteredLeft.join(" ") === filteredRight.join(" ");

  if (filteredExact) {
    return 260;
  }

  const filteredScore = getVisitorTokenDuplicateScore(filteredLeft, filteredRight);
  return Math.max(rawScore, filteredScore > 0 ? filteredScore - 5 : 0);
}

async function findLikelyDuplicateVisitor(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  options: {
    nombreCompleto: string;
    excludeVisitorId?: string;
  }
) {
  const { data: visitors, error } = await supabase
    .from("visitas")
    .select("id, \"nombreCompleto\", created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return {
      duplicateVisitor: null as { id: string; nombreCompleto: string; created_at?: string | null } | null,
      error: error.message || "No se pudo validar la visita."
    };
  }

  const duplicateVisitor = (visitors ?? [])
    .filter((visitor) => visitor.id !== options.excludeVisitorId)
    .map((visitor) => ({
      visitor,
      score: getVisitorDuplicateScore(options.nombreCompleto, visitor.nombreCompleto)
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return (right.visitor.created_at ?? "").localeCompare(left.visitor.created_at ?? "");
    })[0]?.visitor ?? null;

  return {
    duplicateVisitor,
    error: null as string | null
  };
}

async function reserveGlobalPassNumbers(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  count: number
) {
  if (count <= 0) {
    return [];
  }

  const { data, error } = await supabase.rpc("reserve_global_pass_numbers", {
    p_count: count
  });

  if (error) {
    throw new Error(error.message || "No se pudo reservar la numeracion global de pases.");
  }

  return ((data ?? []) as Array<{ sequence_order: number; numero_pase: number }>)
    .sort((left, right) => left.sequence_order - right.sequence_order)
    .map((item) => item.numero_pase);
}

async function normalizeDateStatuses(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  presetDates?: Awaited<ReturnType<typeof getFechas>>
) {
  const dates = presetDates ?? (await getFechas());
  const tomorrowValue = getDateOffset(1);
  const futureOpenDates = [...dates]
    .filter((item) => !item.cierre && item.fechaCompleta >= tomorrowValue)
    .sort((left, right) => left.fechaCompleta.localeCompare(right.fechaCompleta));

  for (const date of dates) {
    let nextStatus = date.estado;

    if (date.cierre) {
      nextStatus = "cerrado";
    } else {
      const futureIndex = futureOpenDates.findIndex((item) => item.id === date.id);
      if (futureIndex === 0) {
        nextStatus = "abierto";
      } else if (futureIndex > 0) {
        nextStatus = "proximo";
      }
    }

    if (nextStatus !== date.estado) {
      const { error } = await supabase
        .from("fechas")
        .update({ estado: nextStatus })
        .eq("id", date.id);

      if (error) {
        throw new Error(error.message || "No se pudo normalizar el estatus de las fechas.");
      }
    }
  }
}

function splitVisitorLegacyName(nombreCompleto: string) {
  const tokens = normalizeFullName(nombreCompleto).split(" ").filter(Boolean);
  if (tokens.length === 0) {
    return {
      nombres: "Sin nombre",
      apellidoPat: "SN",
      apellidoMat: ""
    };
  }

  if (tokens.length === 1) {
    return {
      nombres: tokens[0],
      apellidoPat: "SN",
      apellidoMat: ""
    };
  }

  return {
    nombres: tokens.slice(0, -2).join(" ") || tokens[0],
    apellidoPat: tokens.length >= 2 ? tokens[tokens.length - 2] : "SN",
    apellidoMat: tokens.length >= 3 ? tokens[tokens.length - 1] : ""
  };
}

async function syncVisitorAvailabilityState(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  profileId: string,
  visitor: {
    id: string;
    nombreCompleto: string;
    fechaNacimiento?: string | null;
    betada: boolean;
    fechaBetada?: string | null;
    notas?: string | null;
  }
) {
  const fechaBetada = visitor.betada ? visitor.fechaBetada ?? new Date().toISOString().slice(0, 10) : null;

  const { error: visitorUpdateError } = await supabase
    .from("visitas")
    .update({
      betada: visitor.betada,
      fecha_betada: fechaBetada,
      notas: visitor.notas ?? null
    })
    .eq("id", visitor.id);

  if (visitorUpdateError) {
    return visitorUpdateError.message || "No se pudo actualizar la disponibilidad de la visita.";
  }

  const { data: existingBetada, error: existingBetadaError } = await supabase
    .from("betadas")
    .select("id")
    .eq("visita_id", visitor.id)
    .maybeSingle();

  if (existingBetadaError) {
    return existingBetadaError.message || "No se pudo revisar el historico de la visita.";
  }

  if (!visitor.betada) {
    if (existingBetada?.id) {
      const { error } = await supabase
        .from("betadas")
        .update({
          activo: false,
          fecha_betada: null,
          motivo: visitor.notas?.trim() || "Disponible",
          imposed_by: profileId
        })
        .eq("id", existingBetada.id);

      if (error) {
        return error.message || "No se pudo actualizar el historico de betado.";
      }
    }

    return null;
  }

  const legacyName = splitVisitorLegacyName(visitor.nombreCompleto);
  const payload = {
    visita_id: visitor.id,
    nombres: legacyName.nombres,
    apellido_pat: legacyName.apellidoPat,
    apellido_mat: legacyName.apellidoMat || null,
    fecha_nacimiento: visitor.fechaNacimiento ?? null,
    motivo: visitor.notas?.trim() || "No disponible",
    activo: true,
    imposed_by: profileId,
    fecha_betada: fechaBetada
  };

  if (existingBetada?.id) {
    const { error } = await supabase
      .from("betadas")
      .update(payload)
      .eq("id", existingBetada.id);

    if (error) {
      return error.message || "No se pudo actualizar el historico de betado.";
    }

    return null;
  }

  const { error } = await supabase.from("betadas").insert(payload);
  if (error) {
    return error.message || "No se pudo registrar el historico de betado.";
  }

  return null;
}

function resolveVisitorBirthDate(formData: FormData) {
  const inputMode = String(formData.get("birth_input_mode") ?? "fecha").trim().toLowerCase();
  const rawBirthDate = String(formData.get("fecha_nacimiento") ?? "").trim();
  const rawAge = String(formData.get("edad") ?? "").trim();

  if (inputMode === "edad") {
    const age = Number(rawAge);
    if (!Number.isFinite(age) || age < 0 || age > 120) {
      return { birthDate: "", error: "Debes capturar una edad valida." };
    }

    return { birthDate: buildBirthDateFromAge(age), error: null };
  }

  if (!rawBirthDate) {
    return { birthDate: "", error: "Debes capturar la fecha de nacimiento." };
  }

  return { birthDate: rawBirthDate, error: null };
}

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function resolveZoneId(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  rawZoneValue: FormDataEntryValue | null
) {
  const normalized = String(rawZoneValue ?? "").trim();
  if (!normalized) {
    return { zoneId: null as string | null, error: null as string | null };
  }

  if (looksLikeUuid(normalized)) {
    const { data, error } = await supabase
      .from("zones")
      .select("id")
      .eq("id", normalized)
      .maybeSingle();

    if (error) {
      return { zoneId: null, error: error.message || "No se pudo validar la zona." };
    }

    if (data?.id) {
      return { zoneId: data.id, error: null };
    }
  }

  const { data, error } = await supabase
    .from("zones")
    .select("id")
    .eq("name", normalized.toUpperCase())
    .maybeSingle();

  if (error) {
    return { zoneId: null, error: error.message || "No se pudo validar la zona." };
  }

  if (!data?.id) {
    const zoneName = normalized.replace(/^legacy:/i, "").trim().toUpperCase();
    const { data: insertedZone, error: insertError } = await supabase
      .from("zones")
      .insert({
        name: zoneName,
        active: true
      })
      .select("id")
      .single();

    if (insertError || !insertedZone?.id) {
      return { zoneId: null, error: insertError?.message || "La zona seleccionada ya no existe o no es valida." };
    }

    return { zoneId: insertedZone.id, error: null };
  }

  return { zoneId: data.id, error: null };
}

async function buildExistingVisitorAssignmentMessage(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  nombreCompleto: string
) {
  const { data: duplicateVisitors } = await supabase
    .from("visitas")
    .select("id, \"nombreCompleto\"")
    .ilike("nombreCompleto", nombreCompleto)
    .order("created_at", { ascending: false });

  const existingVisitor = duplicateVisitors?.[0] ?? null;
  if (!existingVisitor) {
    return "La visita ya existe y ya fue registrada previamente.";
  }

  const { data: existingRelation } = await supabase
    .from("interno_visitas")
    .select("interno_id")
    .eq("visita_id", existingVisitor.id)
    .maybeSingle();

  if (!existingRelation?.interno_id) {
    return "La visita ya existe y ya fue registrada previamente.";
  }

  const { data: internal } = await supabase
    .from("internos")
    .select("nombres, apellido_pat, apellido_mat, ubicacion")
    .eq("id", existingRelation.interno_id)
    .maybeSingle();

  if (!internal) {
    return "La visita ya existe y ya fue registrada previamente.";
  }

  return `La visita ya esta asignada a ${internal.nombres} ${internal.apellido_pat} ${internal.apellido_mat ?? ""} - ubicacion ${internal.ubicacion}.`
    .replace(/\s+/g, " ")
    .trim();
}

async function buildExistingVisitorAssignmentMessageByVisitorId(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  visitorId: string,
  fallbackName?: string
) {
  const { data: visitor } = await supabase
    .from("visitas")
    .select("id, \"nombreCompleto\"")
    .eq("id", visitorId)
    .maybeSingle();

  const visitorName = visitor?.nombreCompleto ?? fallbackName ?? "La visita";
  const assignmentMessage = await buildExistingVisitorAssignmentMessage(supabase, visitorName);

  if (assignmentMessage.startsWith("La visita ")) {
    const detail = assignmentMessage.replace(/^La visita /, "");
    return `Ya existe una visita muy parecida: ${visitorName}. ${detail.charAt(0).toUpperCase()}${detail.slice(1)}`;
  }

  return `Ya existe una visita muy parecida: ${visitorName}. ${assignmentMessage}`;
}

function buildDisplayFullName(...parts: Array<string | null | undefined>) {
  return parts
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

async function getPassArticlePayload(formData: FormData) {
  const articlePairs = [...formData.entries()]
    .filter(([key]) => key.startsWith("article_qty_"))
    .map(([key, value]) => ({
      deviceTypeId: key.replace("article_qty_", ""),
      quantity: Number(value ?? 0)
    }))
    .filter((item) => Number.isFinite(item.quantity) && item.quantity > 0);

  return articlePairs;
}

type PassDevicePayloadItem = {
  deviceTypeId: string;
  quantity: number;
};

function mergePassDevicePayload(items: PassDevicePayloadItem[]) {
  const merged = new Map<string, number>();

  for (const item of items) {
    const deviceTypeId = String(item.deviceTypeId ?? "").trim();
    const quantity = Math.max(0, Number(item.quantity ?? 0));
    if (!deviceTypeId || !Number.isFinite(quantity) || quantity < 1) {
      continue;
    }

    merged.set(deviceTypeId, (merged.get(deviceTypeId) ?? 0) + quantity);
  }

  return [...merged.entries()].map(([deviceTypeId, quantity]) => ({
    deviceTypeId,
    quantity
  }));
}

function explodePassDevicePayload(items: PassDevicePayloadItem[]) {
  return items.flatMap((item) =>
    Array.from({ length: Math.max(1, Number(item.quantity ?? 1)) }, () => ({
      deviceTypeId: item.deviceTypeId,
      quantity: 1
    }))
  );
}

function appendDeviceSummaryToSpecials(
  specialsText: string,
  deviceSummary: string | null
) {
  const normalizedText = specialsText.trim();
  const normalizedSummary = deviceSummary?.trim() ?? "";

  if (!normalizedSummary) {
    return normalizedText || null;
  }

  if (!normalizedText) {
    return normalizedSummary;
  }

  return `${normalizedText}\n${normalizedSummary}`;
}

async function requireProfile() {
  const profile = await getCurrentUserProfile();
  if (!profile?.active) {
    throw new Error("Tu sesion no tiene un perfil activo.");
  }

  return profile;
}

async function auditAction(params: {
  userId: string;
  moduleKey: string;
  sectionKey: string;
  actionKey: string;
  entityType: string;
  entityId?: string | null;
  beforeData?: unknown;
  afterData?: unknown;
}) {
  await logAuditEvent(params);
}

export async function createDateAction(
  _prevState: MutationState,
  formData: FormData
): Promise<MutationState> {
  try {
    const profile = await requireProfile();
    if (profile.roleKey !== "super-admin") {
      return failure("Tu rol no puede registrar fechas.");
    }

    const supabase = await createServerSupabaseClient();
    const dateValue = String(formData.get("fecha_completa") ?? "").trim();
    const parsedDate = parseDateParts(dateValue);

    if (!parsedDate) {
      return failure("La fecha no es valida.");
    }

    const existing = await getDateByValue(dateValue);
    if (existing) {
      return failure("Esa fecha ya esta registrada.");
    }

    const dates = await getFechas();
    const tomorrowValue = getDateOffset(1);
    if (dateValue < tomorrowValue) {
      return failure("Solo puedes registrar fechas a partir de manana.");
    }

    const futureOpenDates = [...dates]
      .filter((item) => !item.cierre && item.fechaCompleta >= tomorrowValue)
      .sort((left, right) => left.fechaCompleta.localeCompare(right.fechaCompleta));
    const earliestFutureDate = futureOpenDates[0]?.fechaCompleta ?? null;
    const nextStatus = !earliestFutureDate || dateValue < earliestFutureDate ? "abierto" : "proximo";

    const { error } = await supabase.from("fechas").insert({
      dia: parsedDate.day,
      mes: parsedDate.month,
      anio: parsedDate.year,
      fecha_completa: dateValue,
      cierre: false,
      estado: nextStatus,
      created_by: profile.id
    });

    if (error) {
      return failure(error.message || "No se pudo registrar la fecha.");
    }

    await normalizeDateStatuses(supabase);

    await auditAction({
      userId: profile.id,
      moduleKey: "fechas",
      sectionKey: "crear-fecha",
      actionKey: "create",
      entityType: "fecha",
      entityId: dateValue,
      afterData: { fechaCompleta: dateValue, estado: nextStatus }
    });

    revalidatePath("/sistema/fechas");
    revalidatePath("/sistema/listado");
    return success("Fecha registrada.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "No se pudo registrar la fecha.");
  }
}

async function createDateActionLegacy(
  _prevState: MutationState,
  formData: FormData
): Promise<MutationState> {
  try {
    const profile = await requireProfile();
    if (profile.roleKey !== "super-admin") {
      return failure("Tu rol no puede registrar fechas.");
    }
    const supabase = await createServerSupabaseClient();

    const dateValue = String(formData.get("fecha_completa") ?? "").trim();
    const parsedDate = parseDateParts(dateValue);

    if (!parsedDate) {
      return failure("La fecha no es valida.");
    }

    const existing = await getDateByValue(dateValue);
    if (existing) {
      return failure("Esa fecha ya esta registrada.");
    }

    const dates = await getFechas();
    const tomorrowValue = getDateOffset(1);

    if (dateValue < tomorrowValue) {
      return failure("Solo puedes registrar fechas a partir de manana.");
    }

    const futureOpenDates = [...dates]
      .filter((item) => !item.cierre && item.fechaCompleta >= tomorrowValue)
      .sort((left, right) => left.fechaCompleta.localeCompare(right.fechaCompleta));
    const earliestFutureDate = futureOpenDates[0]?.fechaCompleta ?? null;
    const nextStatus = !earliestFutureDate || dateValue < earliestFutureDate ? "abierto" : "proximo";

    const { error: createDateError } = await supabase.from("fechas").insert({
      dia: parsedDate!.day,
      mes: parsedDate!.month,
      anio: parsedDate!.year,
      fecha_completa: dateValue,
      cierre: false,
      estado: nextStatus,
      created_by: profile.id
    });

    if (createDateError) {
      return failure(createDateError.message || "No se pudo registrar la fecha.");
    }

    await normalizeDateStatuses(supabase);

    await auditAction({
      userId: profile.id,
      moduleKey: "fechas",
      sectionKey: "crear-fecha",
      actionKey: "create",
      entityType: "fecha",
      entityId: dateValue,
      afterData: { fechaCompleta: dateValue, estado: nextStatus }
    });

    revalidatePath("/sistema/fechas");
    revalidatePath("/sistema/listado");
    return success("Fecha registrada.");
    const allowedOpenDate = getDateOffset(1);
    const allowedNextDate = getDateOffset(2);
    const status =
      dateValue === allowedOpenDate
        ? "abierto"
        : dateValue === allowedNextDate
          ? "proximo"
          : "";
    const activeOpenDate = dates.find(
      (item) => item.estado === "abierto" && !item.cierre && item.fechaCompleta === allowedOpenDate
    );
    const waitingDate = dates.find(
      (item) => item.estado === "proximo" && !item.cierre && item.fechaCompleta === allowedNextDate
    );

    if (!status) {
      return failure("Solo puedes registrar fechas para MAÑANA o EN ESPERA.");
    }

    if (status === "abierto" && dateValue !== allowedOpenDate) {
      return failure("La fecha abierta solo puede ser para manana.");
    }

    if (status === "proximo" && dateValue !== allowedNextDate) {
      return failure("La fecha proximo solo puede ser para pasado manana.");
    }

    if (status === "abierto" && activeOpenDate) {
      return failure("Ya existe una fecha activa para MAÑANA.");
    }

    if (status === "proximo" && waitingDate) {
      return failure("Ya existe una fecha activa para EN ESPERA.");
    }

    const { error } = await supabase.from("fechas").insert({
      dia: parsedDate!.day,
      mes: parsedDate!.month,
      anio: parsedDate!.year,
      fecha_completa: dateValue,
      cierre: false,
      estado: status,
      created_by: profile.id
    });

    if (error) {
      return failure(error?.message || "No se pudo registrar la fecha.");
    }

    await auditAction({
      userId: profile.id,
      moduleKey: "fechas",
      sectionKey: "crear-fecha",
      actionKey: "create",
      entityType: "fecha",
      entityId: dateValue,
      afterData: { fechaCompleta: dateValue, estado: status }
    });

    revalidatePath("/sistema/fechas");
    revalidatePath("/sistema/listado");
    return success("Fecha registrada.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "No se pudo registrar la fecha.");
  }
}

export async function closeDateAction(
  _prevState: MutationState,
  formData: FormData
): Promise<MutationState> {
  try {
    const profile = await requireProfile();
    if (profile.roleKey !== "super-admin") {
      return failure("Tu rol no puede cerrar la fecha.");
    }

    const openDate = await getOpenDate();
    const dateValue = String(formData.get("fecha_completa") ?? "").trim() || openDate?.fechaCompleta || "";
    if (!dateValue) {
      return failure("No se encontro la fecha a cerrar.");
    }

    const supabase = await createServerSupabaseClient();
    const closePassword = String(formData.get("close_password") ?? "").trim();
    const { data: setting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "close_password")
      .maybeSingle();

    if (!setting?.value) {
      return failure("No hay contrasena de cierre configurada.");
    }

    if (setting.value !== closePassword) {
      return failure("Contrasena incorrecta.");
    }

    const selectedDate = await getDateByValue(dateValue);
    if (!selectedDate) {
      return failure("La fecha ya no existe.");
    }

    if (selectedDate.cierre) {
      return failure("Esa fecha ya esta cerrada.");
    }

    const passes = await getListado({ fechaVisita: dateValue });
    const activePasses = passes
      .filter((item) => item.status !== "cancelado")
      .sort((a, b) => compareInternalLocations(a.internoUbicacion, b.internoUbicacion) || a.createdAt.localeCompare(b.createdAt));

    const numberedPasses = activePasses
      .filter((item) => item.numeroPase)
      .sort((a, b) => (a.numeroPase ?? 0) - (b.numeroPase ?? 0));
    const pendingPasses = activePasses.filter((item) => !item.numeroPase);

    const orderedPendingPasses =
      numberedPasses.length > 0
        ? pendingPasses.sort(
            (a, b) => compareInternalLocations(a.internoUbicacion, b.internoUbicacion) || a.createdAt.localeCompare(b.createdAt)
          )
        : pendingPasses.sort(
            (a, b) => compareInternalLocations(a.internoUbicacion, b.internoUbicacion) || a.createdAt.localeCompare(b.createdAt)
          );

    const isInitialClosure = numberedPasses.length === 0;
    const reservedNumbers = await reserveGlobalPassNumbers(supabase, orderedPendingPasses.length);

    for (const [index, pass] of orderedPendingPasses.entries()) {
      const currentNumber = reservedNumbers[index];
      if (!currentNumber) {
        return failure("No se pudo obtener la numeracion global para los pases.");
      }

      const { error } = await supabase
        .from("listado")
        .update({
          numero_pase: currentNumber,
          cierre_aplicado: isInitialClosure
        })
        .eq("id", pass.id);

      if (error) {
        return failure(error.message || "No se pudo numerar el cierre.");
      }
    }

    const { error: closeError } = await supabase
      .from("fechas")
      .update({
        cierre: true,
        estado: "cerrado"
      })
      .eq("id", selectedDate.id);

    if (closeError) {
      return failure(closeError.message || "No se pudo cerrar la fecha.");
    }

    await normalizeDateStatuses(supabase);

    await auditAction({
      userId: profile.id,
      moduleKey: "fechas",
      sectionKey: "cerrar-fecha",
      actionKey: "close",
      entityType: "fecha",
      entityId: selectedDate.id,
      beforeData: { fechaCompleta: selectedDate.fechaCompleta, cierre: selectedDate.cierre },
      afterData: { fechaCompleta: selectedDate.fechaCompleta, cierre: true, pasesNumerados: orderedPendingPasses.length }
    });

    revalidatePath("/sistema/fechas");
    revalidatePath("/sistema/listado");
    revalidatePath("/sistema/internos");
    return success("Fecha cerrada.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "No se pudo cerrar la fecha.");
  }
}
export async function createInternalAction(
  _prevState: MutationState,
  formData: FormData
): Promise<MutationState> {
  try {
    const profile = await requireProfile();
    if (!["super-admin", "control", "supervisor", "capturador"].includes(profile.roleKey)) {
      return failure("Tu rol no puede guardar internos.");
    }
    const supabase = await createServerSupabaseClient();

    const age = Number(formData.get("edad") ?? 0);
    const payload = {
      expediente: String(formData.get("expediente") ?? "").trim() || buildInternalExpediente(),
      nombres: capitalizeWords(String(formData.get("nombres") ?? "")),
      apellido_pat: capitalizeWords(String(formData.get("apellido_pat") ?? "")),
      apellido_mat: capitalizeWords(String(formData.get("apellido_mat") ?? "")) || null,
      nacimiento: String(formData.get("nacimiento") ?? "").trim() || buildBirthDateFromAge(age),
      llego: String(formData.get("llego") ?? "").trim() || new Date().toISOString().slice(0, 10),
      libre: String(formData.get("libre") ?? "").trim() || null,
      ubicacion: String(formData.get("ubicacion") ?? "").trim(),
      telefono: null,
      ubi_filiacion: capitalizeWords(String(formData.get("ubi_filiacion") ?? "")) || "Sin Dato",
      laborando: false,
      observaciones: String(formData.get("observaciones") ?? "").trim() || null,
      created_by: profile.id
    };

      if (
        !payload.nombres ||
        !payload.apellido_pat ||
        !payload.nacimiento ||
        !payload.ubicacion
    ) {
      return failure("Completa los datos obligatorios.");
    }

    if (!Number.isFinite(age) || age <= 0) {
      return failure("La edad del interno debe ser mayor a cero.");
    }

      if (!isValidInternalLocation(payload.ubicacion)) {
        return failure("La ubicacion debe tener formato numero-numero o letra-numero, por ejemplo 1-101, 15-8 o I-00.");
      }

    const { error } = await supabase.from("internos").insert(payload);
    if (error) {
      return failure(error.message || "No se pudo guardar el interno.");
    }

    await auditAction({
      userId: profile.id,
      moduleKey: "internos",
      sectionKey: "alta",
      actionKey: "create",
      entityType: "interno",
      entityId: payload.expediente,
      afterData: payload
    });

    revalidatePath("/sistema/internos");
    return success("Interno guardado.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "No se pudo guardar el interno.");
  }
}

export async function updateInternalStatusAction(
  _prevState: MutationState,
  formData: FormData
): Promise<MutationState> {
  try {
    const profile = await requireProfile();
    if (profile.roleKey !== "super-admin") {
      return failure("Solo super-admin puede cambiar el estatus del interno.");
    }

    const supabase = await createServerSupabaseClient();
    const internalId = String(formData.get("interno_id") ?? "").trim();
    const estatus = String(formData.get("estatus") ?? "").trim();

    if (!internalId || !estatus) {
      return failure("Debes elegir el interno y el nuevo estatus.");
    }

    const { data: previousInternal } = await supabase
      .from("internos")
      .select("id, estatus, laborando")
      .eq("id", internalId)
      .maybeSingle();

    const { error } = await supabase.from("internos").update({ estatus }).eq("id", internalId);
    if (error) {
      return failure(error.message || "No se pudo actualizar el estatus.");
    }

    await auditAction({
      userId: profile.id,
      moduleKey: "internos",
      sectionKey: "estatus",
      actionKey: "update",
      entityType: "interno",
      entityId: internalId,
      beforeData: previousInternal,
      afterData: { estatus }
    });

    revalidatePath("/sistema/internos");
    return success("Estatus actualizado.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "No se pudo actualizar el estatus.");
  }
}

export async function updateInternalIdentityAction(
  _prevState: MutationState,
  formData: FormData
): Promise<MutationState> {
  try {
    const profile = await requireProfile();
    if (profile.roleKey !== "super-admin") {
      return failure("Solo super-admin puede modificar nombres o ubicacion.");
    }

    const supabase = await createServerSupabaseClient();
    const internalId = String(formData.get("interno_id") ?? "").trim();
    const nombres = capitalizeWords(String(formData.get("nombres") ?? ""));
    const apellidoPat = capitalizeWords(String(formData.get("apellido_pat") ?? ""));
    const apellidoMat = capitalizeWords(String(formData.get("apellido_mat") ?? ""));
    const ubicacion = String(formData.get("ubicacion") ?? "").trim();

    if (!internalId || !nombres || !apellidoPat || !ubicacion) {
      return failure("Completa interno, nombres, apellido paterno y ubicacion.");
    }

    if (!isValidInternalLocation(ubicacion)) {
      return failure("La ubicacion debe tener formato numero-numero o letra-numero.");
    }

    const { data: previousInternal, error: previousError } = await supabase
      .from("internos")
      .select("nombres, apellido_pat, apellido_mat, ubicacion")
      .eq("id", internalId)
      .maybeSingle();

    if (previousError || !previousInternal) {
      return failure("No se encontro el interno seleccionado.");
    }

    const { error } = await supabase
      .from("internos")
      .update({
        nombres,
        apellido_pat: apellidoPat,
        apellido_mat: apellidoMat || null,
        ubicacion
      })
      .eq("id", internalId);

    if (error) {
      return failure(error.message || "No se pudo actualizar el interno.");
    }

    await auditAction({
      userId: profile.id,
      moduleKey: "admin",
      sectionKey: "correcciones-internos",
      actionKey: "update",
      entityType: "interno",
      entityId: internalId,
      beforeData: {
        ...previousInternal,
        fullName: buildDisplayFullName(
          previousInternal.nombres,
          previousInternal.apellido_pat,
          previousInternal.apellido_mat
        )
      },
      afterData: {
        fullName: buildDisplayFullName(nombres, apellidoPat, apellidoMat || null),
        nombres,
        apellido_pat: apellidoPat,
        apellido_mat: apellidoMat || null,
        ubicacion
      }
    });

    revalidatePath("/sistema/internos");
    revalidatePath("/sistema/visitas");
    revalidatePath("/sistema/listado");
    revalidatePath("/sistema/admin");
    return success("Interno actualizado.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "No se pudo actualizar el interno.");
  }
}

export async function updateVisitorIdentityAction(
  _prevState: MutationState,
  formData: FormData
): Promise<MutationState> {
  try {
    const profile = await requireProfile();
    if (profile.roleKey !== "super-admin") {
      return failure("Solo super-admin puede modificar nombres de visitas.");
    }

    const supabase = await createServerSupabaseClient();
    const visitorId = String(formData.get("visita_id") ?? "").trim();
    const nombreCompleto = capitalizeWords(String(formData.get("nombreCompleto") ?? ""));
    const edad = Number(formData.get("edad") ?? 0);

    if (!visitorId || !nombreCompleto) {
      return failure("Debes elegir la visita y capturar el nombre completo.");
    }

    if (!Number.isInteger(edad) || edad < 0 || edad > 120) {
      return failure("Debes capturar una edad valida.");
    }

    const { data: previousVisitor, error: previousError } = await supabase
      .from("visitas")
      .select("nombreCompleto, edad, fecha_nacimiento, menor")
      .eq("id", visitorId)
      .maybeSingle();

    if (previousError || !previousVisitor) {
      return failure("No se encontro la visita seleccionada.");
    }

    const { data: currentRelation } = await supabase
      .from("interno_visitas")
      .select("parentesco")
      .eq("visita_id", visitorId)
      .maybeSingle();

    const { duplicateVisitor, error: duplicateError } = await findLikelyDuplicateVisitor(supabase, {
      nombreCompleto,
      excludeVisitorId: visitorId
    });

    if (duplicateError) {
      return failure(duplicateError);
    }

    if (duplicateVisitor) {
      return failure(
        await buildExistingVisitorAssignmentMessageByVisitorId(supabase, duplicateVisitor.id, duplicateVisitor.nombreCompleto)
      );
    }

    const fechaNacimiento = buildBirthDateFromAge(edad);
    const menor = edad < 18;

    const { error } = await supabase
      .from("visitas")
      .update({
        nombreCompleto,
        edad,
        menor,
        fecha_nacimiento: fechaNacimiento
      })
      .eq("id", visitorId);

    if (error?.code === "23505") {
      return failure(await buildExistingVisitorAssignmentMessage(supabase, nombreCompleto));
    }

    if (error) {
      return failure(error.message || "No se pudo actualizar la visita.");
    }

    await auditAction({
      userId: profile.id,
      moduleKey: "admin",
      sectionKey: "correcciones-visitas",
      actionKey: "update",
      entityType: "visita",
      entityId: visitorId,
      beforeData: {
        ...previousVisitor,
        parentesco: currentRelation?.parentesco ?? null
      },
      afterData: {
        nombreCompleto,
        edad,
        menor,
        fecha_nacimiento: fechaNacimiento,
        parentesco: currentRelation?.parentesco ?? null
      }
    });

    revalidatePath("/sistema/internos");
    revalidatePath("/sistema/visitas");
    revalidatePath("/sistema/listado");
    revalidatePath("/sistema/admin");
    return success("Visita actualizada.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "No se pudo actualizar la visita.");
  }
}

export async function updateVisitorAvailabilityAction(
  _prevState: MutationState,
  formData: FormData
): Promise<MutationState> {
  try {
    const profile = await requireProfile();
    if (profile.roleKey !== "super-admin") {
      return failure("Solo super-admin puede modificar disponibilidad de visitas.");
    }

    const supabase = await createServerSupabaseClient();
    const visitorId = String(formData.get("visita_id") ?? "").trim();
    const betada = String(formData.get("betada") ?? "false") === "true";
    const fechaBetada = String(formData.get("fecha_betada") ?? "").trim() || null;
    const notas = String(formData.get("notas") ?? "").trim() || null;

    if (!visitorId) {
      return failure("Debes elegir la visita.");
    }

    if (betada && !fechaBetada) {
      return failure("Debes capturar la fecha en que se beto la visita.");
    }

    const { data: previousVisitor, error: previousError } = await supabase
      .from("visitas")
      .select("nombreCompleto, fecha_nacimiento, betada, fecha_betada, notas")
      .eq("id", visitorId)
      .maybeSingle();

    if (previousError || !previousVisitor) {
      return failure("No se encontro la visita seleccionada.");
    }

    const syncError = await syncVisitorAvailabilityState(supabase, profile.id, {
      id: visitorId,
      nombreCompleto: previousVisitor.nombreCompleto,
      fechaNacimiento: previousVisitor.fecha_nacimiento,
      betada,
      fechaBetada,
      notas
    });

    if (syncError) {
      return failure(syncError);
    }

    await auditAction({
      userId: profile.id,
      moduleKey: "admin",
      sectionKey: "correcciones-visitas",
      actionKey: "update",
      entityType: "visita",
      entityId: visitorId,
      beforeData: previousVisitor,
      afterData: {
        betada,
        fecha_betada: betada ? fechaBetada : null,
        notas
      }
    });

    revalidatePath("/sistema/internos");
    revalidatePath("/sistema/visitas");
    revalidatePath("/sistema/listado");
    revalidatePath("/sistema/admin");
    return success("Disponibilidad de visita actualizada.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "No se pudo actualizar la visita.");
  }
}

export async function createVisitorAction(
  _prevState: MutationState,
  formData: FormData
): Promise<MutationState> {
  try {
    const profile = await requireProfile();
    const supabase = await createServerSupabaseClient();
    const canUseFallbackParentesco = ["super-admin", "control"].includes(profile.roleKey);
    const resolvedBirthDate = resolveVisitorBirthDate(formData);
    if (resolvedBirthDate.error) {
      return failure(resolvedBirthDate.error);
    }

    const parentescoInput = String(formData.get("parentesco") ?? "").trim();

    const visitorPayload = {
      nombreCompleto: capitalizeWords(String(formData.get("nombreCompleto") ?? "")),
      fecha_nacimiento: resolvedBirthDate.birthDate,
      fecha_betada: canUseFallbackParentesco && String(formData.get("betada") ?? "false") === "true"
        ? new Date().toISOString().slice(0, 10)
        : null,
      sexo: String(formData.get("sexo") ?? "sin-definir").trim(),
      parentesco: normalizeParentesco(parentescoInput) || (canUseFallbackParentesco ? "SN" : ""),
      telefono: String(formData.get("telefono") ?? "").trim() || "No aplica",
      betada: canUseFallbackParentesco && String(formData.get("betada") ?? "false") === "true",
      notas: String(formData.get("notas") ?? "").trim() || null,
      created_by: profile.id
    };

    const internalId = String(formData.get("interno_id") ?? "").trim();

      if (!visitorPayload.nombreCompleto || !visitorPayload.fecha_nacimiento || !visitorPayload.parentesco) {
        return failure("Completa los datos obligatorios.");
      }

    if (!internalId) {
      return failure("Debes asignar la visita a un interno.");
    }

    const { duplicateVisitor: existingVisitor, error: existingVisitorError } = await findLikelyDuplicateVisitor(
      supabase,
      {
        nombreCompleto: visitorPayload.nombreCompleto
      }
    );

    if (existingVisitorError) {
      return failure(existingVisitorError);
    }

    if (existingVisitor) {
      return failure(
        await buildExistingVisitorAssignmentMessageByVisitorId(
          supabase,
          existingVisitor.id,
          existingVisitor.nombreCompleto
        )
      );
    }

    const { data: insertedVisitor, error: visitorError } = await supabase
      .from("visitas")
      .insert(visitorPayload)
      .select("id")
      .single();

    if (visitorError?.code === "23505") {
      return failure(
        await buildExistingVisitorAssignmentMessage(supabase, visitorPayload.nombreCompleto)
      );
    }

    if (visitorError || !insertedVisitor) {
      return failure(visitorError?.message || "No se pudo guardar la visita.");
    }

    const availabilityError = await syncVisitorAvailabilityState(supabase, profile.id, {
      id: insertedVisitor.id,
      nombreCompleto: visitorPayload.nombreCompleto,
      fechaNacimiento: visitorPayload.fecha_nacimiento,
      betada: visitorPayload.betada,
      fechaBetada: visitorPayload.fecha_betada,
      notas: visitorPayload.notas
    });

    if (availabilityError) {
      return failure(availabilityError);
    }

    if (internalId) {
      const { error: relationError } = await supabase.from("interno_visitas").insert({
        interno_id: internalId,
        visita_id: insertedVisitor.id,
        parentesco: visitorPayload.parentesco,
        titular: false,
        created_by: profile.id
      });

      if (relationError) {
        return failure(
          relationError.message || "La visita se guardo, pero no se pudo asignar al interno."
        );
      }
    }

    await auditAction({
      userId: profile.id,
      moduleKey: "visitas",
      sectionKey: "alta",
      actionKey: "create",
      entityType: "visita",
      entityId: insertedVisitor.id,
      afterData: {
        ...visitorPayload,
        internoId: internalId
      }
    });

    revalidatePath("/sistema/internos");
    revalidatePath("/sistema/visitas");
    return success("Visita guardada.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "No se pudo guardar la visita.");
  }
}

export async function reassignVisitorAction(
  _prevState: MutationState,
  formData: FormData
): Promise<MutationState> {
  try {
    const profile = await requireProfile();
    if (!["super-admin", "control"].includes(profile.roleKey)) {
      return failure("Tu rol no puede reasignar visitas.");
    }

    const supabase = await createServerSupabaseClient();
    const visitaId = String(formData.get("visita_id") ?? "").trim();
    const internoId = String(formData.get("interno_id") ?? "").trim();
    if (!visitaId || !internoId) {
      return failure("Debes elegir la visita y el interno destino.");
    }

    const { data: currentRelations, error: currentError } = await supabase
      .from("interno_visitas")
      .select("interno_id")
      .eq("visita_id", visitaId);

    if (currentError) {
      return failure(currentError.message || "No se pudo revisar la asignacion actual.");
    }

    const previousInternalIds = (currentRelations ?? [])
      .map((item) => item.interno_id)
      .filter((id) => id !== internoId);

    if ((currentRelations ?? []).some((item) => item.interno_id === internoId)) {
      return failure("La visita ya pertenece a ese interno.");
    }

    for (const previousInternalId of previousInternalIds) {
      const { error: historyError } = await supabase.from("visita_interno_historial").insert({
        visita_id: visitaId,
        interno_id: previousInternalId,
        accion: "reasignacion",
        created_by: profile.id
      });

      if (historyError) {
        return failure(historyError.message || "No se pudo guardar el historial de la visita.");
      }
    }

    const { error: deleteError } = await supabase
      .from("interno_visitas")
      .delete()
      .eq("visita_id", visitaId);

    if (deleteError) {
      return failure(deleteError.message || "No se pudo limpiar la asignacion anterior.");
    }

    const { error: insertError } = await supabase.from("interno_visitas").insert({
      interno_id: internoId,
      visita_id: visitaId,
      parentesco: null,
      titular: false,
      created_by: profile.id
    });

    if (insertError) {
      return failure(insertError.message || "No se pudo reasignar la visita.");
    }

    await auditAction({
      userId: profile.id,
      moduleKey: "visitas",
      sectionKey: "reasignacion",
      actionKey: "update",
      entityType: "visita",
      entityId: visitaId,
      beforeData: { previousInternalIds },
      afterData: { internoId }
    });

    revalidatePath("/sistema/internos");
    revalidatePath("/sistema/visitas");
    return success("Visita reasignada.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "No se pudo reasignar la visita.");
  }
}

export async function updateClosePasswordAction(
  _prevState: MutationState,
  formData: FormData
): Promise<MutationState> {
  try {
    const profile = await requireProfile();
    if (profile.roleKey !== "super-admin") {
      return failure("Solo super-admin puede cambiar la contraseña.");
    }

    const value = String(formData.get("close_password") ?? "").trim();
    if (!value) {
      return failure("Escribe una contraseña.");
    }

    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from("app_settings").upsert(
      {
        key: "close_password",
        value,
        updated_by: profile.id
      },
      { onConflict: "key" }
    );

    if (error) {
      return failure(error.message || "No se pudo guardar la contraseña.");
    }

    await auditAction({
      userId: profile.id,
      moduleKey: "admin",
      sectionKey: "contrasena-cierre",
      actionKey: "update",
      entityType: "app_setting",
      entityId: "close_password",
      afterData: { updated: true }
    });

    revalidatePath("/sistema/listado");
    return success("Contraseña guardada.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "No se pudo guardar la contraseña.");
  }
}

export async function updateAuthUserPasswordAction(
  _prevState: MutationState,
  formData: FormData
): Promise<MutationState> {
  try {
    const profile = await requireProfile();
    if (profile.roleKey !== "super-admin") {
      return failure("Solo super-admin puede cambiar contrasenas de usuarios.");
    }

    if (!isSupabaseAdminConfigured()) {
      return failure("Falta configurar SUPABASE_SERVICE_ROLE_KEY en el entorno.");
    }

    const userId = String(formData.get("user_id") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!userId || !password.trim()) {
      return failure("Debes elegir el usuario y escribir la nueva contrasena.");
    }

    const admin = createSupabaseAdminClient();
    const { error } = await admin.auth.admin.updateUserById(userId, { password });

    if (error) {
      return failure(error.message || "No se pudo actualizar la contrasena.");
    }

    await auditAction({
      userId: profile.id,
      moduleKey: "admin",
      sectionKey: "usuarios",
      actionKey: "update-password",
      entityType: "auth_user",
      entityId: userId,
      afterData: { updated: true }
    });

    revalidatePath("/sistema/admin");
    return success("Contrasena actualizada.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "No se pudo actualizar la contrasena.");
  }
}

export async function forceCloseUserSessionsAction(
  _prevState: MutationState,
  formData: FormData
): Promise<MutationState> {
  try {
    const profile = await requireProfile();
    if (profile.roleKey !== "super-admin") {
      return failure("Solo super-admin puede forzar cierre de sesiones.");
    }

    if (!isSupabaseAdminConfigured()) {
      return failure("Falta configurar SUPABASE_SERVICE_ROLE_KEY en el entorno.");
    }

    const userId = String(formData.get("user_id") ?? "").trim();
    if (!userId) {
      return failure("Debes elegir un usuario.");
    }

    const supabase = await createServerSupabaseClient();
    const { data: targetProfile } = await supabase
      .from("user_profiles")
      .select("id, role_id")
      .eq("id", userId)
      .maybeSingle();

    if (targetProfile?.role_id) {
      const { data: role } = await supabase
        .from("roles")
        .select("key")
        .eq("id", targetProfile.role_id)
        .maybeSingle();

      if (role?.key === "super-admin") {
        return failure("No puedes forzar cierre de sesiones para un super-admin.");
      }
    }

    const admin = createSupabaseAdminClient();
    const forcedPassword = buildForcedPassword();
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password: forcedPassword
    });

    if (error) {
      return failure(error.message || "No se pudo forzar el cierre de sesiones.");
    }

    await auditAction({
      userId: profile.id,
      moduleKey: "admin",
      sectionKey: "usuarios",
      actionKey: "force-close-sessions",
      entityType: "auth_user",
      entityId: userId,
      afterData: {
        forcedSessionReset: true
      }
    });

    revalidatePath("/sistema/admin");
    return success("Sesiones cerradas. Se asigno una contrasena aleatoria segura.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "No se pudo forzar el cierre de sesiones.");
  }
}

export async function saveRolePermissionGrantAction(
  _prevState: MutationState,
  formData: FormData
): Promise<MutationState> {
  try {
    const profile = await requireProfile();
    if (profile.roleKey !== "super-admin") {
      return failure("Solo super-admin puede administrar permisos.");
    }

    const supabase = await createServerSupabaseClient();
    const roleId = String(formData.get("role_id") ?? "").trim();
    const scopeKey = String(formData.get("scope_key") ?? "").trim();
    const accessLevel = String(formData.get("access_level") ?? "").trim();

    if (!roleId || !scopeKey) {
      return failure("Debes elegir el rol y el alcance.");
    }

    if (scopeKey.startsWith("danger-zone")) {
      return failure("Danger Zone queda reservado exclusivamente para super-admin.");
    }

    if (!["inherit", "none", "view", "manage"].includes(accessLevel)) {
      return failure("El nivel de acceso no es valido.");
    }

    if (accessLevel === "inherit") {
      const { error } = await supabase
        .from("role_permission_grants")
        .delete()
        .eq("role_id", roleId)
        .eq("scope_key", scopeKey);

      if (error) {
        return failure(error.message || "No se pudo limpiar el permiso del rol.");
      }
    } else {
      const { error } = await supabase.from("role_permission_grants").upsert(
        {
          role_id: roleId,
          scope_key: scopeKey,
          access_level: accessLevel,
          created_by: profile.id
        },
        { onConflict: "role_id,scope_key" }
      );

      if (error) {
        return failure(error.message || "No se pudo guardar el permiso del rol.");
      }
    }

    await auditAction({
      userId: profile.id,
      moduleKey: "admin",
      sectionKey: "permisos",
      actionKey: "save-role-permission",
      entityType: "role_permission",
      entityId: `${roleId}:${scopeKey}`,
      afterData: { roleId, scopeKey, accessLevel }
    });

    revalidatePath("/sistema/admin");
    return success("Permiso de rol guardado.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "No se pudo guardar el permiso del rol.");
  }
}

export async function saveUserPermissionGrantAction(
  _prevState: MutationState,
  formData: FormData
): Promise<MutationState> {
  try {
    const profile = await requireProfile();
    if (profile.roleKey !== "super-admin") {
      return failure("Solo super-admin puede administrar permisos.");
    }

    const supabase = await createServerSupabaseClient();
    const userId = String(formData.get("user_id") ?? "").trim();
    const scopeKey = String(formData.get("scope_key") ?? "").trim();
    const accessLevel = String(formData.get("access_level") ?? "").trim();

    if (!userId || !scopeKey) {
      return failure("Debes elegir el usuario y el alcance.");
    }

    if (scopeKey.startsWith("danger-zone")) {
      return failure("Danger Zone queda reservado exclusivamente para super-admin.");
    }

    if (!["inherit", "none", "view", "manage"].includes(accessLevel)) {
      return failure("El nivel de acceso no es valido.");
    }

    if (accessLevel === "inherit") {
      const { error } = await supabase
        .from("user_permission_grants")
        .delete()
        .eq("user_profile_id", userId)
        .eq("scope_key", scopeKey);

      if (error) {
        return failure(error.message || "No se pudo limpiar el permiso del usuario.");
      }
    } else {
      const { error } = await supabase.from("user_permission_grants").upsert(
        {
          user_profile_id: userId,
          scope_key: scopeKey,
          access_level: accessLevel,
          created_by: profile.id
        },
        { onConflict: "user_profile_id,scope_key" }
      );

      if (error) {
        return failure(error.message || "No se pudo guardar el permiso del usuario.");
      }
    }

    await auditAction({
      userId: profile.id,
      moduleKey: "admin",
      sectionKey: "permisos",
      actionKey: "save-user-permission",
      entityType: "user_permission",
      entityId: `${userId}:${scopeKey}`,
      afterData: { userId, scopeKey, accessLevel }
    });

    revalidatePath("/sistema/admin");
    return success("Permiso de usuario guardado.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "No se pudo guardar el permiso del usuario.");
  }
}

export async function linkVisitorAction(
  _prevState: MutationState,
  formData: FormData
): Promise<MutationState> {
  try {
    const profile = await requireProfile();
    const supabase = await createServerSupabaseClient();

    const internoId = String(formData.get("interno_id") ?? "").trim();
    const visitaId = String(formData.get("visita_id") ?? "").trim();
    const parentesco = String(formData.get("parentesco") ?? "").trim();
    const titular = String(formData.get("titular") ?? "") === "on";

    if (!internoId || !visitaId) {
      return failure("Debes elegir un interno y una visita.");
    }

    const { data: visitor, error: visitorError } = await supabase
      .from("visitas")
      .select("id, betada")
      .eq("id", visitaId)
      .maybeSingle();

    if (visitorError || !visitor) {
      return failure("La visita seleccionada no existe.");
    }

    if (visitor.betada) {
      return failure("No puedes vincular una visita betada.");
    }

    const { data: currentRelation, error: relationLookupError } = await supabase
      .from("interno_visitas")
      .select("interno_id, parentesco, titular")
      .eq("visita_id", visitaId)
      .maybeSingle();

    if (relationLookupError) {
      return failure(relationLookupError.message || "No se pudo revisar la asignacion actual.");
    }

    if (currentRelation?.interno_id && currentRelation.interno_id !== internoId) {
      return failure("La visita ya pertenece a otro interno.");
    }

    const { error } = await supabase.from("interno_visitas").upsert(
      {
        interno_id: internoId,
        visita_id: visitaId,
        parentesco: parentesco || null,
        titular,
        created_by: profile.id
      },
      { onConflict: "interno_id,visita_id" }
    );

    if (error) {
      return failure(error.message || "No se pudo vincular la visita.");
    }

    await auditAction({
      userId: profile.id,
      moduleKey: "visitas",
      sectionKey: "vincular-visita",
      actionKey: "update",
      entityType: "interno_visita",
      entityId: `${internoId}:${visitaId}`,
      beforeData: currentRelation
        ? {
            interno_id: currentRelation.interno_id,
            parentesco: currentRelation.parentesco ?? null,
            titular: Boolean(currentRelation.titular)
          }
        : null,
      afterData: {
        interno_id: internoId,
        parentesco: parentesco || null,
        titular
      }
    });

    revalidatePath("/sistema/internos");
    revalidatePath("/sistema/visitas");
    revalidatePath("/sistema/listado");
    revalidatePath("/sistema/admin");
    return success("Visita vinculada.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "No se pudo vincular la visita.");
  }
}

export async function createPassAction(
  _prevState: MutationState,
  formData: FormData
): Promise<MutationState> {
  try {
    const profile = await requireProfile();
    const supabase = await createServerSupabaseClient();
    const internoId = String(formData.get("interno_id") ?? "").trim();
    const visitorIds = [...new Set(formData.getAll("visitor_ids").map((item) => String(item).trim()).filter(Boolean))];
    const targetDateValue = String(formData.get("fecha_visita") ?? "").trim();
    const allowDuplicatePass = String(formData.get("allow_duplicate_pass") ?? "").trim() === "true";
    const mentions = capitalizeFirstLetterPerLine(String(formData.get("menciones") ?? ""));
    const specials = capitalizeFirstLetterPerLine(String(formData.get("especiales") ?? ""));
    const typedArticlePayload = await getPassArticlePayload(formData);
    const targetDate = await getDateByValue(targetDateValue);

    if (!internoId) {
      return failure("Debes seleccionar un interno.");
    }

    if (!targetDate) {
      return failure("No se encontro la fecha seleccionada para el pase.");
    }

    const canOperateClosedDate = profile.roleKey === "super-admin";

    const canCaptureOnSelectedDate =
      ["abierto", "proximo"].includes(targetDate.estado) || (targetDate.cierre && canOperateClosedDate);

    if (!canCaptureOnSelectedDate) {
      return failure("La fecha seleccionada no esta disponible para captura.");
    }

    if (targetDate.cierre && !canOperateClosedDate) {
      return failure("La fecha seleccionada ya fue cerrada.");
    }

    if (visitorIds.length === 0) {
      return failure("Debes elegir al menos una visita.");
    }

    if (mentions && !canManageMentions(profile.roleKey)) {
      return failure("Tu rol no puede capturar menciones.");
    }

    if (specials && !canManageMentions(profile.roleKey)) {
      return failure("Tu rol no puede capturar peticiones especiales.");
    }

      const { data: existingPass } = await supabase
        .from("listado")
        .select("id, status, created_at")
        .eq("interno_id", internoId)
        .eq("fecha_id", targetDate.id)
        .neq("status", "cancelado")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingPass) {
        if (profile.roleKey !== "super-admin") {
          return failure("Ese interno ya tiene pase para la fecha seleccionada.");
        }

        if (!allowDuplicatePass) {
          return failure("Ese interno ya tiene pase para la fecha seleccionada. Marca la autorizacion para generar otro pase.");
        }
      }

    const { data: relationRows, error: relationError } = await supabase
      .from("interno_visitas")
      .select("visita_id")
      .eq("interno_id", internoId)
      .in("visita_id", visitorIds);

    if (relationError) {
      return failure(relationError.message || "No se pudieron validar las visitas.");
    }

    const allowedIds = new Set((relationRows ?? []).map((item) => item.visita_id));
    const missingVisitorIds = visitorIds.filter((id) => !allowedIds.has(id));
    if (missingVisitorIds.length > 0) {
      const { data: missingVisitors } = await supabase
        .from("visitas")
        .select("\"nombreCompleto\"")
        .in("id", missingVisitorIds);

      const missingNames = (missingVisitors ?? [])
        .map((item) => item.nombreCompleto)
        .filter(Boolean);

      if (missingNames.length > 0) {
        return failure(`Estas visitas ya no pertenecen al interno: ${missingNames.join(", ")}.`);
      }

      return failure("Una o mas visitas ya no pertenecen al interno.");
    }

    const { data: selectedVisitors, error: visitorError } = await supabase
      .from("visitas")
      .select("id, edad, betada")
      .in("id", visitorIds);

    if (visitorError || !selectedVisitors) {
      return failure(visitorError?.message || "No se pudieron validar las visitas.");
    }

    if (selectedVisitors.some((item) => item.betada)) {
      return failure("No puedes generar un pase con visitas betadas.");
    }

    if (selectedVisitors.every((item) => (item.edad ?? 0) < 18)) {
      return failure("Debes incluir al menos un adulto en el pase.");
    }

    const articlePayload = mergePassDevicePayload(typedArticlePayload);

    let articleSummary: string | null = null;
    if (typedArticlePayload.length > 0) {
      const { data: articleTypes, error: articleTypeError } = await supabase
        .from("module_device_types")
        .select("id, name")
        .eq("active", true)
        .in(
          "id",
          typedArticlePayload.map((item) => item.deviceTypeId)
        );

      if (articleTypeError) {
        return failure(articleTypeError.message || "No se pudieron validar los articulos del pase.");
      }

      const articleNameMap = new Map((articleTypes ?? []).map((item) => [item.id, item.name]));
      articleSummary = typedArticlePayload
        .map((item) => {
          const name = articleNameMap.get(item.deviceTypeId);
          if (!name || item.quantity < 1) {
            return null;
          }

          return `${name} [${item.quantity}]`;
        })
        .filter((item): item is string => Boolean(item))
        .join(", ");
    }

    const orderedVisitors = [...selectedVisitors].sort((a, b) => (b.edad ?? 0) - (a.edad ?? 0));
    const specialText =
      canManageMentions(profile.roleKey)
        ? appendDeviceSummaryToSpecials(specials, articleSummary)
        : null;

      const { data: insertedPass, error: insertError } = await supabase.rpc("create_support_pass", {
        p_interno_id: internoId,
        p_fecha_id: targetDate.id,
        p_fecha_visita: targetDate.fechaCompleta,
        p_created_by: profile.id,
        p_duplicate_authorized_by: existingPass && profile.roleKey === "super-admin" && allowDuplicatePass ? profile.id : null,
        p_numero_pase: null,
        p_menciones: canManageMentions(profile.roleKey) && mentions ? mentions : null,
        p_especiales: specialText,
        p_visitor_ids: orderedVisitors.map((visitor) => visitor.id),
        p_device_items: articlePayload
      });

      if (insertError?.code === "23505") {
        return failure(
          profile.roleKey === "super-admin"
            ? "Ese interno ya tiene pase para la fecha seleccionada. Autoriza explicitamente el duplicado para crear otro."
            : "Ese interno ya tiene pase para la fecha seleccionada."
        );
      }

    if (insertError || !insertedPass) {
      return failure(insertError?.message || "No se pudo crear el pase.");
    }
    const passId = String(insertedPass);
    revalidatePath("/sistema/internos");
    revalidatePath("/sistema/listado");
    if (articlePayload.length > 0) {
      revalidatePath("/sistema/visual");
      revalidatePath("/sistema/comunicacion");
    }
    await auditAction({
      userId: profile.id,
      moduleKey: "listado",
      sectionKey: "crear-pase",
      actionKey: "create",
      entityType: "pase",
      entityId: passId,
        afterData: {
          internoId: internoId,
          fechaVisita: targetDate.fechaCompleta,
          duplicateAuthorized: Boolean(existingPass && allowDuplicatePass && profile.roleKey === "super-admin"),
          visitorIds,
          mentions,
          specials,
        articlePayload
      }
    });
    return success("Pase creado.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "No se pudo crear el pase.");
  }
}

export async function updatePassAction(
  _prevState: MutationState,
  formData: FormData
): Promise<MutationState> {
  try {
    const profile = await requireProfile();
    if (profile.roleKey !== "super-admin") {
      return failure("Solo super-admin puede editar pases.");
    }

    const supabase = await createServerSupabaseClient();
    const passId = String(formData.get("listado_id") ?? "").trim();
    const internoId = String(formData.get("interno_id") ?? "").trim();
    const visitorIds = [...new Set(formData.getAll("visitor_ids").map((item) => String(item).trim()).filter(Boolean))];
    const mentions = capitalizeFirstLetterPerLine(String(formData.get("menciones") ?? ""));
    const specials = capitalizeFirstLetterPerLine(String(formData.get("especiales") ?? ""));
    const typedArticlePayload = await getPassArticlePayload(formData);

    if (!passId || !internoId) {
      return failure("No se encontro el pase a editar.");
    }

    if (visitorIds.length === 0) {
      return failure("Debes elegir al menos una visita.");
    }

    const { data: passRow, error: passError } = await supabase
      .from("listado")
      .select("id, interno_id, fecha_id, fecha_visita, menciones, especiales")
      .eq("id", passId)
      .maybeSingle();

    if (passError || !passRow || passRow.interno_id !== internoId) {
      return failure("No se encontro el pase seleccionado.");
    }

    const { data: relationRows, error: relationError } = await supabase
      .from("interno_visitas")
      .select("visita_id")
      .eq("interno_id", internoId)
      .in("visita_id", visitorIds);

    if (relationError) {
      return failure(relationError.message || "No se pudieron validar las visitas.");
    }

    const allowedIds = new Set((relationRows ?? []).map((item) => item.visita_id));
    if (visitorIds.some((id) => !allowedIds.has(id))) {
      return failure("Una o mas visitas ya no pertenecen al interno.");
    }

    const { data: selectedVisitors, error: visitorError } = await supabase
      .from("visitas")
      .select("id, edad, betada")
      .in("id", visitorIds);

    if (visitorError || !selectedVisitors) {
      return failure(visitorError?.message || "No se pudieron validar las visitas.");
    }

    if (selectedVisitors.some((item) => item.betada)) {
      return failure("No puedes guardar un pase con visitas betadas.");
    }

    if (selectedVisitors.every((item) => (item.edad ?? 0) < 18)) {
      return failure("Debes incluir al menos un adulto en el pase.");
    }

    const articlePayload = mergePassDevicePayload(typedArticlePayload);

    let articleSummary: string | null = null;
    if (typedArticlePayload.length > 0) {
      const { data: articleTypes, error: articleTypeError } = await supabase
        .from("module_device_types")
        .select("id, name")
        .eq("active", true)
        .in(
          "id",
          typedArticlePayload.map((item) => item.deviceTypeId)
        );

      if (articleTypeError) {
        return failure(articleTypeError.message || "No se pudieron validar los articulos del pase.");
      }

      const articleNameMap = new Map((articleTypes ?? []).map((item) => [item.id, item.name]));
      articleSummary = typedArticlePayload
        .map((item) => {
          const name = articleNameMap.get(item.deviceTypeId);
          if (!name || item.quantity < 1) {
            return null;
          }

          return `${name} [${item.quantity}]`;
        })
        .filter((item): item is string => Boolean(item))
        .join(", ");
    }

    const specialText = appendDeviceSummaryToSpecials(specials, articleSummary);

    const { data: currentDeviceItemRows, error: currentDeviceItemsError } = await supabase
      .from("listing_device_items")
      .select("device_type_id, quantity")
      .eq("listado_id", passId);

    if (currentDeviceItemsError) {
      return failure(currentDeviceItemsError.message || "No se pudieron validar los articulos actuales.");
    }

    const { data: linkedDevices, error: linkedDevicesError } = await supabase
      .from("internal_devices")
      .select("id, device_type_id, quantity, status")
      .eq("source_listing_id", passId);

    if (linkedDevicesError) {
      return failure(linkedDevicesError.message || "No se pudieron validar los aparatos pendientes.");
    }

    const normalizeItems = (items: Array<{ device_type_id?: string; deviceTypeId?: string; quantity: number }>) =>
      mergePassDevicePayload(
        items.map((item) => ({
          deviceTypeId: String(item.deviceTypeId ?? item.device_type_id ?? ""),
          quantity: Math.max(1, Number(item.quantity ?? 1))
        }))
      ).sort((a, b) => a.deviceTypeId.localeCompare(b.deviceTypeId) || a.quantity - b.quantity);

    const currentNormalizedItems = JSON.stringify(normalizeItems(currentDeviceItemRows ?? []));
    const nextNormalizedItems = JSON.stringify(normalizeItems(articlePayload));
    const hasProcessedLinkedDevices = (linkedDevices ?? []).some((item) => item.status !== "pendiente");

    if (hasProcessedLinkedDevices && currentNormalizedItems !== nextNormalizedItems) {
      return failure("No puedes modificar los articulos de este pase porque ya generaron movimiento en otros bloques.");
    }

    const orderedVisitors = [...selectedVisitors].sort((a, b) => (b.edad ?? 0) - (a.edad ?? 0));

    const { error: updatePassError } = await supabase
      .from("listado")
      .update({
        menciones: mentions || null,
        especiales: specialText
      })
      .eq("id", passId);

    if (updatePassError) {
      return failure(updatePassError.message || "No se pudo actualizar el encabezado del pase.");
    }

    const { error: deleteVisitorsError } = await supabase
      .from("listado_visitas")
      .delete()
      .eq("listado_id", passId);

    if (deleteVisitorsError) {
      return failure(deleteVisitorsError.message || "No se pudieron actualizar las visitas del pase.");
    }

    const { error: insertVisitorsError } = await supabase.from("listado_visitas").insert(
      orderedVisitors.map((visitor, index) => ({
        listado_id: passId,
        visita_id: visitor.id,
        orden: index + 1,
        validada: false
      }))
    );

    if (insertVisitorsError) {
      return failure(insertVisitorsError.message || "No se pudieron guardar las visitas del pase.");
    }

    if (!hasProcessedLinkedDevices) {
      const { error: deleteItemsError } = await supabase
        .from("listing_device_items")
        .delete()
        .eq("listado_id", passId);

      if (deleteItemsError) {
        return failure(deleteItemsError.message || "No se pudieron actualizar los articulos del pase.");
      }

      if (articlePayload.length > 0) {
        const { error: insertItemsError } = await supabase.from("listing_device_items").insert(
          explodePassDevicePayload(articlePayload).map((item) => ({
            listado_id: passId,
            device_type_id: item.deviceTypeId,
            quantity: item.quantity
          }))
        );

        if (insertItemsError) {
          return failure(insertItemsError.message || "No se pudieron guardar los articulos del pase.");
        }
      }

      const { error: deletePendingDevicesError } = await supabase
        .from("internal_devices")
        .delete()
        .eq("source_listing_id", passId)
        .eq("status", "pendiente");

      if (deletePendingDevicesError) {
        return failure(deletePendingDevicesError.message || "No se pudieron limpiar los aparatos pendientes del pase.");
      }

      if (articlePayload.length > 0) {
        const { data: typeRows, error: typeRowsError } = await supabase
          .from("module_device_types")
          .select("id, module_key")
          .eq("active", true)
          .in(
            "id",
            articlePayload.map((item) => item.deviceTypeId)
          );

        if (typeRowsError) {
          return failure(typeRowsError.message || "No se pudieron preparar los aparatos pendientes.");
        }

        const typeModuleMap = new Map((typeRows ?? []).map((item) => [item.id, item.module_key]));
        const pendingDevicesPayload = articlePayload
          .map((item) => {
            const moduleKey = typeModuleMap.get(item.deviceTypeId);
            if (!moduleKey) {
              return null;
            }

            return {
              internal_id: internoId,
              module_key: moduleKey,
              device_type_id: item.deviceTypeId,
              source_listing_id: passId,
              quantity: item.quantity,
              cameras_allowed: false,
              status: "pendiente",
              created_by: profile.id
            };
          })
          .filter(
            (
              item
            ): item is {
              internal_id: string;
              module_key: string;
              device_type_id: string;
              source_listing_id: string;
              quantity: number;
              cameras_allowed: boolean;
              status: string;
              created_by: string;
            } => item !== null
          );

        if (pendingDevicesPayload.length > 0) {
          const { error: recreatePendingError } = await supabase
            .from("internal_devices")
            .insert(
              pendingDevicesPayload.flatMap((item) =>
                Array.from({ length: Math.max(1, Number(item.quantity ?? 1)) }, () => ({
                  ...item,
                  quantity: 1
                }))
              )
            );

          if (recreatePendingError) {
            return failure(recreatePendingError.message || "No se pudieron recrear los aparatos pendientes del pase.");
          }
        }
      }
    }

    revalidatePath("/sistema/listado");
    revalidatePath("/sistema/internos");
    revalidatePath("/sistema/visual");
    revalidatePath("/sistema/comunicacion");

    await auditAction({
      userId: profile.id,
      moduleKey: "listado",
      sectionKey: "editar-pase",
      actionKey: "update",
      entityType: "pase",
      entityId: passId,
      beforeData: {
        menciones: passRow.menciones,
        especiales: passRow.especiales,
        deviceItems: currentDeviceItemRows ?? []
      },
      afterData: {
        menciones: mentions || null,
        especiales: specialText,
        visitorIds,
        articlePayload
      }
    });

    return success("Pase actualizado.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "No se pudo actualizar el pase.");
  }
}

export async function createModuleZoneAction(
  _prevState: MutationState,
  formData: FormData
): Promise<MutationState> {
  try {
    const profile = await requireProfile();
    if (profile.roleKey !== "super-admin") {
      return failure("Solo super-admin puede guardar zonas.");
    }
      const supabase = await createServerSupabaseClient();
      const name = String(formData.get("name") ?? "").trim();
      const sortOrderInput = String(formData.get("sort_order") ?? "").trim();

      if (!name) {
        return failure("Debes escribir el nombre de la zona.");
      }

      if (!/^M[A-Z0-9]+$/i.test(name)) {
        return failure("La zona debe tener formato M seguido de numeros o letras, por ejemplo M8 o MI.");
      }

      let sortOrder = Number(sortOrderInput);
      if (!sortOrderInput) {
        const { data: lastZone } = await supabase
          .from("zones")
          .select("sort_order")
          .order("sort_order", { ascending: false })
          .limit(1)
          .maybeSingle();

        sortOrder = Number(lastZone?.sort_order ?? 0) + 1;
      }

      if (!Number.isInteger(sortOrder) || sortOrder <= 0) {
        return failure("Debes capturar un orden valido para la zona.");
      }

      const { error } = await supabase.from("zones").insert({
        name,
        sort_order: sortOrder,
        created_by: profile.id
      });

    if (error) {
      return failure(error.message || "No se pudo guardar la zona.");
    }

    revalidatePath("/sistema/admin");
    revalidatePath("/sistema/visual");
    revalidatePath("/sistema/comunicacion");
    revalidatePath("/sistema/escaleras");
    revalidatePath("/sistema/rentas");
    return success("Zona guardada.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "No se pudo guardar la zona.");
  }
}

export async function updateModuleZoneSortOrderAction(
  _prevState: MutationState,
  formData: FormData
): Promise<MutationState> {
  try {
    const profile = await requireProfile();
    if (profile.roleKey !== "super-admin") {
      return failure("Solo super-admin puede ordenar zonas.");
    }

    const supabase = await createServerSupabaseClient();
    const zoneId = String(formData.get("zone_id") ?? "").trim();
    const sortOrder = Number(formData.get("sort_order") ?? 0);

    if (!zoneId || !Number.isInteger(sortOrder) || sortOrder <= 0) {
      return failure("Debes indicar la zona y un orden valido.");
    }

    const { error } = await supabase
      .from("zones")
      .update({ sort_order: sortOrder })
      .eq("id", zoneId);

    if (error) {
      return failure(error.message || "No se pudo actualizar el orden de la zona.");
    }

    revalidatePath("/sistema/admin");
    revalidatePath("/sistema/visual");
    revalidatePath("/sistema/comunicacion");
    revalidatePath("/sistema/escaleras");
    revalidatePath("/sistema/rentas");
    return success("Orden de zona actualizado.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "No se pudo actualizar el orden de la zona.");
  }
}

export async function createModuleChargeRouteAction(
  _prevState: MutationState,
  formData: FormData
): Promise<MutationState> {
  try {
    const profile = await requireProfile();
    if (profile.roleKey !== "super-admin") {
      return failure("Solo super-admin puede programar cobros.");
    }

    const supabase = await createServerSupabaseClient();
    const moduleKey = String(formData.get("module_key") ?? "").trim();
    const zoneSelection = formData.get("zone_id");
    const chargeWeekday = Number(formData.get("charge_weekday") ?? 0);
    const { zoneId, error: zoneError } = await resolveZoneId(supabase, zoneSelection);

    if (zoneError) {
      return failure(zoneError);
    }

    if (!moduleKey || !zoneId || !Number.isFinite(chargeWeekday)) {
      return failure("Debes elegir bloque, zona y dia de cobro.");
    }

    const { error } = await supabase.from("module_charge_routes").upsert(
      {
        module_key: moduleKey,
        zone_id: zoneId,
        charge_weekday: chargeWeekday,
        active: true,
        created_by: profile.id
      },
      { onConflict: "module_key,zone_id" }
    );

    if (error) {
      return failure(error.message || "No se pudo guardar la programacion de cobro.");
    }

    revalidatePath("/sistema/admin");
    revalidatePath(`/sistema/${moduleKey}`);
    return success("Programacion de cobro guardada.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "No se pudo guardar la programacion de cobro.");
  }
}

export async function saveModulePriceAction(
  _prevState: MutationState,
  formData: FormData
): Promise<MutationState> {
  try {
    const profile = await requireProfile();
    const supabase = await createServerSupabaseClient();
    const moduleKey = String(formData.get("module_key") ?? "").trim();
    const deviceTypeId = String(formData.get("device_type_id") ?? "").trim();
    const weeklyPrice = Number(formData.get("weekly_price") ?? 0);
    const activationPrice = Number(formData.get("activation_price") ?? 0);
    const finePrice = Number(formData.get("fine_price") ?? 0);
    const maintenancePrice = Number(formData.get("maintenance_price") ?? 0);
    const retentionPrice = Number(formData.get("retention_price") ?? 0);
    const discountAmount = Number(formData.get("discount_amount") ?? 0);

    if (!deviceTypeId) {
      return failure("Debes elegir un tipo de aparato.");
    }

    const { error } = await supabase.from("module_prices").upsert(
      {
        module_key: moduleKey,
        device_type_id: deviceTypeId,
        weekly_price: weeklyPrice,
        activation_price: activationPrice,
        fine_price: finePrice,
        maintenance_price: maintenancePrice,
        retention_price: retentionPrice,
        discount_amount: discountAmount,
        created_by: profile.id
      },
      { onConflict: "module_key,device_type_id" }
    );

    if (error) {
      return failure(error.message || "No se pudo guardar el precio.");
    }

    revalidatePath(`/sistema/${moduleKey}`);
    revalidatePath("/sistema/admin");
    return success("Precio guardado.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "No se pudo guardar el precio.");
  }
}

export async function saveModuleSettingsAction(
  _prevState: MutationState,
  formData: FormData
): Promise<MutationState> {
  try {
    const profile = await requireProfile();
    if (profile.roleKey !== "super-admin") {
      return failure("Solo super-admin puede cambiar la configuracion.");
    }

    const supabase = await createServerSupabaseClient();
    const cutoffWeekday = Number(formData.get("cutoff_weekday") ?? 1);
    const blockModules = ["visual", "comunicacion", "escaleras", "rentas"];

    const { error: appSettingError } = await supabase.from("app_settings").upsert(
      {
        key: "global_cutoff_weekday",
        value: String(cutoffWeekday),
        updated_by: profile.id
      },
      { onConflict: "key" }
    );

    if (appSettingError) {
      return failure(appSettingError.message || "No se pudo guardar el corte global.");
    }

    const settingsPayload = blockModules.map((moduleKey) => ({
      module_key: moduleKey,
      cutoff_weekday: cutoffWeekday,
      created_by: profile.id
    }));

    const { error } = await supabase.from("module_settings").upsert(settingsPayload, {
      onConflict: "module_key"
    });

    if (error) {
      return failure(error.message || "No se pudo sincronizar el corte global.");
    }

    revalidatePath("/sistema/admin");
    revalidatePath("/sistema/visual");
    revalidatePath("/sistema/comunicacion");
    revalidatePath("/sistema/escaleras");
    await auditAction({
      userId: profile.id,
      moduleKey: "admin",
      sectionKey: "danger-zone",
      actionKey: "update",
      entityType: "global_cutoff_weekday",
      entityId: "global_cutoff_weekday",
      afterData: { cutoffWeekday }
    });
    return success("Configuracion guardada.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "No se pudo guardar la configuracion.");
  }
}

export async function createWorkplaceAction(
  _prevState: MutationState,
  formData: FormData
): Promise<MutationState> {
  try {
    const profile = await requireProfile();
    if (profile.roleKey !== "super-admin") {
      return failure("Solo super-admin puede guardar centros de trabajo.");
    }

    const supabase = await createServerSupabaseClient();
    const name = String(formData.get("name") ?? "").trim();
    const type = String(formData.get("type") ?? "").trim();

    if (!name || !["negocio", "oficina"].includes(type)) {
      return failure("Debes capturar nombre y tipo.");
    }

    const { error } = await supabase.from("workplaces").insert({
      name,
      type,
      created_by: profile.id
    });

    if (error) {
      return failure(error.message || "No se pudo guardar el centro de trabajo.");
    }

    revalidatePath("/sistema/admin");
    return success("Centro de trabajo guardado.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "No se pudo guardar el centro de trabajo.");
  }
}

export async function saveWorkplacePositionAction(
  _prevState: MutationState,
  formData: FormData
): Promise<MutationState> {
  try {
    const profile = await requireProfile();
    if (profile.roleKey !== "super-admin") {
      return failure("Solo super-admin puede guardar puestos.");
    }

    const supabase = await createServerSupabaseClient();
    const workplaceId = String(formData.get("workplace_id") ?? "").trim();
    const title = String(formData.get("title") ?? "").trim();
    const salary = Number(formData.get("salary") ?? 0);
    const assignedInternalId = String(formData.get("assigned_internal_id") ?? "").trim() || null;

    if (!workplaceId || !title) {
      return failure("Debes elegir centro de trabajo y puesto.");
    }

    const { error } = await supabase.from("workplace_positions").upsert(
      {
        workplace_id: workplaceId,
        title,
        salary: Number.isFinite(salary) ? salary : 0,
        assigned_internal_id: assignedInternalId,
        created_by: profile.id
      },
      { onConflict: "workplace_id,title" }
    );

    if (error) {
      return failure(error.message || "No se pudo guardar el puesto.");
    }

    if (assignedInternalId) {
      await supabase.from("internos").update({ laborando: true, estatus: "activo" }).eq("id", assignedInternalId);
    }

    revalidatePath("/sistema/admin");
    revalidatePath("/sistema/internos");
    return success("Puesto guardado.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "No se pudo guardar el puesto.");
  }
}

export async function assignModuleDeviceAction(
  _prevState: MutationState,
  formData: FormData
): Promise<MutationState> {
  try {
    const profile = await requireProfile();
    const supabase = await createServerSupabaseClient();
    const moduleKey = String(formData.get("module_key") ?? "").trim();
    const internalId = String(formData.get("internal_id") ?? "").trim();
    const deviceTypeId = String(formData.get("device_type_id") ?? "").trim();
    const zoneSelection = formData.get("zone_id");
    const brand = String(formData.get("brand") ?? "").trim() || null;
    const model = String(formData.get("model") ?? "").trim() || null;
    const characteristics = String(formData.get("characteristics") ?? "").trim() || null;
    const imei = String(formData.get("imei") ?? "").trim() || null;
    const chipNumber = String(formData.get("chip_number") ?? "").trim() || null;
    const camerasAllowed = String(formData.get("cameras_allowed") ?? "") === "on";
    const notes = String(formData.get("notes") ?? "").trim() || null;

    if (!internalId || !deviceTypeId) {
      return failure("Debes elegir el interno y el tipo de aparato.");
    }

    const { zoneId, error: zoneError } = await resolveZoneId(supabase, zoneSelection);
    if (zoneError) {
      return failure(zoneError);
    }

    const allowedDeviceNames = getAllowedModuleDeviceNames(moduleKey as "visual" | "comunicacion" | "escaleras" | "rentas");
    const { data: selectedType, error: typeError } = await supabase
      .from("module_device_types")
      .select("name, module_key")
      .eq("id", deviceTypeId)
      .maybeSingle();

    if (typeError || !selectedType) {
      return failure(typeError?.message || "No se encontro el tipo de aparato.");
    }

    if (String(selectedType.module_key ?? "").trim() !== moduleKey) {
      return failure(`Ese aparato no corresponde al bloque ${moduleKey}.`);
    }

    if (allowedDeviceNames && !allowedDeviceNames.has(normalizeDeviceTypeName(selectedType.name))) {
      return failure(`Ese aparato no corresponde al bloque ${moduleKey}.`);
    }

    const { data: selectedInternal, error: internalError } = await supabase
      .from("internos")
      .select("id")
      .eq("id", internalId)
      .maybeSingle();

    if (internalError || !selectedInternal) {
      return failure(internalError?.message || "El interno seleccionado ya no existe.");
    }

    if (zoneId) {
      const { data: selectedZone, error: selectedZoneError } = await supabase
        .from("zones")
        .select("id")
        .eq("id", zoneId)
        .maybeSingle();

      if (selectedZoneError || !selectedZone) {
        return failure(selectedZoneError?.message || "La zona seleccionada ya no existe.");
      }
    }

    const insertPayload: Record<string, unknown> = {
      internal_id: internalId,
      module_key: selectedType.module_key,
      device_type_id: deviceTypeId,
      brand,
      model,
      characteristics,
      imei,
      chip_number: chipNumber,
      quantity: 1,
      cameras_allowed: camerasAllowed,
      assigned_manually: true,
      status: "pendiente",
      notes,
      created_by: profile.id
    };

    if (zoneId) {
      insertPayload.zone_id = zoneId;
    }

    let insertError: { code?: string; message?: string | null; details?: string | null } | null = null;

    const initialInsert = await supabase.from("internal_devices").insert(insertPayload);
    insertError = initialInsert.error;

    if (insertError?.code === "23503" && zoneId) {
      const retryPayload = { ...insertPayload };
      delete retryPayload.zone_id;
      const retryInsert = await supabase.from("internal_devices").insert(retryPayload);
      insertError = retryInsert.error;
    }

    if (insertError) {
      if (insertError.code === "23503") {
        return failure("No se pudo guardar el aparato porque el interno, la zona o el dispositivo ya no existen.");
      }
      return failure(insertError.message || "No se pudo asignar el aparato.");
    }

    revalidatePath(`/sistema/${moduleKey}`);
    revalidatePath("/sistema/internos");
    await auditAction({
      userId: profile.id,
      moduleKey,
      sectionKey: "aparatos",
      actionKey: "create",
      entityType: "aparato",
      entityId: deviceTypeId,
      afterData: {
        internalId,
        deviceTypeId,
        zoneId,
        brand,
        model,
        quantity: 1
      }
    });
    return success("Aparato asignado.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "No se pudo asignar el aparato.");
  }
}

export async function registerModulePaymentAction(
  _prevState: MutationState,
  formData: FormData
): Promise<MutationState> {
  try {
    const profile = await requireProfile();
    const supabase = await createServerSupabaseClient();
    const moduleKey = String(formData.get("module_key") ?? "").trim();
    const internalDeviceId = String(formData.get("internal_device_id") ?? "").trim();
    const internalId = String(formData.get("internal_id") ?? "").trim();
    const zoneSelection = formData.get("zone_id");
    const amount = Number(formData.get("amount") ?? 0);
    const notes = String(formData.get("notes") ?? "").trim() || null;
    const brand = String(formData.get("brand") ?? "").trim() || null;
    const model = String(formData.get("model") ?? "").trim() || null;
    const imei = String(formData.get("imei") ?? "").trim() || null;
    const chipNumber = String(formData.get("chip_number") ?? "").trim() || null;
    const characteristics = String(formData.get("characteristics") ?? "").trim() || null;

    if (!internalDeviceId && !internalId) {
      return failure("Debes elegir un interno.");
    }

    const { zoneId, error: zoneError } = await resolveZoneId(supabase, zoneSelection);
    if (zoneError) {
      return failure(zoneError);
    }

    const { data: settings } = await supabase
      .from("module_settings")
      .select("cutoff_weekday")
      .eq("module_key", moduleKey)
      .maybeSingle();
    const { start: weekStart, end: weekEnd } = getWeekRangeFromCutoff(settings?.cutoff_weekday ?? 1);

    const { data: cycle, error: cycleError } = await supabase
      .from("device_payment_cycles")
      .upsert(
        {
          module_key: moduleKey,
          week_start: weekStart,
          week_end: weekEnd
        },
        { onConflict: "module_key,week_start,week_end" }
      )
      .select("id, closed")
      .single();

    if (cycleError || !cycle) {
      return failure(cycleError?.message || "No se pudo preparar la semana de cobro.");
    }

    if (cycle.closed) {
      return failure("La semana ya esta cerrada y no admite cambios.");
    }

    const targetDevices = internalId
      ? await supabase
          .from("internal_devices")
          .select("id, internal_id, device_type_id, quantity, status, weekly_price_override, discount_override, module_device_types!inner(name)")
          .eq("module_key", moduleKey)
          .eq("internal_id", internalId)
          .neq("status", "baja")
      : await supabase
          .from("internal_devices")
          .select("id, internal_id, device_type_id, quantity, status, weekly_price_override, discount_override, module_device_types!inner(name)")
          .eq("id", internalDeviceId)
          .eq("module_key", moduleKey)
          .neq("status", "baja");

    if (targetDevices.error || !targetDevices.data || targetDevices.data.length === 0) {
      return failure(targetDevices.error?.message || "No se encontraron aparatos para cobrar.");
    }
    const filteredTargetDevices = targetDevices.data ?? [];

    if (internalDeviceId) {
      const updatePayload: Record<string, string | null> = {};
      if (zoneId) {
        updatePayload.zone_id = zoneId;
      }
      if (brand !== null) {
        updatePayload.brand = brand;
      }
      if (model !== null) {
        updatePayload.model = model;
      }
      if (imei !== null) {
        updatePayload.imei = imei;
      }
      if (chipNumber !== null) {
        updatePayload.chip_number = chipNumber;
      }
      if (characteristics !== null) {
        updatePayload.characteristics = characteristics;
      }
      if (notes !== null) {
        updatePayload.notes = notes;
      }

      if (Object.keys(updatePayload).length > 0) {
        const { error: updateDeviceError } = await supabase
          .from("internal_devices")
          .update(updatePayload)
          .eq("id", internalDeviceId);

        if (updateDeviceError) {
          return failure(updateDeviceError.message || "No se pudo actualizar el aparato antes del pago.");
        }
      }
    }

    const deviceTypeIds = [...new Set(filteredTargetDevices.map((device) => device.device_type_id))];
    const { data: modulePrices } = deviceTypeIds.length
      ? await supabase
          .from("module_prices")
          .select("device_type_id, weekly_price, activation_price, discount_amount")
          .eq("module_key", moduleKey)
          .in("device_type_id", deviceTypeIds)
      : { data: [] as Array<{ device_type_id: string; weekly_price: number; activation_price: number; discount_amount: number }> };
    const priceMap = new Map(
      (modulePrices ?? []).map((item) => [
        item.device_type_id,
        {
          weeklyPrice: Number(item.weekly_price ?? 0),
          activationPrice: Number(item.activation_price ?? 0),
          discountAmount: Number(item.discount_amount ?? 0)
        }
      ])
    );
    const paymentsPayload = filteredTargetDevices.map((device) => ({
      internal_device_id: device.id,
      module_key: moduleKey,
      zone_id: zoneId,
      cycle_id: cycle.id,
      amount:
        device.status === "pendiente"
          ? priceMap.get(device.device_type_id)?.activationPrice ?? 0
          : Math.max(
              0,
              (device.weekly_price_override ?? priceMap.get(device.device_type_id)?.weeklyPrice ?? 0) -
                (device.discount_override ?? priceMap.get(device.device_type_id)?.discountAmount ?? 0)
            ) * Math.max(Number(device.quantity ?? 1), 1),
      status: "pagado",
      paid_at: new Date().toISOString(),
      paid_by: profile.id,
      notes
    }));

    const { error } = await supabase.from("device_payments").upsert(paymentsPayload, {
      onConflict: "internal_device_id,cycle_id"
    });

    if (error) {
      return failure(error.message || "No se pudo registrar el pago.");
    }

    await supabase
      .from("internal_devices")
      .update({
        status: "activo",
        activated_at: new Date().toISOString()
      })
      .in(
        "id",
        filteredTargetDevices.map((device) => device.id)
      )
      .eq("status", "pendiente");

    revalidatePath(`/sistema/${moduleKey}`);
    await auditAction({
      userId: profile.id,
      moduleKey,
      sectionKey: "cobranza",
      actionKey: "create",
      entityType: "pago",
      entityId: cycle.id,
      afterData: {
        internalId,
        amount,
        zoneId,
        cycleId: cycle.id
      }
    });
    return success("Pago registrado.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "No se pudo registrar el pago.");
  }
}

export async function closeModuleWeekAction(
  _prevState: MutationState,
  formData: FormData
): Promise<MutationState> {
  try {
    const profile = await requireProfile();
    const moduleKey = String(formData.get("module_key") ?? "").trim();
    const cycleId = String(formData.get("cycle_id") ?? "").trim();
    const supabase = await createServerSupabaseClient();

    let canClose = profile.roleKey === "super-admin";
    if (!canClose) {
      const { data: worker } = await supabase
        .from("module_workers")
        .select("id")
        .eq("module_key", moduleKey)
        .eq("user_profile_id", profile.id)
        .eq("active", true)
        .maybeSingle();

      if (worker) {
        const { data: permission } = await supabase
          .from("module_worker_permissions")
          .select("id")
          .eq("worker_id", worker.id)
          .eq("function_key", "encargado")
          .maybeSingle();

        canClose = Boolean(permission);
      }
    }

    if (!canClose) {
      return failure("Solo super-admin o Encargado del bloque puede cerrar la semana.");
    }

    if (!cycleId) {
      return failure("No se encontro la semana activa.");
    }

    const { data: cycle } = await supabase
      .from("device_payment_cycles")
      .select("week_start, week_end")
      .eq("id", cycleId)
      .maybeSingle();

    if (!cycle) {
      return failure("No se encontro la semana activa.");
    }

    const { data: devices } = await supabase
      .from("internal_devices")
      .select("id, zone_id, status, module_device_types!inner(name)")
      .eq("module_key", moduleKey)
      .neq("status", "baja");

    const activeDeviceIds = (devices ?? [])
      .filter((item) => item.status === "activo")
      .map((item) => item.id);
    if (activeDeviceIds.length > 0) {
      const { data: paidItems } = await supabase
        .from("device_payments")
        .select("internal_device_id, status")
        .eq("module_key", moduleKey)
        .eq("cycle_id", cycleId)
        .in("internal_device_id", activeDeviceIds);

      const paidSet = new Set(
        (paidItems ?? []).filter((item) => item.status === "pagado").map((item) => item.internal_device_id)
      );
      if (paidSet.size !== activeDeviceIds.length) {
        return failure("No puedes cerrar la semana si hay zonas o aparatos pendientes de cobro.");
      }
    }

    const { error } = await supabase
      .from("device_payment_cycles")
      .update({
        closed: true,
        closed_by: profile.id
      })
      .eq("id", cycleId);

    if (error) {
      return failure(error.message || "No se pudo cerrar la semana.");
    }

    revalidatePath(`/sistema/${moduleKey}`);
    await auditAction({
      userId: profile.id,
      moduleKey,
      sectionKey: "cierre-semana",
      actionKey: "close",
      entityType: "semana",
      entityId: cycleId,
      beforeData: cycle,
      afterData: { closed: true }
    });
    return success("Semana cerrada.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "No se pudo cerrar la semana.");
  }
}

export async function saveEscaleraEntryAction(
  _prevState: MutationState,
  formData: FormData
): Promise<MutationState> {
  try {
    const profile = await requireProfile();
    if (!["super-admin", "control", "escaleras"].includes(profile.roleKey)) {
      return failure("Tu rol no puede operar Escaleras.");
    }

    const supabase = await createServerSupabaseClient();
    const listadoId = String(formData.get("listado_id") ?? "").trim();
    const internalId = String(formData.get("internal_id") ?? "").trim();
    const fechaVisita = String(formData.get("fecha_visita") ?? "").trim();
    const off8Aplica = String(formData.get("off8_aplica") ?? "") === "on";
    const off8Type = String(formData.get("off8_type") ?? "").trim() || null;
    const off8Percent = Number(formData.get("off8_percent") ?? 0);
    const off8Value = Number(formData.get("off8_value") ?? 0);
    const ticketAmount = Number(formData.get("ticket_amount") ?? 0);
    const requestedStatus = String(formData.get("status") ?? "pendiente").trim();
    const comentarios = String(formData.get("comentarios") ?? "").trim() || null;
    const retenciones = String(formData.get("retenciones") ?? "").trim() || null;

    if (!listadoId || !internalId || !fechaVisita) {
      return failure("Faltan datos del registro de Escaleras.");
    }

    const { data: currentEntry } = await supabase
      .from("escalera_entries")
      .select("id")
      .eq("listado_id", listadoId)
      .maybeSingle();

    const entryId = currentEntry?.id ?? null;
    const itemCheck = entryId
      ? await supabase
          .from("escalera_entry_items")
          .select("id", { count: "exact", head: true })
          .eq("escalera_entry_id", entryId)
      : null;
    const manualItemCount = Number(itemCheck?.count ?? 0);

    let resolvedStatus = requestedStatus;
    let resolvedOff8Type = off8Aplica ? off8Type : null;
    let resolvedTicketAmount = Number.isFinite(ticketAmount) && ticketAmount > 0 ? ticketAmount : null;
    let resolvedOff8Percent = off8Aplica && resolvedOff8Type === "porcentual" && Number.isFinite(off8Percent) && off8Percent > 0
      ? Math.max(1, Math.min(100, off8Percent))
      : null;
    let resolvedOff8Value = off8Aplica && Number.isFinite(off8Value) && off8Value > 0 ? off8Value : null;

    if (resolvedOff8Type === "libre") {
      resolvedStatus = "entregado";
      resolvedTicketAmount = null;
      resolvedOff8Percent = null;
      resolvedOff8Value = 0;
    } else if (off8Aplica && resolvedOff8Type === "porcentual" && resolvedTicketAmount) {
      resolvedOff8Value = Number(((resolvedTicketAmount * (resolvedOff8Percent ?? 0)) / 100).toFixed(2));
    }

    if (off8Aplica && resolvedOff8Type !== "libre" && requestedStatus !== "pendiente") {
      resolvedStatus = "enviado";
    }

    if (resolvedStatus !== "pendiente" && manualItemCount === 0) {
      return failure("Debes capturar primero el listado de articulos antes de cerrar el registro.");
    }

    const { error } = await supabase.from("escalera_entries").upsert(
      {
        listado_id: listadoId,
        internal_id: internalId,
        fecha_visita: fechaVisita,
        off8_aplica: off8Aplica,
        off8_type: resolvedOff8Type,
        off8_percent: resolvedOff8Percent,
        off8_value: off8Aplica ? resolvedOff8Value : null,
        ticket_amount: resolvedTicketAmount,
        status: resolvedStatus,
        comentarios,
        retenciones,
        created_by: profile.id
      },
      { onConflict: "listado_id" }
    );

    if (error) {
      return failure(error.message || "No se pudo guardar el registro de Escaleras.");
    }

    const logLines = [
      off8Aplica ? `Off8: ${off8Type === "porcentual" ? "Porcentual" : "Fijo"} ${Number.isFinite(off8Value) ? off8Value : 0}` : null,
      resolvedOff8Type === "libre" ? "Off8: Libre" : null,
      Number.isFinite(resolvedTicketAmount ?? 0) && (resolvedTicketAmount ?? 0) > 0 ? `Ticket: $${(resolvedTicketAmount ?? 0).toFixed(2)}` : null,
      retenciones ? `Retenciones: ${retenciones}` : null,
      comentarios ? `Comentarios: ${comentarios}` : null,
      `Estatus: ${resolvedStatus}`
    ].filter(Boolean);

    if (logLines.length > 0) {
      await supabase.from("internal_log_notes").upsert(
        {
          internal_id: internalId,
          source_module: "escaleras",
          source_ref_id: listadoId,
          title: "Registro Escaleras",
          notes: logLines.join("\n"),
          created_by: profile.id
        },
        { onConflict: "source_module,source_ref_id" }
      );
    }

    revalidatePath("/sistema/escaleras");
    await auditAction({
      userId: profile.id,
      moduleKey: "escaleras",
      sectionKey: "registro",
      actionKey: "update",
      entityType: "escalera_entry",
      entityId: listadoId,
      afterData: {
        internalId,
        fechaVisita,
        off8Aplica,
        off8Type: resolvedOff8Type,
        off8Percent: resolvedOff8Percent,
        off8Value: resolvedOff8Value,
        ticketAmount: resolvedTicketAmount,
        status: resolvedStatus,
        comentarios,
        retenciones
      }
    });
    return success("Registro de Escaleras guardado.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "No se pudo guardar Escaleras.");
  }
}

export async function addEscaleraItemAction(
  _prevState: MutationState,
  formData: FormData
): Promise<MutationState> {
  try {
    const profile = await requireProfile();
    if (!["super-admin", "control", "escaleras"].includes(profile.roleKey)) {
      return failure("Tu rol no puede agregar articulos en Escaleras.");
    }

    const supabase = await createServerSupabaseClient();
    const listadoId = String(formData.get("listado_id") ?? "").trim();
    const internalId = String(formData.get("internal_id") ?? "").trim();
    const fechaVisita = String(formData.get("fecha_visita") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const quantity = Number(formData.get("quantity") ?? 1);
    const unitLabel = String(formData.get("unit_label") ?? "").trim() || null;
    const weightKg = Number(formData.get("weight_kg") ?? 0);
    const liters = Number(formData.get("liters") ?? 0);
    const notes = String(formData.get("notes") ?? "").trim() || null;

    if (!listadoId || !internalId || !fechaVisita || !description) {
      return failure("Completa la descripcion del articulo.");
    }

    const { data: entry, error: entryError } = await supabase
      .from("escalera_entries")
      .upsert(
        {
          listado_id: listadoId,
          internal_id: internalId,
          fecha_visita: fechaVisita,
          created_by: profile.id
        },
        { onConflict: "listado_id" }
      )
      .select("id")
      .single();

    if (entryError || !entry) {
      return failure(entryError?.message || "No se pudo preparar el registro de Escaleras.");
    }

    const { error } = await supabase.from("escalera_entry_items").insert({
      escalera_entry_id: entry.id,
      description,
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      unit_label: unitLabel,
      weight_kg: Number.isFinite(weightKg) && weightKg > 0 ? weightKg : null,
      liters: Number.isFinite(liters) && liters > 0 ? liters : null,
      notes,
      created_by: profile.id
    });

    if (error) {
      return failure(error.message || "No se pudo guardar el articulo.");
    }

    revalidatePath("/sistema/escaleras");
    await auditAction({
      userId: profile.id,
      moduleKey: "escaleras",
      sectionKey: "articulos",
      actionKey: "create",
      entityType: "escalera_item",
      entityId: entry.id,
      afterData: {
        description,
        quantity,
        unitLabel,
        weightKg,
        liters,
        notes
      }
    });
    return success("Articulo agregado.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "No se pudo guardar el articulo.");
  }
}

export async function payAduanaEntryAction(
  _prevState: MutationState,
  formData: FormData
): Promise<MutationState> {
  try {
    const profile = await requireProfile();
    if (!["super-admin", "escaleras"].includes(profile.roleKey)) {
      return failure("Tu rol no puede operar Aduana.");
    }

    const supabase = await createServerSupabaseClient();
    const entryId = String(formData.get("entry_id") ?? "").trim();
    const paidAmount = Number(formData.get("paid_amount") ?? 0);
    const comments = String(formData.get("comments") ?? "").trim() || null;

    if (!entryId) {
      return failure("No se encontro el registro de Aduana.");
    }

    const { error } = await supabase
      .from("escalera_entries")
      .update({
        status: "pagado",
        paid_at: new Date().toISOString(),
        paid_amount: Number.isFinite(paidAmount) ? paidAmount : 0,
        comentarios: comments
      })
      .eq("id", entryId);

    if (error) {
      return failure(error.message || "No se pudo registrar el pago en Aduana.");
    }

    revalidatePath("/sistema/aduana");
    revalidatePath("/sistema/escaleras");
    await auditAction({
      userId: profile.id,
      moduleKey: "escaleras",
      sectionKey: "aduana",
      actionKey: "update",
      entityType: "escalera_entry",
      entityId: entryId,
      afterData: {
        status: "pagado",
        paidAmount,
        comments
      }
    });
    return success("Pago registrado en Aduana.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "No se pudo registrar el pago.");
  }
}

export async function assignModuleWorkerAction(
  _prevState: MutationState,
  formData: FormData
): Promise<MutationState> {
  try {
    const profile = await requireProfile();
    if (!["super-admin", "control"].includes(profile.roleKey)) {
      return failure("Tu rol no puede asignar trabajadores.");
    }

    const supabase = await createServerSupabaseClient();
    const moduleKey = String(formData.get("module_key") ?? "").trim();
    const userId = String(formData.get("user_id") ?? "").trim();
    const moduleOnly = String(formData.get("module_only") ?? "") === "on";
    const functions = formData.getAll("functions").map((item) => String(item)).filter(Boolean);

    if (!userId) {
      return failure("Debes elegir un usuario.");
    }

    const { data: worker, error: workerError } = await supabase
      .from("module_workers")
      .upsert(
        {
          module_key: moduleKey,
          user_profile_id: userId,
          active: true,
          created_by: profile.id
        },
        { onConflict: "module_key,user_profile_id" }
      )
      .select("id")
      .single();

    if (workerError || !worker) {
      return failure(workerError?.message || "No se pudo guardar el trabajador.");
    }

    await supabase.from("module_worker_permissions").delete().eq("worker_id", worker.id);

    if (functions.length > 0) {
      const { error: permissionsError } = await supabase.from("module_worker_permissions").insert(
        functions.map((fn) => ({
          worker_id: worker.id,
          function_key: fn
        }))
      );

      if (permissionsError) {
        return failure(permissionsError.message || "No se pudieron guardar las funciones.");
      }
    }

    await supabase
      .from("user_profiles")
      .update({ module_only: moduleOnly })
      .eq("id", userId);

    revalidatePath(`/sistema/${moduleKey}`);
    await auditAction({
      userId: profile.id,
      moduleKey,
      sectionKey: "trabajadores",
      actionKey: "update",
      entityType: "module_worker",
      entityId: userId,
      afterData: { functions, moduleOnly }
    });
    return success("Trabajador asignado.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "No se pudo asignar el trabajador.");
  }
}

export async function assignModuleStaffAction(
  _prevState: MutationState,
  formData: FormData
): Promise<MutationState> {
  try {
    const profile = await requireProfile();
    if (!["super-admin", "control"].includes(profile.roleKey)) {
      return failure("Tu rol no puede asignar puestos.");
    }

    const supabase = await createServerSupabaseClient();
    const moduleKey = String(formData.get("module_key") ?? "").trim();
    const internalId = String(formData.get("internal_id") ?? "").trim();
    const userId = String(formData.get("user_id") ?? "").trim();
    const positionKey = String(formData.get("position_key") ?? "").trim();

    if (!internalId || !userId || !positionKey) {
      return failure("Debes elegir interno, usuario y puesto.");
    }

    await supabase
      .from("module_internal_staff")
      .delete()
      .eq("module_key", moduleKey)
      .eq("user_profile_id", userId);

    const { error } = await supabase.from("module_internal_staff").insert({
      module_key: moduleKey,
      internal_id: internalId,
      user_profile_id: userId,
      position_key: positionKey,
      created_by: profile.id
    });

    if (error) {
      return failure(error.message || "No se pudo asignar el puesto.");
    }

    revalidatePath(`/sistema/${moduleKey}`);
    await auditAction({
      userId: profile.id,
      moduleKey,
      sectionKey: "puestos",
      actionKey: "update",
      entityType: "module_internal_staff",
      entityId: `${internalId}:${userId}`,
      afterData: { internalId, userId, positionKey }
    });
    return success("Puesto asignado.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "No se pudo asignar el puesto.");
  }
}



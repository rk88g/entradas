"use server";

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
  canCloseMexicoCityDate,
  getAllowedModuleDeviceNames,
  canManageMentions,
  compareInternalLocations,
  getDateOffset,
  isValidInternalLocation,
  getWeekRangeFromCutoff,
  normalizeDeviceTypeName,
  nextPassNumber
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
  const today = new Date();
  const birthDate = new Date(today.getFullYear() - age, today.getMonth(), today.getDate());
  return birthDate.toISOString().slice(0, 10);
}

function buildInternalExpediente() {
  return `INT-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
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
    const allowedOpenDate = getDateOffset(1);
    const allowedNextDate = getDateOffset(2);
    const status =
      dateValue === allowedOpenDate
        ? "abierto"
        : dateValue === allowedNextDate
          ? "proximo"
          : "";
    const activeOpenDate = dates.find((item) => item.estado === "abierto" && !item.cierre);
    const waitingDate = dates.find((item) => item.estado === "proximo" && !item.cierre);

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
      dia: parsedDate.day,
      mes: parsedDate.month,
      anio: parsedDate.year,
      fecha_completa: dateValue,
      cierre: false,
      estado: status,
      created_by: profile.id
    });

    if (error) {
      return failure(error.message || "No se pudo registrar la fecha.");
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

    revalidatePath("/sistema");
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
      return failure("No se encontro la fecha activa de MAÑANA.");
    }

    if (!canCloseMexicoCityDate()) {
      return failure("Solo puedes cerrar la fecha despues de las 18:00 horas de Mexico.");
    }

    const supabase = await createServerSupabaseClient();
    const closePassword = String(formData.get("close_password") ?? "").trim();
    const { data: setting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "close_password")
      .maybeSingle();

    if (!setting?.value) {
      return failure("No hay contraseña de cierre configurada.");
    }

    if (setting.value !== closePassword) {
      return failure("Contraseña incorrecta.");
    }

    const selectedDate = await getDateByValue(dateValue);
    if (!selectedDate) {
      return failure("La fecha ya no existe.");
    }

    if (selectedDate.estado !== "abierto") {
      return failure("Solo se puede cerrar la fecha de MAÑANA.");
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
        ? pendingPasses.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        : pendingPasses.sort(
            (a, b) => compareInternalLocations(a.internoUbicacion, b.internoUbicacion) || a.createdAt.localeCompare(b.createdAt)
          );

    let currentNumber = numberedPasses[numberedPasses.length - 1]?.numeroPase ?? 0;
    const isInitialClosure = numberedPasses.length === 0;

    for (const pass of orderedPendingPasses) {
      currentNumber = nextPassNumber(currentNumber);
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
        cierre: true
      })
      .eq("id", selectedDate.id);

    if (closeError) {
      return failure(closeError.message || "No se pudo cerrar la fecha.");
    }

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

    revalidatePath("/sistema");
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
    if (profile.roleKey !== "super-admin") {
      return failure("Solo super-admin puede guardar precios.");
    }
    const supabase = await createServerSupabaseClient();

    const age = Number(formData.get("edad") ?? 0);
    const payload = {
      expediente: String(formData.get("expediente") ?? "").trim() || buildInternalExpediente(),
      nombres: String(formData.get("nombres") ?? "").trim(),
      apellido_pat: String(formData.get("apellido_pat") ?? "").trim(),
      apellido_mat: String(formData.get("apellido_mat") ?? "").trim() || null,
      nacimiento: String(formData.get("nacimiento") ?? "").trim() || buildBirthDateFromAge(age),
      llego: String(formData.get("llego") ?? "").trim() || new Date().toISOString().slice(0, 10),
      libre: String(formData.get("libre") ?? "").trim() || null,
      ubicacion: String(formData.get("ubicacion") ?? "").trim(),
      telefono: null,
      ubi_filiacion: String(formData.get("ubi_filiacion") ?? "").trim() || "Sin dato",
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
      return failure("La ubicacion debe tener formato numero-numero, por ejemplo 1-101 o 15-8.");
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

    revalidatePath("/sistema");
    revalidatePath("/sistema/internos");
    revalidatePath("/sistema/listado");
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
    revalidatePath("/sistema/listado");
    return success("Estatus actualizado.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "No se pudo actualizar el estatus.");
  }
}

export async function createVisitorAction(
  _prevState: MutationState,
  formData: FormData
): Promise<MutationState> {
  try {
    const profile = await requireProfile();
    const supabase = await createServerSupabaseClient();

    const visitorPayload = {
      nombres: String(formData.get("nombres") ?? "").trim(),
      apellido_pat: String(formData.get("apellido_pat") ?? "").trim(),
      apellido_mat: String(formData.get("apellido_mat") ?? "").trim() || null,
      fecha_nacimiento: String(formData.get("fecha_nacimiento") ?? "").trim(),
      sexo: String(formData.get("sexo") ?? "sin-definir").trim(),
      parentesco: String(formData.get("parentesco") ?? "").trim(),
      telefono: String(formData.get("telefono") ?? "").trim() || "No aplica",
      betada:
        ["super-admin", "control"].includes(profile.roleKey) &&
        String(formData.get("betada") ?? "false") === "true",
      notas: String(formData.get("notas") ?? "").trim() || null,
      created_by: profile.id
    };

    const internalId = String(formData.get("interno_id") ?? "").trim();

    if (
      !visitorPayload.nombres ||
      !visitorPayload.apellido_pat ||
      !visitorPayload.apellido_mat ||
      !visitorPayload.fecha_nacimiento ||
      !visitorPayload.parentesco
    ) {
      return failure("Completa los datos obligatorios.");
    }

    if (!internalId) {
      return failure("Debes asignar la visita a un interno.");
    }

    const normalizedApellidoMat = (visitorPayload.apellido_mat ?? "").trim().toLowerCase();
    const { data: duplicateVisitors, error: existingVisitorError } = await supabase
      .from("visitas")
      .select("id, apellido_mat")
      .ilike("nombres", visitorPayload.nombres)
      .ilike("apellido_pat", visitorPayload.apellido_pat)
      .order("created_at", { ascending: false });

    if (existingVisitorError) {
      return failure(existingVisitorError.message || "No se pudo validar la visita.");
    }

    const existingVisitor =
      duplicateVisitors?.find(
        (item) => (item.apellido_mat ?? "").trim().toLowerCase() === normalizedApellidoMat
      ) ??
      null;

    if (existingVisitor) {
      const { data: existingRelation } = await supabase
        .from("interno_visitas")
        .select("interno_id")
        .eq("visita_id", existingVisitor.id)
        .maybeSingle();

      if (existingRelation?.interno_id) {
        const { data: internal } = await supabase
          .from("internos")
          .select("nombres, apellido_pat, apellido_mat, ubicacion")
          .eq("id", existingRelation.interno_id)
          .maybeSingle();

        if (internal) {
          return failure(
            `La visita ya esta asignada a ${internal.nombres} ${internal.apellido_pat} ${internal.apellido_mat ?? ""} - ubicacion ${internal.ubicacion}.`
              .replace(/\s+/g, " ")
              .trim()
          );
        }
      }

      return failure("La visita ya existe y ya fue registrada previamente.");
    }

    const { data: insertedVisitor, error: visitorError } = await supabase
      .from("visitas")
      .insert(visitorPayload)
      .select("id")
      .single();

    if (visitorError || !insertedVisitor) {
      return failure(visitorError?.message || "No se pudo guardar la visita.");
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

    revalidatePath("/sistema");
    revalidatePath("/sistema/internos");
    revalidatePath("/sistema/visitas");
    revalidatePath("/sistema/listado");
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
    revalidatePath("/sistema/listado");
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
    const password = String(formData.get("password") ?? "").trim();

    if (!userId || !password) {
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
      .select("interno_id")
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

    revalidatePath("/sistema/internos");
    revalidatePath("/sistema/listado");
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
    const visitorIds = formData.getAll("visitor_ids").map((item) => String(item));
    const targetDateValue = String(formData.get("fecha_visita") ?? "").trim();
    const mentions = String(formData.get("menciones") ?? "").trim();
    const specials = String(formData.get("especiales") ?? "").trim();
    const articlePayload = await getPassArticlePayload(formData);
    const targetDate = await getDateByValue(targetDateValue);

    if (!internoId) {
      return failure("Debes seleccionar un interno.");
    }

    if (!targetDate) {
      return failure("No se encontro la fecha seleccionada para el pase.");
    }

    const canOperateClosedDate = ["super-admin", "control"].includes(profile.roleKey);

    if (!["abierto", "proximo"].includes(targetDate.estado)) {
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
      .select("id, status")
      .eq("interno_id", internoId)
      .eq("fecha_id", targetDate.id)
      .neq("status", "cancelado")
      .maybeSingle();

    if (existingPass) {
      return failure("Ese interno ya tiene pase para la fecha seleccionada.");
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
        .select("nombres, apellido_pat, apellido_mat")
        .in("id", missingVisitorIds);

      const missingNames = (missingVisitors ?? [])
        .map((item) => [item.nombres, item.apellido_pat, item.apellido_mat].filter(Boolean).join(" "))
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

    let articleSummary: string | null = null;
    if (articlePayload.length > 0) {
      const { data: articleTypes, error: articleTypeError } = await supabase
        .from("module_device_types")
        .select("id, name")
        .eq("active", true)
        .in(
          "id",
          articlePayload.map((item) => item.deviceTypeId)
        );

      if (articleTypeError) {
        return failure(articleTypeError.message || "No se pudieron validar los articulos del pase.");
      }

      const articleNameMap = new Map((articleTypes ?? []).map((item) => [item.id, item.name]));
      articleSummary = articlePayload
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

    let nextNumber: number | null = null;
    if (targetDate.cierre && canOperateClosedDate) {
      const existingPasses = await getListado({ fechaVisita: targetDate.fechaCompleta });
      const maxNumber = existingPasses.reduce(
        (current, item) => Math.max(current, item.numeroPase ?? 0),
        0
      );
      nextNumber = nextPassNumber(maxNumber);
    }

    const { data: insertedPass, error: insertError } = await supabase
      .from("listado")
      .insert({
        interno_id: internoId,
        fecha_id: targetDate.id,
        fecha_visita: targetDate.fechaCompleta,
        apartado: "618",
        status: "capturado",
        numero_pase: nextNumber,
        cierre_aplicado: false,
        menciones: canManageMentions(profile.roleKey) && mentions ? mentions : null,
        especiales:
          canManageMentions(profile.roleKey)
            ? appendDeviceSummaryToSpecials(specials, articleSummary)
            : null,
        created_by: profile.id
      })
      .select("id")
      .single();

    if (insertError || !insertedPass) {
      return failure(insertError?.message || "No se pudo crear el pase.");
    }

    const passId = insertedPass.id;

    const orderedVisitors = [...selectedVisitors].sort((a, b) => (b.edad ?? 0) - (a.edad ?? 0));
    const payload = orderedVisitors.map((visitor, index) => ({
      listado_id: passId,
      visita_id: visitor.id,
      orden: index + 1,
      validada: false
    }));

    const { error: relationInsertError } = await supabase.from("listado_visitas").insert(payload);
    if (relationInsertError) {
      return failure(
        relationInsertError.message || "El pase se creo, pero no se pudieron guardar sus visitas."
      );
    }

    if (articlePayload.length > 0) {
      const { data: articleTypes, error: articleTypeError } = await supabase
        .from("module_device_types")
        .select("id, module_key")
        .eq("active", true)
        .in(
          "id",
          articlePayload.map((item) => item.deviceTypeId)
        );

      if (articleTypeError || !articleTypes) {
        return failure(articleTypeError?.message || "No se pudieron validar los articulos del pase.");
      }

      const articleTypeMap = new Map(articleTypes.map((item) => [item.id, item]));
      const listingItemsPayload = articlePayload
        .map((item) => ({
          listado_id: passId,
          device_type_id: item.deviceTypeId,
          quantity: item.quantity
        }))
        .filter((item) => articleTypeMap.has(item.device_type_id));

      if (listingItemsPayload.length > 0) {
        const { error: listingItemsError } = await supabase
          .from("listing_device_items")
          .insert(listingItemsPayload);

        if (listingItemsError) {
          return failure(
            listingItemsError.message || "El pase se creo, pero no se pudieron guardar los articulos."
          );
        }

        const internalDevicePayload = articlePayload
          .map((item) => {
            const articleType = articleTypeMap.get(item.deviceTypeId);
            if (!articleType) {
              return null;
            }

            return {
              internal_id: internoId,
              module_key: articleType.module_key,
              device_type_id: item.deviceTypeId,
              source_listing_id: passId,
              quantity: item.quantity,
              assigned_manually: false,
              status: "pendiente",
              created_by: profile.id
            };
          })
          .filter(Boolean);

        if (internalDevicePayload.length > 0) {
          const { error: devicesError } = await supabase
            .from("internal_devices")
            .insert(internalDevicePayload);

          if (devicesError) {
            return failure(
              devicesError.message || "El pase se creo, pero no se pudieron registrar los articulos del interno."
            );
          }
        }
      }
    }

    revalidatePath("/sistema");
    revalidatePath("/sistema/internos");
    revalidatePath("/sistema/listado");
    revalidatePath("/sistema/visual");
    revalidatePath("/sistema/comunicacion");
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

    if (!name) {
      return failure("Debes escribir el nombre de la zona.");
    }

    if (!/^M\d+$/i.test(name)) {
      return failure("La zona debe tener formato M + numero, por ejemplo M8.");
    }

    const { error } = await supabase.from("zones").insert({
      name,
      created_by: profile.id
    });

    if (error) {
      return failure(error.message || "No se pudo guardar la zona.");
    }

    revalidatePath("/sistema/admin");
    return success("Zona guardada.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "No se pudo guardar la zona.");
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
    const zoneId = String(formData.get("zone_id") ?? "").trim();
    const chargeWeekday = Number(formData.get("charge_weekday") ?? 0);

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
    const zoneId = String(formData.get("zone_id") ?? "").trim() || null;
    const brand = String(formData.get("brand") ?? "").trim() || null;
    const model = String(formData.get("model") ?? "").trim() || null;
    const characteristics = String(formData.get("characteristics") ?? "").trim() || null;
    const imei = String(formData.get("imei") ?? "").trim() || null;
    const chipNumber = String(formData.get("chip_number") ?? "").trim() || null;
    const quantity = Number(formData.get("quantity") ?? 1);
    const camerasAllowed = String(formData.get("cameras_allowed") ?? "") === "on";
    const notes = String(formData.get("notes") ?? "").trim() || null;

    if (!internalId || !deviceTypeId) {
      return failure("Debes elegir el interno y el tipo de aparato.");
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

    const { error } = await supabase.from("internal_devices").insert({
      internal_id: internalId,
      module_key: selectedType.module_key,
      device_type_id: deviceTypeId,
      zone_id: zoneId,
      brand,
      model,
      characteristics,
      imei,
      chip_number: chipNumber,
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      cameras_allowed: camerasAllowed,
      assigned_manually: true,
      status: "pendiente",
      notes,
      created_by: profile.id
    });

    if (error) {
      return failure(error.message || "No se pudo asignar el aparato.");
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
        quantity
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
    const zoneId = String(formData.get("zone_id") ?? "").trim() || null;
    const amount = Number(formData.get("amount") ?? 0);
    const notes = String(formData.get("notes") ?? "").trim() || null;

    if (!internalDeviceId && !internalId) {
      return failure("Debes elegir un interno.");
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

    const allowedDeviceNames = getAllowedModuleDeviceNames(moduleKey as "visual" | "comunicacion" | "escaleras" | "rentas");
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

    const filteredTargetDevices = (targetDevices.data ?? []).filter((device) => {
      const deviceTypeRelation = device.module_device_types as
        | Array<{ name?: string }>
        | { name?: string }
        | null;
      const typeName = Array.isArray(deviceTypeRelation)
        ? deviceTypeRelation[0]?.name
        : deviceTypeRelation?.name;
      return !allowedDeviceNames || (typeName ? allowedDeviceNames.has(normalizeDeviceTypeName(typeName)) : false);
    });

    if (filteredTargetDevices.length === 0) {
      return failure("No se encontraron aparatos validos para este bloque.");
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

    const allowedDeviceNames = getAllowedModuleDeviceNames(moduleKey as "visual" | "comunicacion" | "escaleras" | "rentas");
    const { data: devices } = await supabase
      .from("internal_devices")
      .select("id, zone_id, status, module_device_types!inner(name)")
      .eq("module_key", moduleKey)
      .neq("status", "baja");

    const activeDeviceIds = (devices ?? [])
      .filter((item) => {
        const typeName = item.module_device_types?.[0]?.name;
        if (allowedDeviceNames && (!typeName || !allowedDeviceNames.has(normalizeDeviceTypeName(typeName)))) {
          return false;
        }

        return item.status === "activo";
      })
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
    if (!["super-admin", "escaleras"].includes(profile.roleKey)) {
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
    if (!["super-admin", "escaleras"].includes(profile.roleKey)) {
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

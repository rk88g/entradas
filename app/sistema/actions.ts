"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserProfile, getDateByValue, getListado, getOperatingDate } from "@/lib/supabase/queries";
import { MutationState } from "@/lib/types";
import { canChoosePassType, canManageMentions, nextPassNumber } from "@/lib/utils";

const initialState = { success: null, error: null };

function success(message: string): MutationState {
  return { success: message, error: null };
}

function failure(message: string): MutationState {
  return { success: null, error: message };
}

async function requireProfile() {
  const profile = await getCurrentUserProfile();
  if (!profile?.active) {
    throw new Error("Tu sesión no tiene un perfil activo.");
  }

  return profile;
}

export async function createDateAction(
  _prevState: MutationState,
  formData: FormData
): Promise<MutationState> {
  try {
    const profile = await requireProfile();
    const supabase = await createServerSupabaseClient();

    if (!["super-admin", "control", "supervisor"].includes(profile.roleKey)) {
      return failure("Tu rol no puede registrar fechas.");
    }

    const dateValue = String(formData.get("fecha_completa") ?? "").trim();
    const status = String(formData.get("estado") ?? "abierto").trim();

    if (!dateValue) {
      return failure("Debes seleccionar una fecha.");
    }

    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
      return failure("La fecha no es válida.");
    }

    const existing = await getDateByValue(dateValue);
    if (existing) {
      return failure("Esa fecha ya está registrada.");
    }

    if (status === "abierto") {
      await supabase
        .from("fechas")
        .update({ estado: "proximo" })
        .eq("estado", "abierto");
    }

    const { error } = await supabase.from("fechas").insert({
      dia: date.getDate(),
      mes: date.getMonth() + 1,
      anio: date.getFullYear(),
      fecha_completa: dateValue,
      cierre: false,
      estado: status,
      created_by: profile.id
    });

    if (error) {
      return failure("No se pudo registrar la nueva fecha.");
    }

    revalidatePath("/sistema");
    revalidatePath("/sistema/fechas");
    revalidatePath("/sistema/listado");
    return success("Fecha registrada correctamente.");
  } catch {
    return failure("Ocurrió un problema al registrar la fecha.");
  }
}

export async function closeDateAction(
  _prevState: MutationState,
  formData: FormData
): Promise<MutationState> {
  try {
    const profile = await requireProfile();
    if (!["super-admin", "control", "supervisor"].includes(profile.roleKey)) {
      return failure("Tu rol no puede cerrar la fecha.");
    }

    const dateValue = String(formData.get("fecha_completa") ?? "").trim();
    if (!dateValue) {
      return failure("No se encontró la fecha a cerrar.");
    }

    const supabase = await createServerSupabaseClient();
    const selectedDate = await getDateByValue(dateValue);
    if (!selectedDate) {
      return failure("La fecha ya no existe.");
    }

    const passes = await getListado({ fechaVisita: dateValue, area: "618" });
    const activePasses = passes
      .filter((item) => item.status !== "cancelado")
      .sort(
        (a, b) =>
          a.internoUbicacion - b.internoUbicacion || a.createdAt.localeCompare(b.createdAt)
      );

    let currentNumber = 0;
    for (const pass of activePasses) {
      currentNumber = nextPassNumber(currentNumber);
      const { error } = await supabase
        .from("listado")
        .update({
          numero_pase: currentNumber,
          cierre_aplicado: true
        })
        .eq("id", pass.id);

      if (error) {
        return failure("No se pudo aplicar la numeración de cierre.");
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
      return failure("No se pudo cerrar la fecha.");
    }

    revalidatePath("/sistema");
    revalidatePath("/sistema/fechas");
    revalidatePath("/sistema/listado");
    revalidatePath("/sistema/internos");
    return success("Fecha cerrada y pases 618 numerados correctamente.");
  } catch {
    return failure("Ocurrió un problema al cerrar la fecha.");
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
      return failure("No se pudo vincular la visita al interno.");
    }

    revalidatePath("/sistema/internos");
    revalidatePath("/sistema/listado");
    return success("Visita vinculada correctamente al interno.");
  } catch {
    return failure("Ocurrió un problema al vincular la visita.");
  }
}

export async function createPassAction(
  _prevState: MutationState,
  formData: FormData
): Promise<MutationState> {
  try {
    const profile = await requireProfile();
    const supabase = await createServerSupabaseClient();
    const operatingDate = await getOperatingDate();

    if (!operatingDate || operatingDate.estado !== "abierto") {
      return failure("No hay una fecha abierta para operar.");
    }

    const internoId = String(formData.get("interno_id") ?? "").trim();
    const visitorIds = formData.getAll("visitor_ids").map((item) => String(item));
    const requestedArea = String(formData.get("apartado") ?? "618").trim();
    const mentions = String(formData.get("menciones") ?? "").trim();
    const area =
      canChoosePassType(profile.roleKey) && (requestedArea === "INTIMA" || requestedArea === "618")
        ? requestedArea
        : "618";

    if (!internoId) {
      return failure("Debes seleccionar un interno.");
    }

    if (visitorIds.length === 0) {
      return failure("Debes elegir al menos una visita.");
    }

    if (mentions && !canManageMentions(profile.roleKey)) {
      return failure("Tu rol no puede capturar menciones.");
    }

    const { data: existingPass } = await supabase
      .from("listado")
      .select("id")
      .eq("interno_id", internoId)
      .eq("fecha_id", operatingDate.id)
      .neq("status", "cancelado")
      .maybeSingle();

    if (existingPass) {
      return failure("Ese interno ya tiene un pase registrado para la fecha en operación.");
    }

    const { data: relationRows, error: relationError } = await supabase
      .from("interno_visitas")
      .select("visita_id")
      .eq("interno_id", internoId)
      .in("visita_id", visitorIds);

    if (relationError) {
      return failure("No se pudieron validar las visitas disponibles para el interno.");
    }

    const allowedIds = new Set((relationRows ?? []).map((item) => item.visita_id));
    if (visitorIds.some((id) => !allowedIds.has(id))) {
      return failure("Una o más visitas no pertenecen al perfil del interno.");
    }

    const { data: selectedVisitors, error: visitorError } = await supabase
      .from("visitas")
      .select("id, edad, betada")
      .in("id", visitorIds);

    if (visitorError || !selectedVisitors) {
      return failure("No se pudieron validar las visitas seleccionadas.");
    }

    if (selectedVisitors.some((item) => item.betada)) {
      return failure("No puedes generar un pase con visitas betadas.");
    }

    const { data: insertedPass, error: insertError } = await supabase
      .from("listado")
      .insert({
        interno_id: internoId,
        fecha_id: operatingDate.id,
        fecha_visita: operatingDate.fechaCompleta,
        apartado: area,
        status: "capturado",
        numero_pase: null,
        cierre_aplicado: false,
        menciones: canManageMentions(profile.roleKey) && mentions ? mentions : null,
        created_by: profile.id
      })
      .select("id")
      .single();

    if (insertError || !insertedPass) {
      return failure("No se pudo crear el pase.");
    }

    const orderedVisitors = [...selectedVisitors].sort((a, b) => (b.edad ?? 0) - (a.edad ?? 0));
    const payload = orderedVisitors.map((visitor, index) => ({
      listado_id: insertedPass.id,
      visita_id: visitor.id,
      orden: index + 1,
      validada: false
    }));

    const { error: relationInsertError } = await supabase.from("listado_visitas").insert(payload);
    if (relationInsertError) {
      return failure("El pase se creó pero no se pudieron guardar sus visitas.");
    }

    revalidatePath("/sistema");
    revalidatePath("/sistema/internos");
    revalidatePath("/sistema/listado");
    return success("Pase creado correctamente.");
  } catch {
    return failure("Ocurrió un problema al generar el pase.");
  }
}

export const mutationInitialState: MutationState = initialState;

"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserProfile, getDateByValue, getListado, getOperatingDate } from "@/lib/supabase/queries";
import { MutationState } from "@/lib/types";
import { canChoosePassType, canManageMentions, nextPassNumber } from "@/lib/utils";

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

async function requireProfile() {
  const profile = await getCurrentUserProfile();
  if (!profile?.active) {
    throw new Error("Tu sesion no tiene un perfil activo.");
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
    const parsedDate = parseDateParts(dateValue);

    if (!parsedDate) {
      return failure("La fecha no es valida.");
    }

    const existing = await getDateByValue(dateValue);
    if (existing) {
      return failure("Esa fecha ya esta registrada.");
    }

    if (status === "abierto") {
      const { error: openError } = await supabase
        .from("fechas")
        .update({ estado: "proximo" })
        .eq("estado", "abierto");

      if (openError) {
        return failure(openError.message || "No se pudo preparar la fecha actual.");
      }
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
    if (profile.roleKey !== "control") {
      return failure("Tu rol no puede cerrar la fecha.");
    }

    const dateValue = String(formData.get("fecha_completa") ?? "").trim();
    if (!dateValue) {
      return failure("No se encontro la fecha.");
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
      ubicacion: Number(formData.get("ubicacion") ?? 0),
      telefono: String(formData.get("telefono") ?? "").trim() || null,
      ubi_filiacion: String(formData.get("ubi_filiacion") ?? "").trim() || "Sin dato",
      apartado: "618",
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

    const { error } = await supabase.from("internos").insert(payload);
    if (error) {
      return failure(error.message || "No se pudo guardar el interno.");
    }

    revalidatePath("/sistema");
    revalidatePath("/sistema/internos");
    revalidatePath("/sistema/listado");
    return success("Interno guardado.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "No se pudo guardar el interno.");
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
      telefono: String(formData.get("telefono") ?? "").trim() || null,
      betada: String(formData.get("betada") ?? "false") === "true",
      notas: String(formData.get("notas") ?? "").trim() || null,
      created_by: profile.id
    };

    const internalId = String(formData.get("interno_id") ?? "").trim();

    if (
      !visitorPayload.nombres ||
      !visitorPayload.apellido_pat ||
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

    revalidatePath("/sistema/listado");
    return success("Contraseña guardada.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "No se pudo guardar la contraseña.");
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

    if (mentions && area !== "INTIMA") {
      return failure("Las menciones solo aplican para pases sueltos.");
    }

    const { data: existingPass } = await supabase
      .from("listado")
      .select("id, status")
      .eq("interno_id", internoId)
      .eq("fecha_id", operatingDate.id)
      .neq("status", "cancelado")
      .maybeSingle();

    const canEditExisting =
      existingPass &&
      ["super-admin", "control"].includes(profile.roleKey) &&
      !operatingDate.cierre &&
      existingPass.status !== "impreso";

    if (existingPass && !canEditExisting) {
      return failure("Ese interno ya tiene pase para la fecha abierta.");
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
      return failure("Una o mas visitas no pertenecen al interno.");
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

    const listedVisitorCountFor618 = selectedVisitors.filter((item) => (item.edad ?? 0) >= 12).length;
    if (area === "618" && listedVisitorCountFor618 > 8) {
      return failure("El pase 618 solo permite 8 visitas visibles por pase.");
    }

    let passId = existingPass?.id ?? "";

    if (canEditExisting && existingPass) {
      const { error: resetError } = await supabase
        .from("listado_visitas")
        .delete()
        .eq("listado_id", existingPass.id);

      if (resetError) {
        return failure(resetError.message || "No se pudo limpiar el pase actual.");
      }

      const { error: updateError } = await supabase
        .from("listado")
        .update({
          apartado: area,
          menciones:
            area === "INTIMA" && canManageMentions(profile.roleKey) && mentions ? mentions : null,
          updated_at: new Date().toISOString()
        })
        .eq("id", existingPass.id);

      if (updateError) {
        return failure(updateError.message || "No se pudo actualizar el pase.");
      }

      passId = existingPass.id;
    } else {
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
          menciones:
            area === "INTIMA" && canManageMentions(profile.roleKey) && mentions ? mentions : null,
          created_by: profile.id
        })
        .select("id")
        .single();

      if (insertError || !insertedPass) {
        return failure(insertError?.message || "No se pudo crear el pase.");
      }

      passId = insertedPass.id;
    }

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

    revalidatePath("/sistema");
    revalidatePath("/sistema/internos");
    revalidatePath("/sistema/listado");
    return success(canEditExisting ? "Pase actualizado." : "Pase creado.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "No se pudo crear el pase.");
  }
}

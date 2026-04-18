import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  BetadaRecord,
  DateRecord,
  InternalRecord,
  ListingRecord,
  RoleKey,
  UserProfile,
  VisitorRecord
} from "@/lib/types";
import { fullNameFromParts, getStatsFromListings, sortVisitorsByAge } from "@/lib/utils";

function ensureRoleKey(value?: string | null): RoleKey {
  if (value === "super-admin" || value === "control" || value === "supervisor") {
    return value;
  }

  return "capturador";
}

export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id, full_name, role_id, active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return null;
  }

  const { data: role, error: roleError } = await supabase
    .from("roles")
    .select("key, name")
    .eq("id", profile.role_id)
    .maybeSingle();

  if (roleError || !role) {
    return null;
  }

  return {
    id: profile.id,
    email: user.email ?? "",
    fullName: profile.full_name ?? user.email ?? "Usuario",
    roleKey: ensureRoleKey(role.key),
    roleName: role.name,
    active: Boolean(profile.active)
  };
}

export async function getInternos(): Promise<InternalRecord[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("internos")
    .select(
      `
        id,
        expediente,
        nombres,
        apellido_pat,
        apellido_mat,
        nacimiento,
        llego,
        libre,
        ubicacion,
        ubi_filiacion,
        apartado,
        observaciones,
        created_at,
        updated_at
      `
    )
    .order("updated_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((item) => ({
    id: item.id,
    fullName: fullNameFromParts(item.nombres, item.apellido_pat, item.apellido_mat),
    nombres: item.nombres,
    apellidoPat: item.apellido_pat,
    apellidoMat: item.apellido_mat ?? "",
    nacimiento: item.nacimiento,
    llego: item.llego,
    libre: item.libre ?? "",
    ubicacion: item.ubicacion,
    ubiFiliacion: item.ubi_filiacion,
    clasificacion: item.apartado,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    expediente: item.expediente,
    observaciones: item.observaciones ?? undefined
  }));
}

export async function getVisitas(): Promise<VisitorRecord[]> {
  const supabase = await createServerSupabaseClient();

  const [{ data: visitas, error: visitasError }, { data: historial }] = await Promise.all([
    supabase
      .from("visitas")
      .select(
        `
          id,
          nombres,
          apellido_pat,
          apellido_mat,
          fecha_nacimiento,
          edad,
          menor,
          parentesco,
          betada,
          telefono,
          created_at,
          updated_at
        `
      )
      .order("updated_at", { ascending: false }),
    supabase
      .from("historial_ingresos")
      .select("visita_id, interno_nombre")
  ]);

  if (visitasError || !visitas) {
    return [];
  }

  const historyMap = new Map<string, string[]>();

  (historial ?? []).forEach((item) => {
    if (!item.visita_id || !item.interno_nombre) {
      return;
    }

    const current = historyMap.get(item.visita_id) ?? [];
    if (!current.includes(item.interno_nombre)) {
      current.push(item.interno_nombre);
      historyMap.set(item.visita_id, current);
    }
  });

  return sortVisitorsByAge(
    visitas.map((item) => ({
      id: item.id,
      fullName: fullNameFromParts(item.nombres, item.apellido_pat, item.apellido_mat),
      nombres: item.nombres,
      apellidoPat: item.apellido_pat,
      apellidoMat: item.apellido_mat ?? "",
      fechaNacimiento: item.fecha_nacimiento,
      edad: item.edad ?? 0,
      menor: Boolean(item.menor),
      parentesco: item.parentesco,
      betada: Boolean(item.betada),
      historialInterno: historyMap.get(item.id) ?? [],
      telefono: item.telefono ?? undefined,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }))
  );
}

export async function getBetadas(): Promise<BetadaRecord[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("betadas")
    .select(
      `
        id,
        nombres,
        apellido_pat,
        apellido_mat,
        fecha_nacimiento,
        motivo,
        activo,
        created_at
      `
    )
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((item) => ({
    id: item.id,
    fullName: fullNameFromParts(item.nombres, item.apellido_pat, item.apellido_mat),
    nombres: item.nombres,
    apellidoPat: item.apellido_pat,
    apellidoMat: item.apellido_mat ?? "",
    fechaNacimiento: item.fecha_nacimiento ?? undefined,
    motivo: item.motivo,
    activo: Boolean(item.activo),
    createdAt: item.created_at
  }));
}

export async function getFechas(): Promise<DateRecord[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("fechas")
    .select("id, dia, mes, anio, fecha_completa, cierre, estado")
    .order("fecha_completa", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map((item) => ({
    id: item.id,
    dia: item.dia,
    mes: item.mes,
    anio: item.anio,
    fechaCompleta: item.fecha_completa,
    cierre: Boolean(item.cierre),
    estado: item.estado
  }));
}

export async function getListado(): Promise<ListingRecord[]> {
  const supabase = await createServerSupabaseClient();
  const { data: listadoRows, error: listadoError } = await supabase
    .from("listado")
    .select("id, interno_id, fecha_visita, apartado, status, menciones")
    .order("fecha_visita", { ascending: true });

  if (listadoError || !listadoRows) {
    return [];
  }

  const internoIds = [...new Set(listadoRows.map((item) => item.interno_id))];

  const [
    { data: internosRows, error: internosError },
    { data: listadoVisitasRows, error: listadoVisitasError }
  ] = await Promise.all([
    internoIds.length
      ? supabase
          .from("internos")
          .select("id, nombres, apellido_pat, apellido_mat")
          .in("id", internoIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("listado_visitas")
      .select("listado_id, visita_id, orden")
      .in(
        "listado_id",
        listadoRows.map((item) => item.id)
      )
  ]);

  if (internosError || listadoVisitasError) {
    return [];
  }

  const visitaIds = [...new Set((listadoVisitasRows ?? []).map((item) => item.visita_id))];

  const { data: visitasRows, error: visitasError } = visitaIds.length
    ? await supabase
        .from("visitas")
        .select("id, nombres, apellido_pat, apellido_mat, parentesco, edad, menor, betada")
        .in("id", visitaIds)
    : { data: [], error: null };

  if (visitasError) {
    return [];
  }

  const internosMap = new Map(
    (internosRows ?? []).map((item) => [
      item.id,
      fullNameFromParts(item.nombres, item.apellido_pat, item.apellido_mat)
    ])
  );

  const visitasMap = new Map((visitasRows ?? []).map((item) => [item.id, item]));
  const listadoVisitasMap = new Map<string, typeof listadoVisitasRows>();

  (listadoVisitasRows ?? []).forEach((item) => {
    const current = listadoVisitasMap.get(item.listado_id) ?? [];
    current.push(item);
    listadoVisitasMap.set(item.listado_id, current);
  });

  return listadoRows.map((item) => {
    const visitors = (listadoVisitasMap.get(item.id) ?? [])
      .sort((a, b) => a.orden - b.orden)
      .map((relation) => {
        const visitor = visitasMap.get(relation.visita_id);
        if (!visitor) {
          return null;
        }

        return {
          visitorId: visitor.id,
          nombre: fullNameFromParts(visitor.nombres, visitor.apellido_pat, visitor.apellido_mat),
          parentesco: visitor.parentesco,
          edad: visitor.edad ?? 0,
          menor: Boolean(visitor.menor),
          betada: Boolean(visitor.betada)
        };
      })
      .filter((visitor): visitor is NonNullable<typeof visitor> => visitor !== null);

    return {
      id: item.id,
      internoId: item.interno_id,
      internoNombre: internosMap.get(item.interno_id) ?? "Interno sin nombre",
      fechaVisita: item.fecha_visita,
      area: item.apartado,
      createdByRole: "capturador",
      status: item.status,
      menciones: item.menciones ?? undefined,
      visitantes: sortVisitorsByAge(visitors)
    };
  });
}

export async function getDashboardSummary() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = tomorrow.toISOString().slice(0, 10);

  const [listado, visitas, betadas, fechas] = await Promise.all([
    getListado(),
    getVisitas(),
    getBetadas(),
    getFechas()
  ]);

  const tomorrowListings = listado.filter((item) => item.fechaVisita === tomorrowDate);
  const listingStats = getStatsFromListings(listado);

  return {
    tomorrowDate,
    totalTomorrowPasses: tomorrowListings.length,
    totalTomorrowVisitors: tomorrowListings.reduce((sum, item) => sum + item.visitantes.length, 0),
    totalBetadas: betadas.filter((item) => item.activo).length,
    nextOpenDate: fechas.find((item) => item.estado === "abierto") ?? null,
    listingStats,
    activeVisitors: visitas.filter((item) => !item.betada).length
  };
}

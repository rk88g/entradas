import "server-only";

import { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  BetadaRecord,
  DateRecord,
  InternalProfile,
  InternalRecord,
  InternalVisitorLink,
  ListingBuilderData,
  ListingRecord,
  PassVisitor,
  RoleKey,
  UserProfile,
  VisitorHistoryEntry,
  VisitorRecord,
  VisitorSex
} from "@/lib/types";
import {
  fullNameFromParts,
  getAgeFromDate,
  getStatsFromListings,
  getTodayDate,
  getTomorrowDate,
  sortVisitorsByAge
} from "@/lib/utils";

function ensureRoleKey(value?: string | null): RoleKey {
  if (value === "super-admin" || value === "control" || value === "supervisor") {
    return value;
  }

  return "capturador";
}

function ensureSex(value?: string | null): VisitorSex {
  if (value === "hombre" || value === "mujer") {
    return value;
  }

  return "sin-definir";
}

function mapInternalRecord(item: {
  id: string;
  expediente: string;
  nombres: string;
  apellido_pat: string;
  apellido_mat: string | null;
  nacimiento: string;
  llego: string;
  libre: string | null;
  ubicacion: number;
  telefono: string | null;
  ubi_filiacion: string;
  apartado: "618" | "INTIMA";
  observaciones: string | null;
  created_at: string;
  updated_at: string;
}): InternalRecord {
  return {
    id: item.id,
    fullName: fullNameFromParts(item.nombres, item.apellido_pat, item.apellido_mat),
    nombres: item.nombres,
    apellidoPat: item.apellido_pat,
    apellidoMat: item.apellido_mat ?? "",
    nacimiento: item.nacimiento,
    edad: getAgeFromDate(item.nacimiento),
    llego: item.llego,
    libre: item.libre ?? "",
    ubicacion: item.ubicacion,
    telefono: item.telefono ?? "",
    ubiFiliacion: item.ubi_filiacion,
    clasificacion: item.apartado,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    expediente: item.expediente,
    observaciones: item.observaciones ?? undefined
  };
}

function mapVisitorRecord(
  item: {
    id: string;
    nombres: string;
    apellido_pat: string;
    apellido_mat: string | null;
    fecha_nacimiento: string;
    edad: number | null;
    menor: boolean | null;
    sexo: string | null;
    parentesco: string;
    betada: boolean | null;
    telefono: string | null;
    created_at: string;
    updated_at: string;
  },
  historialInterno: string[] = [],
  historial: VisitorHistoryEntry[] = []
): VisitorRecord {
  return {
    id: item.id,
    fullName: fullNameFromParts(item.nombres, item.apellido_pat, item.apellido_mat),
    nombres: item.nombres,
    apellidoPat: item.apellido_pat,
    apellidoMat: item.apellido_mat ?? "",
    fechaNacimiento: item.fecha_nacimiento,
    edad: item.edad ?? 0,
    menor: Boolean(item.menor),
    sexo: ensureSex(item.sexo),
    parentesco: item.parentesco,
    betada: Boolean(item.betada),
    historialInterno,
    historial,
    telefono: item.telefono ?? undefined,
    createdAt: item.created_at,
    updatedAt: item.updated_at
  };
}

async function getVisitorHistoryData(supabase: SupabaseClient) {
  const [{ data: visitHistory }, { data: transferHistory }, { data: internals }] = await Promise.all([
    supabase.from("historial_ingresos").select("listado_id, visita_id, interno_nombre, fecha_visita"),
    supabase.from("visita_interno_historial").select("id, visita_id, interno_id, created_at"),
    supabase.from("internos").select("id, nombres, apellido_pat, apellido_mat")
  ]);
  const historyMap = new Map<string, string[]>();
  const detailedHistoryMap = new Map<string, VisitorHistoryEntry[]>();
  const internalNameMap = new Map(
    (internals ?? []).map((item) => [
      item.id,
      fullNameFromParts(item.nombres, item.apellido_pat, item.apellido_mat)
    ])
  );

  (visitHistory ?? []).forEach((item) => {
    if (!item.visita_id || !item.interno_nombre) {
      return;
    }

    const current = historyMap.get(item.visita_id) ?? [];
    if (!current.includes(item.interno_nombre)) {
      current.push(item.interno_nombre);
      historyMap.set(item.visita_id, current);
    }

    const historyEntries = detailedHistoryMap.get(item.visita_id) ?? [];
    historyEntries.push({
      id: item.listado_id,
      internalName: item.interno_nombre,
      date: item.fecha_visita,
      type: "visita"
    });
    detailedHistoryMap.set(item.visita_id, historyEntries);
  });

  (transferHistory ?? []).forEach((item) => {
    const name = internalNameMap.get(item.interno_id);
    if (!item.visita_id || !name) {
      return;
    }

    const current = historyMap.get(item.visita_id) ?? [];
    if (!current.includes(name)) {
      current.push(name);
      historyMap.set(item.visita_id, current);
    }

    const historyEntries = detailedHistoryMap.get(item.visita_id) ?? [];
    historyEntries.push({
      id: item.id,
      internalName: name,
      date: item.created_at,
      type: "reasignacion"
    });
    detailedHistoryMap.set(item.visita_id, historyEntries);
  });

  detailedHistoryMap.forEach((entries, visitorId) => {
    detailedHistoryMap.set(
      visitorId,
      [...entries].sort((a, b) => b.date.localeCompare(a.date))
    );
  });

  return { historyMap, detailedHistoryMap };
}

async function getInternosMap(
  supabase: SupabaseClient,
  internalIds: string[]
): Promise<Map<string, InternalRecord>> {
  if (internalIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("internos")
    .select(
      "id, expediente, nombres, apellido_pat, apellido_mat, nacimiento, llego, libre, ubicacion, telefono, ubi_filiacion, apartado, observaciones, created_at, updated_at"
    )
    .in("id", internalIds);

  if (error || !data) {
    return new Map();
  }

  return new Map(data.map((item) => [item.id, mapInternalRecord(item)]));
}

async function getVisitorsMap(
  supabase: SupabaseClient,
  visitorIds: string[]
): Promise<Map<string, VisitorRecord>> {
  if (visitorIds.length === 0) {
    return new Map();
  }

  const [{ historyMap, detailedHistoryMap }, { data, error }] = await Promise.all([
    getVisitorHistoryData(supabase),
    supabase
      .from("visitas")
      .select(
        "id, nombres, apellido_pat, apellido_mat, fecha_nacimiento, edad, menor, sexo, parentesco, betada, telefono, created_at, updated_at"
      )
      .in("id", visitorIds)
  ]);

  if (error || !data) {
    return new Map();
  }

  return new Map(
    data.map((item) => [
      item.id,
      mapVisitorRecord(
        item,
        historyMap.get(item.id) ?? [],
        detailedHistoryMap.get(item.id) ?? []
      )
    ])
  );
}

async function buildListingsForRows(
  supabase: SupabaseClient,
  listadoRows: Array<{
    id: string;
    interno_id: string;
    fecha_id: string;
    fecha_visita: string;
    apartado: "618" | "INTIMA";
    status: "capturado" | "autorizado" | "impreso" | "cancelado";
    numero_pase: number | null;
    cierre_aplicado: boolean | null;
    menciones: string | null;
    created_at: string;
  }>
): Promise<ListingRecord[]> {
  if (listadoRows.length === 0) {
    return [];
  }

  const internalIds = [...new Set(listadoRows.map((item) => item.interno_id))];
  const [internosMap, { data: listadoVisitasRows, error: listadoVisitasError }] = await Promise.all([
    getInternosMap(supabase, internalIds),
    supabase
      .from("listado_visitas")
      .select("listado_id, visita_id, orden")
      .in(
        "listado_id",
        listadoRows.map((item) => item.id)
      )
  ]);

  if (listadoVisitasError) {
    return [];
  }

  const visitorIds = [...new Set((listadoVisitasRows ?? []).map((item) => item.visita_id))];
  const visitorsMap = await getVisitorsMap(supabase, visitorIds);
  const relationMap = new Map<string, typeof listadoVisitasRows>();

  (listadoVisitasRows ?? []).forEach((item) => {
    const current = relationMap.get(item.listado_id) ?? [];
    current.push(item);
    relationMap.set(item.listado_id, current);
  });

  return listadoRows.map((item) => {
    const interno = internosMap.get(item.interno_id);
    const visitantes: PassVisitor[] = sortVisitorsByAge(
      (relationMap.get(item.id) ?? [])
        .sort((a, b) => a.orden - b.orden)
        .map((relation) => {
          const visitor = visitorsMap.get(relation.visita_id);
          if (!visitor) {
            return null;
          }

          return {
            visitorId: visitor.id,
            nombre: visitor.fullName,
            parentesco: visitor.parentesco,
            edad: visitor.edad,
            menor: visitor.menor,
            sexo: visitor.sexo,
            betada: visitor.betada
          };
        })
        .filter((visitor): visitor is PassVisitor => visitor !== null)
    );

    return {
      id: item.id,
      internoId: item.interno_id,
      internoNombre: interno?.fullName ?? "Interno sin nombre",
      internoUbicacion: interno?.ubicacion ?? 0,
      fechaId: item.fecha_id,
      fechaVisita: item.fecha_visita,
      area: item.apartado,
      createdByRole: "capturador",
      status: item.status,
      numeroPase: item.numero_pase,
      cierreAplicado: Boolean(item.cierre_aplicado),
      menciones: item.menciones ?? undefined,
      createdAt: item.created_at,
      visitantes
    };
  });
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
      "id, expediente, nombres, apellido_pat, apellido_mat, nacimiento, llego, libre, ubicacion, telefono, ubi_filiacion, apartado, observaciones, created_at, updated_at"
    )
    .order("ubicacion", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map(mapInternalRecord);
}

export async function getVisitas(): Promise<VisitorRecord[]> {
  const supabase = await createServerSupabaseClient();
  const { historyMap, detailedHistoryMap } = await getVisitorHistoryData(supabase);
  const [{ data, error }, { data: currentRelations, error: relationError }, internals] = await Promise.all([
    supabase
      .from("visitas")
      .select(
        "id, nombres, apellido_pat, apellido_mat, fecha_nacimiento, edad, menor, sexo, parentesco, betada, telefono, created_at, updated_at"
      )
      .order("updated_at", { ascending: false }),
    supabase
      .from("interno_visitas")
      .select("visita_id, interno_id"),
    getInternos()
  ]);

  if (error || !data) {
    return [];
  }

  const internalMap = new Map(internals.map((internal) => [internal.id, internal]));
  const currentRelationMap = new Map<string, { internoId: string; internoName: string }>();
  if (!relationError) {
    (currentRelations ?? []).forEach((item) => {
      const interno = internalMap.get(item.interno_id);
      if (!interno) {
        return;
      }

      currentRelationMap.set(item.visita_id, {
        internoId: item.interno_id,
        internoName: interno.fullName
      });
    });
  }

  return sortVisitorsByAge(
    data.map((item) => {
      const currentRelation = currentRelationMap.get(item.id);
      return {
        ...mapVisitorRecord(
          item,
          historyMap.get(item.id) ?? [],
          detailedHistoryMap.get(item.id) ?? []
        ),
        currentInternalId: currentRelation?.internoId,
        currentInternalName: currentRelation?.internoName
      };
    })
  );
}

export async function getBetadas(): Promise<BetadaRecord[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("betadas")
    .select(
      "id, nombres, apellido_pat, apellido_mat, fecha_nacimiento, motivo, activo, created_at"
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
    .select("id, dia, mes, anio, fecha_completa, cierre, estado, created_at, updated_at")
    .order("fecha_completa", { ascending: false });

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
    estado: item.estado,
    createdAt: item.created_at,
    updatedAt: item.updated_at
  }));
}

export async function getOpenDate(): Promise<DateRecord | null> {
  const fechas = await getFechas();
  return fechas.find((item) => item.estado === "abierto") ?? null;
}

export async function getNextDate(): Promise<DateRecord | null> {
  const fechas = await getFechas();
  return fechas.find((item) => item.estado === "proximo") ?? null;
}

export async function getOperatingDate(): Promise<DateRecord | null> {
  return getOpenDate();
}

export async function getDateByValue(dateValue: string): Promise<DateRecord | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("fechas")
    .select("id, dia, mes, anio, fecha_completa, cierre, estado, created_at, updated_at")
    .eq("fecha_completa", dateValue)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    dia: data.dia,
    mes: data.mes,
    anio: data.anio,
    fechaCompleta: data.fecha_completa,
    cierre: Boolean(data.cierre),
    estado: data.estado,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
}

export async function getListado(filters?: {
  fechaVisita?: string;
  area?: "618" | "INTIMA";
}): Promise<ListingRecord[]> {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("listado")
    .select(
      "id, interno_id, fecha_id, fecha_visita, apartado, status, numero_pase, cierre_aplicado, menciones, created_at"
    )
    .order("fecha_visita", { ascending: true })
    .order("created_at", { ascending: true });

  if (filters?.fechaVisita) {
    query = query.eq("fecha_visita", filters.fechaVisita);
  }

  if (filters?.area) {
    query = query.eq("apartado", filters.area);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  return buildListingsForRows(supabase, data);
}

export async function getInternalProfiles(options?: {
  nextDateValue?: string | null;
  openDateValue?: string | null;
}): Promise<InternalProfile[]> {
  const supabase = await createServerSupabaseClient();
  const [internos, nextDate, openDate] = await Promise.all([
    getInternos(),
    options?.nextDateValue ? getDateByValue(options.nextDateValue) : getNextDate(),
    options?.openDateValue ? getDateByValue(options.openDateValue) : getOpenDate()
  ]);

  const internalIds = internos.map((item) => item.id);
  const [nextDatePasses, openDatePasses] = await Promise.all([
    nextDate ? getListado({ fechaVisita: nextDate.fechaCompleta, area: "618" }) : Promise.resolve([]),
    openDate ? getListado({ fechaVisita: openDate.fechaCompleta, area: "INTIMA" }) : Promise.resolve([])
  ]);

  const [{ data: relationRows, error: relationError }, allListingsForRecent] =
    await Promise.all([
      internalIds.length
        ? supabase
            .from("interno_visitas")
            .select("id, interno_id, visita_id, parentesco, titular")
            .in("interno_id", internalIds)
        : Promise.resolve({ data: [], error: null }),
      getListado()
    ]);

  if (relationError) {
    return internos.map((interno) => ({
      ...interno,
      visitors: [],
      nextDatePass: null,
      openDatePass: null,
      recentPasses: []
    }));
  }

  const visitorIds = [...new Set((relationRows ?? []).map((item) => item.visita_id))];
  const visitorsMap = await getVisitorsMap(supabase, visitorIds);
  const relationMap = new Map<string, InternalVisitorLink[]>();

  (relationRows ?? []).forEach((item) => {
    const visitor = visitorsMap.get(item.visita_id);
    if (!visitor) {
      return;
    }

    const current = relationMap.get(item.interno_id) ?? [];
    current.push({
      id: item.id,
      internoId: item.interno_id,
      visitaId: item.visita_id,
      parentesco: item.parentesco ?? visitor.parentesco,
      titular: Boolean(item.titular),
      visitor
    });
    relationMap.set(item.interno_id, current);
  });

  const nextPassMap = new Map(nextDatePasses.map((item) => [item.internoId, item]));
  const openPassMap = new Map(openDatePasses.map((item) => [item.internoId, item]));
  const recentPassMap = new Map<string, ListingRecord[]>();

  allListingsForRecent.forEach((item) => {
    const current = recentPassMap.get(item.internoId) ?? [];
    if (current.length < 5) {
      current.push(item);
      recentPassMap.set(item.internoId, current);
    }
  });

  return internos.map((interno) => ({
    ...interno,
    visitors: [...(relationMap.get(interno.id) ?? [])].sort(
      (a, b) => b.visitor.edad - a.visitor.edad
    ) as InternalVisitorLink[],
    nextDatePass: nextPassMap.get(interno.id) ?? null,
    openDatePass: openPassMap.get(interno.id) ?? null,
    recentPasses: recentPassMap.get(interno.id) ?? []
  }));
}

export async function getListingBuilderData(): Promise<ListingBuilderData> {
  const [openDate, nextDate] = await Promise.all([getOpenDate(), getNextDate()]);
  const [closePasswordConfigured, internalProfiles, todaysPasses] = await Promise.all([
    getClosePasswordConfigured(),
    getInternalProfiles({
      nextDateValue: nextDate?.fechaCompleta,
      openDateValue: openDate?.fechaCompleta
    }),
    getListado({ fechaVisita: getTodayDate() })
  ]);

  return {
    openDate,
    nextDate,
    internalProfiles,
    todaysPasses,
    closePasswordConfigured
  };
}

export async function getClosePasswordConfigured() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("app_settings")
    .select("key")
    .eq("key", "close_password")
    .maybeSingle();

  return Boolean(data);
}

export async function getDashboardSummary() {
  const tomorrowDate = getTomorrowDate();

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

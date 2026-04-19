import "server-only";

import { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  AccessStatus,
  BetadaRecord,
  DateRecord,
  InternalProfile,
  InternalRecord,
  InternalDeviceRecord,
  InternalVisitorLink,
  ListingBuilderData,
  ListingRecord,
  ModuleDeviceType,
  ModuleFinanceSummary,
  ModuleKey,
  ModulePanelData,
  ModulePriceRecord,
  ModuleStaffAssignment,
  ModuleZone,
  ModuleWorkerRecord,
  PassVisitor,
  RoleKey,
  UserProfile,
  VisitorHistoryEntry,
  VisitorRecord,
  VisitorSex
} from "@/lib/types";
import {
  compareInternalLocations,
  fullNameFromParts,
  getAgeFromDate,
  getModuleDisplayName,
  getStatsFromListings,
  getTodayDate,
  getWeekRange,
  getWeekRangeFromCutoff,
  sortVisitorsByAge
} from "@/lib/utils";

function ensureRoleKey(value?: string | null): RoleKey {
  if (
    value === "super-admin" ||
    value === "control" ||
    value === "supervisor" ||
    value === "visual" ||
    value === "comunicacion"
  ) {
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

function ensureModuleKey(value?: string | null): ModuleKey {
  if (value === "visual" || value === "comunicacion") {
    return value;
  }

  return "rentas";
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
  ubicacion: string | number;
  telefono: string | null;
  ubi_filiacion: string;
  laborando: boolean | null;
  estatus: string;
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
    ubicacion: String(item.ubicacion),
    telefono: item.telefono ?? "",
    estatus: item.estatus ?? "activo",
    laborando: Boolean(item.laborando),
    ubiFiliacion: item.ubi_filiacion,
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
    telefono: item.telefono ?? "No aplica",
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
      "id, expediente, nombres, apellido_pat, apellido_mat, nacimiento, llego, libre, ubicacion, telefono, ubi_filiacion, laborando, estatus, observaciones, created_at, updated_at"
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
    especiales: string | null;
    created_at: string;
  }>
): Promise<ListingRecord[]> {
  if (listadoRows.length === 0) {
    return [];
  }

  const internalIds = [...new Set(listadoRows.map((item) => item.interno_id))];
  const [internosMap, { data: listadoVisitasRows, error: listadoVisitasError }, { data: deviceItemRows }] = await Promise.all([
    getInternosMap(supabase, internalIds),
    supabase
      .from("listado_visitas")
      .select("listado_id, visita_id, orden")
      .in(
        "listado_id",
        listadoRows.map((item) => item.id)
      ),
    supabase
      .from("listing_device_items")
      .select("id, listado_id, quantity, device_type_id, module_device_types!inner(id, module_key, name)")
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
  const deviceMap = new Map<string, Array<{
    id: string;
    quantity: number;
    device_type_id: string;
    module_device_types: Array<{ id: string; module_key: string; name: string }>;
  }>>();

  (listadoVisitasRows ?? []).forEach((item) => {
    const current = relationMap.get(item.listado_id) ?? [];
    current.push(item);
    relationMap.set(item.listado_id, current);
  });

  (deviceItemRows ?? []).forEach((item) => {
    const current = deviceMap.get(item.listado_id) ?? [];
    current.push(item);
    deviceMap.set(item.listado_id, current);
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
      internoUbicacion: interno?.ubicacion ?? "",
      fechaId: item.fecha_id,
      fechaVisita: item.fecha_visita,
      area: item.apartado,
      createdByRole: "capturador",
      status: item.status,
      numeroPase: item.numero_pase,
      cierreAplicado: Boolean(item.cierre_aplicado),
      menciones: item.menciones ?? undefined,
      especiales: item.especiales ?? undefined,
      createdAt: item.created_at,
      visitantes,
      deviceItems: (deviceMap.get(item.id) ?? [])
        .map((device) => {
          const deviceType = device.module_device_types?.[0];
          if (!deviceType) {
            return null;
          }

          return {
            id: device.id,
            deviceTypeId: device.device_type_id,
            moduleKey: ensureModuleKey(deviceType.module_key),
            name: deviceType.name,
            quantity: device.quantity
          };
        })
        .filter((item): item is ListingRecord["deviceItems"][number] => item !== null)
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
    .select("id, full_name, role_id, active, module_only")
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

  const { data: workers } = await supabase
    .from("module_workers")
    .select("id, module_key, active")
    .eq("user_profile_id", profile.id)
    .eq("active", true);

  const workerIds = (workers ?? []).map((item) => item.id);
  const { data: permissions } = workerIds.length
    ? await supabase
        .from("module_worker_permissions")
        .select("worker_id, function_key")
        .in("worker_id", workerIds)
    : { data: [] as Array<{ worker_id: string; function_key: string }> };

  const accessibleModules = (workers ?? []).map((worker) => ({
    moduleKey: ensureModuleKey(worker.module_key),
    moduleName: getModuleDisplayName(ensureModuleKey(worker.module_key)),
    functions: (permissions ?? [])
      .filter((permission) => permission.worker_id === worker.id)
      .map((permission) => permission.function_key) as UserProfile["accessibleModules"][number]["functions"]
  }));

  return {
    id: profile.id,
    email: user.email ?? "",
    fullName: profile.full_name ?? user.email ?? "Usuario",
    roleKey: ensureRoleKey(role.key),
    roleName: role.name,
    active: Boolean(profile.active),
    moduleOnly: Boolean(profile.module_only),
    accessibleModules
  };
}

export async function getInternos(includeAll = false): Promise<InternalRecord[]> {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("internos")
    .select(
      "id, expediente, nombres, apellido_pat, apellido_mat, nacimiento, llego, libre, ubicacion, telefono, ubi_filiacion, laborando, estatus, observaciones, created_at, updated_at"
    )
    .order("created_at", { ascending: false });

  if (!includeAll) {
    query = query.neq("estatus", "150");
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  return data.map(mapInternalRecord).sort((a, b) => compareInternalLocations(a.ubicacion, b.ubicacion));
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
    getInternos(true)
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
      "id, interno_id, fecha_id, fecha_visita, apartado, status, numero_pase, cierre_aplicado, menciones, especiales, created_at"
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
  includeInactive?: boolean;
}): Promise<InternalProfile[]> {
  const supabase = await createServerSupabaseClient();
  const [internos, nextDate, openDate] = await Promise.all([
    getInternos(options?.includeInactive ?? false),
    options?.nextDateValue ? getDateByValue(options.nextDateValue) : getNextDate(),
    options?.openDateValue ? getDateByValue(options.openDateValue) : getOpenDate()
  ]);

  const internalIds = internos.map((item) => item.id);
  const [nextDatePasses, openDatePasses] = await Promise.all([
    nextDate ? getListado({ fechaVisita: nextDate.fechaCompleta }) : Promise.resolve([]),
    openDate ? getListado({ fechaVisita: openDate.fechaCompleta }) : Promise.resolve([])
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

export async function getListingBuilderData(includeInactive = false): Promise<ListingBuilderData> {
  const [openDate, nextDate] = await Promise.all([getOpenDate(), getNextDate()]);
  const [closePasswordConfigured, internalProfiles, todaysPasses, passArticles] = await Promise.all([
    getClosePasswordConfigured(),
    getInternalProfiles({
      nextDateValue: nextDate?.fechaCompleta,
      openDateValue: openDate?.fechaCompleta,
      includeInactive
    }),
    getListado({ fechaVisita: getTodayDate() }),
    getPassDeviceTypes()
  ]);

  return {
    openDate,
    nextDate,
    printDate: openDate,
    internalProfiles,
    todaysPasses,
    closePasswordConfigured,
    passArticles
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

export async function getPassDeviceTypes(): Promise<ModuleDeviceType[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("module_device_types")
    .select("id, module_key, key, name, sort_order, requires_imei, requires_chip, allow_cameras_flag")
    .eq("active", true)
    .order("name", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map((item) => ({
    id: item.id,
    moduleKey: ensureModuleKey(item.module_key),
    key: item.key,
    name: item.name,
    sortOrder: item.sort_order,
    requiresImei: Boolean(item.requires_imei),
    requiresChip: Boolean(item.requires_chip),
    allowCamerasFlag: Boolean(item.allow_cameras_flag)
  }));
}

export async function getModulePanelData(moduleKey: ModuleKey, includeInactiveInternals = false): Promise<ModulePanelData> {
  const supabase = await createServerSupabaseClient();
  const moduleName = getModuleDisplayName(moduleKey);
  const { data: settingsSeed } = await supabase
    .from("module_settings")
    .select("cutoff_weekday")
    .eq("module_key", moduleKey)
    .maybeSingle();
  const cutoffWeekday = settingsSeed?.cutoff_weekday ?? 1;
  const { start, end } = getWeekRangeFromCutoff(cutoffWeekday);

  const [
    internals,
    deviceTypesResponse,
    zonesResponse,
    pricesResponse,
    devicesResponse,
    workersResponse,
    permissionsResponse,
    cyclesResponse,
    paymentsResponse,
    userProfilesResponse,
    staffAssignmentsResponse
  ] = await Promise.all([
    getInternos(includeInactiveInternals),
    supabase
      .from("module_device_types")
      .select("id, module_key, key, name, sort_order, requires_imei, requires_chip, allow_cameras_flag")
      .eq("module_key", moduleKey)
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("module_zones")
      .select("id, module_key, name, charge_weekday, active")
      .eq("module_key", moduleKey)
      .order("name", { ascending: true }),
    supabase
      .from("module_prices")
      .select("id, module_key, device_type_id, weekly_price, discount_amount, active, module_device_types!inner(name)")
      .eq("module_key", moduleKey),
    supabase
      .from("internal_devices")
      .select(
        "id, internal_id, module_key, device_type_id, zone_id, brand, model, characteristics, imei, chip_number, cameras_allowed, quantity, status, paid_through, weekly_price_override, discount_override, assigned_manually, notes, module_device_types!inner(name), module_zones(name)"
      )
      .eq("module_key", moduleKey)
      .neq("status", "baja")
      .order("created_at", { ascending: false }),
    supabase
      .from("module_workers")
      .select("id, user_profile_id, module_key, active")
      .eq("module_key", moduleKey),
    supabase
      .from("module_worker_permissions")
      .select("worker_id, function_key"),
    supabase
      .from("device_payment_cycles")
      .select("id, closed, week_start, week_end")
      .eq("module_key", moduleKey)
      .eq("week_start", start)
      .eq("week_end", end)
      .maybeSingle(),
    supabase
      .from("device_payments")
      .select("id, internal_device_id, zone_id, amount, status, cycle_id")
      .eq("module_key", moduleKey),
    supabase
      .from("user_profiles")
      .select("id, full_name, roles!inner(key)")
      .eq("active", true),
    supabase
      .from("module_internal_staff")
      .select("id, module_key, internal_id, user_profile_id, position_key")
      .eq("module_key", moduleKey)
  ]);

  const deviceTypes: ModuleDeviceType[] = (deviceTypesResponse.data ?? []).map((item) => ({
    id: item.id,
    moduleKey: ensureModuleKey(item.module_key),
    key: item.key,
    name: item.name,
    sortOrder: item.sort_order,
    requiresImei: Boolean(item.requires_imei),
    requiresChip: Boolean(item.requires_chip),
    allowCamerasFlag: Boolean(item.allow_cameras_flag)
  }));

  const zones: ModuleZone[] = (zonesResponse.data ?? []).map((item) => ({
    id: item.id,
    moduleKey: ensureModuleKey(item.module_key),
    name: item.name,
    chargeWeekday: item.charge_weekday,
    active: Boolean(item.active)
  }));

  const prices: ModulePriceRecord[] = (pricesResponse.data ?? []).map((item) => ({
    id: item.id,
    moduleKey: ensureModuleKey(item.module_key),
    deviceTypeId: item.device_type_id,
    deviceTypeName: item.module_device_types?.[0]?.name ?? "Aparato",
    weeklyPrice: Number(item.weekly_price ?? 0),
    discountAmount: Number(item.discount_amount ?? 0),
    active: Boolean(item.active)
  }));

  const internalMap = new Map(internals.map((item) => [item.id, item]));
  const zoneMap = new Map(zones.map((item) => [item.id, item]));
  const cycleId = cyclesResponse.data?.id ?? null;
  const paymentMap = new Map(
    (paymentsResponse.data ?? [])
      .filter((item) => !cycleId || item.cycle_id === cycleId)
      .map((item) => [item.internal_device_id, item])
  );

  const devices: InternalDeviceRecord[] = (devicesResponse.data ?? []).map((item) => {
    const internal = internalMap.get(item.internal_id);
    const zone = item.zone_id ? zoneMap.get(item.zone_id) : undefined;
    return {
      id: item.id,
      internalId: item.internal_id,
      internalName: internal?.fullName ?? "Interno sin nombre",
      internalLocation: internal?.ubicacion ?? "",
      moduleKey: ensureModuleKey(item.module_key),
      deviceTypeId: item.device_type_id,
      deviceTypeName: item.module_device_types?.[0]?.name ?? "Aparato",
      zoneId: item.zone_id ?? undefined,
      zoneName: zone?.name ?? item.module_zones?.[0]?.name ?? undefined,
      brand: item.brand ?? undefined,
      model: item.model ?? undefined,
      characteristics: item.characteristics ?? undefined,
      imei: item.imei ?? undefined,
      chipNumber: item.chip_number ?? undefined,
      camerasAllowed: Boolean(item.cameras_allowed),
      quantity: item.quantity ?? 1,
      status: item.status,
      paidThrough: item.paid_through ?? undefined,
      weeklyPriceOverride: item.weekly_price_override ?? undefined,
      discountOverride: item.discount_override ?? undefined,
      assignedManually: Boolean(item.assigned_manually),
      notes: item.notes ?? undefined
    };
  });

  const userMap = new Map(
    (userProfilesResponse.data ?? []).map((item) => [item.id, item.full_name ?? "Usuario"])
  );
  const staffAssignments: ModuleStaffAssignment[] = (staffAssignmentsResponse.data ?? []).map((item) => ({
    id: item.id,
    moduleKey: ensureModuleKey(item.module_key),
    internalId: item.internal_id,
    internalName: internalMap.get(item.internal_id)?.fullName ?? "Interno",
    userId: item.user_profile_id,
    userName: userMap.get(item.user_profile_id) ?? "Usuario",
    positionKey: item.position_key as ModuleStaffAssignment["positionKey"]
  }));

  const workers: ModuleWorkerRecord[] = (workersResponse.data ?? []).map((item) => ({
    id: item.id,
    userId: item.user_profile_id,
    fullName: userMap.get(item.user_profile_id) ?? "Usuario",
    email: "",
    moduleKey: ensureModuleKey(item.module_key),
    functions: (permissionsResponse.data ?? [])
      .filter((permission) => permission.worker_id === item.id)
      .map((permission) => permission.function_key) as ModuleWorkerRecord["functions"],
    active: Boolean(item.active)
  }));

  const unpaidDevices = devices.filter((device) => {
    const payment = paymentMap.get(device.id);
    if (device.status !== "activo") {
      return false;
    }

    return !payment || payment.status !== "pagado";
  });

  const paidDevices = devices.filter((device) => {
    const payment = paymentMap.get(device.id);
    return Boolean(payment && payment.status === "pagado");
  });

  const totalsByZoneMap = new Map<string, ModuleFinanceSummary>();
  devices.forEach((device) => {
    const zoneId = device.zoneId ?? "sin-zona";
    const zoneName = device.zoneName ?? "Sin zona";
    const payment = paymentMap.get(device.id);
    const current = totalsByZoneMap.get(zoneId) ?? {
      zoneId: zoneId === "sin-zona" ? null : zoneId,
      zoneName,
      totalPaid: 0,
      paidCount: 0,
      pendingCount: 0
    };

    if (payment && payment.status === "pagado") {
      current.totalPaid += Number(payment.amount ?? 0);
      current.paidCount += 1;
    } else {
      current.pendingCount += 1;
    }

    totalsByZoneMap.set(zoneId, current);
  });

  return {
    moduleKey,
    moduleName,
    deviceTypes,
    zones,
    prices,
    devices,
    workers,
    unpaidDevices,
    paidDevices,
    totalsByZone: [...totalsByZoneMap.values()].sort((a, b) => a.zoneName.localeCompare(b.zoneName)),
    totalIncome: [...totalsByZoneMap.values()].reduce((sum, item) => sum + item.totalPaid, 0),
    currentWeekLabel: `${start} al ${end}`,
    weekClosed: Boolean(cyclesResponse.data?.closed),
    currentCycleId: cyclesResponse.data?.id,
    cutoffWeekday,
    assignableUsers: (userProfilesResponse.data ?? [])
      .filter((item) => item.roles?.[0]?.key === moduleKey)
      .map((item) => ({
        id: item.id,
        fullName: item.full_name ?? "Usuario"
      })),
    staffAssignments
  };
}

export async function getDashboardSummary() {
  const [listado, visitas, betadas, fechas, openDate, nextDate] = await Promise.all([
    getListado(),
    getVisitas(),
    getBetadas(),
    getFechas(),
    getOpenDate(),
    getNextDate()
  ]);

  const openListings = openDate
    ? listado.filter((item) => item.fechaVisita === openDate.fechaCompleta)
    : [];
  const waitingListings = nextDate
    ? listado.filter((item) => item.fechaVisita === nextDate.fechaCompleta)
    : [];
  const relevantListings = [...openListings, ...waitingListings];
  const listingStats = getStatsFromListings(relevantListings);

  return {
    openDate,
    nextDate,
    openPassCount: openListings.length,
    waitingPassCount: waitingListings.length,
    totalTomorrowPasses: relevantListings.length,
    totalTomorrowVisitors: relevantListings.reduce((sum, item) => sum + item.visitantes.length, 0),
    totalBetadas: betadas.filter((item) => item.activo).length,
    nextOpenDate: fechas.find((item) => item.estado === "abierto" && !item.cierre) ?? null,
    listingStats,
    activeVisitors: visitas.filter((item) => !item.betada).length
  };
}

export async function getIntegratedModuleCounts() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("internal_devices")
    .select("module_key")
    .neq("status", "baja");

  if (error || !data) {
    return {
      visual: 0,
      comunicacion: 0
    };
  }

  return data.reduce(
    (acc, item) => {
      const moduleKey = ensureModuleKey(item.module_key);
      if (moduleKey === "visual" || moduleKey === "comunicacion") {
        acc[moduleKey] += 1;
      }
      return acc;
    },
    { visual: 0, comunicacion: 0 }
  );
}

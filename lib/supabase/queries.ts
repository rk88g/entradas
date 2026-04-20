import "server-only";

import { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  AdminUserRecord,
  AccessStatus,
  ActionAuditRecord,
  BetadaRecord,
  ConnectionLogRecord,
  DateRecord,
  EscaleraAuthorizedDevice,
  EscaleraManualItem,
  EscaleraRecord,
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
  ModuleChargeRoute,
  ModuleStaffAssignment,
  ModuleWorkerRecord,
  DangerZoneConfigData,
  InternalEquipmentMovementRecord,
  InternalFineRecord,
  InternalNoteRecord,
  InternalSeizureRecord,
  InternalWeeklyPaymentRecord,
  PassVisitor,
  RoleKey,
  UserProfile,
  VisitorHistoryEntry,
  ZoneRecord,
  VisitorRecord,
  VisitorSex,
  WorkplacePositionRecord,
  WorkplaceRecord
} from "@/lib/types";
import {
  compareInternalLocations,
  fullNameFromParts,
  getAgeFromDate,
  getAllowedModuleDeviceNames,
  getModuleDisplayName,
  normalizeDeviceTypeName,
  getStatsFromListings,
  getTodayDate,
  getWeekRangeFromCutoff,
  sortVisitorsByAge
} from "@/lib/utils";

function getFirstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? value[0] ?? null : value;
}

function ensureRoleKey(value?: string | null): RoleKey {
  if (
    value === "super-admin" ||
    value === "control" ||
    value === "supervisor" ||
    value === "visual" ||
    value === "comunicacion" ||
    value === "escaleras"
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
  if (value === "visual" || value === "comunicacion" || value === "escaleras") {
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
    nombreCompleto: string;
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
    fullName: item.nombreCompleto,
    nombreCompleto: item.nombreCompleto,
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
        "id, \"nombreCompleto\", fecha_nacimiento, edad, menor, sexo, parentesco, betada, telefono, created_at, updated_at"
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

  const directRoleModuleKey =
    role.key === "visual" || role.key === "comunicacion" || role.key === "escaleras"
      ? ensureModuleKey(role.key)
      : null;

  if (
    directRoleModuleKey &&
    !accessibleModules.some((item) => item.moduleKey === directRoleModuleKey)
  ) {
    accessibleModules.push({
      moduleKey: directRoleModuleKey,
      moduleName: getModuleDisplayName(directRoleModuleKey),
      functions: ["encargado", "altas", "cobranza"]
    });
  }

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
    );

  if (!includeAll) {
    query = query.eq("estatus", "activo");
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
        "id, \"nombreCompleto\", fecha_nacimiento, edad, menor, sexo, parentesco, betada, telefono, created_at, updated_at"
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

  const [
    { data: relationRows, error: relationError },
    allListingsForRecent,
    { data: deviceRows },
    { data: paymentRows },
    { data: staffRows },
    { data: workplaceRows },
    { data: noteRows },
    { data: fineRows },
    { data: seizureRows },
    { data: movementRows },
    escaleraHistory
  ] =
      await Promise.all([
        internalIds.length
          ? supabase
              .from("interno_visitas")
              .select("id, interno_id, visita_id, parentesco, titular")
              .in("interno_id", internalIds)
          : Promise.resolve({ data: [], error: null }),
        getListado()
        ,
        internalIds.length
          ? supabase
              .from("internal_devices")
      .select(
        "id, internal_id, module_key, device_type_id, zone_id, brand, model, characteristics, imei, chip_number, cameras_allowed, quantity, status, paid_through, weekly_price_override, discount_override, assigned_manually, notes, module_device_types!inner(name,module_key), zones(name)"
      )
              .in("internal_id", internalIds)
              .neq("status", "baja")
          : Promise.resolve({ data: [] }),
        internalIds.length
          ? supabase
              .from("device_payments")
              .select(
                "id, amount, status, paid_at, notes, internal_devices!inner(internal_id, module_key, module_device_types!inner(name,module_key))"
              )
              .in("internal_devices.internal_id", internalIds)
          : Promise.resolve({ data: [] }),
        internalIds.length
          ? supabase
              .from("module_internal_staff")
              .select("id, module_key, internal_id, user_profile_id, position_key, user_profiles!inner(full_name)")
              .in("internal_id", internalIds)
          : Promise.resolve({ data: [] }),
        internalIds.length
          ? supabase
              .from("workplace_positions")
              .select("id, title, salary, assigned_internal_id, active, workplaces!inner(id, name, type)")
              .in("assigned_internal_id", internalIds)
          : Promise.resolve({ data: [] }),
        internalIds.length
          ? supabase
              .from("internal_log_notes")
              .select("id, internal_id, source_module, title, notes, created_at")
              .in("internal_id", internalIds)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] }),
        internalIds.length
          ? supabase
              .from("internal_fines")
              .select("id, internal_id, concept, amount, status, created_at")
              .in("internal_id", internalIds)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] }),
        internalIds.length
          ? supabase
              .from("internal_seizures")
              .select("id, internal_id, concept, status, notes, created_at")
              .in("internal_id", internalIds)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] }),
        internalIds.length
          ? supabase
              .from("internal_equipment_movements")
              .select("id, internal_id, movement_type, description, amount, created_at")
              .in("internal_id", internalIds)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] }),
        getEscalerasPanelData(options?.includeInactive ?? false)
      ]);

  if (relationError) {
    return internos.map((interno) => ({
      ...interno,
      visitors: [],
      nextDatePass: null,
      openDatePass: null,
      recentPasses: [],
      devices: [],
      weeklyPayments: [],
      escalerasHistory: [],
      notes: [],
      staffAssignments: [],
      workplaceAssignments: [],
      equipmentMovements: [],
      fines: [],
      seizures: []
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
  const deviceMap = new Map<string, InternalProfile["devices"]>();
  const paymentMap = new Map<string, InternalWeeklyPaymentRecord[]>();
  const staffMap = new Map<string, ModuleStaffAssignment[]>();
  const noteMap = new Map<string, InternalNoteRecord[]>();
  const fineMap = new Map<string, InternalFineRecord[]>();
  const seizureMap = new Map<string, InternalSeizureRecord[]>();
  const movementMap = new Map<string, InternalEquipmentMovementRecord[]>();
  const escaleraMap = new Map<string, InternalProfile["escalerasHistory"]>();
  const workplaceMap = new Map<string, WorkplacePositionRecord[]>();

  allListingsForRecent.forEach((item) => {
    const current = recentPassMap.get(item.internoId) ?? [];
    if (current.length < 5) {
      current.push(item);
      recentPassMap.set(item.internoId, current);
    }
  });

  (deviceRows ?? []).forEach((item) => {
    const current = deviceMap.get(item.internal_id) ?? [];
    current.push({
      id: item.id,
      internalId: item.internal_id,
      internalName: internos.find((interno) => interno.id === item.internal_id)?.fullName ?? "Interno",
      internalLocation: internos.find((interno) => interno.id === item.internal_id)?.ubicacion ?? "",
      moduleKey: ensureModuleKey(getFirstRelation(item.module_device_types)?.module_key ?? item.module_key),
      deviceTypeId: item.device_type_id,
      deviceTypeName: getFirstRelation(item.module_device_types)?.name ?? "Aparato",
      zoneId: item.zone_id ?? undefined,
      zoneName: getFirstRelation(item.zones)?.name ?? undefined,
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
    });
    deviceMap.set(item.internal_id, current);
  });

  (paymentRows ?? []).forEach((item) => {
    const internalDevice = getFirstRelation(item.internal_devices);
    const internalId = internalDevice?.internal_id;
    if (!internalId) {
      return;
    }
    const current = paymentMap.get(internalId) ?? [];
    current.push({
      id: item.id,
      moduleKey: ensureModuleKey(getFirstRelation(internalDevice?.module_device_types)?.module_key ?? internalDevice?.module_key),
      amount: Number(item.amount ?? 0),
      status: item.status,
      paidAt: item.paid_at ?? null,
      notes: item.notes ?? null,
      deviceTypeName: getFirstRelation(internalDevice?.module_device_types)?.name ?? "Aparato"
    });
    paymentMap.set(internalId, current);
  });

  (staffRows ?? []).forEach((item) => {
    const current = staffMap.get(item.internal_id) ?? [];
    current.push({
      id: item.id,
      moduleKey: ensureModuleKey(item.module_key),
      internalId: item.internal_id,
      internalName: internos.find((interno) => interno.id === item.internal_id)?.fullName ?? "Interno",
      userId: item.user_profile_id,
      userName: getFirstRelation(item.user_profiles)?.full_name ?? "Usuario",
      positionKey: item.position_key as ModuleStaffAssignment["positionKey"]
    });
    staffMap.set(item.internal_id, current);
  });

  (workplaceRows ?? []).forEach((item) => {
    const assignedInternalId = item.assigned_internal_id;
    const workplace = getFirstRelation(item.workplaces);
    if (!assignedInternalId || !workplace) {
      return;
    }

    const current = workplaceMap.get(assignedInternalId) ?? [];
    current.push({
      id: item.id,
      workplaceId: workplace.id,
      workplaceName: workplace.name,
      workplaceType: workplace.type,
      title: item.title,
      salary: Number(item.salary ?? 0),
      assignedInternalId,
      assignedInternalName: internos.find((interno) => interno.id === assignedInternalId)?.fullName ?? "Interno",
      active: Boolean(item.active)
    });
    workplaceMap.set(assignedInternalId, current);
  });

  (noteRows ?? []).forEach((item) => {
    const current = noteMap.get(item.internal_id) ?? [];
    current.push({
      id: item.id,
      sourceModule: item.source_module,
      title: item.title,
      notes: item.notes,
      createdAt: item.created_at
    });
    noteMap.set(item.internal_id, current);
  });

  (fineRows ?? []).forEach((item) => {
    const current = fineMap.get(item.internal_id) ?? [];
    current.push({
      id: item.id,
      concept: item.concept,
      amount: Number(item.amount ?? 0),
      status: item.status,
      createdAt: item.created_at
    });
    fineMap.set(item.internal_id, current);
  });

  (seizureRows ?? []).forEach((item) => {
    const current = seizureMap.get(item.internal_id) ?? [];
    current.push({
      id: item.id,
      concept: item.concept,
      status: item.status,
      notes: item.notes ?? undefined,
      createdAt: item.created_at
    });
    seizureMap.set(item.internal_id, current);
  });

  (movementRows ?? []).forEach((item) => {
    const current = movementMap.get(item.internal_id) ?? [];
    current.push({
      id: item.id,
      movementType: item.movement_type,
      description: item.description,
      amount: item.amount ?? null,
      createdAt: item.created_at
    });
    movementMap.set(item.internal_id, current);
  });

  escaleraHistory.forEach((item) => {
    const current = escaleraMap.get(item.internalId) ?? [];
    current.push(item);
    escaleraMap.set(item.internalId, current);
  });

  return internos.map((interno) => ({
      ...interno,
      visitors: [...(relationMap.get(interno.id) ?? [])].sort(
        (a, b) => b.visitor.edad - a.visitor.edad
      ) as InternalVisitorLink[],
      nextDatePass: nextPassMap.get(interno.id) ?? null,
      openDatePass: openPassMap.get(interno.id) ?? null,
      recentPasses: recentPassMap.get(interno.id) ?? [],
      devices: (deviceMap.get(interno.id) ?? []).sort((a, b) => a.deviceTypeName.localeCompare(b.deviceTypeName)),
      weeklyPayments: paymentMap.get(interno.id) ?? [],
      escalerasHistory: escaleraMap.get(interno.id) ?? [],
      notes: noteMap.get(interno.id) ?? [],
      staffAssignments: staffMap.get(interno.id) ?? [],
      workplaceAssignments: workplaceMap.get(interno.id) ?? [],
      equipmentMovements: movementMap.get(interno.id) ?? [],
      fines: fineMap.get(interno.id) ?? [],
      seizures: seizureMap.get(interno.id) ?? []
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
  const [{ data: globalCutoff }, { data: settingsSeed }] = await Promise.all([
    supabase.from("app_settings").select("value").eq("key", "global_cutoff_weekday").maybeSingle(),
    supabase.from("module_settings").select("cutoff_weekday").eq("module_key", moduleKey).maybeSingle()
  ]);
  const cutoffWeekday = Number(globalCutoff?.value ?? settingsSeed?.cutoff_weekday ?? 1);
  const { start, end } = getWeekRangeFromCutoff(cutoffWeekday);

  const [
    internals,
    deviceTypesResponse,
    zonesResponse,
    chargeRoutesResponse,
    pricesResponse,
    devicesResponse,
    workersResponse,
    permissionsResponse,
    cyclesResponse,
    paymentsResponse,
    userProfilesResponse,
    rolesResponse,
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
      .from("zones")
      .select("id, name, active")
      .order("name", { ascending: true }),
    supabase
      .from("module_charge_routes")
      .select("id, module_key, zone_id, charge_weekday, active, zones!inner(name)")
      .eq("module_key", moduleKey)
      .order("charge_weekday", { ascending: true }),
    supabase
      .from("module_prices")
      .select("id, module_key, device_type_id, weekly_price, activation_price, fine_price, maintenance_price, retention_price, discount_amount, active, module_device_types!inner(name)")
      .eq("module_key", moduleKey),
    supabase
      .from("internal_devices")
      .select(
        "id, internal_id, module_key, device_type_id, zone_id, brand, model, characteristics, imei, chip_number, cameras_allowed, quantity, status, paid_through, weekly_price_override, discount_override, assigned_manually, notes, module_device_types!inner(name,module_key), zones(name)"
      )
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
      .select("id, full_name, role_id")
      .eq("active", true),
    supabase
      .from("roles")
      .select("id, key"),
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
  const allowedDeviceNames = getAllowedModuleDeviceNames(moduleKey);
  const visibleDeviceTypes = allowedDeviceNames
    ? deviceTypes.filter((item) => allowedDeviceNames.has(normalizeDeviceTypeName(item.name)))
    : deviceTypes;
  const visibleDeviceTypeIds = new Set(visibleDeviceTypes.map((item) => item.id));

  const zones: ZoneRecord[] = (zonesResponse.data ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    active: Boolean(item.active)
  }));

  const chargeRoutes: ModuleChargeRoute[] = (chargeRoutesResponse.data ?? []).map((item) => ({
    id: item.id,
    moduleKey: ensureModuleKey(item.module_key),
    zoneId: item.zone_id,
    zoneName: getFirstRelation(item.zones)?.name ?? "Zona",
    chargeWeekday: item.charge_weekday,
    active: Boolean(item.active)
  }));

  const prices: ModulePriceRecord[] = (pricesResponse.data ?? []).map((item) => ({
    id: item.id,
    moduleKey: ensureModuleKey(item.module_key),
    deviceTypeId: item.device_type_id,
    deviceTypeName: getFirstRelation(item.module_device_types)?.name ?? "Aparato",
    weeklyPrice: Number(item.weekly_price ?? 0),
    activationPrice: Number(item.activation_price ?? 0),
    finePrice: Number(item.fine_price ?? 0),
    maintenancePrice: Number(item.maintenance_price ?? 0),
    retentionPrice: Number(item.retention_price ?? 0),
    discountAmount: Number(item.discount_amount ?? 0),
    active: Boolean(item.active)
  }));

  const internalMap = new Map(internals.map((item) => [item.id, item]));
  const zoneMap = new Map(zones.map((item) => [item.id, item]));
  const visibleZones = zones.filter((item) => item.active);
  const cycleId = cyclesResponse.data?.id ?? null;
  const paymentMap = new Map(
    (paymentsResponse.data ?? [])
      .filter((item) => !cycleId || item.cycle_id === cycleId)
      .map((item) => [item.internal_device_id, item])
  );

  const devices: InternalDeviceRecord[] = (devicesResponse.data ?? [])
    .map((item) => {
      const internal = internalMap.get(item.internal_id);
      const zone = item.zone_id ? zoneMap.get(item.zone_id) : undefined;
      const typeRelation = getFirstRelation(item.module_device_types);
      return {
        id: item.id,
        internalId: item.internal_id,
        internalName: internal?.fullName ?? "Interno sin nombre",
        internalLocation: internal?.ubicacion ?? "",
        moduleKey: ensureModuleKey(typeRelation?.module_key ?? item.module_key),
        deviceTypeId: item.device_type_id,
        deviceTypeName: typeRelation?.name ?? "Aparato",
        zoneId: item.zone_id ?? undefined,
        zoneName: zone?.name ?? getFirstRelation(item.zones)?.name ?? undefined,
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
    })
    .filter((item) => item.moduleKey === moduleKey && visibleDeviceTypeIds.has(item.deviceTypeId));

  const userMap = new Map(
    (userProfilesResponse.data ?? []).map((item) => [item.id, item.full_name ?? "Usuario"])
  );
  const roleMap = new Map((rolesResponse.data ?? []).map((item) => [item.id, item.key]));
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
  const pendingDevices = devices.filter((device) => device.status === "pendiente");

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
    deviceTypes: visibleDeviceTypes,
    zones: visibleZones,
    chargeRoutes,
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
      .filter((item) => roleMap.get(item.role_id) === moduleKey)
      .map((item) => ({
        id: item.id,
        fullName: item.full_name ?? "Usuario"
      })),
    staffAssignments,
    pendingDevices
  };
}

export async function getEscalerasPanelData(includeInactiveInternals = false): Promise<EscaleraRecord[]> {
  const supabase = await createServerSupabaseClient();
  const today = getTodayDate();
  const [internals, passes] = await Promise.all([
    getInternos(includeInactiveInternals),
    getListado({ fechaVisita: today })
  ]);

  const relevantPasses = passes.filter(
    (item) => item.menciones?.trim() || item.especiales?.trim() || item.deviceItems.length > 0
  );

  if (relevantPasses.length === 0) {
    return [];
  }

  const internalMap = new Map(internals.map((item) => [item.id, item]));
  const passIds = relevantPasses.map((item) => item.id);
  const internalIds = [...new Set(relevantPasses.map((item) => item.internoId))];

  const [{ data: entryRows }, { data: authorizedDeviceRows }] = await Promise.all([
    supabase
      .from("escalera_entries")
      .select("id, listado_id, internal_id, fecha_visita, off8_aplica, off8_type, off8_percent, off8_value, ticket_amount, status, comentarios, retenciones, confirmed_at, paid_at, paid_amount")
      .in("listado_id", passIds),
    supabase
      .from("internal_devices")
      .select("id, internal_id, quantity, brand, model, module_key, module_device_types!inner(name,module_key)")
      .in("internal_id", internalIds)
      .neq("status", "baja")
  ]);
  const escaleraEntryIds = (entryRows ?? []).map((item) => item.id);
  const itemRows = escaleraEntryIds.length
    ? (
        await supabase
          .from("escalera_entry_items")
          .select("id, escalera_entry_id, description, quantity, unit_label, weight_kg, liters, notes")
          .in("escalera_entry_id", escaleraEntryIds)
      ).data ?? []
    : [];

  const entryMap = new Map((entryRows ?? []).map((item) => [item.listado_id, item]));
  const manualItemsMap = new Map<string, EscaleraManualItem[]>();
  (itemRows ?? []).forEach((item) => {
    const current = manualItemsMap.get(item.escalera_entry_id) ?? [];
    current.push({
      id: item.id,
      escaleraEntryId: item.escalera_entry_id,
      description: item.description,
      quantity: item.quantity ?? 1,
      unitLabel: item.unit_label ?? undefined,
      weightKg: item.weight_kg ?? undefined,
      liters: item.liters ?? undefined,
      notes: item.notes ?? undefined
    });
    manualItemsMap.set(item.escalera_entry_id, current);
  });

  const authorizedDevicesMap = new Map<string, EscaleraAuthorizedDevice[]>();
  (authorizedDeviceRows ?? []).forEach((item) => {
    const resolvedModuleKey = ensureModuleKey(item.module_device_types?.[0]?.module_key ?? item.module_key);
    if (resolvedModuleKey !== "visual" && resolvedModuleKey !== "comunicacion") {
      return;
    }

    const current = authorizedDevicesMap.get(item.internal_id) ?? [];
    current.push({
      id: item.id,
      name: item.module_device_types?.[0]?.name ?? "Aparato",
      quantity: item.quantity ?? 1,
      moduleKey: resolvedModuleKey,
      brand: item.brand ?? undefined,
      model: item.model ?? undefined
    });
    authorizedDevicesMap.set(item.internal_id, current);
  });

  const records = relevantPasses
    .map((pass): EscaleraRecord | null => {
      const internal = internalMap.get(pass.internoId);
      if (!internal) {
        return null;
      }

      const entry = entryMap.get(pass.id);
      return {
        id: entry?.id ?? `pending-${pass.id}`,
        listadoId: pass.id,
        internalId: pass.internoId,
        internalName: pass.internoNombre,
        internalLocation: pass.internoUbicacion,
        laborando: internal.laborando,
        fechaVisita: pass.fechaVisita,
        off8Aplica: Boolean(entry?.off8_aplica),
        off8Type: (entry?.off8_type as EscaleraRecord["off8Type"]) ?? null,
        off8Percent: entry?.off8_percent ?? null,
        off8Value: entry?.off8_value ?? null,
        ticketAmount: entry?.ticket_amount ?? null,
        status: (entry?.status as EscaleraRecord["status"]) ?? "pendiente",
        comments: entry?.comentarios ?? undefined,
        retentions: entry?.retenciones ?? undefined,
        basicRequest: pass.menciones ?? undefined,
        specialRequest: pass.especiales ?? undefined,
        passDeviceItems: pass.deviceItems,
        authorizedDevices: authorizedDevicesMap.get(pass.internoId) ?? [],
        manualItems: entry ? manualItemsMap.get(entry.id) ?? [] : []
      };
    })
    .filter((item): item is EscaleraRecord => item !== null);

  return records.sort((a, b) => compareInternalLocations(a.internalLocation, b.internalLocation));
}

export async function getAduanaPanelData(includeInactiveInternals = false): Promise<EscaleraRecord[]> {
  const records = await getEscalerasPanelData(includeInactiveInternals);
  return records
    .filter((item) => item.status === "enviado" || item.status === "pagado")
    .sort((a, b) => compareInternalLocations(a.internalLocation, b.internalLocation));
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
    .select("module_key, module_device_types!inner(name,module_key)")
    .neq("status", "baja");

  if (error || !data) {
    return {
      visual: 0,
      comunicacion: 0
    };
  }

  return data.reduce(
    (acc, item) => {
      const relation = getFirstRelation(item.module_device_types);
      const moduleKey = ensureModuleKey(relation?.module_key ?? item.module_key);
      const allowedNames = getAllowedModuleDeviceNames(moduleKey);
      const typeName = relation?.name;
      if (
        (moduleKey === "visual" || moduleKey === "comunicacion") &&
        (!allowedNames || (typeName ? allowedNames.has(normalizeDeviceTypeName(typeName)) : false))
      ) {
        acc[moduleKey] += 1;
      }
      return acc;
    },
    { visual: 0, comunicacion: 0 }
  );
}

export async function getAdminPanelData() {
  const supabase = await createServerSupabaseClient();
  const [
    connectionLogsResponse,
    auditLogsResponse,
    profilesResponse,
    rolesResponse,
    settingsResponse,
    zonesResponse,
    chargeRoutesResponse,
    pricesResponse,
    deviceTypesResponse,
    workplacesResponse,
    workplacePositionsResponse,
    internals
  ] = await Promise.all([
    supabase
      .from("connection_logs")
      .select("id, user_profile_id, email, success, failure_reason, ip_address, user_agent, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("action_audit_logs")
      .select("id, user_profile_id, module_key, section_key, action_key, entity_type, entity_id, before_data, after_data, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("user_profiles")
      .select("id, full_name, active, role_id")
      .order("full_name", { ascending: true }),
    supabase.from("roles").select("id, key"),
    supabase.from("app_settings").select("key, value"),
    supabase
      .from("zones")
      .select("id, name, active")
      .order("name", { ascending: true }),
    supabase
      .from("module_charge_routes")
      .select("id, module_key, zone_id, charge_weekday, active, zones!inner(name)")
      .order("module_key", { ascending: true })
      .order("charge_weekday", { ascending: true }),
    supabase
      .from("module_prices")
      .select(
        "id, module_key, device_type_id, weekly_price, activation_price, fine_price, maintenance_price, retention_price, discount_amount, active, module_device_types!inner(name)"
      )
      .order("module_key", { ascending: true }),
    supabase
      .from("module_device_types")
      .select("id, module_key, key, name, sort_order, requires_imei, requires_chip, allow_cameras_flag")
      .eq("active", true)
      .order("module_key", { ascending: true })
      .order("sort_order", { ascending: true }),
    supabase
      .from("workplaces")
      .select("id, name, type, active")
      .order("type", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("workplace_positions")
      .select("id, title, salary, assigned_internal_id, active, workplaces!inner(id, name, type)")
      .order("title", { ascending: true }),
    getInternos(true)
  ]);

  const roleMap = new Map((rolesResponse.data ?? []).map((item) => [item.id, item.key]));
  const profileIds = [
    ...new Set([
      ...(connectionLogsResponse.data ?? []).map((item) => item.user_profile_id).filter(Boolean),
      ...(auditLogsResponse.data ?? []).map((item) => item.user_profile_id).filter(Boolean)
    ])
  ] as string[];
  const profilesMap = new Map(
    (profilesResponse.data ?? []).map((item) => [
      item.id,
      {
        fullName: item.full_name ?? "Usuario",
        roleKey: roleMap.get(item.role_id) ?? "capturador",
        active: Boolean(item.active)
      }
    ])
  );
  const namesMap = new Map(
    (profilesResponse.data ?? []).map((item) => [item.id, item.full_name ?? "Usuario"])
  );

  if (profileIds.length > 0) {
    const { data: extraProfiles } = await supabase
      .from("user_profiles")
      .select("id, full_name")
      .in("id", profileIds);
    (extraProfiles ?? []).forEach((item) => namesMap.set(item.id, item.full_name ?? "Usuario"));
  }

  const connectionLogs: ConnectionLogRecord[] = (connectionLogsResponse.data ?? []).map((item) => ({
    id: item.id,
    userId: item.user_profile_id,
    userName: item.user_profile_id ? namesMap.get(item.user_profile_id) ?? "Usuario" : null,
    email: item.email,
    success: Boolean(item.success),
    failureReason: item.failure_reason ?? null,
    ipAddress: item.ip_address ?? null,
    userAgent: item.user_agent ?? null,
    createdAt: item.created_at
  }));

  const actionLogs: ActionAuditRecord[] = (auditLogsResponse.data ?? []).map((item) => ({
    id: item.id,
    userId: item.user_profile_id,
    userName: item.user_profile_id ? namesMap.get(item.user_profile_id) ?? "Usuario" : null,
    moduleKey: item.module_key,
    sectionKey: item.section_key,
    actionKey: item.action_key,
    entityType: item.entity_type,
    entityId: item.entity_id ?? null,
    beforeData:
      item.before_data === null ? null : JSON.stringify(item.before_data, null, 2),
    afterData:
      item.after_data === null ? null : JSON.stringify(item.after_data, null, 2),
    createdAt: item.created_at
  }));

  let assignableUsers: AdminUserRecord[] = (profilesResponse.data ?? []).map((item) => ({
    id: item.id,
    fullName: item.full_name ?? "Usuario",
    roleKey: roleMap.get(item.role_id) ?? "capturador",
    email: "",
    active: Boolean(item.active),
    hasProfile: true
  }));

  if (isSupabaseAdminConfigured()) {
    const admin = createSupabaseAdminClient();
    const { data: authUsersResponse } = await admin.auth.admin.listUsers();
    const authUsers = authUsersResponse?.users ?? [];
    assignableUsers = authUsers.map((user) => {
      const profile = profilesMap.get(user.id);
      return {
        id: user.id,
        fullName:
          profile?.fullName ??
          user.user_metadata?.full_name ??
          user.email ??
          "Usuario",
        roleKey: profile?.roleKey ?? "sin perfil",
        email: user.email ?? "",
        active: profile?.active ?? true,
        hasProfile: Boolean(profile)
      };
    });
  }

  const cutoffWeekday = Number(
    (settingsResponse.data ?? []).find((item) => item.key === "global_cutoff_weekday")?.value ?? "1"
  );
  const workplaces: WorkplaceRecord[] = (workplacesResponse.data ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    type: item.type,
    active: Boolean(item.active)
  }));
  const internalMap = new Map(internals.map((item) => [item.id, item]));
  const workplacePositions: WorkplacePositionRecord[] = (workplacePositionsResponse.data ?? []).map((item) => {
    const workplace = getFirstRelation(item.workplaces);
    const assignedInternal = item.assigned_internal_id ? internalMap.get(item.assigned_internal_id) : null;
    return {
      id: item.id,
      workplaceId: workplace?.id ?? "",
      workplaceName: workplace?.name ?? "Sin centro",
      workplaceType: workplace?.type ?? "oficina",
      title: item.title,
      salary: Number(item.salary ?? 0),
      assignedInternalId: item.assigned_internal_id ?? null,
      assignedInternalName: assignedInternal?.fullName ?? null,
      active: Boolean(item.active)
    };
  });
  const config: DangerZoneConfigData = {
    cutoffWeekday,
    zones: (zonesResponse.data ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      active: Boolean(item.active)
    })),
    chargeRoutes: (chargeRoutesResponse.data ?? []).map((item) => ({
      id: item.id,
      moduleKey: ensureModuleKey(item.module_key),
      zoneId: item.zone_id,
      zoneName: getFirstRelation(item.zones)?.name ?? "Zona",
      chargeWeekday: item.charge_weekday,
      active: Boolean(item.active)
    })),
    prices: (pricesResponse.data ?? []).map((item) => ({
      id: item.id,
      moduleKey: ensureModuleKey(item.module_key),
      deviceTypeId: item.device_type_id,
      deviceTypeName: getFirstRelation(item.module_device_types)?.name ?? "Aparato",
      weeklyPrice: Number(item.weekly_price ?? 0),
      activationPrice: Number(item.activation_price ?? 0),
      finePrice: Number(item.fine_price ?? 0),
      maintenancePrice: Number(item.maintenance_price ?? 0),
      retentionPrice: Number(item.retention_price ?? 0),
      discountAmount: Number(item.discount_amount ?? 0),
      active: Boolean(item.active)
    })),
    deviceTypes: (deviceTypesResponse.data ?? []).map((item) => ({
      id: item.id,
      moduleKey: ensureModuleKey(item.module_key),
      key: item.key,
      name: item.name,
      sortOrder: item.sort_order,
      requiresImei: Boolean(item.requires_imei),
      requiresChip: Boolean(item.requires_chip),
      allowCamerasFlag: Boolean(item.allow_cameras_flag)
    })),
    workplaces,
    workplacePositions
  };

  return {
    connectionLogs,
    actionLogs,
    users: assignableUsers,
    config,
    internals: internals.map((item) => ({
      id: item.id,
      fullName: item.fullName,
      ubicacion: item.ubicacion
    }))
  };
}

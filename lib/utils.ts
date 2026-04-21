import {
  AccessStatus,
  EscaleraEntryStatus,
  ListingRecord,
  ModuleAccess,
  ModuleKey,
  ModuleWorkerFunctionKey,
  PermissionGrantRecord,
  PassVisitor,
  RoleKey,
  VisitorRecord
} from "@/lib/types";

const MEXICO_CITY_TIMEZONE = "America/Mexico_City";
const SENSITIVE_DATA_EXCEPTION_USER_IDS = new Set([
  "66d0a5da-5156-4aa4-98b5-3e37002af970",
  "4df7451f-5900-42f7-9336-e87180a2e336"
]);

function formatPartsToIso(parts: Intl.DateTimeFormatPart[]) {
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function parseLocalDate(input: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (match) {
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  return new Date(input);
}

export function getAgeFromDate(input: string) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return 0;
  }

  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
    age -= 1;
  }

  return Math.max(age, 0);
}

export function formatLongDate(input: string) {
  try {
    const value = parseLocalDate(input);
    if (Number.isNaN(value.getTime())) {
      return input || "-";
    }

    return new Intl.DateTimeFormat("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(value);
  } catch {
    return input || "-";
  }
}

export function formatLongDateWithWeekday(input: string) {
  try {
    const value = parseLocalDate(input);
    if (Number.isNaN(value.getTime())) {
      return input || "-";
    }

    const weekday = new Intl.DateTimeFormat("es-MX", {
      weekday: "long"
    }).format(value);

    return `${weekday} ${formatLongDate(input)}`;
  } catch {
    return input || "-";
  }
}

export function formatShortDate(input: string) {
  try {
    const value = parseLocalDate(input);
    if (Number.isNaN(value.getTime())) {
      return input || "-";
    }

    return new Intl.DateTimeFormat("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(value);
  } catch {
    return input || "-";
  }
}

export function getStatusDisplayLabel(status: AccessStatus) {
  if (status === "abierto") {
    return "MANANA";
  }

  if (status === "proximo") {
    return "EN ESPERA";
  }

  return "CERRADA";
}

export function getModuleDisplayName(moduleKey: ModuleKey) {
  if (moduleKey === "visual") {
    return "Visual";
  }

  if (moduleKey === "comunicacion") {
    return "Comunicacion";
  }

  if (moduleKey === "escaleras") {
    return "Escaleras";
  }

  return "Rentas";
}

export function getVisitorAvailabilityLabel(betada: boolean) {
  return betada ? "No disponible" : "Activo";
}

export function maskValue(value: string | number, visible = false) {
  if (visible) {
    return String(value);
  }

  const text = String(value ?? "");
  if (!text || text === "-") {
    return "-";
  }

  return "*".repeat(Math.max(3, Math.min(text.length, 8)));
}

export function canViewSensitiveSystemData(roleKey: RoleKey, userId?: string | null) {
  if (roleKey === "super-admin") {
    return true;
  }

  if (!userId) {
    return true;
  }

  return !SENSITIVE_DATA_EXCEPTION_USER_IDS.has(userId);
}

export function formatDateInput(input: Date) {
  return formatPartsToIso(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: MEXICO_CITY_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(input)
  );
}

export function fullNameFromParts(...parts: Array<string | null | undefined>) {
  return parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
}

export function sortVisitorsByAge<T extends PassVisitor | VisitorRecord>(visitors: T[]): T[] {
  return [...visitors].sort((a, b) => b.edad - a.edad);
}

export function getTodayDate() {
  return formatDateInput(new Date());
}

export function getTomorrowDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return formatDateInput(date);
}

export function getDateOffset(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return formatDateInput(date);
}

export function getNextTwoDays() {
  return [0, 1, 2].map((offset) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return formatDateInput(date);
  });
}

export function getMexicoCityHour(reference = new Date()) {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: MEXICO_CITY_TIMEZONE,
      hour: "2-digit",
      hour12: false
    }).format(reference)
  );
}

export function canCloseMexicoCityDate(reference = new Date()) {
  return getMexicoCityHour(reference) >= 18;
}

export function getEscaleraStatusLabel(status: EscaleraEntryStatus) {
  if (status === "pagado") {
    return "Pagado";
  }

  if (status === "enviado") {
    return "Enviado";
  }

  if (status === "entregado") {
    return "Entregado";
  }

  if (status === "retenido") {
    return "Retenido";
  }

  if (status === "rechazado") {
    return "No entregado";
  }

  return "Pendiente";
}

export function getEscaleraStatusMeta(status: EscaleraEntryStatus) {
  if (status === "pagado") {
    return { label: "Pagado", variant: "ok" as const };
  }

  if (status === "enviado") {
    return { label: "Enviado", variant: "warn" as const };
  }

  if (status === "entregado") {
    return { label: "Entregado", variant: "ok" as const };
  }

  if (status === "retenido") {
    return { label: "Retenido", variant: "danger" as const };
  }

  if (status === "rechazado") {
    return { label: "No entregado", variant: "off" as const };
  }

  return { label: "Pendiente", variant: "warn" as const };
}

export function getDeviceStatusMeta(status: string) {
  const normalized = String(status ?? "").trim().toLowerCase();

  if (normalized === "activo") {
    return { label: "Activo", variant: "ok" as const };
  }

  if (normalized === "pendiente") {
    return { label: "Pendiente", variant: "warn" as const };
  }

  if (normalized === "retenido") {
    return { label: "Retenido", variant: "danger" as const };
  }

  if (normalized === "reparacion") {
    return { label: "Mantenimiento", variant: "off" as const };
  }

  return { label: "Baja", variant: "off" as const };
}

export function getStatsFromListings(listings: ListingRecord[]) {
  const totalVisitors = listings.reduce((sum, item) => sum + item.visitantes.length, 0);
  const minors = listings.reduce(
    (sum, item) => sum + item.visitantes.filter((visitor) => visitor.menor).length,
    0
  );
  const areas = listings.reduce<Record<string, number>>((acc, item) => {
    acc[item.area] = (acc[item.area] ?? 0) + 1;
    return acc;
  }, {});

  return {
    totalPasses: listings.length,
    totalVisitors,
    minors,
    areas
  };
}

export function canManageMentions(role: RoleKey) {
  return role === "super-admin" || role === "control";
}

export function getDefaultDateStatusForRole(role: RoleKey): AccessStatus {
  return role === "capturador" ? "proximo" : "abierto";
}

export function canAccessCoreSystem(role: RoleKey, moduleOnly: boolean) {
  if (role === "super-admin" || role === "control") {
    return true;
  }

  if (role === "escaleras") {
    return false;
  }

  return !moduleOnly;
}

function getExplicitPermissionLevel(permissionGrants: PermissionGrantRecord[] = [], scopeKey: string) {
  return permissionGrants.find((item) => item.scopeKey === scopeKey)?.accessLevel ?? null;
}

export function canAccessScope(
  role: RoleKey,
  permissionGrants: PermissionGrantRecord[] = [],
  scopeKey: string,
  fallback: boolean
) {
  if (role === "super-admin") {
    return true;
  }

  const explicit = getExplicitPermissionLevel(permissionGrants, scopeKey);
  if (explicit) {
    return explicit !== "none";
  }

  return fallback;
}

export function canManageScope(
  role: RoleKey,
  permissionGrants: PermissionGrantRecord[] = [],
  scopeKey: string,
  fallback: boolean
) {
  if (role === "super-admin") {
    return true;
  }

  const explicit = getExplicitPermissionLevel(permissionGrants, scopeKey);
  if (explicit) {
    return explicit === "manage";
  }

  return fallback;
}

export function canAccessModule(
  role: RoleKey,
  accesses: ModuleAccess[],
  moduleKey: ModuleKey
) {
  if (role === "super-admin") {
    return true;
  }

  if (role === "control") {
    return moduleKey === "escaleras";
  }

  if (role === "escaleras" && moduleKey === "escaleras") {
    return true;
  }

  return accesses.some((item) => item.moduleKey === moduleKey);
}

export function canManageModuleFunction(
  role: RoleKey,
  accesses: ModuleAccess[],
  moduleKey: ModuleKey,
  fn: ModuleWorkerFunctionKey
) {
  if (role === "super-admin") {
    return true;
  }

  if (role === "control") {
    return moduleKey === "escaleras";
  }

  return accesses.some(
    (item) => item.moduleKey === moduleKey && (item.functions.includes("encargado") || item.functions.includes(fn))
  );
}

export function normalizeDeviceTypeName(value?: string | null) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function getAllowedModuleDeviceNames(moduleKey: ModuleKey) {
  if (moduleKey === "visual") {
    return new Set(["pantalla", "pantallas", "consola", "consolas", "sonido"]);
  }

  if (moduleKey === "comunicacion") {
    return new Set(["banda ancha", "celular", "telefono", "internet", "laptop", "satelital", "tablet"]);
  }

  return null;
}

export function getInternalStatusMeta(status?: string | null) {
  const normalized = String(status ?? "").trim().toLowerCase();

  if (normalized === "activo") {
    return { label: "Activo", variant: "ok" as const };
  }

  if (normalized === "retenido") {
    return { label: "Retenido", variant: "danger" as const };
  }

  if (normalized === "baja") {
    return { label: "Baja", variant: "off" as const };
  }

  if (normalized === "150") {
    return { label: "150", variant: "warn" as const };
  }

  return { label: status || "Sin estatus", variant: "off" as const };
}

export function getWeekRange(reference = new Date()) {
  const value = new Date(reference);
  const day = value.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(value);
  start.setDate(value.getDate() + diffToMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return {
    start: formatDateInput(start),
    end: formatDateInput(end)
  };
}

export function getWeekRangeFromCutoff(cutoffWeekday: number, reference = new Date()) {
  const value = new Date(reference);
  const currentDay = value.getDay();
  const normalizedCutoff = Math.max(0, Math.min(6, cutoffWeekday));
  const diff = (currentDay - normalizedCutoff + 7) % 7;
  const start = new Date(value);
  start.setDate(value.getDate() - diff);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return {
    start: formatDateInput(start),
    end: formatDateInput(end)
  };
}

export function nextPassNumber(seed: number) {
  if (seed >= 9999) {
    return 1;
  }

  return seed + 1;
}

export function isValidInternalLocation(value: string) {
  return /^(?:[1-9]|1[0-5])-\d+$/.test(value.trim());
}

export function parseInternalLocation(value: string) {
  const normalized = String(value ?? "").trim();
  const match = /^(\d+)-(\d+)$/.exec(normalized);
  if (!match) {
    return {
      primary: Number.MAX_SAFE_INTEGER,
      secondary: Number.MAX_SAFE_INTEGER,
      raw: normalized
    };
  }

  return {
    primary: Number(match[1]),
    secondary: Number(match[2]),
    raw: normalized
  };
}

export function compareInternalLocations(a: string, b: string) {
  const locationA = parseInternalLocation(a);
  const locationB = parseInternalLocation(b);

  if (locationA.primary !== locationB.primary) {
    return locationA.primary - locationB.primary;
  }

  if (locationA.secondary !== locationB.secondary) {
    return locationA.secondary - locationB.secondary;
  }

  return locationA.raw.localeCompare(locationB.raw);
}

export function sortListingsForPrint(listings: ListingRecord[]) {
  return [...listings].sort((a, b) => {
    const numberA = a.numeroPase ?? Number.MAX_SAFE_INTEGER;
    const numberB = b.numeroPase ?? Number.MAX_SAFE_INTEGER;

    if (numberA !== numberB) {
      return numberA - numberB;
    }

    if (a.numeroPase && b.numeroPase) {
      return compareInternalLocations(a.internoUbicacion, b.internoUbicacion) || a.createdAt.localeCompare(b.createdAt);
    }

    if (a.numeroPase !== b.numeroPase) {
      return a.numeroPase ? -1 : 1;
    }

    if (a.cierreAplicado !== b.cierreAplicado) {
      return a.cierreAplicado ? -1 : 1;
    }

    if (a.cierreAplicado && b.cierreAplicado) {
      return compareInternalLocations(a.internoUbicacion, b.internoUbicacion) || a.createdAt.localeCompare(b.createdAt);
    }

    return compareInternalLocations(a.internoUbicacion, b.internoUbicacion) || a.createdAt.localeCompare(b.createdAt);
  });
}

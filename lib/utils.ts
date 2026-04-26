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
const SENSITIVE_INTERNAL_IDS = new Set([
  "66d0a5da-5156-4aa4-98b5-3e37002af970",
  "4df7451f-5900-42f7-9336-e87180a2e336"
]);
const PRIVATE_MASK = "****";
const MOJIBAKE_TOKENS = [
  "Ã",
  "Â",
  "â€¦",
  "â€“",
  "â€”",
  "â€œ",
  "â€",
  "â€",
  "â€™",
  "â€¢",
  "ï¿½",
  "�"
];

function needsEncodingRepair(value: string) {
  return MOJIBAKE_TOKENS.some((token) => value.includes(token));
}

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

export function repairTextEncoding(value: string | number | null | undefined) {
  return sanitizeText(value);
}

export function sanitizeText(value: string | number | null | undefined) {
  let text = String(value ?? "");
  if (!text || !needsEncodingRepair(text)) {
    return text;
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (!needsEncodingRepair(text)) {
      break;
    }

    try {
      const bytes = Uint8Array.from(Array.from(text).map((character) => character.charCodeAt(0) & 0xff));
      const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      if (!decoded || decoded === text) {
        break;
      }

      text = decoded;
    } catch {
      break;
    }
  }

  return text
    .replace(/â€¦/g, "…")
    .replace(/â€“/g, "–")
    .replace(/â€”/g, "—")
    .replace(/â€œ/g, "“")
    .replace(/â€\u001d/g, "”")
    .replace(/â€\u0018/g, "‘")
    .replace(/â€™/g, "’")
    .replace(/â€¢/g, "•")
    .replace(/Â¿/g, "¿")
    .replace(/Â¡/g, "¡")
    .replace(/Â·/g, "·")
    .replace(/Â /g, " ")
    .replace(/Â/g, "")
    .replace(/ï¿½/g, "")
    .replace(/�/g, "");
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
  return true;
}

export function isSensitiveInternalId(internalId?: string | null) {
  return Boolean(internalId && SENSITIVE_INTERNAL_IDS.has(internalId));
}

export function shouldMaskSensitiveInternal(roleKey: RoleKey, internalId?: string | null) {
  return roleKey !== "super-admin" && isSensitiveInternalId(internalId);
}

export function maskPrivateText(value: string | number | null | undefined, masked = false) {
  if (masked) {
    return PRIVATE_MASK;
  }

  const normalized = String(value ?? "").trim();
  return normalized || "-";
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
  const date = parseLocalDate(getTodayDate());
  date.setDate(date.getDate() + 1);
  return formatDateInput(date);
}

export function getDateOffset(offset: number) {
  const date = parseLocalDate(getTodayDate());
  date.setDate(date.getDate() + offset);
  return formatDateInput(date);
}

export function getNextTwoDays() {
  return [0, 1, 2].map((offset) => {
    const date = parseLocalDate(getTodayDate());
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

export const PASS_BASIC_MENTIONS_SCOPE = "listado.captura-menciones";
export const PASS_SPECIAL_MENTIONS_SCOPE = "listado.captura-especiales";

export function canManagePassMentions(
  role: RoleKey,
  permissionGrants: PermissionGrantRecord[] = [],
  target: "basicas" | "especiales" | "any" = "any"
): boolean {
  if (target === "basicas") {
    return canManageScope(role, permissionGrants, PASS_BASIC_MENTIONS_SCOPE, role === "control");
  }

  if (target === "especiales") {
    return canManageScope(role, permissionGrants, PASS_SPECIAL_MENTIONS_SCOPE, role === "control");
  }

  return (
    canManagePassMentions(role, permissionGrants, "basicas") ||
    canManagePassMentions(role, permissionGrants, "especiales")
  );
}

export function canManageMentions(
  role: RoleKey,
  permissionGrants: PermissionGrantRecord[] = [],
  target: "basicas" | "especiales" | "any" = "any"
): boolean {
  return canManagePassMentions(role, permissionGrants, target);
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
  const normalized = value.trim().toUpperCase();
  return /^(?:(?:0|[1-9]|1[0-5])-\d+|[A-Z]+-\d+)$/.test(normalized);
}

export function parseInternalLocation(value: string) {
  const normalized = String(value ?? "").trim();
  const numericMatch = /^(\d+)-(\d+)$/.exec(normalized);
  if (numericMatch) {
    return {
      type: "numeric" as const,
      primaryNumber: Number(numericMatch[1]),
      primaryText: "",
      secondary: Number(numericMatch[2]),
      raw: normalized
    };
  }

  const alphaMatch = /^([A-Z]+)-(\d+)$/i.exec(normalized);
  if (alphaMatch) {
    return {
      type: "alpha" as const,
      primaryNumber: Number.MAX_SAFE_INTEGER,
      primaryText: alphaMatch[1].toUpperCase(),
      secondary: Number(alphaMatch[2]),
      raw: normalized.toUpperCase()
    };
  }

  return {
    type: "unknown" as const,
    primaryNumber: Number.MAX_SAFE_INTEGER,
    primaryText: normalized.toUpperCase(),
    secondary: Number.MAX_SAFE_INTEGER,
    raw: normalized
  };
}

export function compareInternalLocations(a: string, b: string) {
  const locationA = parseInternalLocation(a);
  const locationB = parseInternalLocation(b);

  const rankA =
    locationA.type === "alpha"
      ? locationA.primaryText === "I"
        ? -1
        : Number.MAX_SAFE_INTEGER - 1
      : locationA.primaryNumber;
  const rankB =
    locationB.type === "alpha"
      ? locationB.primaryText === "I"
        ? -1
        : Number.MAX_SAFE_INTEGER - 1
      : locationB.primaryNumber;

  if (rankA !== rankB) {
    return rankA - rankB;
  }

  if (locationA.type === "numeric" && locationB.type === "numeric") {
    if (locationA.secondary !== locationB.secondary) {
      return locationA.secondary - locationB.secondary;
    }

    return locationA.raw.localeCompare(locationB.raw);
  }

  if (locationA.primaryText !== locationB.primaryText) {
    return locationA.primaryText.localeCompare(locationB.primaryText);
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

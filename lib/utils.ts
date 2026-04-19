import {
  AccessStatus,
  ListingRecord,
  ModuleAccess,
  ModuleKey,
  ModuleWorkerFunctionKey,
  PassVisitor,
  RoleKey,
  VisitorRecord
} from "@/lib/types";

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
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(value);
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
    return "PROXIMOS";
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

export function formatDateInput(input: Date) {
  return input.toISOString().slice(0, 10);
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

  return !moduleOnly;
}

export function canAccessModule(
  role: RoleKey,
  accesses: ModuleAccess[],
  moduleKey: ModuleKey
) {
  if (role === "super-admin" || role === "control") {
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
  if (role === "super-admin" || role === "control") {
    return true;
  }

  return accesses.some(
    (item) => item.moduleKey === moduleKey && (item.functions.includes("encargado") || item.functions.includes(fn))
  );
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

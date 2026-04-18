import { ListingRecord, PassVisitor, RoleKey, VisitorRecord } from "@/lib/types";

export function formatLongDate(input: string) {
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(input));
}

export function formatShortDate(input: string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(input));
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

export function canChoosePassType(role: RoleKey) {
  return role === "super-admin" || role === "control";
}

export function nextPassNumber(seed: number) {
  if (seed >= 9999) {
    return 1;
  }

  return seed + 1;
}

export function sortListingsForPrint(listings: ListingRecord[]) {
  const sueltos = listings
    .filter((item) => item.area === "INTIMA")
    .sort((a, b) => a.internoUbicacion - b.internoUbicacion || a.createdAt.localeCompare(b.createdAt));

  const byLocation = listings
    .filter((item) => item.area === "618")
    .sort((a, b) => {
      const numberA = a.numeroPase ?? Number.MAX_SAFE_INTEGER;
      const numberB = b.numeroPase ?? Number.MAX_SAFE_INTEGER;

      if (numberA !== numberB) {
        return numberA - numberB;
      }

      if (a.cierreAplicado && b.cierreAplicado) {
        return a.internoUbicacion - b.internoUbicacion;
      }

      if (a.cierreAplicado !== b.cierreAplicado) {
        return a.cierreAplicado ? -1 : 1;
      }

      return a.createdAt.localeCompare(b.createdAt);
    });

  return {
    byLocation,
    sueltos
  };
}

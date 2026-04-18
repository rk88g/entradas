export type RoleKey = "super-admin" | "control" | "supervisor" | "capturador";

export type AccessArea = "618" | "INTIMA";
export type AccessStatus = "abierto" | "proximo" | "cerrado";
export type PassStatus = "capturado" | "autorizado" | "impreso" | "cancelado";
export type VisitorSex = "hombre" | "mujer" | "sin-definir";

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  roleKey: RoleKey;
  roleName: string;
  active: boolean;
}

export interface InternalRecord {
  id: string;
  fullName: string;
  nombres: string;
  apellidoPat: string;
  apellidoMat: string;
  nacimiento: string;
  edad: number;
  llego: string;
  libre: string;
  ubicacion: number;
  telefono: string;
  ubiFiliacion: string;
  clasificacion: AccessArea;
  createdAt: string;
  updatedAt: string;
  expediente: string;
  observaciones?: string;
}

export interface InternalVisitorLink {
  id: string;
  internoId: string;
  visitaId: string;
  parentesco: string;
  titular: boolean;
  visitor: VisitorRecord;
}

export interface InternalProfile extends InternalRecord {
  visitors: InternalVisitorLink[];
  currentDatePass?: ListingRecord | null;
  recentPasses: ListingRecord[];
}

export interface VisitorRecord {
  id: string;
  fullName: string;
  nombres: string;
  apellidoPat: string;
  apellidoMat: string;
  fechaNacimiento: string;
  edad: number;
  menor: boolean;
  sexo: VisitorSex;
  parentesco: string;
  betada: boolean;
  historialInterno: string[];
  historial: VisitorHistoryEntry[];
  currentInternalId?: string;
  currentInternalName?: string;
  telefono?: string;
  createdAt: string;
  updatedAt: string;
  motivoBetado?: string;
}

export interface VisitorHistoryEntry {
  id: string;
  internalName: string;
  date: string;
  type: "visita" | "reasignacion";
}

export interface DateRecord {
  id: string;
  dia: number;
  mes: number;
  anio: number;
  fechaCompleta: string;
  cierre: boolean;
  estado: AccessStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface PassVisitor {
  visitorId: string;
  nombre: string;
  parentesco: string;
  edad: number;
  menor: boolean;
  sexo: VisitorSex;
  betada: boolean;
}

export interface ListingRecord {
  id: string;
  internoId: string;
  internoNombre: string;
  internoUbicacion: number;
  fechaId?: string;
  fechaVisita: string;
  area: AccessArea;
  createdByRole: RoleKey;
  status: PassStatus;
  numeroPase?: number | null;
  menciones?: string;
  cierreAplicado?: boolean;
  createdAt: string;
  visitantes: PassVisitor[];
}

export interface BetadaRecord {
  id: string;
  fullName: string;
  nombres: string;
  apellidoPat: string;
  apellidoMat: string;
  fechaNacimiento?: string;
  motivo: string;
  activo: boolean;
  createdAt: string;
}

export interface DashboardStat {
  label: string;
  value: string;
  hint: string;
}

export interface ListingBuilderData {
  operatingDate: DateRecord | null;
  todayDate: DateRecord | null;
  internalProfiles: InternalProfile[];
  todaysPasses: ListingRecord[];
  closePasswordConfigured: boolean;
}

export interface MutationState {
  success: string | null;
  error: string | null;
}

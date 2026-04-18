export type RoleKey = "super-admin" | "control" | "supervisor" | "capturador";

export type AccessArea = "618" | "INTIMA";

export type AccessStatus = "abierto" | "proximo" | "cerrado";
export type PassStatus = "capturado" | "autorizado" | "impreso" | "cancelado";

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
  llego: string;
  libre: string;
  ubicacion: number;
  ubiFiliacion: string;
  clasificacion: AccessArea;
  createdAt: string;
  updatedAt: string;
  expediente: string;
  observaciones?: string;
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
  parentesco: string;
  betada: boolean;
  historialInterno: string[];
  telefono?: string;
  createdAt: string;
  updatedAt: string;
  motivoBetado?: string;
}

export interface DateRecord {
  id: string;
  dia: number;
  mes: number;
  anio: number;
  fechaCompleta: string;
  cierre: boolean;
  estado: AccessStatus;
}

export interface PassVisitor {
  visitorId: string;
  nombre: string;
  parentesco: string;
  edad: number;
  menor: boolean;
  betada: boolean;
}

export interface ListingRecord {
  id: string;
  internoId: string;
  internoNombre: string;
  fechaVisita: string;
  area: AccessArea;
  createdByRole: RoleKey;
  status: PassStatus;
  menciones?: string;
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

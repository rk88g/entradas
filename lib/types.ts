export type RoleKey =
  | "super-admin"
  | "control"
  | "supervisor"
  | "capturador"
  | "visual"
  | "comunicacion"
  | "escaleras";
export type ModuleKey = "visual" | "comunicacion" | "escaleras" | "rentas";
export type ModuleWorkerFunctionKey =
  | "altas"
  | "cobranza"
  | "encargado"
  | "segundo"
  | "supervisor"
  | "mantenimiento"
  | "configuracion";

export type AccessStatus = "abierto" | "proximo" | "cerrado";
export type PassStatus = "capturado" | "autorizado" | "impreso" | "cancelado";
export type VisitorSex = "hombre" | "mujer" | "sin-definir";
export type DeviceStatus = "activo" | "retenido" | "reparacion" | "baja";

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  roleKey: RoleKey;
  roleName: string;
  active: boolean;
  moduleOnly: boolean;
  accessibleModules: ModuleAccess[];
}

export interface ModuleAccess {
  moduleKey: ModuleKey;
  moduleName: string;
  functions: ModuleWorkerFunctionKey[];
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
  ubicacion: string;
  telefono: string;
  estatus: string;
  laborando: boolean;
  ubiFiliacion: string;
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
  nextDatePass?: ListingRecord | null;
  openDatePass?: ListingRecord | null;
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
  internoUbicacion: string;
  fechaId?: string;
  fechaVisita: string;
  area: string;
  createdByRole: RoleKey;
  status: PassStatus;
  numeroPase?: number | null;
  menciones?: string;
  especiales?: string;
  cierreAplicado?: boolean;
  createdAt: string;
  visitantes: PassVisitor[];
  deviceItems: PassDeviceItem[];
}

export interface PassDeviceItem {
  id: string;
  deviceTypeId: string;
  moduleKey: ModuleKey;
  name: string;
  quantity: number;
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
  openDate: DateRecord | null;
  nextDate: DateRecord | null;
  printDate: DateRecord | null;
  internalProfiles: InternalProfile[];
  todaysPasses: ListingRecord[];
  closePasswordConfigured: boolean;
  passArticles: ModuleDeviceType[];
}

export interface MutationState {
  success: string | null;
  error: string | null;
}

export interface ModuleDeviceType {
  id: string;
  moduleKey: ModuleKey;
  key: string;
  name: string;
  sortOrder: number;
  requiresImei: boolean;
  requiresChip: boolean;
  allowCamerasFlag: boolean;
}

export interface ModuleZone {
  id: string;
  moduleKey: ModuleKey;
  name: string;
  chargeWeekday: number;
  active: boolean;
}

export interface ModulePriceRecord {
  id: string;
  moduleKey: ModuleKey;
  deviceTypeId: string;
  deviceTypeName: string;
  weeklyPrice: number;
  discountAmount: number;
  active: boolean;
}

export interface InternalDeviceRecord {
  id: string;
  internalId: string;
  internalName: string;
  internalLocation: string;
  moduleKey: ModuleKey;
  deviceTypeId: string;
  deviceTypeName: string;
  zoneId?: string;
  zoneName?: string;
  brand?: string;
  model?: string;
  characteristics?: string;
  imei?: string;
  chipNumber?: string;
  camerasAllowed: boolean;
  quantity: number;
  status: DeviceStatus;
  paidThrough?: string | null;
  weeklyPriceOverride?: number | null;
  discountOverride?: number | null;
  assignedManually: boolean;
  notes?: string;
}

export interface ModuleWorkerRecord {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  moduleKey: ModuleKey;
  functions: ModuleWorkerFunctionKey[];
  active: boolean;
}

export interface ModuleFinanceSummary {
  zoneId: string | null;
  zoneName: string;
  totalPaid: number;
  paidCount: number;
  pendingCount: number;
}

export interface ModulePanelData {
  moduleKey: ModuleKey;
  moduleName: string;
  deviceTypes: ModuleDeviceType[];
  zones: ModuleZone[];
  prices: ModulePriceRecord[];
  devices: InternalDeviceRecord[];
  workers: ModuleWorkerRecord[];
  unpaidDevices: InternalDeviceRecord[];
  paidDevices: InternalDeviceRecord[];
  totalsByZone: ModuleFinanceSummary[];
  totalIncome: number;
  currentWeekLabel: string;
  weekClosed: boolean;
  currentCycleId?: string;
  cutoffWeekday: number;
  assignableUsers: Array<{ id: string; fullName: string }>;
  staffAssignments: ModuleStaffAssignment[];
}

export interface ModuleStaffAssignment {
  id: string;
  moduleKey: ModuleKey;
  internalId: string;
  internalName: string;
  userId: string;
  userName: string;
  positionKey: ModuleWorkerFunctionKey;
}

export type EscaleraEntryStatus = "pendiente" | "entregado" | "retenido" | "rechazado";
export type EscaleraOff8Type = "fijo" | "porcentual";

export interface EscaleraManualItem {
  id: string;
  escaleraEntryId: string;
  description: string;
  quantity: number;
  unitLabel?: string;
  weightKg?: number | null;
  liters?: number | null;
  notes?: string;
}

export interface EscaleraAuthorizedDevice {
  id: string;
  name: string;
  quantity: number;
  moduleKey: ModuleKey;
  brand?: string;
  model?: string;
}

export interface EscaleraRecord {
  id: string;
  listadoId: string;
  internalId: string;
  internalName: string;
  internalLocation: string;
  laborando: boolean;
  fechaVisita: string;
  off8Aplica: boolean;
  off8Type?: EscaleraOff8Type | null;
  off8Value?: number | null;
  ticketAmount?: number | null;
  status: EscaleraEntryStatus;
  comments?: string;
  retentions?: string;
  basicRequest?: string;
  specialRequest?: string;
  passDeviceItems: PassDeviceItem[];
  authorizedDevices: EscaleraAuthorizedDevice[];
  manualItems: EscaleraManualItem[];
}

export interface ConnectionLogRecord {
  id: string;
  userId?: string | null;
  userName?: string | null;
  email: string;
  success: boolean;
  failureReason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

export interface ActionAuditRecord {
  id: string;
  userId?: string | null;
  userName?: string | null;
  moduleKey: string;
  sectionKey: string;
  actionKey: string;
  entityType: string;
  entityId?: string | null;
  beforeData?: string | null;
  afterData?: string | null;
  createdAt: string;
}

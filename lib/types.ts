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
export type DeviceStatus = "pendiente" | "activo" | "retenido" | "reparacion" | "baja";
export type WorkplaceType = "negocio" | "oficina";
export type PermissionAccessLevel = "none" | "view" | "manage";

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  roleKey: RoleKey;
  roleName: string;
  active: boolean;
  moduleOnly: boolean;
  accessibleModules: ModuleAccess[];
  permissionGrants: PermissionGrantRecord[];
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

export interface InternalSearchOption {
  id: string;
  fullName: string;
  ubicacion: string;
  estatus: string;
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
  devices: InternalDeviceRecord[];
  weeklyPayments: InternalWeeklyPaymentRecord[];
  escalerasHistory: EscaleraRecord[];
  notes: InternalNoteRecord[];
  staffAssignments: ModuleStaffAssignment[];
  workplaceAssignments: WorkplacePositionRecord[];
  equipmentMovements: InternalEquipmentMovementRecord[];
  fines: InternalFineRecord[];
  seizures: InternalSeizureRecord[];
}

export interface VisitorRecord {
  id: string;
  fullName: string;
  nombreCompleto: string;
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

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  query: string;
}

export interface InternalHistoryPayload {
  visitors: InternalVisitorLink[];
  recentPasses: ListingRecord[];
  devices: InternalDeviceRecord[];
  weeklyPayments: InternalWeeklyPaymentRecord[];
  escalerasHistory: EscaleraRecord[];
  notes: InternalNoteRecord[];
  staffAssignments: ModuleStaffAssignment[];
  workplaceAssignments: WorkplacePositionRecord[];
  equipmentMovements: InternalEquipmentMovementRecord[];
  fines: InternalFineRecord[];
  seizures: InternalSeizureRecord[];
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

export interface ZoneRecord {
  id: string;
  name: string;
  active: boolean;
}

export interface ModuleChargeRoute {
  id: string;
  moduleKey: ModuleKey;
  zoneId: string;
  zoneName: string;
  chargeWeekday: number;
  active: boolean;
}

export interface ModulePriceRecord {
  id: string;
  moduleKey: ModuleKey;
  deviceTypeId: string;
  deviceTypeName: string;
  weeklyPrice: number;
  activationPrice: number;
  finePrice: number;
  maintenancePrice: number;
  retentionPrice: number;
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

export interface WorkplaceRecord {
  id: string;
  name: string;
  type: WorkplaceType;
  active: boolean;
}

export interface WorkplacePositionRecord {
  id: string;
  workplaceId: string;
  workplaceName: string;
  workplaceType: WorkplaceType;
  title: string;
  salary: number;
  assignedInternalId?: string | null;
  assignedInternalName?: string | null;
  active: boolean;
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
  zones: ZoneRecord[];
  chargeRoutes: ModuleChargeRoute[];
  prices: ModulePriceRecord[];
  devices: InternalDeviceRecord[];
  workers: ModuleWorkerRecord[];
  unpaidDevices: InternalDeviceRecord[];
  paidDevices: InternalDeviceRecord[];
  pendingDevices: InternalDeviceRecord[];
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

export interface InternalWeeklyPaymentRecord {
  id: string;
  moduleKey: ModuleKey;
  amount: number;
  status: string;
  paidAt?: string | null;
  notes?: string | null;
  deviceTypeName: string;
}

export interface InternalNoteRecord {
  id: string;
  sourceModule: string;
  title: string;
  notes: string;
  createdAt: string;
}

export interface InternalEquipmentMovementRecord {
  id: string;
  movementType: "venta" | "renta" | "compra" | "cambio";
  description: string;
  amount?: number | null;
  createdAt: string;
}

export interface InternalFineRecord {
  id: string;
  concept: string;
  amount: number;
  status: "pendiente" | "pagada";
  createdAt: string;
}

export interface InternalSeizureRecord {
  id: string;
  concept: string;
  status: "retenido" | "entregado" | "cancelado";
  createdAt: string;
  notes?: string;
}

export type EscaleraEntryStatus = "pendiente" | "enviado" | "entregado" | "pagado" | "retenido" | "rechazado";
export type EscaleraOff8Type = "fijo" | "porcentual" | "libre";

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
  off8Percent?: number | null;
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

export interface AduanaRecord extends EscaleraRecord {
  confirmedAt?: string | null;
  paidAt?: string | null;
  paidAmount?: number | null;
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
  country?: string | null;
  region?: string | null;
  city?: string | null;
  createdAt: string;
}

export interface PermissionScopeRecord {
  key: string;
  moduleKey?: string | null;
  scopeType: "module" | "section";
  parentKey?: string | null;
  label: string;
  description?: string | null;
  sortOrder: number;
  active: boolean;
}

export interface PermissionGrantRecord {
  scopeKey: string;
  accessLevel: PermissionAccessLevel;
  source: "role" | "user";
}

export interface AdminRoleRecord {
  id: string;
  key: string;
  name: string;
}

export interface StoredPermissionGrantRecord {
  id: string;
  subjectType: "role" | "user";
  subjectId: string;
  subjectLabel: string;
  scopeKey: string;
  accessLevel: PermissionAccessLevel;
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

export interface AdminUserRecord {
  id: string;
  fullName: string;
  roleKey: string;
  email: string;
  active: boolean;
  hasProfile: boolean;
}

export interface DangerZoneConfigData {
  cutoffWeekday: number;
  zones: ZoneRecord[];
  chargeRoutes: ModuleChargeRoute[];
  prices: ModulePriceRecord[];
  deviceTypes: ModuleDeviceType[];
  workplaces: WorkplaceRecord[];
  workplacePositions: WorkplacePositionRecord[];
  roles: AdminRoleRecord[];
  permissionScopes: PermissionScopeRecord[];
  rolePermissionGrants: StoredPermissionGrantRecord[];
  userPermissionGrants: StoredPermissionGrantRecord[];
}

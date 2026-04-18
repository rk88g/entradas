import {
  DashboardStat,
  DateRecord,
  InternalRecord,
  ListingRecord,
  RoleKey,
  VisitorRecord
} from "@/lib/types";
import { getNextTwoDays } from "@/lib/utils";

const [today, tomorrow, afterTomorrow] = getNextTwoDays();

export const roles: RoleKey[] = ["super-admin", "control", "supervisor", "capturador"];

export const dashboardStats: DashboardStat[] = [
  {
    label: "Pases mañana",
    value: "38",
    hint: "26 del bloque 618 y 12 sueltos INTIMA"
  },
  {
    label: "Visitas registradas",
    value: "91",
    hint: "Ordenadas y listas para validar impresión"
  },
  {
    label: "Betadas detectadas",
    value: "4",
    hint: "Bloqueadas desde captura para evitar errores"
  }
];

export const internos: InternalRecord[] = [
  {
    id: "int-001",
    fullName: "Carlos Mendoza Rivas",
    nombres: "Carlos",
    apellidoPat: "Mendoza",
    apellidoMat: "Rivas",
    nacimiento: "1989-04-10",
    llego: "2021-09-18",
    libre: "2029-10-11",
    ubicacion: 618,
    ubiFiliacion: "Terraza Norte",
    clasificacion: "618",
    createdAt: "2026-04-14T09:15:00.000Z",
    updatedAt: "2026-04-17T08:45:00.000Z",
    expediente: "EXP-618-101",
    observaciones: "Visita frecuente en bloque matutino"
  },
  {
    id: "int-002",
    fullName: "Julio Cesar Ortega Lara",
    nombres: "Julio Cesar",
    apellidoPat: "Ortega",
    apellidoMat: "Lara",
    nacimiento: "1992-11-03",
    llego: "2023-01-08",
    libre: "2030-04-21",
    ubicacion: 203,
    ubiFiliacion: "Intima Sur",
    clasificacion: "INTIMA",
    createdAt: "2026-04-11T14:20:00.000Z",
    updatedAt: "2026-04-17T07:10:00.000Z",
    expediente: "EXP-INT-031",
    observaciones: "Requiere pases sueltos con mención"
  },
  {
    id: "int-003",
    fullName: "Miguel Angel Varela Soto",
    nombres: "Miguel Angel",
    apellidoPat: "Varela",
    apellidoMat: "Soto",
    nacimiento: "1985-07-20",
    llego: "2020-05-02",
    libre: "2028-12-30",
    ubicacion: 620,
    ubiFiliacion: "Terraza Norte",
    clasificacion: "618",
    createdAt: "2026-04-12T12:20:00.000Z",
    updatedAt: "2026-04-16T16:10:00.000Z",
    expediente: "EXP-618-210"
  }
];

export const visitas: VisitorRecord[] = [
  {
    id: "vis-001",
    fullName: "Maria Fernanda Lopez Ruiz",
    nombres: "Maria Fernanda",
    apellidoPat: "Lopez",
    apellidoMat: "Ruiz",
    fechaNacimiento: "1987-01-20",
    edad: 39,
    menor: false,
    parentesco: "Esposa",
    betada: false,
    historialInterno: ["Carlos Mendoza Rivas"],
    telefono: "8331023301",
    createdAt: "2026-04-10T08:00:00.000Z",
    updatedAt: "2026-04-17T08:00:00.000Z"
  },
  {
    id: "vis-002",
    fullName: "Ana Lucia Mendoza Lopez",
    nombres: "Ana Lucia",
    apellidoPat: "Mendoza",
    apellidoMat: "Lopez",
    fechaNacimiento: "2017-06-11",
    edad: 8,
    menor: true,
    parentesco: "Hija",
    betada: false,
    historialInterno: ["Carlos Mendoza Rivas"],
    createdAt: "2026-04-10T08:10:00.000Z",
    updatedAt: "2026-04-17T08:00:00.000Z"
  },
  {
    id: "vis-003",
    fullName: "Rosa Elena Ortega Diaz",
    nombres: "Rosa Elena",
    apellidoPat: "Ortega",
    apellidoMat: "Diaz",
    fechaNacimiento: "1990-09-03",
    edad: 35,
    menor: false,
    parentesco: "Hermana",
    betada: true,
    historialInterno: ["Julio Cesar Ortega Lara"],
    createdAt: "2026-04-08T09:10:00.000Z",
    updatedAt: "2026-04-15T11:35:00.000Z",
    motivoBetado: "Incidencia previa en filtro de acceso"
  },
  {
    id: "vis-004",
    fullName: "Lucia Soto Guerrero",
    nombres: "Lucia",
    apellidoPat: "Soto",
    apellidoMat: "Guerrero",
    fechaNacimiento: "1976-12-02",
    edad: 49,
    menor: false,
    parentesco: "Madre",
    betada: false,
    historialInterno: ["Miguel Angel Varela Soto"],
    createdAt: "2026-04-08T09:20:00.000Z",
    updatedAt: "2026-04-16T08:12:00.000Z"
  },
  {
    id: "vis-005",
    fullName: "Diego Varela Soto",
    nombres: "Diego",
    apellidoPat: "Varela",
    apellidoMat: "Soto",
    fechaNacimiento: "2011-10-08",
    edad: 14,
    menor: false,
    parentesco: "Hijo",
    betada: false,
    historialInterno: ["Miguel Angel Varela Soto"],
    createdAt: "2026-04-08T09:25:00.000Z",
    updatedAt: "2026-04-16T08:12:00.000Z"
  }
];

export const fechas: DateRecord[] = [
  {
    id: "fec-001",
    dia: 17,
    mes: 4,
    anio: 2026,
    fechaCompleta: today,
    cierre: true,
    estado: "cerrado"
  },
  {
    id: "fec-002",
    dia: 18,
    mes: 4,
    anio: 2026,
    fechaCompleta: tomorrow,
    cierre: false,
    estado: "abierto"
  },
  {
    id: "fec-003",
    dia: 19,
    mes: 4,
    anio: 2026,
    fechaCompleta: afterTomorrow,
    cierre: false,
    estado: "proximo"
  }
];

export const listado: ListingRecord[] = [
  {
    id: "pas-001",
    internoId: "int-001",
    internoNombre: "Carlos Mendoza Rivas",
    fechaVisita: tomorrow,
    area: "618",
    createdByRole: "capturador",
    status: "autorizado",
    visitantes: [
      {
        visitorId: "vis-001",
        nombre: "Maria Fernanda Lopez Ruiz",
        parentesco: "Esposa",
        edad: 39,
        menor: false,
        betada: false
      },
      {
        visitorId: "vis-002",
        nombre: "Ana Lucia Mendoza Lopez",
        parentesco: "Hija",
        edad: 8,
        menor: true,
        betada: false
      }
    ]
  },
  {
    id: "pas-002",
    internoId: "int-002",
    internoNombre: "Julio Cesar Ortega Lara",
    fechaVisita: tomorrow,
    area: "INTIMA",
    createdByRole: "supervisor",
    status: "capturado",
    menciones: "Presentarse 30 minutos antes. Validar mención manual.",
    visitantes: [
      {
        visitorId: "vis-003",
        nombre: "Rosa Elena Ortega Diaz",
        parentesco: "Hermana",
        edad: 35,
        menor: false,
        betada: true
      }
    ]
  },
  {
    id: "pas-003",
    internoId: "int-003",
    internoNombre: "Miguel Angel Varela Soto",
    fechaVisita: tomorrow,
    area: "618",
    createdByRole: "capturador",
    status: "impreso",
    visitantes: [
      {
        visitorId: "vis-004",
        nombre: "Lucia Soto Guerrero",
        parentesco: "Madre",
        edad: 49,
        menor: false,
        betada: false
      },
      {
        visitorId: "vis-005",
        nombre: "Diego Varela Soto",
        parentesco: "Hijo",
        edad: 14,
        menor: false,
        betada: false
      }
    ]
  }
];


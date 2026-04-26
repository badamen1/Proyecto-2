// lib/types.ts
export type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type ResultadoEstado = 'PENDIENTE' | 'VALIDADO' | 'ENTREGADO';
export type ResultadoFuente = 'FASIL' | 'EXTERNO' | 'MANUAL';

export type ResultadoLista = {
  id: string;
  paciente_nombre: string;
  paciente_documento: string;
  empresa_nombre: string | null;
  tipo_examen: string;
  fuente: ResultadoFuente;
  estado: ResultadoEstado;
  fecha_examen: string;
  fecha_carga: string;
  nombre_archivo: string | null;
};

export type ResultadoDetalle = ResultadoLista & {
  paciente: number;
  empresa: number | null;
  subido_por: number | null;
  subido_por_nombre: string | null;
  archivo_pdf: string;
  tipo_archivo: string;
  fecha_actualizacion: string;
  observaciones: string;
  id_orden_fasil: string | null;
};

export type RefreshResponse = {
  access: string;
};

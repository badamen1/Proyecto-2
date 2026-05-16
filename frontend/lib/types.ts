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
  paciente_documento: string | null;
  empresa_nombre: string | null;
  tipo_examen: string;
  fuente: ResultadoFuente;
  estado: ResultadoEstado;
  fecha_examen: string;
  fecha_carga: string;
  nombre_archivo: string | null;
  tiene_pdf?: boolean;
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

// === Inventario ===

export type ProductoCategoria = 'REACTIVO' | 'CONSUMIBLE' | 'MATERIAL_VIDRIO' | 'OTRO';
export type ProductoUnidadMedida = 'UNIDAD' | 'CAJA' | 'ML' | 'LT' | 'GR' | 'PAQUETE';
export type TipoMovimiento = 'INGRESO' | 'EGRESO';

export type ProductoLista = {
  id: number;
  codigo: string;
  nombre: string;
  categoria: ProductoCategoria;
  unidad_medida: ProductoUnidadMedida;
  stock_actual: number;
  stock_minimo: number;
  activo: boolean;
};

export type ProductoDetalle = ProductoLista & {
  proveedor_habitual: string;
  ultimo_costo: string | null;
  fecha_vencimiento: string | null;
  numero_lote: string;
  observaciones: string;
  fecha_registro: string;
  fecha_actualizacion: string;
};

export type ProductoBacteriologoDetalle = Omit<ProductoDetalle, 'ultimo_costo'>;

export type MovimientoLista = {
  id: number;
  producto_nombre: string;
  tipo: TipoMovimiento;
  cantidad: number;
  fecha_registro: string;
};

export type Movimiento = MovimientoLista & {
  producto: number;
  motivo: string;
  registrado_por: number | null;
  registrado_por_nombre: string | null;
};

export type InventarioAlertas = {
  stock_bajo: ProductoLista[];
  por_vencer: ProductoLista[];
  vencidos: ProductoLista[];
};

export type InventarioResumen = {
  total_productos: number;
  stock_bajo: number;
  sin_stock: number;
  vencidos: number;
  ultimos_movimientos: MovimientoLista[];
};

/**
 * Fase 0 — Lista de Precios **por cliente/contrato** (CRUD, Fase 2).
 *
 * Los códigos vienen de AS2. Cada cliente puede tener códigos, precios,
 * descripción y tipo distintos (ej. Petroecuador vs. Guaina). La hoja LP
 * real ya trae la columna `Tipo` (Material/Servicio).
 */

export type TipoItem = 'Material' | 'Servicio';

export interface ListaPreciosItem {
  id: number;
  codigo: string;
  descripcion: string;
  unidad: string;
  precio: number;
  tipo: TipoItem;
}

export interface ListaPrecios {
  id: number;
  cliente: string;
  numeroContrato: string;
  vigenteDesde: string;
  activa: boolean;
  items: ListaPreciosItem[];
}

export type ListaPreciosItemDraft = Omit<ListaPreciosItem, 'id'>;

export type CreateListaPreciosInput = Omit<ListaPrecios, 'id' | 'items'> & {
  items?: ListaPreciosItemDraft[];
};

/**
 * Guía de Remisión. Documento de traslado de mercadería a nivel nacional.
 * **Solo participa cuando hay ítems tipo Material** — es **requisito
 * previo a generar la prefactura** (no posterior al envío al cliente):
 * si el Reporte de Herramientas ya registró ítems tipo venta, `Generar
 * prefactura` queda bloqueado hasta que se elabore esta guía.
 *
 * NO es la Guía de Remisión electrónica del SRI (esa la emite AS2): acá se
 * referencia su número cuando exista.
 */

export interface GuiaRemisionItem {
  codigo: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  serie?: string;
}

export interface PersonaTransporte {
  nombreORazonSocial: string;
  rucCedula: string;
}

export interface GuiaRemision {
  id: number;
  pedidoId: number;
  /** Se completa después, cuando la prefactura ya existe (referencia, no requisito de creación). */
  prefacturaId?: number;
  fecha: string;

  clienteRuc?: string;
  solicitadoPor?: string;
  despachadoPor?: string;
  lugarOrigen: string;
  horaSalida?: string;
  horaLlegada?: string;

  personaTransporte?: PersonaTransporte;
  vehiculo?: string;
  placa?: string;

  items: GuiaRemisionItem[];
  firmaDynadrill?: { nombre: string; firmadoAt: string };
  firmaCliente?: { nombre: string; cedula: string; cargo: string; firmadoAt: string };
  /** Nº de la Guía de Remisión SRI real, una vez que AS2 la emite. */
  guiaRemisionAs2Ref?: string;
}

export type CreateGuiaRemisionInput = Omit<GuiaRemision, 'id' | 'pedidoId' | 'prefacturaId' | 'firmaDynadrill' | 'firmaCliente' | 'guiaRemisionAs2Ref'>;

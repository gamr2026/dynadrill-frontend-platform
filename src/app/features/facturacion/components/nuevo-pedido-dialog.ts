import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import type { NzUploadFile } from 'ng-zorro-antd/upload';
import { firstValueFrom } from 'rxjs';
import * as XLSX from 'xlsx';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillDatetimePickerComponent,
  DynadrillIconButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTextComponent,
  DynadrillUploadZoneComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../core/services/auth.service';
import {
  ItemEstimado,
  LINEA_SERVICIO_LABELS,
  LineaServicio,
  Pedido,
  TIPO_OT_LABELS,
  TIPO_SERVICIO_LABELS,
  TIPOS_SERVICIO_POR_LINEA,
  TipoOt,
  TipoServicio,
} from '../models/pedido.model';
import { ListaPrecios } from '../models/lista-precios.model';
import { Prefactura } from '../models/prefactura.model';
import { ListaPreciosService, PedidoService, PrefacturaService } from '../services/pedido.service';
import { RolesService } from '../../users/services/users.service';
import { ArticulosService } from '../../inventario/services/articulos.service';
import type { Articulo } from '../../inventario/models/articulo.model';
import {
  CatalogosService,
  UBICACION_VACIA,
  UbicacionSelectorComponent,
  type ClienteCatalogo,
  type TipoPersonaContacto,
  type UbicacionSeleccion,
} from '../../../shared/index';

/**
 * Línea estimada en edición — todos los campos como texto libre (mismo
 * patrón que unit-report-dialog: bindear un number a [value] de un
 * <input type="number"> hace que el valor tipeado "no pegue"). Ya NO se
 * deriva de un código elegido de la Lista de Precios interna — la
 * plantilla real de AS2 (ver `onCargarPlantilla`) trae su propia
 * descripción/precio/descuento, que puede no coincidir con ningún código
 * de esa lista.
 */
interface LineaEstimadaDraft {
  codigo: string;
  descripcion: string;
  unidad: string;
  cantidad: string;
  valorUnitario: string;
  descuentoPorcentaje: string;
  /** Pumping precarga estas líneas en "Asignar recursos" — ver ticket-detail-page.ts del módulo Pumping. */
  esQuimico: boolean;
}

/**
 * Documento de referencia adjuntado por Ventas — hoy solo aplica a Pumping
 * (ver `esPumping` en este mismo componente). Mismo criterio que el resto
 * de adjuntos de la app: se guarda el nombre del archivo, no su contenido.
 */
interface DocumentoAdjuntoDraft {
  /** `null` = todavía no subido (se sube recién al guardar, cuando ya hay `pedidoId`); con valor = ya persistido en el backend. */
  id: number | null;
  descripcion: string;
  archivo: NzUploadFile | null;
  /** Solo para los ya persistidos (`id` no nulo) — nombre real del archivo subido, para mostrarlo sin re-pedir el binario. */
  nombreOriginal?: string;
}

const LINEA_ESTIMADA_VACIA: LineaEstimadaDraft = {
  codigo: '',
  descripcion: '',
  unidad: '',
  cantidad: '1',
  valorUnitario: '0',
  descuentoPorcentaje: '0',
  esQuimico: false,
};

/** Cabecera real de la plantilla descargable de AS2 (hoja "Ventas", fila 4) — "AS2 Pedido Cliente.xlsx". */
const CABECERA_PLANTILLA_AS2 = 'Codigo Producto AS2';
const MAX_PLANTILLA_BYTES = 5 * 1024 * 1024;
/** Copia estática de la plantilla real de AS2 — ver public/plantillas/. */
const URL_PLANTILLA_AS2 = '/plantillas/as2-pedido-cliente.xlsx';

/** Condición de pago — dos categorías a pedido del cliente: normal vs. "SIN CRÉDITO" (plazos largos, sin línea de crédito). */
const CONDICION_PAGO_OPTIONS: DynadrillSelectOption[] = [
  { label: '1 día', value: '1 día', group: 'Con crédito' },
  { label: '15 días', value: '15 días', group: 'Con crédito' },
  { label: '30 días', value: '30 días', group: 'Con crédito' },
  { label: '45 días', value: '45 días', group: 'Con crédito' },
  { label: '60 días', value: '60 días', group: 'Sin crédito' },
  { label: '90 días', value: '90 días', group: 'Sin crédito' },
  { label: '120 días', value: '120 días', group: 'Sin crédito' },
  { label: '150 días', value: '150 días', group: 'Sin crédito' },
  { label: '180 días', value: '180 días', group: 'Sin crédito' },
  { label: '210 días', value: '210 días', group: 'Sin crédito' },
];

/** Se pasa al abrir el diálogo en modo edición (ver pedido-detail-page). Sin `data`/`data.pedido`, arranca en modo alta. */
export interface NuevoPedidoDialogData {
  pedido?: Pedido;
}

/**
 * FACT-001 — alta de Pedido desde el Portal (rol Ventas). El gateway lo
 * empuja a AS2 (mock). La cabecera completa + una sola línea estimada.
 *
 * También sirve para editar un pedido existente (Ventas y Facturación, ver
 * `ModuleRoles.pedidos` en el backend) — se abre con `data: { pedido }` desde
 * `pedido-detail-page`; la sección Administrativos queda oculta para
 * Facturación en ese modo (a pedido del cliente: solo Ventas la gestiona).
 */
@Component({
  selector: 'app-nuevo-pedido-dialog',
  imports: [
    DecimalPipe,
    DynadrillBannerComponent,
    DynadrillInputComponent,
    DynadrillSelectComponent,
    DynadrillDatetimePickerComponent,
    DynadrillButtonComponent,
    DynadrillIconButtonComponent,
    DynadrillTextComponent,
    DynadrillUploadZoneComponent,
    UbicacionSelectorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './nuevo-pedido-dialog.html',
  styleUrl: './nuevo-pedido-dialog.scss',
})
export class NuevoPedidoDialog {
  private readonly pedidoService = inject(PedidoService);
  private readonly prefacturaService = inject(PrefacturaService);
  private readonly listaService = inject(ListaPreciosService);
  private readonly rolesService = inject(RolesService);
  private readonly catalogosService = inject(CatalogosService);
  private readonly articulosService = inject(ArticulosService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<NuevoPedidoDialog, Pedido | undefined>);
  private readonly data = inject<NuevoPedidoDialogData | null>(NZ_MODAL_DATA, { optional: true });

  /** Modo edición — se abrió con `data: { pedido }` desde el detalle de un pedido ya creado. */
  protected readonly editando = computed(() => !!this.data?.pedido);
  /** A pedido del cliente: en edición, Facturación no gestiona Administrativos (solo Ventas). En alta, solo Ventas llega acá igual. */
  protected readonly puedeVerAdministrativos = computed(
    () => !this.editando() || this.auth.currentUser()?.roleName !== 'Facturación',
  );

  // ── Cliente ──
  protected readonly cliente = signal<string | null>(null);
  protected readonly subcliente = signal('');
  protected readonly numeroContrato = signal('2025201');

  /** Catálogo real de clientes (ClientesController) — antes un array CLIENTES hardcodeado de 4 entradas. */
  private readonly clientesCatalogo = signal<ClienteCatalogo[]>([]);
  protected readonly clienteOptions = computed<DynadrillSelectOption[]>(() =>
    this.clientesCatalogo().map(c => ({ label: c.nombreComercial, value: c.nombreComercial })),
  );
  protected readonly clienteRuc = computed(
    () => this.clientesCatalogo().find(c => c.nombreComercial === this.cliente())?.identificacion ?? '',
  );
  /** Id real de ClienteCatalogo del cliente elegido — se manda al backend para que la prefactura matchee la Lista de Precios sin depender de que el texto sea idéntico (bug $0 reportado). `null` si el cliente no vino del catálogo (no debería pasar, el select solo ofrece catálogo). */
  protected readonly clienteId = computed(
    () => this.clientesCatalogo().find(c => c.nombreComercial === this.cliente())?.id ?? null,
  );

  // ── Servicio ──
  protected readonly lineaServicio = signal<LineaServicio | null>(null);
  protected readonly lineaOptions: DynadrillSelectOption[] = (Object.entries(LINEA_SERVICIO_LABELS) as [LineaServicio, string][]).map(
    ([value, label]) => ({ label, value }),
  );

  /** Segundo select, depende de la línea elegida — ver TIPOS_SERVICIO_POR_LINEA. */
  protected readonly tipoServicio = signal<TipoServicio | null>(null);
  protected readonly tipoServicioOptions = computed<DynadrillSelectOption[]>(() => {
    const linea = this.lineaServicio();
    if (!linea) return [];
    return TIPOS_SERVICIO_POR_LINEA[linea].map(value => ({ label: TIPO_SERVICIO_LABELS[value], value }));
  });

  /** Cambia la línea de servicio — el tipo de servicio elegido puede no aplicar a la línea nueva, así que se limpia. */
  protected onLineaServicioChange(value: LineaServicio | null): void {
    this.lineaServicio.set(value);
    this.tipoServicio.set(null);
  }

  /**
   * Clasifica el pedido como Venta o Servicio para el reporte de
   * Facturación — se pide siempre, para FCR y para Pumping (antes solo
   * aplicaba a FCR, decidía qué entrada del FcrTicket derivado se usa).
   */
  protected readonly tipoOt = signal<TipoOt | null>(null);
  protected readonly tipoOtOptions: DynadrillSelectOption[] = (Object.entries(TIPO_OT_LABELS) as [TipoOt, string][]).map(
    ([value, label]) => ({ label, value }),
  );
  protected readonly esPumping = computed(() => this.lineaServicio() === 'pumping');

  /**
   * Catálogo real de químicos de Inventario (categoría QUÍMICA) — antes
   * "Químico" era solo un checkbox sobre un código de texto libre, sin
   * ninguna garantía de que ese código existiera en Inventario; recién se
   * descubría el desfase en Pumping, al asignar recursos ("no aparece
   * como químico en el inventario"). Ahora, al marcar una línea como
   * químico, el código se elige de este catálogo (por código, no por
   * nombre — dos químicos pueden compartir nombre comercial) y
   * descripción/unidad se autocompletan del artículo real.
   */
  private readonly quimicosCatalogo = signal<Articulo[]>([]);
  protected readonly quimicoOptions = computed<DynadrillSelectOption[]>(() =>
    this.quimicosCatalogo().map(a => ({ label: `${a.codigo} — ${a.nombre}`, value: a.codigo })),
  );

  /**
   * Documentos de referencia — solo para Pumping (a pedido del cliente):
   * "que sepa de qué es el documento cargado" para que Pumping los vea ya
   * identificados en sus pasos, en vez de tener que volver a pedirlos.
   */
  protected readonly documentosAdjuntos = signal<DocumentoAdjuntoDraft[]>([]);

  protected agregarDocumentoAdjunto(): void {
    this.documentosAdjuntos.update(list => [...list, { id: null, descripcion: '', archivo: null }]);
  }

  /** Si ya está persistido (`id` no nulo), lo borra del backend antes de sacarlo de la lista — sin esto quedaba huérfano en disco. */
  protected quitarDocumentoAdjunto(index: number): void {
    const doc = this.documentosAdjuntos()[index];
    const pedidoId = this.data?.pedido?.id;
    if (doc?.id != null && pedidoId != null) {
      this.pedidoService.eliminarDocumentoAdjunto(pedidoId, doc.id).subscribe({
        error: () => this.notify.error('Error', 'No se pudo quitar el documento.'),
      });
    }
    this.documentosAdjuntos.update(list => list.filter((_, i) => i !== index));
  }

  protected onDocumentoAdjuntoDescripcionChange(index: number, descripcion: string): void {
    this.documentosAdjuntos.update(list => list.map((d, i) => (i === index ? { ...d, descripcion } : d)));
  }

  protected onDocumentoAdjuntoArchivoChange(index: number, archivo: NzUploadFile): void {
    this.documentosAdjuntos.update(list => list.map((d, i) => (i === index ? { ...d, archivo } : d)));
  }

  /** Campo / Bloque / Pozo / Taladro — del catálogo, vía <app-ubicacion-selector>. */
  protected readonly ubicacion = signal<UbicacionSeleccion>(UBICACION_VACIA);
  protected readonly fechaInicioServicio = signal<Date | null>(null);
  protected readonly fechaFinServicio = signal<Date | null>(null);

  // ── Comercial / responsables — selects con búsqueda desde PersonaContacto (antes texto libre) ──
  protected readonly agenteComercial = signal('');
  protected readonly representanteCampo = signal(''); // = "Company Man" (mismo rol, un solo catálogo)
  protected readonly representanteQuito = signal('');
  protected readonly analistaFacturacion = signal('');

  protected readonly agenteComercialOptions = signal<DynadrillSelectOption[]>([]);
  protected readonly representanteCampoOptions = signal<DynadrillSelectOption[]>([]);
  protected readonly representanteQuitoOptions = signal<DynadrillSelectOption[]>([]);
  protected readonly analistaFacturacionOptions = signal<DynadrillSelectOption[]>([]);

  /**
   * El label incluye la cédula cuando la persona la trae (hoy solo
   * 'representante_campo' = Company Man) — nz-select busca sobre el label,
   * así que esto habilita buscar por cédula además de por nombre sin
   * tocar el componente compartido. El value sigue siendo solo el nombre
   * (lo que se guarda en el Pedido), sin cambios ahí.
   */
  private cargarPersonas(tipo: TipoPersonaContacto, destino: typeof this.agenteComercialOptions): void {
    this.catalogosService.personas(tipo).subscribe(personas => {
      destino.set(personas.map(p => ({ label: p.cedula ? `${p.nombre} — ${p.cedula}` : p.nombre, value: p.nombre })));
    });
  }
  /**
   * FACT-001 Fase 2/3: "Asignar Técnico HSE responsable" — el sistema no
   * activa/distribuye el ticket sin uno con rol activo. El backend
   * re-valida contra el usuario real; acá solo se lista para elegir.
   */
  protected readonly tecnicoHseResponsableId = signal<number | null>(null);
  protected readonly tecnicoHseOptions = signal<DynadrillSelectOption[]>([]);

  // ── Administrativos ──
  protected readonly condicionPago = signal('30 días');
  protected readonly condicionPagoOptions = CONDICION_PAGO_OPTIONS;
  /** Se autocompleta al elegir el Pozo (Campo -> Zona, ver onUbicacionChange) — editable para el ~7% de campos sin zona mapeada en el Excel. */
  protected readonly zona = signal('');
  protected readonly bodega = signal('BODEGA ORION');
  protected readonly solicitudMedio = signal<'verbal' | 'escrita'>('escrita');
  protected readonly solicitudMedioOptions: DynadrillSelectOption[] = [
    { label: 'Escrita', value: 'escrita' },
    { label: 'Verbal', value: 'verbal' },
  ];

  // ── Estimado (1 o varias líneas — texto libre, o cargadas desde la plantilla real de AS2) ──
  /** Solo para la advertencia "no está en la Lista de Precios de Dynadrill" — ya no restringe qué se puede tipear/cargar. */
  protected readonly listaCliente = signal<ListaPrecios | null>(null);

  protected readonly lineasEstimadas = signal<LineaEstimadaDraft[]>([{ ...LINEA_ESTIMADA_VACIA }]);

  /** true si el código NO está en la Lista de Precios interna del cliente — esa línea no entrará a la prefactura automática (armarPrefacturaItems solo toma códigos conocidos). */
  protected codigoFueraDeListaPrecios(codigo: string): boolean {
    const lista = this.listaCliente();
    if (!lista || !codigo.trim()) return false;
    return !lista.items.some(i => i.codigo === codigo.trim());
  }

  protected agregarLinea(): void {
    this.lineasEstimadas.update(ls => [...ls, { ...LINEA_ESTIMADA_VACIA }]);
  }

  protected quitarLinea(index: number): void {
    this.lineasEstimadas.update(ls => (ls.length > 1 ? ls.filter((_, i) => i !== index) : ls));
  }

  protected onLineaCampoChange<K extends keyof LineaEstimadaDraft>(index: number, campo: K, valor: LineaEstimadaDraft[K]): void {
    this.lineasEstimadas.update(ls => ls.map((l, i) => (i === index ? { ...l, [campo]: valor } : l)));
  }

  /**
   * Al marcar una línea como "Químico" se selecciona el código del
   * catálogo real de Inventario (no se tipea) — garantiza que el código
   * que llega a Pumping siempre matchee contra Inventario. Autocompleta
   * descripción y unidad del artículo real; el precio/cantidad/descuento
   * los sigue definiendo Ventas (Inventario no cotiza).
   */
  protected onQuimicoCodigoSeleccionado(index: number, codigo: string | null): void {
    const articulo = this.quimicosCatalogo().find(a => a.codigo === codigo);
    this.lineasEstimadas.update(ls =>
      ls.map((l, i) =>
        i === index
          ? { ...l, codigo: articulo?.codigo ?? '', descripcion: articulo?.nombre ?? l.descripcion, unidad: articulo?.unidadStock ?? l.unidad }
          : l,
      ),
    );
  }

  /**
   * Al tildar/destildar "Químico" en una línea que ya tenía un código de
   * texto libre cargado, se limpia — así no queda un código que Pumping
   * después no va a encontrar en Inventario (justamente lo que se quiere
   * evitar); el usuario elige uno real del select que aparece.
   */
  protected onQuimicoToggle(index: number, esQuimico: boolean): void {
    this.lineasEstimadas.update(ls =>
      ls.map((l, i) => (i === index ? { ...l, esQuimico, codigo: esQuimico ? '' : l.codigo } : l)),
    );
  }

  private lineaValida(l: LineaEstimadaDraft): boolean {
    return !!l.codigo.trim() && !!l.descripcion.trim() && Number(l.cantidad) > 0 && Number(l.valorUnitario) > 0;
  }

  protected readonly lineasTodasValidas = computed(() => this.lineasEstimadas().every(l => this.lineaValida(l)));
  protected readonly valorEstimadoTotal = computed(() =>
    Math.round(this.lineasEstimadas().reduce((s, l) => s + Number(l.cantidad) * Number(l.valorUnitario), 0) * 100) / 100,
  );

  /**
   * Carga la plantilla real "AS2 Pedido Cliente.xlsx" (hoja "Ventas": Codigo
   * Producto AS2, Codigo UN, Cantidad, Descripción, Precio, Porcentaje
   * Descuento) — reemplaza las líneas actuales por TODOS los registros del
   * archivo, tal como pidió el cliente.
   */
  /** Copia estática servida por el propio frontend (public/plantillas/) — el mismo formato que espera `onCargarPlantilla`. */
  protected descargarPlantilla(): void {
    const a = document.createElement('a');
    a.href = URL_PLANTILLA_AS2;
    a.download = 'AS2 Pedido Cliente.xlsx';
    a.click();
  }

  protected onCargarPlantilla(file: NzUploadFile): void {
    const archivo = (file.originFileObj as File | undefined) ?? (file as unknown as File);
    if (!archivo || typeof archivo.size !== 'number') {
      this.notify.error('Archivo no reconocido', 'No se pudo leer el archivo seleccionado. Probá de nuevo.');
      return;
    }
    if (archivo.size > MAX_PLANTILLA_BYTES) {
      this.notify.error('Archivo demasiado grande', 'El archivo supera el máximo permitido de 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = evento => {
      try {
        const datos = new Uint8Array(evento.target!.result as ArrayBuffer);
        const libro = XLSX.read(datos, { type: 'array' });
        const hoja = libro.Sheets[libro.SheetNames[0]];
        const filas = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, defval: '', raw: false });

        const idxCabecera = filas.findIndex(f => (f[0] ?? '').toString().trim() === CABECERA_PLANTILLA_AS2);
        if (idxCabecera === -1) {
          this.notify.error(
            'Plantilla no reconocida',
            `No se encontró el encabezado "${CABECERA_PLANTILLA_AS2}" — ¿es la plantilla de AS2 Pedido Cliente?`,
          );
          return;
        }

        const lineas: LineaEstimadaDraft[] = [];
        for (const fila of filas.slice(idxCabecera + 1)) {
          const codigo = (fila[0] ?? '').toString().trim();
          if (!codigo) break; // primera fila vacía = fin de los datos
          const unidad = (fila[1] ?? '').toString().trim();
          const cantidad = (fila[2] ?? '').toString().trim();
          const descripcion = (fila[3] ?? '').toString().trim();
          const precio = (fila[4] ?? '').toString().trim();
          const descuento = (fila[5] ?? '').toString().trim();
          lineas.push({
            codigo,
            descripcion,
            unidad,
            cantidad: cantidad || '1',
            valorUnitario: precio || '0',
            descuentoPorcentaje: descuento || '0',
            esQuimico: false,
          });
        }

        if (!lineas.length) {
          this.notify.error('Sin registros', 'La plantilla no trae ninguna línea después del encabezado.');
          return;
        }
        this.lineasEstimadas.set(lineas);
        this.notify.success('Plantilla cargada', `${lineas.length} línea(s) cargada(s) desde el archivo.`);
      } catch {
        this.notify.error('Error al leer el archivo', 'No se pudo procesar el Excel. Verificá que no esté dañado.');
      }
    };
    reader.readAsArrayBuffer(archivo);
  }

  protected readonly submitting = signal(false);

  protected readonly puedeGuardar = computed(
    () =>
      !!this.cliente() &&
      !!this.lineaServicio() &&
      !!this.tipoServicio() &&
      !!this.tipoOt() &&
      this.ubicacion().pozoId !== null &&
      this.ubicacion().taladroId !== null &&
      this.agenteComercial().trim().length > 0 &&
      this.representanteCampo().trim().length > 0 &&
      this.representanteQuito().trim().length > 0 &&
      this.tecnicoHseResponsableId() !== null &&
      this.lineasTodasValidas(),
  );

  /** Prefill de <app-ubicacion-selector> en modo edición — el propio componente resuelve ids contra el catálogo. */
  protected readonly ubicacionInicial = computed<Partial<UbicacionSeleccion> | null>(() => {
    const p = this.data?.pedido;
    if (!p) return null;
    return {
      pozoId: p.pozoId ?? null,
      pozo: p.pozo,
      nombreCompletoPozo: p.nombreCompletoPozo ?? '',
      campoId: p.campoId ?? null,
      campo: p.campo,
      bloqueId: p.bloqueId ?? null,
      bloque: p.bloque,
      taladroId: p.taladroId ?? null,
      taladro: p.taladroRig,
    };
  });

  /** Solo se consulta en edición — si el pedido ya tiene prefactura, decide el aviso sobre "Líneas estimadas". */
  protected readonly prefacturaExistente = signal<Prefactura | null>(null);

  /**
   * Mientras la prefactura sigue en 'generada' (no salió al cliente), editar
   * el pedido SÍ actualiza su valor (ver `recalcularPrefacturaSiAplica` en
   * el backend) — de ahí el aviso, no un bloqueo. Una vez enviada/firmada
   * queda congelada a propósito y el aviso lo dice explícito.
   */
  protected readonly avisoPrefactura = computed<{ variant: 'warning' | 'info'; mensaje: string } | null>(() => {
    const pf = this.prefacturaExistente();
    if (!pf) return null;
    if (pf.estado === 'generada') {
      return {
        variant: 'warning',
        mensaje: `Este pedido ya tiene la prefactura ${pf.code} generada — al guardar, su valor se actualiza con estos cambios.`,
      };
    }
    return {
      variant: 'info',
      mensaje: `Este pedido ya tiene la prefactura ${pf.code} (${pf.estado.replace(/_/g, ' ')}) — ya no se actualiza automáticamente al editar.`,
    };
  });

  constructor() {
    this.listaService.list().subscribe(listas => {
      this.actualizarListaCliente(listas);
    });
    this.rolesService.usuariosPorRol('tecnico_hse').subscribe(usuarios => {
      this.tecnicoHseOptions.set(usuarios.map(u => ({ label: u.name, value: u.id })));
    });
    this.catalogosService.clientes().subscribe(clientes => this.clientesCatalogo.set(clientes));
    this.articulosService.list({ categoria: 'QUIMICA', activo: true }).subscribe(articulos => this.quimicosCatalogo.set(articulos));
    this.cargarPersonas('agente_comercial', this.agenteComercialOptions);
    this.cargarPersonas('representante_campo', this.representanteCampoOptions);
    this.cargarPersonas('representante_quito', this.representanteQuitoOptions);
    this.cargarPersonas('analista_facturacion', this.analistaFacturacionOptions);

    const p = this.data?.pedido;
    if (p) {
      this.prefillDesdePedido(p);
      this.prefacturaService.dePedido(p.id).subscribe(pf => this.prefacturaExistente.set(pf));
      this.pedidoService.listarDocumentosAdjuntos(p.id).subscribe(docs => {
        this.documentosAdjuntos.set(
          docs.map(d => ({ id: d.id, descripcion: d.descripcion, archivo: null, nombreOriginal: d.nombreOriginal })),
        );
      });
    }
  }

  /** Autocompleta Zona (Campo -> Zona, ver FACT-001) — solo si el campo elegido tiene una zona mapeada; si no, se deja como estaba para que Ventas la complete a mano. */
  protected onUbicacionChange(sel: UbicacionSeleccion): void {
    this.ubicacion.set(sel);
    if (sel.zona) this.zona.set(sel.zona);
  }

  /** Modo edición — vuelca el pedido ya creado a las señales del formulario. `ubicacion`/`ubicacionInicial` los resuelve <app-ubicacion-selector>. */
  private prefillDesdePedido(p: Pedido): void {
    this.cliente.set(p.cliente);
    this.subcliente.set(p.subcliente ?? '');
    this.numeroContrato.set(p.numeroContrato ?? '');
    this.lineaServicio.set(p.lineaServicio);
    this.tipoServicio.set(p.tipoServicio ?? null);
    this.tipoOt.set(p.tipoOt);
    this.fechaInicioServicio.set(p.fechaInicioServicio ? new Date(p.fechaInicioServicio) : null);
    this.fechaFinServicio.set(p.fechaFinServicio ? new Date(p.fechaFinServicio) : null);
    this.agenteComercial.set(p.agenteComercial ?? '');
    this.representanteCampo.set(p.representanteCampo ?? '');
    this.representanteQuito.set(p.representanteQuito ?? '');
    this.analistaFacturacion.set(p.analistaFacturacion ?? '');
    this.tecnicoHseResponsableId.set(p.tecnicoHseResponsableId ?? null);
    this.condicionPago.set(p.condicionPago ?? '30 días');
    this.zona.set(p.zona ?? '');
    this.bodega.set(p.bodega ?? '');
    this.solicitudMedio.set(p.solicitudMedio ?? 'escrita');
    if (p.itemsEstimados?.length) {
      this.lineasEstimadas.set(
        p.itemsEstimados.map(it => ({
          codigo: it.codigo,
          descripcion: it.descripcion,
          unidad: it.unidad,
          cantidad: String(it.cantidad),
          valorUnitario: String(it.valorUnitario),
          descuentoPorcentaje: it.descuentoPorcentaje != null ? String(it.descuentoPorcentaje) : '0',
          esQuimico: it.esQuimico ?? false,
        })),
      );
    }
  }

  private todasLasListas: ListaPrecios[] = [];

  private actualizarListaCliente(listas: ListaPrecios[]): void {
    this.todasLasListas = listas;
    this.emparejarLista();
  }

  /**
   * Solo actualiza `listaCliente` (para la advertencia de "código fuera de
   * la Lista de Precios") — ya NO toca `lineasEstimadas`: los códigos son
   * texto libre, no dependen de que existan en la lista del cliente elegido.
   */
  private emparejarLista(): void {
    this.listaCliente.set(
      this.todasLasListas.find(l => l.cliente === this.cliente() && l.numeroContrato === this.numeroContrato() && l.activa) ??
        this.todasLasListas.find(l => l.cliente === this.cliente() && l.activa) ??
        null,
    );
  }

  protected onClienteChange(value: string): void {
    this.cliente.set(value);
    this.emparejarLista();
  }

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected guardar(): void {
    if (!this.puedeGuardar() || this.submitting()) return;
    this.submitting.set(true);

    const nombre = this.auth.currentUser()?.name ?? 'Ventas';
    const itemsEstimados: ItemEstimado[] = this.lineasEstimadas().map(l => ({
      codigo: l.codigo.trim(),
      descripcion: l.descripcion.trim(),
      unidad: l.unidad.trim(),
      cantidad: Number(l.cantidad),
      valorUnitario: Number(l.valorUnitario),
      descuentoPorcentaje: Number(l.descuentoPorcentaje) || 0,
      esQuimico: l.esQuimico,
    }));

    const payload = {
      origen: 'portal' as const,
      cliente: this.cliente()!,
      clienteRuc: this.clienteRuc() || undefined,
      clienteId: this.clienteId() ?? undefined,
      subcliente: this.subcliente().trim() || undefined,
      lineaServicio: this.lineaServicio()!,
      tipoServicio: this.tipoServicio()!,
      tipoOt: this.tipoOt()!,
      campo: this.ubicacion().campo,
      bloque: this.ubicacion().bloque,
      pozo: this.ubicacion().pozo,
      taladroRig: this.ubicacion().taladro,
      campoId: this.ubicacion().campoId ?? undefined,
      bloqueId: this.ubicacion().bloqueId ?? undefined,
      pozoId: this.ubicacion().pozoId ?? undefined,
      nombreCompletoPozo: this.ubicacion().nombreCompletoPozo || undefined,
      taladroId: this.ubicacion().taladroId ?? undefined,
      numeroContrato: this.numeroContrato().trim(),
      agenteComercial: this.agenteComercial().trim(),
      representanteCampo: this.representanteCampo().trim(),
      representanteQuito: this.representanteQuito().trim(),
      analistaFacturacion: this.analistaFacturacion().trim() || undefined,
      tecnicoHseResponsableId: this.tecnicoHseResponsableId()!,
      condicionPago: this.condicionPago().trim() || undefined,
      solicitudMedio: this.solicitudMedio(),
      zona: this.zona().trim() || undefined,
      bodega: this.bodega().trim() || undefined,
      itemsEstimados,
      fechaInicioServicio: this.fechaInicioServicio()?.toISOString().slice(0, 10),
      fechaFinServicio: this.fechaFinServicio()?.toISOString().slice(0, 10),
      createdBy: nombre,
    };

    const pedidoExistente = this.data?.pedido;
    const request = pedidoExistente
      ? this.pedidoService.update(pedidoExistente.id, payload)
      : this.pedidoService.create(payload);

    request.subscribe({
      next: pedido => void this.subirDocumentosPendientesYCerrar(pedido, !!pedidoExistente),
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', pedidoExistente ? 'No se pudo actualizar el pedido.' : 'No se pudo crear el pedido.');
      },
    });
  }

  /**
   * El pedido recién quedó creado/actualizado (ya tiene `id`) — ahora sí se
   * pueden subir los documentos adjuntos pendientes (los que el usuario
   * eligió en este mismo formulario, `id: null`). Antes esto se mandaba
   * como metadata dentro del propio payload del pedido, sin contenido real.
   */
  private async subirDocumentosPendientesYCerrar(pedido: Pedido, esEdicion: boolean): Promise<void> {
    const pendientes = this.documentosAdjuntos().filter(d => d.id === null && d.archivo);
    try {
      for (const doc of pendientes) {
        const archivo = (doc.archivo!.originFileObj as File | undefined) ?? (doc.archivo as unknown as File);
        if (!archivo || typeof archivo.size !== 'number') continue;
        await firstValueFrom(this.pedidoService.subirDocumentoAdjunto(pedido.id, doc.descripcion.trim(), archivo));
      }
      this.notify.success(
        esEdicion ? 'Pedido actualizado' : 'Pedido creado',
        esEdicion ? `Pedido ${pedido.code} actualizado.` : `Pedido ${pedido.code} registrado y sincronizado con AS2.`,
      );
      this.modalRef.close(pedido);
    } catch {
      this.submitting.set(false);
      this.notify.error('Documentos no subidos', 'El pedido se guardó, pero algún documento adjunto no se pudo subir. Volvé a intentarlo desde "Editar pedido".');
    }
  }
}

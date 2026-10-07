import { DecimalPipe } from '@angular/common';
import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import type { NzUploadFile } from 'ng-zorro-antd/upload';
import { firstValueFrom, map } from 'rxjs';
import * as XLSX from 'xlsx';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillChipGroupComponent,
  DynadrillDatetimePickerComponent,
  DynadrillDialogService,
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
  subTiposServicioDisponibles,
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
  type PersonaContacto,
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
  /** Igual que `esQuimico`, pero contra el catálogo de herramientas de Inventario (categoría HERRAMIENTAS). */
  esHerramienta: boolean;
  /** La prefactura factura exactamente esta cantidad — no la recalcula con los días del Reporte Job (ver `cantidadFija` en pedido.model.ts). */
  cantidadFija: boolean;
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
  esHerramienta: false,
  cantidadFija: false,
};

/** Cabecera real de la plantilla descargable de AS2 (hoja "Ventas", fila 4) — "AS2 Pedido Cliente.xlsx". */
const CABECERA_PLANTILLA_AS2 = 'Codigo Producto AS2';
const MAX_PLANTILLA_BYTES = 5 * 1024 * 1024;
/** Copia estática de la plantilla real de AS2 — ver public/plantillas/. */
const URL_PLANTILLA_AS2 = '/plantillas/as2-pedido-cliente.xlsx';

/**
 * Plantillas de ejemplo (mismo formato AS2, con la columna opcional "Cantidad fija") armadas con las líneas de tickets
 * reales del cliente — 4368 y 4412 de Pumping, 4426 de FCR. "Cargar" las aplica directo; también se pueden descargar y
 * subir con "Cargar plantilla". Fijan la línea de servicio y el tipo de servicio que usó ese ticket.
 */
interface PlantillaEjemplo {
  id: string;
  titulo: string;
  detalle: string;
  archivo: string;
  linea: LineaServicio;
  tipoServicio: TipoServicio;
}

const PLANTILLAS_EJEMPLO: PlantillaEjemplo[] = [
  {
    id: 'pumping-bes',
    titulo: 'Pumping · Limpieza de equipo BES con CTU',
    detalle: 'Ticket 4368 — 37 líneas, 5 químicos',
    archivo: 'pedido-pumping-limpieza-bes-4368.xlsx',
    linea: 'pumping',
    tipoServicio: 'coiled_tubing',
  },
  {
    id: 'pumping-linea',
    titulo: 'Pumping · Limpieza de línea de superficie y flushing',
    detalle: 'Ticket 4412 — 38 líneas, 4 químicos',
    archivo: 'pedido-pumping-limpieza-linea-4412.xlsx',
    linea: 'pumping',
    tipoServicio: 'coiled_tubing',
  },
  {
    id: 'fcr-sarta',
    titulo: 'FCR · Sarta de limpieza de casing 7"',
    detalle: 'Ticket 4426 — sarta de limpieza, subs y movilización (4 líneas)',
    archivo: 'pedido-fcr-sarta-limpieza-4426.xlsx',
    linea: 'fcr',
    tipoServicio: 'wellbore_cleanup_tools',
  },
];

/**
 * Mismos tipos que acepta el backend para documentos adjuntos del Pedido
 * (`TIPOS_ARCHIVO_DOCUMENTO_PEDIDO` en pedido-documentos.constants.ts) — acá
 * solo se puede chequear `File.type` (MIME reportado por el navegador, no
 * magic number), así que esto es una validación temprana, no la definitiva:
 * el backend sigue siendo quien manda.
 */
const TIPOS_ARCHIVO_DOCUMENTO_PEDIDO =
  /^application\/pdf$|^image\/(jpeg|png)$|^application\/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet)$/i;

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
    DynadrillChipGroupComponent,
    DynadrillIconButtonComponent,
    DynadrillTextComponent,
    DynadrillUploadZoneComponent,
    UbicacionSelectorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './nuevo-pedido-dialog.html',
  styleUrl: './nuevo-pedido-dialog.scss',
  // Marca para styles.scss: en móvil el diálogo se abre a pantalla completa (Figma "Nuevo pedido").
  host: { class: 'app-dialog-fullscreen-mobile' },
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
  private readonly dialog = inject(DynadrillDialogService);
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

  /** Segundo select, depende de la línea elegida — ver TIPOS_SERVICIO_POR_LINEA. FCR puede llevar más de un tipo (ej. Fishing + Milling en la misma OT); Pumping solo uno. */
  protected readonly tipoServicio = signal<TipoServicio[]>([]);
  protected readonly tipoServicioOptions = computed<DynadrillSelectOption[]>(() => {
    const linea = this.lineaServicio();
    if (!linea) return [];
    return TIPOS_SERVICIO_POR_LINEA[linea].map(value => ({ label: TIPO_SERVICIO_LABELS[value], value }));
  });

  /** Valor del select: lista en FCR, un solo tipo (o nada) en Pumping. */
  protected readonly tipoServicioValor = computed<TipoServicio[] | TipoServicio | null>(() =>
    this.esFcr() ? this.tipoServicio() : this.tipoServicio().at(0) ?? null,
  );

  /** Cambia la línea de servicio — los tipos de servicio elegidos pueden no aplicar a la línea nueva, así que se limpian. */
  protected onLineaServicioChange(value: LineaServicio | null): void {
    this.lineaServicio.set(value);
    this.tipoServicio.set([]);
    this.subTipoServicio.set([]);
  }

  /** Tercer select (solo FCR), depende de los Tipos de servicio elegidos (varios tipos → unión de sus sub-tipos). Solo descriptivo, no acoplado a IPERC. */
  protected readonly subTipoServicio = signal<string[]>([]);
  protected readonly subTipoServicioOptions = computed<DynadrillSelectOption[]>(() =>
    subTiposServicioDisponibles(this.tipoServicio()).map(value => ({ label: value, value })),
  );

  protected onTipoServicioChange(value: unknown): void {
    // Pumping admite un solo tipo (el select es simple y emite un valor suelto); FCR admite varios.
    const tipos = Array.isArray(value) ? (value as TipoServicio[]) : value ? [value as TipoServicio] : [];
    this.tipoServicio.set(tipos);
    // Un sub-tipo ya elegido puede dejar de aplicar si se destilda el tipo que lo traía.
    const disponibles = new Set(subTiposServicioDisponibles(tipos));
    this.subTipoServicio.update(actuales => actuales.filter(s => disponibles.has(s)));
  }

  protected onSubTipoServicioChange(value: unknown): void {
    this.subTipoServicio.set(Array.isArray(value) ? (value as string[]) : []);
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
  /** FCR (fishing/completion) se asume siempre herramienta — no hace falta un checkbox para elegirlo línea por línea, el selector de herramienta aparece directo en la columna Código. */
  protected readonly esFcr = computed(() => this.lineaServicio() === 'fcr');

  /**
   * Catálogo completo de químicos de Inventario (categoría QUÍMICA) — antes
   * "Químico" era solo un checkbox sobre un código de texto libre, sin
   * ninguna garantía de que ese código existiera en Inventario; recién se
   * descubría el desfase en Pumping, al asignar recursos ("no aparece
   * como químico en el inventario"). Se carga completo una sola vez;
   * `quimicosCatalogo` (más abajo) es el que realmente se ofrece para
   * elegir, filtrado por el cliente seleccionado.
   */
  private readonly quimicosCatalogoCompleto = signal<Articulo[]>([]);
  /** Mismo mecanismo que `quimicosCatalogoCompleto`, pero para herramientas (categoría HERRAMIENTAS de Inventario). */
  private readonly herramientasCatalogoCompleto = signal<Articulo[]>([]);

  /**
   * Solo se pueden elegir los códigos que además están en la Lista de
   * Precios del cliente seleccionado — Inventario es el catálogo interno de
   * Dynadrill (no distingue cliente), así que sin este filtro se podían
   * elegir códigos que le pertenecen a otro cliente. Sin cliente elegido (o
   * sin Lista de Precios activa para él) no hay nada para ofrecer todavía.
   */
  protected readonly quimicosCatalogo = computed<Articulo[]>(() => {
    const lista = this.listaCliente();
    if (!lista) return [];
    const codigos = new Set(lista.items.map(i => i.codigo));
    return this.quimicosCatalogoCompleto().filter(a => codigos.has(a.codigo));
  });
  protected readonly quimicoOptions = computed<DynadrillSelectOption[]>(() =>
    this.conCodigosDeLasLineas(this.quimicosCatalogo().map(a => ({ label: `${a.codigo} — ${a.nombre}`, value: a.codigo })), l => l.esQuimico),
  );

  /**
   * Las opciones salen de la Lista de Precios del cliente, que recién existe al elegir cliente. Si las líneas ya vienen cargadas
   * (plantilla, edición), se suman sus códigos para que el selector los muestre en vez de quedar vacío.
   */
  private conCodigosDeLasLineas(opciones: DynadrillSelectOption[], esDelTipo: (l: LineaEstimadaDraft) => boolean): DynadrillSelectOption[] {
    const presentes = new Set(opciones.map(o => o.value));
    const extra = this.lineasEstimadas()
      .filter(l => esDelTipo(l) && l.codigo && !presentes.has(l.codigo))
      .map(l => ({ label: `${l.codigo} — ${l.descripcion}`, value: l.codigo }));
    return [...opciones, ...extra];
  }

  /** Espejo de `quimicosCatalogo`, para herramientas. */
  protected readonly herramientasCatalogo = computed<Articulo[]>(() => {
    const lista = this.listaCliente();
    if (!lista) return [];
    const codigos = new Set(lista.items.map(i => i.codigo));
    return this.herramientasCatalogoCompleto().filter(a => codigos.has(a.codigo));
  });
  protected readonly herramientaOptions = computed<DynadrillSelectOption[]>(() =>
    this.conCodigosDeLasLineas(this.herramientasCatalogo().map(a => ({ label: `${a.codigo} — ${a.nombre}`, value: a.codigo })), l => l.esHerramienta || this.esFcr()),
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

  /**
   * Rechaza de una el archivo si el tipo no es uno de los que el backend
   * acepta — antes se guardaba igual en el draft y recién fallaba al subirlo
   * DESPUÉS de crear el pedido (mensaje "el pedido se guardó, pero..."). Con
   * esto el archivo inválido nunca entra al draft, así que `puedeGuardar`
   * (que exige archivo en cada fila) bloquea la creación del pedido.
   */
  protected onDocumentoAdjuntoArchivoChange(index: number, archivo: NzUploadFile): void {
    const file = (archivo.originFileObj as File | undefined) ?? (archivo as unknown as File);
    if (!file || !TIPOS_ARCHIVO_DOCUMENTO_PEDIDO.test(file.type)) {
      this.notify.error('Archivo no válido', 'Solo se aceptan PDF, imágenes (JPG/PNG) o documentos Word/Excel.');
      return;
    }
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
      this.personasPorTipo.update(m => ({ ...m, [tipo]: personas }));
      destino.set(personas.map(p => ({ label: p.cedula ? `${p.nombre} — ${p.cedula}` : p.nombre, value: p.nombre })));
    });
  }

  // ── Alta rápida / baja de personas desde el propio select (se guardan en la base) ──

  private readonly personasPorTipo = signal<Partial<Record<TipoPersonaContacto, PersonaContacto[]>>>({});

  private personaSelects(tipo: TipoPersonaContacto) {
    switch (tipo) {
      case 'agente_comercial':
        return { valor: this.agenteComercial, opciones: this.agenteComercialOptions };
      case 'representante_campo':
        return { valor: this.representanteCampo, opciones: this.representanteCampoOptions };
      case 'representante_quito':
        return { valor: this.representanteQuito, opciones: this.representanteQuitoOptions };
      case 'analista_facturacion':
        return { valor: this.analistaFacturacion, opciones: this.analistaFacturacionOptions };
    }
  }

  protected altaPersona(tipo: TipoPersonaContacto, texto: string): void {
    const nombre = texto.trim();
    if (!nombre) return;
    const { valor } = this.personaSelects(tipo);
    const existente = (this.personasPorTipo()[tipo] ?? []).find(p => p.nombre.toLowerCase() === nombre.toLowerCase());
    if (existente) {
      valor.set(existente.nombre);
      return;
    }
    this.catalogosService.crearPersona({ tipo, nombre }).subscribe({
      next: persona => {
        this.personasPorTipo.update(m => ({ ...m, [tipo]: [...(m[tipo] ?? []), persona] }));
        this.personaSelects(tipo).opciones.update(o => [...o, { label: persona.nombre, value: persona.nombre }]);
        valor.set(persona.nombre);
        this.notify.success('Guardado', `${persona.nombre} agregado al catálogo.`);
      },
      error: () => this.notify.error('Error', 'No se pudo guardar. Solo Ventas puede agregar personas.'),
    });
  }

  protected async eliminarPersona(tipo: TipoPersonaContacto): Promise<void> {
    const { valor, opciones } = this.personaSelects(tipo);
    const persona = (this.personasPorTipo()[tipo] ?? []).find(p => p.nombre === valor());
    if (!persona) return;
    const confirmado = await this.dialog.confirm({
      title: `¿Eliminar a ${persona.nombre}?`,
      content: 'Se quita del catálogo para todos. Los pedidos que ya lo usan conservan su dato. Esta acción no se puede deshacer.',
      okText: 'Eliminar',
      danger: true,
    });
    if (!confirmado) return;
    this.catalogosService.eliminarPersona(persona.id).subscribe({
      next: () => {
        this.personasPorTipo.update(m => ({ ...m, [tipo]: (m[tipo] ?? []).filter(p => p.id !== persona.id) }));
        opciones.update(o => o.filter(x => x.value !== persona.nombre));
        valor.set('');
        this.notify.success('Eliminado', `${persona.nombre} eliminado.`);
      },
      error: () => this.notify.error('Error', 'No se pudo eliminar.'),
    });
  }

  protected puedeEliminarPersona(tipo: TipoPersonaContacto): boolean {
    const valor = this.personaSelects(tipo).valor();
    return !!valor && (this.personasPorTipo()[tipo] ?? []).some(p => p.nombre === valor);
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
   * Precio con el que autocompletar `valorUnitario` al elegir un código de
   * Inventario: primero el precio REAL de la Lista de Precios del cliente
   * elegido (es el precio ya pactado, no hace falta retipearlo); si el
   * código no está ahí, el precio sugerido del catálogo de referencia
   * "Normal" (sin cliente asociado) como punto de partida editable — nunca
   * el costo interno Dynadrill (`costoUnitario`), que no es precio de venta.
   */
  private precioSugeridoParaCodigo(codigo: string): number | null {
    const enListaCliente = this.listaCliente()?.items.find(i => i.codigo === codigo)?.precio;
    if (enListaCliente != null) return enListaCliente;
    const listaReferencia = this.todasLasListas.find(lp => lp.clienteId == null);
    return listaReferencia?.items.find(i => i.codigo === codigo)?.precio ?? null;
  }

  /**
   * Al marcar una línea como "Químico" se selecciona el código del
   * catálogo real de Inventario (no se tipea) — garantiza que el código
   * que llega a Pumping siempre matchee contra Inventario. Autocompleta
   * descripción, unidad, precio unitario (ver `precioSugeridoParaCodigo`) y
   * % de descuento sugerido (Lista de Descuentos, a nivel general) — Ventas
   * puede seguir ajustando cualquiera de estos valores a mano.
   */
  protected onQuimicoCodigoSeleccionado(index: number, codigo: string | null): void {
    const articulo = this.quimicosCatalogo().find(a => a.codigo === codigo);
    const precio = codigo ? this.precioSugeridoParaCodigo(codigo) : null;
    this.lineasEstimadas.update(ls =>
      ls.map((l, i) =>
        i === index
          ? {
              ...l,
              codigo: articulo?.codigo ?? '',
              descripcion: articulo?.nombre ?? l.descripcion,
              unidad: articulo?.unidadStock ?? l.unidad,
              // Siempre se reescribe (nunca se deja el precio de la selección
              // anterior) — si el código nuevo no tiene precio conocido en
              // ningún catálogo, se resetea a 0 en vez de quedar "pegado" al
              // precio de lo que estaba elegido antes.
              valorUnitario: precio != null ? String(precio) : '0',
              descuentoPorcentaje: articulo?.descuentoSugerido != null ? String(articulo.descuentoSugerido) : '0',
            }
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
      ls.map((l, i) =>
        i === index ? { ...l, esQuimico, esHerramienta: esQuimico ? false : l.esHerramienta, codigo: esQuimico ? '' : l.codigo } : l,
      ),
    );
  }

  /** Tipo de cada línea de la cotización de Pumping — decide si el código sale del catálogo de químicos, de herramientas o es texto libre (servicio). */
  protected readonly tipoLineaOptions: DynadrillSelectOption[] = [
    { label: 'Servicio', value: 'servicio' },
    // Se llama "Material" porque así lo clasifica la Lista de Precios; internamente sigue siendo `esQuimico` (categoría QUIMICA de Inventario).
    { label: 'Material', value: 'quimico' },
    { label: 'Herramienta', value: 'herramienta' },
  ];

  protected tipoDeLinea(l: LineaEstimadaDraft): 'servicio' | 'quimico' | 'herramienta' {
    return l.esQuimico ? 'quimico' : l.esHerramienta ? 'herramienta' : 'servicio';
  }

  protected onTipoLineaChange(index: number, tipo: 'servicio' | 'quimico' | 'herramienta' | null): void {
    const linea = this.lineasEstimadas()[index];
    if (!linea || (tipo ?? 'servicio') === this.tipoDeLinea(linea)) return;
    // Al cambiar de tipo se limpia el código: uno de otro catálogo no sirve (ver onQuimicoToggle).
    this.lineasEstimadas.update(ls =>
      ls.map((l, i) => (i === index ? { ...l, esQuimico: tipo === 'quimico', esHerramienta: tipo === 'herramienta', codigo: '' } : l)),
    );
  }

  /** Espejo de `onQuimicoCodigoSeleccionado`, contra el catálogo de herramientas. */
  protected onHerramientaCodigoSeleccionado(index: number, codigo: string | null): void {
    const articulo = this.herramientasCatalogo().find(a => a.codigo === codigo);
    const precio = codigo ? this.precioSugeridoParaCodigo(codigo) : null;
    this.lineasEstimadas.update(ls =>
      ls.map((l, i) =>
        i === index
          ? {
              ...l,
              codigo: articulo?.codigo ?? '',
              descripcion: articulo?.nombre ?? l.descripcion,
              unidad: articulo?.unidadStock ?? l.unidad,
              valorUnitario: precio != null ? String(precio) : '0',
              descuentoPorcentaje: articulo?.descuentoSugerido != null ? String(articulo.descuentoSugerido) : '0',
            }
          : l,
      ),
    );
  }

  /** Espejo de `onQuimicoToggle`, para "Es herramienta". Mutuamente excluyente con "Es químico" — una línea es una cosa u otra. */
  protected onHerramientaToggle(index: number, esHerramienta: boolean): void {
    this.lineasEstimadas.update(ls =>
      ls.map((l, i) =>
        i === index ? { ...l, esHerramienta, esQuimico: esHerramienta ? false : l.esQuimico, codigo: esHerramienta ? '' : l.codigo } : l,
      ),
    );
  }

  /**
   * Precio de referencia para Ventas cuando el código elegido de Inventario
   * (químico o herramienta) todavía no está en la Lista de Precios del
   * cliente: costo interno Dynadrill (nunca precio de venta) + precio
   * sugerido del catálogo general "Normal" (referencia interna, sin cliente
   * asociado — nunca se usa para facturar automático, ver backend).
   */
  protected referenciaPrecio(l: LineaEstimadaDraft): { costoInterno?: number; precioSugerido?: number } | null {
    const codigo = l.codigo.trim();
    if (!codigo || (!l.esQuimico && !l.esHerramienta) || !this.codigoFueraDeListaPrecios(codigo)) return null;
    const catalogo = l.esQuimico ? this.quimicosCatalogo() : this.herramientasCatalogo();
    const costoInterno = catalogo.find(a => a.codigo === codigo)?.costoUnitario;
    const listaReferencia = this.todasLasListas.find(lp => lp.clienteId == null);
    const precioSugerido = listaReferencia?.items.find(i => i.codigo === codigo)?.precio;
    if (costoInterno == null && precioSugerido == null) return null;
    return { costoInterno, precioSugerido };
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
    reader.onload = evento => this.procesarPlantilla(new Uint8Array(evento.target!.result as ArrayBuffer));
    reader.readAsArrayBuffer(archivo);
  }

  /** Plantillas de ejemplo (ver `PLANTILLAS_EJEMPLO`) — mismo formato que la de AS2, listas para cargar o descargar. */
  protected readonly plantillasEjemplo = PLANTILLAS_EJEMPLO;

  protected descargarPlantillaEjemplo(p: PlantillaEjemplo): void {
    const a = document.createElement('a');
    a.href = `/plantillas/${p.archivo}`;
    a.download = p.archivo;
    a.click();
  }

  /** Aplica una plantilla de ejemplo: fija la línea y el tipo de servicio del ticket de origen y carga sus líneas. */
  protected async cargarPlantillaEjemplo(p: PlantillaEjemplo): Promise<void> {
    try {
      const resp = await fetch(`/plantillas/${p.archivo}`);
      if (!resp.ok) throw new Error(String(resp.status));
      const datos = new Uint8Array(await resp.arrayBuffer());
      if (this.procesarPlantilla(datos)) {
        if (this.lineaServicio() !== p.linea) this.onLineaServicioChange(p.linea);
        this.onTipoServicioChange(p.linea === 'pumping' ? p.tipoServicio : [p.tipoServicio]);
      }
    } catch {
      this.notify.error('No se pudo cargar el ejemplo', 'No se encontró el archivo de la plantilla. Probá de nuevo.');
    }
  }

  /**
   * Lee un Excel con el formato de AS2 Pedido Cliente y reemplaza las líneas. Columna G opcional "Cantidad fija" (SI):
   * esa línea se factura con su cantidad exacta. Los códigos que existen como químico / herramienta en Inventario quedan
   * marcados solos (Pumping precarga los químicos; FCR, las herramientas). Devuelve `true` si cargó líneas.
   */
  private procesarPlantilla(datos: Uint8Array): boolean {
    try {
      const libro = XLSX.read(datos, { type: 'array' });
      const hoja = libro.Sheets[libro.SheetNames[0]];
      const filas = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, defval: '', raw: false });

      const idxCabecera = filas.findIndex(f => (f[0] ?? '').toString().trim() === CABECERA_PLANTILLA_AS2);
      if (idxCabecera === -1) {
        this.notify.error(
          'Plantilla no reconocida',
          `No se encontró el encabezado "${CABECERA_PLANTILLA_AS2}" — ¿es la plantilla de AS2 Pedido Cliente?`,
        );
        return false;
      }

      const quimicos = new Set(this.quimicosCatalogoCompleto().map(a => a.codigo));
      const herramientas = new Set(this.herramientasCatalogoCompleto().map(a => a.codigo));
      const lineas: LineaEstimadaDraft[] = [];
      for (const fila of filas.slice(idxCabecera + 1)) {
        const codigo = (fila[0] ?? '').toString().trim();
        if (!codigo) break; // primera fila vacía = fin de los datos
        const unidad = (fila[1] ?? '').toString().trim();
        const cantidad = (fila[2] ?? '').toString().trim();
        const descripcion = (fila[3] ?? '').toString().trim();
        const precio = (fila[4] ?? '').toString().trim();
        const descuento = (fila[5] ?? '').toString().trim();
        const fija = (fila[6] ?? '').toString().trim().toUpperCase();
        lineas.push({
          codigo,
          descripcion,
          unidad,
          cantidad: cantidad || '1',
          valorUnitario: precio || '0',
          descuentoPorcentaje: descuento || '0',
          esQuimico: this.esPumping() && quimicos.has(codigo),
          esHerramienta: herramientas.has(codigo),
          cantidadFija: ['SI', 'SÍ', 'S', '1', 'TRUE', 'X'].includes(fija),
        });
      }

      if (!lineas.length) {
        this.notify.error('Sin registros', 'La plantilla no trae ninguna línea después del encabezado.');
        return false;
      }
      this.lineasEstimadas.set(lineas);
      this.notify.success('Plantilla cargada', `${lineas.length} línea(s) cargada(s) desde el archivo.`);
      return true;
    } catch {
      this.notify.error('Error al leer el archivo', 'No se pudo procesar el Excel. Verificá que no esté dañado.');
      return false;
    }
  }

  protected readonly submitting = signal(false);

  /** Toda fila de documento agregada (`id === null`, sin persistir) debe tener ya un archivo válido — si no, no se crea/actualiza el pedido. */
  protected readonly documentosAdjuntosValidos = computed(() => this.documentosAdjuntos().every(d => d.id !== null || !!d.archivo));

  protected readonly puedeGuardar = computed(
    () =>
      !!this.cliente() &&
      !!this.lineaServicio() &&
      this.tipoServicio().length > 0 &&
      !!this.tipoOt() &&
      this.ubicacion().pozoId !== null &&
      this.ubicacion().taladroId !== null &&
      this.agenteComercial().trim().length > 0 &&
      this.representanteCampo().trim().length > 0 &&
      this.representanteQuito().trim().length > 0 &&
      this.tecnicoHseResponsableId() !== null &&
      this.lineasTodasValidas() &&
      this.documentosAdjuntosValidos(),
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
    this.articulosService.list({ categoria: 'QUIMICA', activo: true }).subscribe({
      next: articulos => this.quimicosCatalogoCompleto.set(articulos),
      // Antes fallaba en silencio (403 de permisos) y el select de químicos
      // quedaba vacío sin ninguna pista de por qué (bug reportado).
      error: () => this.notify.error('Químicos', 'No se pudo cargar el catálogo de químicos de Inventario — las líneas marcadas como químico no van a poder elegir código.'),
    });
    // `categoria='HERRAMIENTAS'` (no 'FISHING & TOOLS'): es el único catálogo con
    // partes/BOM cargado (`ArticuloParte`, ver articulo-partes.service.ts) — el
    // checklist de inspección de FCR se rompe (queda vacío) si se agrega al
    // ticket una herramienta sin BOM. 'FISHING & TOOLS' tiene más ítems y precio
    // real, pero cero partes cargadas todavía, así que queda afuera de este
    // selector hasta que alguien migre/cargue su BOM.
    this.articulosService.list({ categoria: 'HERRAMIENTAS', activo: true }).subscribe({
      next: articulos => this.herramientasCatalogoCompleto.set(articulos),
      error: () => this.notify.error('Herramientas', 'No se pudo cargar el catálogo de herramientas de Inventario — las líneas marcadas como herramienta no van a poder elegir código.'),
    });
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
    this.tipoServicio.set(p.tipoServicio ?? []);
    this.subTipoServicio.set(p.subTipoServicio ?? []);
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
          esHerramienta: it.esHerramienta ?? false,
          cantidadFija: it.cantidadFija ?? false,
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
   * la Lista de Precios" y el autocompletado de precio) — ya NO toca
   * `lineasEstimadas`: los códigos son texto libre, no dependen de que
   * existan en la lista del cliente elegido.
   *
   * Empareja primero por `clienteId` real (igual que `buscarListaPrecios` en
   * el backend) — matchear solo por el texto de `cliente` es frágil: el
   * nombre comercial completo de ClienteCatalogo ("Empresa Publica De
   * Hidrocarburos Del Ecuador Ep Petroecuador") no tiene por qué ser
   * idéntico al `cliente` que quedó guardado en la Lista de Precios ("EP
   * Petroecuador") aunque sea exactamente el mismo cliente — antes, con
   * solo texto, esa Lista de Precios nunca aparecía emparejada (bug
   * reportado: ni el aviso "fuera de lista" ni el autocompletado de precio
   * funcionaban para ese cliente). El texto libre queda de fallback para
   * listas legacy sin `clienteId`.
   */
  private emparejarLista(): void {
    const clienteId = this.clienteId();
    this.listaCliente.set(
      (clienteId != null
        ? (this.todasLasListas.find(l => l.clienteId === clienteId && l.numeroContrato === this.numeroContrato() && l.activa) ??
          this.todasLasListas.find(l => l.clienteId === clienteId && l.activa))
        : undefined) ??
        this.todasLasListas.find(l => l.cliente === this.cliente() && l.numeroContrato === this.numeroContrato() && l.activa) ??
        this.todasLasListas.find(l => l.cliente === this.cliente() && l.activa) ??
        null,
    );
  }

  protected onClienteChange(value: string): void {
    this.cliente.set(value);
    this.emparejarLista();
  }

  // ── Validación (Figma "Nuevo pedido · Validación") ──
  /** Tras un primer intento fallido de guardar se muestra el aviso; antes no, para no regañar un formulario recién abierto. */
  protected readonly intentoGuardar = signal(false);
  private readonly avisoRef = viewChild<ElementRef<HTMLElement>>('aviso');

  /** Campos obligatorios sin completar — mismas reglas que `puedeGuardar`, una por una para poder contarlas. */
  protected readonly camposFaltantes = computed(() => {
    const faltan: string[] = [];
    if (!this.cliente()) faltan.push('Cliente');
    if (!this.lineaServicio()) faltan.push('Línea de servicio');
    if (this.tipoServicio().length === 0) faltan.push('Tipos de servicio');
    if (!this.tipoOt()) faltan.push('Tipo de OT');
    if (this.ubicacion().pozoId === null) faltan.push('Pozo');
    if (this.ubicacion().taladroId === null) faltan.push('Taladro / Rig');
    if (this.agenteComercial().trim().length === 0) faltan.push('Agente comercial');
    if (this.representanteCampo().trim().length === 0) faltan.push('Representante en campo');
    if (this.representanteQuito().trim().length === 0) faltan.push('Representante en Quito (PEC)');
    if (this.tecnicoHseResponsableId() === null) faltan.push('Técnico HSE responsable');
    if (!this.lineasTodasValidas()) faltan.push('Líneas estimadas');
    if (!this.documentosAdjuntosValidos()) faltan.push('Documentos de referencia');
    return faltan;
  });

  protected readonly avisoValidacion = computed(() => {
    const n = this.camposFaltantes().length;
    if (!this.intentoGuardar() || n === 0) return null;
    return `Revisa ${n} ${n === 1 ? 'campo obligatorio' : 'campos obligatorios'} antes de ${this.editando() ? 'guardar el pedido' : 'crear el pedido'}: ${this.camposFaltantes().join(', ')}.`;
  });

  // ── Móvil: los selects de 2 opciones (Línea, Tipo de OT, Solicitud) pasan a chips ──
  protected readonly isMobile = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 840px)')
      .pipe(map(state => state.matches)),
    { initialValue: false },
  );

  protected readonly lineaChips = this.lineaOptions.map(o => o.label);
  protected readonly lineaChipSeleccionado = computed(() => this.chipDe(this.lineaOptions, this.lineaServicio()));
  protected onLineaChip(selected: string[]): void {
    this.onLineaServicioChange(this.valorDe<LineaServicio>(this.lineaOptions, selected));
  }

  protected readonly tipoOtChips = this.tipoOtOptions.map(o => o.label);
  protected readonly tipoOtChipSeleccionado = computed(() => this.chipDe(this.tipoOtOptions, this.tipoOt()));
  protected onTipoOtChip(selected: string[]): void {
    this.tipoOt.set(this.valorDe<TipoOt>(this.tipoOtOptions, selected));
  }

  protected readonly solicitudChips = this.solicitudMedioOptions.map(o => o.label);
  protected readonly solicitudChipSeleccionado = computed(() => this.chipDe(this.solicitudMedioOptions, this.solicitudMedio()));
  protected onSolicitudChip(selected: string[]): void {
    this.solicitudMedio.set(this.valorDe<'verbal' | 'escrita'>(this.solicitudMedioOptions, selected) ?? 'escrita');
  }

  /** dynadrill-chip-group trabaja con textos: se traduce label ↔ valor de la opción. */
  private chipDe(options: DynadrillSelectOption[], value: unknown): string[] {
    const label = options.find(o => o.value === value)?.label;
    return label ? [label] : [];
  }

  private valorDe<T>(options: DynadrillSelectOption[], selected: string[]): T | null {
    return (options.find(o => o.label === selected[0])?.value as T | undefined) ?? null;
  }

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected guardar(): void {
    if (this.submitting()) return;
    if (!this.puedeGuardar()) {
      // Sin botón deshabilitado: el usuario ve por qué no avanza (aviso con los campos que faltan).
      this.intentoGuardar.set(true);
      queueMicrotask(() => this.avisoRef()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
      return;
    }
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
      // FCR se asume siempre herramienta, aunque no haya checkbox para marcarlo línea por línea.
      esHerramienta: l.esHerramienta || this.esFcr(),
      ...(l.cantidadFija ? { cantidadFija: true } : {}),
    }));

    const payload = {
      origen: 'portal' as const,
      cliente: this.cliente()!,
      clienteRuc: this.clienteRuc() || undefined,
      clienteId: this.clienteId() ?? undefined,
      subcliente: this.subcliente().trim() || undefined,
      lineaServicio: this.lineaServicio()!,
      tipoServicio: this.tipoServicio(),
      subTipoServicio: this.esFcr() && this.subTipoServicio().length ? this.subTipoServicio() : undefined,
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

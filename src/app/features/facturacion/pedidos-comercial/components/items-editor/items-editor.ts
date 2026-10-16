import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, model, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillDialogService,
  DynadrillIconButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillSpinnerComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { SearchField } from '../../../../../shared/components/search-field/search-field';
import { ListasPreciosComercialService } from '../../services/listas-precios-comercial.service';
import { PedidosComercialService } from '../../services/pedidos-comercial.service';
import { leerFilasPlantillaAs2 } from '../../models/plantilla-as2.util';
import {
  MAX_LINEAS,
  agregarLinea,
  errorDeLinea,
  importesDeLinea,
  lineaDesdePlantilla,
  totalesDeLineas,
  type LineaEditable,
} from '../../models/lineas-pedido';
import {
  formatoMoneda,
  mensajeDeError,
  resumenPaginacion,
  type ErrorPlantilla,
  type ItemListaCliente,
  type ItemPlantillaValidado,
  type TipoItemLista,
} from '../../models/pedido-comercial.model';

const LIMITE_BUSQUEDA = 10;
const MAX_BYTES_PLANTILLA = 5 * 1024 * 1024;
/** Copia estática de la plantilla de AS2 que sirve el propio frontend. */
const URL_PLANTILLA_AS2 = '/plantillas/as2-pedido-cliente.xlsx';

/**
 * Ítems del pedido: siempre salen de la lista de precios del cliente (búsqueda en el servidor) o de la plantilla Excel de
 * AS2 validada contra esa lista. El precio es el de la lista; aquí solo se editan cantidad y descuento.
 */
@Component({
  selector: 'app-items-editor',
  imports: [
    SearchField,
    DynadrillBannerComponent,
    DynadrillButtonComponent,
    DynadrillIconButtonComponent,
    DynadrillInputComponent,
    DynadrillSelectComponent,
    DynadrillSpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './items-editor.html',
  styleUrl: './items-editor.scss',
})
export class ItemsEditor {
  private readonly listas = inject(ListasPreciosComercialService);
  private readonly pedidos = inject(PedidosComercialService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly dialog = inject(DynadrillDialogService);

  readonly clienteId = input<string | null>(null);
  readonly lineas = model<LineaEditable[]>([]);

  protected readonly maxLineas = MAX_LINEAS;
  protected readonly urlPlantilla = URL_PLANTILLA_AS2;

  // ── Búsqueda en la lista de precios ──
  protected readonly busqueda = signal('');
  protected readonly tipo = signal<TipoItemLista | null>(null);
  protected readonly resultados = signal<ItemListaCliente[]>([]);
  protected readonly total = signal(0);
  protected readonly pagina = signal(1);
  protected readonly buscando = signal(false);
  protected readonly tipoOpciones: DynadrillSelectOption[] = [
    { label: 'Servicio', value: 'Servicio' },
    { label: 'Material', value: 'Material' },
  ];
  protected readonly resumenBusqueda = computed(() => resumenPaginacion(this.pagina(), LIMITE_BUSQUEDA, this.resultados().length, this.total()));
  protected readonly hayAnterior = computed(() => this.pagina() > 1);
  protected readonly haySiguiente = computed(() => this.pagina() * LIMITE_BUSQUEDA < this.total());

  // ── Plantilla ──
  protected readonly leyendo = signal(false);
  protected readonly erroresPlantilla = signal<ErrorPlantilla[]>([]);
  protected readonly diferenciasPlantilla = signal<ItemPlantillaValidado[]>([]);

  // ── Totales y validez ──
  protected readonly totales = computed(() => totalesDeLineas(this.lineas()));
  protected readonly llena = computed(() => this.lineas().length >= MAX_LINEAS);

  private readonly texto$ = new Subject<string>();
  private vigente = 0;

  constructor() {
    this.texto$.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(inject(DestroyRef))).subscribe(() => {
      this.pagina.set(1);
      this.buscar();
    });
    // Al cambiar el cliente se recarga la lista de ítems elegibles (y se limpia lo anterior).
    effect(() => {
      this.clienteId();
      untracked(() => {
        this.pagina.set(1);
        this.erroresPlantilla.set([]);
        this.diferenciasPlantilla.set([]);
        this.buscar();
      });
    });
  }

  protected onBusqueda(valor: string): void {
    this.busqueda.set(valor);
    this.texto$.next(valor.trim());
  }

  protected onTipo(valor: TipoItemLista | null): void {
    this.tipo.set(valor);
    this.pagina.set(1);
    this.buscar();
  }

  protected irA(delta: number): void {
    this.pagina.update(p => Math.max(1, p + delta));
    this.buscar();
  }

  private buscar(): void {
    const cliente = this.clienteId();
    const peticion = ++this.vigente;
    if (!cliente) {
      this.resultados.set([]);
      this.total.set(0);
      this.buscando.set(false);
      return;
    }
    this.buscando.set(true);
    this.listas.itemsDeCliente(cliente, { q: this.busqueda(), tipo: this.tipo(), page: this.pagina(), limit: LIMITE_BUSQUEDA }).subscribe({
      next: r => {
        if (peticion !== this.vigente) return;
        this.resultados.set(r.items);
        this.total.set(r.total);
        this.buscando.set(false);
      },
      error: err => {
        if (peticion !== this.vigente) return;
        this.buscando.set(false);
        this.notify.error('Error', mensajeDeError(err, 'No se pudo consultar la lista de precios del cliente.'));
      },
    });
  }

  // ── Edición de líneas ──

  protected agregar(item: ItemListaCliente): void {
    if (this.llena() && !this.lineas().some(l => l.listaPreciosItemId === item.listaPreciosItemId)) {
      this.notify.warning('Límite alcanzado', `Un pedido admite hasta ${MAX_LINEAS} ítems.`);
      return;
    }
    this.lineas.update(ls => agregarLinea(ls, item));
  }

  protected yaAgregado(item: ItemListaCliente): boolean {
    return this.lineas().some(l => l.listaPreciosItemId === item.listaPreciosItemId);
  }

  protected cambiar(indice: number, campo: 'cantidad' | 'descuentoPct', valor: string): void {
    this.lineas.update(ls => ls.map((l, i) => (i === indice ? { ...l, [campo]: valor } : l)));
  }

  protected quitar(indice: number): void {
    this.lineas.update(ls => ls.filter((_, i) => i !== indice));
  }

  // ── Plantilla Excel de AS2 ──

  protected async onArchivo(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = '';
    const cliente = this.clienteId();
    if (!archivo) return;
    if (!cliente) {
      this.notify.warning('Elija el cliente', 'La plantilla se valida contra la lista de precios del cliente.');
      return;
    }
    if (archivo.size > MAX_BYTES_PLANTILLA) {
      this.notify.error('Archivo demasiado grande', 'El archivo supera el máximo permitido de 5 MB.');
      return;
    }
    if (this.lineas().length > 0) {
      const ok = await this.dialog.confirm({
        title: '¿Reemplazar los ítems actuales?',
        content: 'La plantilla reemplaza todos los ítems del pedido por los registros del archivo.',
        okText: 'Reemplazar',
      });
      if (!ok) return;
    }
    this.leyendo.set(true);
    try {
      const XLSX = await import('xlsx');
      const libro = XLSX.read(new Uint8Array(await archivo.arrayBuffer()), { type: 'array' });
      const hoja = libro.Sheets[libro.SheetNames[0]];
      const filas = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, defval: '', raw: false });
      const lectura = leerFilasPlantillaAs2(filas);
      if (lectura.error) {
        this.leyendo.set(false);
        this.notify.error('Plantilla no reconocida', lectura.error);
        return;
      }
      this.pedidos.validarPlantilla(cliente, lectura.filas).subscribe({
        next: r => {
          this.leyendo.set(false);
          const ilegibles: ErrorPlantilla[] = lectura.ilegibles.map(i => ({ fila: i.fila, codigo: i.codigo, motivo: i.motivo }));
          this.erroresPlantilla.set([...ilegibles, ...r.errores]);
          this.diferenciasPlantilla.set(r.items.filter(i => i.diferenciaPrecio !== null));
          this.lineas.set(r.items.slice(0, MAX_LINEAS).map(lineaDesdePlantilla));
          if (r.items.length > 0) this.notify.success('Plantilla cargada', `${r.items.length} ítem(s) validado(s) contra la lista de precios.`);
          else this.notify.warning('Sin ítems válidos', 'Ningún código del archivo está en la lista de precios del cliente.');
        },
        error: err => {
          this.leyendo.set(false);
          this.notify.error('No se pudo validar', mensajeDeError(err, 'No se pudo validar la plantilla.'));
        },
      });
    } catch {
      this.leyendo.set(false);
      this.notify.error('Error al leer el archivo', 'No se pudo procesar el Excel. Verifique que no esté dañado.');
    }
  }

  protected readonly moneda = formatoMoneda;
  protected readonly errorLinea = errorDeLinea;
  protected readonly neto = (l: LineaEditable) => importesDeLinea(l).neto;
}

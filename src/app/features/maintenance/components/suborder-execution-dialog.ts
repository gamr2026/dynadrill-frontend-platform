import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillIconComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  type DynadrillSelectOption,
  DynadrillTextareaComponent,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { NovedadReadonlyComponent } from '../../../shared/components/novedad-readonly/novedad-readonly';
import { InventarioPlataformaService } from '../../inventario/services/inventario-plataforma.service';
import type { RepuestoDisponible } from '../../inventario/models/inventario-plataforma.model';
import { mensajeDeError } from '../../../shared/utils/mensaje-error.util';
import { Repuesto, SubOrder } from '../models/maintenance-order.model';
import { MaintenanceOrdersService } from '../services/maintenance-orders.service';

export interface SuborderExecutionDialogData {
  subOrder: SubOrder;
  novedadOriginal: string;
}

@Component({
  selector: 'app-suborder-execution-dialog',
  host: { class: 'app-dialog-fullscreen-mobile' },
  imports: [
    CommonModule,
    DynadrillTextComponent,
    DynadrillTextareaComponent,
    DynadrillInputComponent,
    DynadrillSelectComponent,
    DynadrillButtonComponent,
    DynadrillIconComponent,
    NovedadReadonlyComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './suborder-execution-dialog.html',
  styleUrl: './suborder-execution-dialog.scss',
})
export class SuborderExecutionDialog {
  private readonly ordersService = inject(MaintenanceOrdersService);
  private readonly inventario = inject(InventarioPlataformaService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<SuborderExecutionDialog, boolean>);
  protected readonly data = inject<SuborderExecutionDialogData>(NZ_MODAL_DATA);

  protected readonly diagnostico = signal(this.data.subOrder.diagnostico ?? '');
  protected readonly actividadesCorrectivas = signal(this.data.subOrder.actividadesCorrectivas ?? '');
  protected readonly horasTrabajo = signal(this.data.subOrder.horasTrabajo?.toString() ?? '');
  protected readonly repuestos = signal<Repuesto[]>(this.data.subOrder.repuestos ? [...this.data.subOrder.repuestos] : []);
  protected readonly trabajosAdicionales = signal(this.data.subOrder.trabajosAdicionales ?? '');
  protected readonly submitting = signal(false);

  protected readonly wasRejected = this.data.subOrder.status === 'Corrección Solicitada';
  protected readonly isClosed = this.data.subOrder.status === 'Cerrado';

  /** Búsqueda en el catálogo de repuestos de Inventario (solo con 2 letras o más). */
  protected readonly busqueda = signal('');
  protected readonly resultados = signal<RepuestoDisponible[]>([]);
  protected readonly buscando = signal(false);
  private readonly texto$ = new Subject<string>();

  constructor() {
    this.cargarBodegasDeLoGuardado();
    this.texto$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap(q => {
          if (q.length < 2) return of<RepuestoDisponible[]>([]);
          this.buscando.set(true);
          return this.inventario.repuestosDisponibles(q);
        }),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe({
        next: lista => {
          this.resultados.set(lista);
          this.buscando.set(false);
        },
        error: () => {
          this.resultados.set([]);
          this.buscando.set(false);
          this.notify.error('Error', 'No se pudo consultar el catálogo de repuestos.');
        },
      });
  }

  protected readonly hayCatalogo = computed(() => this.repuestos().some(r => r.articuloId));

  protected readonly canSubmit = computed(() =>
    this.diagnostico().trim().length > 0 && this.actividadesCorrectivas().trim().length > 0,
  );

  /** Los repuestos ya guardados traen solo su bodega: se consulta la existencia para poder cambiarla. */
  private cargarBodegasDeLoGuardado(): void {
    for (const r of this.repuestos().filter(x => x.articuloId)) {
      this.inventario.repuestosDisponibles(r.numeroParte).subscribe({
        next: lista => {
          const a = lista.find(x => x.id === r.articuloId);
          if (!a) return;
          const guardada = r.bodegasDisponibles ?? [];
          const bodegas = [...a.porBodega, ...guardada.filter(g => !a.porBodega.some(b => b.bodegaId === g.bodegaId))];
          this.repuestos.update(list => list.map(x => (x.articuloId === r.articuloId ? { ...x, bodegasDisponibles: bodegas, unidad: a.unidad } : x)));
        },
        error: () => undefined, // sin la existencia se sigue pudiendo guardar con la bodega ya elegida
      });
    }
  }

  onBusqueda(valor: string): void {
    this.busqueda.set(valor);
    this.texto$.next(valor.trim());
  }

  /** Agrega el repuesto del catálogo; si ya estaba, suma una unidad (un artículo va una sola vez por sub-orden). */
  addDelCatalogo(a: RepuestoDisponible): void {
    this.repuestos.update(list => {
      const i = list.findIndex(r => r.articuloId === a.id);
      if (i >= 0) return list.map((r, j) => (j === i ? { ...r, cantidad: r.cantidad + 1 } : r));
      return [
        ...list,
        {
          articuloId: a.id,
          numeroParte: a.codigo,
          descripcion: a.nombre,
          cantidad: 1,
          unidad: a.unidad,
          bodegasDisponibles: a.porBodega,
          bodegaId: a.porBodega[0]?.bodegaId,
        },
      ];
    });
    this.busqueda.set('');
    this.resultados.set([]);
  }

  protected bodegaOptions(r: Repuesto): DynadrillSelectOption[] {
    return (r.bodegasDisponibles ?? []).map(b => ({
      label: b.stock === undefined ? b.bodega : `${b.bodega} (${b.stock} disponibles)`,
      value: b.bodegaId,
    }));
  }

  updateBodega(index: number, bodegaId: string): void {
    this.repuestos.update(list => list.map((r, i) => (i === index ? { ...r, bodegaId } : r)));
  }

  /** Repuesto que no existe en el catálogo: se escribe el número de parte y la descripción (no mueve stock). */
  addRepuesto(): void {
    this.repuestos.update(list => [...list, { numeroParte: '', cantidad: 1, descripcion: '' }]);
  }

  removeRepuesto(index: number): void {
    this.repuestos.update(list => list.filter((_, i) => i !== index));
  }

  updateRepuesto(index: number, field: keyof Repuesto, value: string): void {
    this.repuestos.update(list =>
      list.map((r, i) => {
        if (i !== index) return r;
        if (field !== 'cantidad') return { ...r, [field]: value };
        // Mientras el usuario borra el campo para reescribirlo, `Number('') || 1` lo forzaba
        // a 1 en cada tecla — conserva la cantidad anterior hasta que el nuevo valor sea válido.
        const parsed = Number(value);
        return Number.isNaN(parsed) || parsed <= 0 ? r : { ...r, cantidad: parsed };
      }),
    );
  }

  private buildInput() {
    return {
      diagnostico: this.diagnostico(),
      actividadesCorrectivas: this.actividadesCorrectivas(),
      horasTrabajo: this.horasTrabajo() ? Number(this.horasTrabajo()) : undefined,
      // un repuesto de texto necesita su número de parte (el del catálogo ya trae su artículo)
      repuestos: this.repuestos().filter(r => r.articuloId || r.numeroParte.trim()),
      trabajosAdicionales: this.trabajosAdicionales().trim() || undefined,
    };
  }

  save(): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.ordersService.updateSubOrder(this.data.subOrder.id, this.buildInput()).subscribe({
      next: () => {
        this.notify.success(
          this.isClosed ? 'Cambios guardados' : 'Avance guardado',
          this.isClosed ? `${this.data.subOrder.code} corregida.` : `${this.data.subOrder.code} en ejecución.`,
        );
        this.modalRef.close(true);
      },
      error: e => {
        this.submitting.set(false);
        this.notify.error('Error', mensajeDeError(e, 'No se pudo guardar.'));
      },
    });
  }

  submitForReview(): void {
    if (!this.canSubmit() || this.submitting()) return;
    this.submitting.set(true);
    this.ordersService.updateSubOrder(this.data.subOrder.id, this.buildInput()).subscribe({
      next: () => {
        this.ordersService.submitSubOrderForReview(this.data.subOrder.id).subscribe({
          next: () => {
            this.notify.success('Enviado a revisión', `${this.data.subOrder.code} lista para revisión de cierre.`);
            this.modalRef.close(true);
          },
          error: e => {
            this.submitting.set(false);
            this.notify.error('Error', mensajeDeError(e, 'No se pudo enviar a revisión.'));
          },
        });
      },
      error: e => {
        this.submitting.set(false);
        this.notify.error('Error', mensajeDeError(e, 'No se pudo guardar.'));
      },
    });
  }

  cancel(): void {
    this.modalRef.close(false);
  }
}

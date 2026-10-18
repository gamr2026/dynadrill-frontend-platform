import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { forkJoin, of, switchMap, type Observable } from 'rxjs';
import {
  DynadrillButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTextComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { RolesService } from '../../../../../users/services/users.service';
import { InventarioPlataformaService } from '../../../../../inventario/services/inventario-plataforma.service';
import type { RepuestoDisponible } from '../../../../../inventario/models/inventario-plataforma.model';
import { ArchivosService } from '../../../../../facturacion/pedidos-comercial/services/archivos.service';
import { mensajeErrorArchivo, type ArchivoSubido } from '../../../../../facturacion/pedidos-comercial/models/documentos-pedido';
import { CatalogosPlataformaService } from '../../../../../facturacion/pedidos-comercial/services/catalogos-plataforma.service';
import type { VehiculoPlataforma } from '../../../../../facturacion/pedidos-comercial/models/catalogos-plataforma.model';
import { MODULO_ARCHIVO_MEZCLA, mensajeErrorTicket, validarAsignacion, validarQuimicos, type FilaAsignacion, type FilaQuimico, type TicketPumping } from '../../models/ticket-pumping';
import { TicketsPumpingService } from '../../services/tickets-pumping.service';

export interface TicketAsignarDialogData {
  ticketId: string;
  titulo: string;
  /** Asignación ya guardada (al reasignar), para precargar. */
  actual?: TicketPumping['asignacion'];
}

interface Persona {
  id: string;
  name: string;
}

/**
 * El Jefe de Base asigna al equipo del servicio: un supervisor y los operadores, cada uno con la unidad que lleva (vehículos del
 * catálogo). A cada persona elegida se le avisa por correo y campanita (solo a ellas, no a todo su rol).
 */
@Component({
  selector: 'app-ticket-asignar-dialog',
  imports: [DynadrillButtonComponent, DynadrillInputComponent, DynadrillSelectComponent, DynadrillTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-dialog-sheet-mobile' },
  template: `
    <div class="ta">
      <dynadrill-text variant="body">{{ data.titulo }}. A quienes elija se les avisará por correo y en la campanita.</dynadrill-text>

      <dynadrill-select label="Supervisor" placeholder="Elija el supervisor" [options]="opcionesSupervisores()" [value]="supervisorId()" [searchable]="true" (valueChange)="supervisorId.set($any($event))" />

      <fieldset class="ta__bloque">
        <legend>Operadores y sus unidades</legend>
        @for (f of filas(); track $index; let i = $index) {
          <div class="ta__fila">
            <dynadrill-select label="Operador" placeholder="Elija un operador" [options]="opcionesOperadores(i)" [value]="f.usuarioId" [searchable]="true" (valueChange)="cambiar(i, 'usuarioId', $any($event))" />
            <dynadrill-select label="Unidad" placeholder="Elija la placa" [options]="opcionesUnidades()" [value]="f.vehiculoId" [searchable]="true" (valueChange)="cambiar(i, 'vehiculoId', $any($event))" />
            <button type="button" class="ta__quitar" [attr.aria-label]="'Quitar la fila ' + (i + 1)" (click)="quitar(i)">Quitar</button>
          </div>
        }
        <div>
          <dynadrill-button variant="secondary" size="small" (clicked)="agregar()">Agregar operador</dynadrill-button>
        </div>
      </fieldset>

      <fieldset class="ta__bloque">
        <legend>Químicos (opcional)</legend>
        <dynadrill-text variant="caption">Salen de bodega a cargo del ticket al asignar. El documento de mezcla es obligatorio si asigna alguno.</dynadrill-text>
        @for (q of quimicos(); track $index; let i = $index) {
          <div class="ta__fila ta__fila--quimico">
            <dynadrill-select label="Químico" placeholder="Elija el químico" [options]="opcionesQuimicos()" [value]="q.articuloId" [searchable]="true" (valueChange)="cambiarQuimico(i, 'articuloId', $any($event))" />
            <dynadrill-select label="Bodega" placeholder="Bodega" [options]="opcionesBodegas(q)" [value]="q.bodegaId" (valueChange)="cambiarQuimico(i, 'bodegaId', $any($event))" />
            <dynadrill-input label="Cantidad" type="number" placeholder="0" [value]="q.cantidad === null ? '' : q.cantidad.toString()" (valueChange)="cambiarCantidad(i, $event)" />
            <button type="button" class="ta__quitar" [attr.aria-label]="'Quitar el químico ' + (i + 1)" (click)="quitarQuimico(i)">Quitar</button>
          </div>
        }
        <div>
          <dynadrill-button variant="secondary" size="small" (clicked)="agregarQuimico()">Agregar químico</dynadrill-button>
        </div>
        @if (quimicos().length) {
          <label class="ta__archivo">
            <span>Documento de mezcla (obligatorio; PDF, PNG, JPEG, DOCX o XLSX, máximo 25 MB)</span>
            <input type="file" accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx" [disabled]="enviando()" (change)="alElegirMezcla($event)" />
          </label>
        }
      </fieldset>

      @if (problema(); as p) {
        <dynadrill-text variant="caption" role="status">{{ p }}</dynadrill-text>
      }
    </div>
    <footer class="ta__acciones">
      <dynadrill-button variant="secondary" (clicked)="cancelar()">Cancelar</dynadrill-button>
      <dynadrill-button [disabled]="!!problema() || enviando()" (clicked)="asignar()">{{ enviando() ? 'Asignando…' : 'Asignar y avisar' }}</dynadrill-button>
    </footer>
  `,
  styles: `
    .ta { display: flex; flex-direction: column; gap: 14px; }
    .ta__bloque { border: 1px solid #ecebf1; border-radius: 8px; padding: 8px 12px 12px; display: flex; flex-direction: column; gap: 10px; }
    .ta__bloque legend { padding: 0 6px; font-weight: 600; }
    .ta__fila { display: grid; grid-template-columns: 1fr 1fr auto; gap: 8px; align-items: end; }
    .ta__quitar { background: none; border: 0; color: #5c5870; text-decoration: underline; cursor: pointer; padding: 0 4px 10px; }
    .ta__fila--quimico { grid-template-columns: 2fr 1.5fr 0.8fr auto; }
    .ta__archivo { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #5c5870; }
    .ta__acciones { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #ecebf1; }
  `,
})
export class TicketAsignarDialog {
  private readonly servicio = inject(TicketsPumpingService);
  private readonly roles = inject(RolesService);
  private readonly catalogos = inject(CatalogosPlataformaService);
  private readonly inventario = inject(InventarioPlataformaService);
  private readonly archivos = inject(ArchivosService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<TicketAsignarDialog, TicketPumping | undefined>);
  protected readonly data = inject<TicketAsignarDialogData>(NZ_MODAL_DATA);

  private readonly supervisores = signal<Persona[]>([]);
  private readonly operadores = signal<Persona[]>([]);
  private readonly vehiculos = signal<VehiculoPlataforma[]>([]);

  protected readonly supervisorId = signal<string | null>(this.data.actual?.supervisor?.usuarioId ?? null);
  protected readonly filas = signal<FilaAsignacion[]>(
    this.data.actual?.operadores.length
      ? this.data.actual.operadores.map(o => ({ usuarioId: o.usuarioId, vehiculoId: o.vehiculoId }))
      : [{ usuarioId: null, vehiculoId: null }],
  );
  protected readonly enviando = signal(false);

  // ── químicos ──
  private readonly disponibles = signal<RepuestoDisponible[]>([]);
  protected readonly quimicos = signal<FilaQuimico[]>([]);
  private readonly mezcla = signal<File | null>(null);
  protected readonly opcionesQuimicos = computed<DynadrillSelectOption[]>(() =>
    this.disponibles().map(a => ({ label: `${a.codigo} · ${a.nombre} (${a.stockActual} ${a.unidad})`, value: a.id })),
  );

  protected readonly opcionesSupervisores = computed<DynadrillSelectOption[]>(() =>
    this.supervisores()
      .filter(s => !this.filas().some(f => f.usuarioId === s.id))
      .map(s => ({ label: s.name, value: s.id })),
  );
  protected readonly opcionesUnidades = computed<DynadrillSelectOption[]>(() =>
    this.vehiculos()
      .filter(v => v.habilitado)
      .map(v => ({ label: [v.placa, v.tipoVehiculo?.nombre, v.marca, v.modelo].filter(Boolean).join(' · '), value: v.id })),
  );
  protected readonly problema = computed(() => validarAsignacion(this.supervisorId(), this.filas()) ?? validarQuimicos(this.quimicos(), !!this.mezcla()));

  constructor() {
    this.inventario.quimicosDisponibles().subscribe({
      next: l => this.disponibles.set(l),
      error: err => this.notify.error('Error', mensajeErrorTicket(err, 'No se pudo cargar la lista de químicos.')),
    });
    forkJoin({
      sup: this.roles.usuariosPorRol('supervisor'),
      supPumping: this.roles.usuariosPorRol('supervisor_pumping'),
      ops: this.roles.usuariosPorRol('operador'),
      veh: this.catalogos.vehiculos(),
    }).subscribe({
      next: r => {
        const unicos = (l: Persona[]) => [...new Map(l.map(p => [p.id, p])).values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
        this.supervisores.set(unicos([...r.sup, ...r.supPumping]));
        this.operadores.set(unicos(r.ops));
        this.vehiculos.set(r.veh);
      },
      error: err => this.notify.error('Error', mensajeErrorTicket(err, 'No se pudo cargar las personas y unidades.')),
    });
  }

  /** Operadores que todavía se pueden elegir en la fila `i` (sin los ya elegidos en otras filas ni el supervisor). */
  protected opcionesOperadores(i: number): DynadrillSelectOption[] {
    const usados = new Set(this.filas().filter((_, k) => k !== i).map(f => f.usuarioId));
    return this.operadores()
      .filter(o => !usados.has(o.id) && o.id !== this.supervisorId())
      .map(o => ({ label: o.name, value: o.id }));
  }

  /** Bodegas con existencia del químico elegido en la fila. */
  protected opcionesBodegas(q: FilaQuimico): DynadrillSelectOption[] {
    const a = this.disponibles().find(x => x.id === q.articuloId);
    return (a?.porBodega ?? []).map(b => ({ label: `${b.bodega} (${b.stock} disponibles)`, value: b.bodegaId }));
  }
  protected agregarQuimico(): void {
    this.quimicos.update(l => [...l, { articuloId: null, bodegaId: null, cantidad: null }]);
  }
  protected quitarQuimico(i: number): void {
    this.quimicos.update(l => l.filter((_, k) => k !== i));
    if (this.quimicos().length === 0) this.mezcla.set(null);
  }
  protected cambiarQuimico(i: number, campo: 'articuloId' | 'bodegaId', valor: string | null): void {
    this.quimicos.update(l =>
      l.map((q, k) => {
        if (k !== i) return q;
        if (campo === 'articuloId') {
          // al cambiar el químico se propone su única bodega (o se obliga a elegir)
          const bodegas = this.disponibles().find(a => a.id === valor)?.porBodega ?? [];
          return { ...q, articuloId: valor, bodegaId: bodegas.length === 1 ? bodegas[0].bodegaId : null };
        }
        return { ...q, bodegaId: valor };
      }),
    );
  }
  protected cambiarCantidad(i: number, valor: string): void {
    const n = Number(valor);
    this.quimicos.update(l => l.map((q, k) => (k === i ? { ...q, cantidad: valor.trim() === '' || Number.isNaN(n) ? null : n } : q)));
  }
  protected alElegirMezcla(e: Event): void {
    this.mezcla.set((e.target as HTMLInputElement).files?.[0] ?? null);
  }

  protected cambiar(i: number, campo: keyof FilaAsignacion, valor: string | null): void {
    this.filas.update(l => l.map((f, k) => (k === i ? { ...f, [campo]: valor } : f)));
  }
  protected agregar(): void {
    this.filas.update(l => [...l, { usuarioId: null, vehiculoId: null }]);
  }
  protected quitar(i: number): void {
    this.filas.update(l => (l.length > 1 ? l.filter((_, k) => k !== i) : [{ usuarioId: null, vehiculoId: null }]));
  }

  protected asignar(): void {
    if (this.problema() || this.enviando()) return;
    const cuerpo = {
      supervisorId: this.supervisorId()!,
      operadores: this.filas().map(f => ({ usuarioId: f.usuarioId!, vehiculoId: f.vehiculoId! })),
    };
    const quimicos = this.quimicos().map(q => ({ articuloId: q.articuloId!, bodegaId: q.bodegaId!, cantidad: q.cantidad! }));
    const mezcla = this.mezcla();
    this.enviando.set(true);
    // mientras sube el documento, un error es del archivo; después, de la asignación
    let subiendo = !!(quimicos.length && mezcla);
    // primero el documento de mezcla (si hay químicos), después la asignación con todo
    const subida$: Observable<ArchivoSubido | null> = quimicos.length && mezcla ? this.archivos.subir(mezcla, MODULO_ARCHIVO_MEZCLA) : of(null);
    subida$
      .pipe(
        switchMap(archivo => {
          subiendo = false;
          return this.servicio.asignar(this.data.ticketId, archivo ? { ...cuerpo, quimicos, documentoMezclaId: archivo.id } : cuerpo);
        }),
      )
      .subscribe({
        next: t => {
          this.notify.success('Equipo asignado', quimicos.length ? 'Los químicos salieron de bodega y se avisó a las personas elegidas.' : 'Se avisó por correo y en la campanita a las personas elegidas.');
          this.modalRef.close(t);
        },
        error: err => {
          this.enviando.set(false);
          this.notify.error('No se pudo asignar', subiendo ? mensajeErrorArchivo(err) : mensajeErrorTicket(err, 'No se pudo asignar el equipo. Intente de nuevo.'));
        },
      });
  }

  protected cancelar(): void {
    this.modalRef.close(undefined);
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NzModalRef } from 'ng-zorro-antd/modal';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTextareaComponent,
  DynadrillTextComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { mensajeDeError } from '../../../../shared/utils/mensaje-error.util';
import { FlotaUnidadesService } from '../../../flota/services/flota-unidades.service';
import {
  criteriosQueFallan,
  evaluar,
  pendientesDeInspeccion,
  resultadoDe,
  type Evaluacion,
  type TipoInspeccion,
} from '../models/inspeccion';
import { InspeccionesService } from '../services/inspecciones.service';

interface UnidadElegible {
  id: string;
  codigo: string;
  nombre: string;
}

/**
 * Inspección de campo: eslinga de cable, detector de gas o vehículo-grúa. Se evalúan todos los criterios del tipo; si alguno falla el equipo
 * queda en cuarentena (y, en el vehículo-grúa, se avisa a Mantenimiento). Lo puede abrir cualquier usuario.
 */
@Component({
  selector: 'app-inspeccion-registrar-dialog',
  host: { class: 'app-dialog-sheet-mobile' },
  imports: [
    DynadrillBannerComponent,
    DynadrillButtonComponent,
    DynadrillInputComponent,
    DynadrillSelectComponent,
    DynadrillTextareaComponent,
    DynadrillTextComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ir">
      <dynadrill-select
        label="Tipo de equipo"
        placeholder="Elija el tipo"
        [options]="opcionesTipo()"
        [value]="tipoId()"
        (valueChange)="elegirTipo($any($event) ?? '')"
      />

      @if (tipo(); as t) {
        @if (t.requiereUnidad) {
          <dynadrill-select
            label="Unidad"
            placeholder="Elija la unidad"
            [options]="opcionesUnidad()"
            [value]="unidadId()"
            [searchable]="true"
            (valueChange)="unidadId.set($any($event) ?? '')"
          />
          @if (!unidades().length) {
            <dynadrill-text variant="caption"
              >No se pudo cargar la lista de unidades (su cuenta puede no tener acceso a
              Flota).</dynadrill-text
            >
          }
        } @else {
          <dynadrill-input
            label="Número o código del equipo"
            [value]="equipoCodigo()"
            (valueChange)="equipoCodigo.set($event)"
          />
        }

        <div class="ir__criterios">
          <strong>Criterios de rechazo — cualquiera que falle rechaza el equipo</strong>
          @for (c of t.criterios; track c.id) {
            <div class="ir__criterio">
              <span>{{ c.nombre }}</span>
              <span class="ir__toggle">
                <dynadrill-button
                  size="small"
                  [variant]="evaluacion().get(c.id) === true ? 'success' : 'secondary'"
                  (clicked)="marcar(c.id, true)"
                  >Cumple</dynadrill-button
                >
                <dynadrill-button
                  size="small"
                  [variant]="evaluacion().get(c.id) === false ? 'error' : 'secondary'"
                  (clicked)="marcar(c.id, false)"
                  >Falla</dynadrill-button
                >
              </span>
            </div>
          }
        </div>

        @if (t.requiereBumpTest) {
          <div class="ir__criterio">
            <span>¿Se hizo el bump test antes del uso?</span>
            <span class="ir__toggle">
              <dynadrill-button
                size="small"
                [variant]="bumpTest() === true ? 'success' : 'secondary'"
                (clicked)="bumpTest.set(true)"
                >Sí</dynadrill-button
              >
              <dynadrill-button
                size="small"
                [variant]="bumpTest() === false ? 'error' : 'secondary'"
                (clicked)="bumpTest.set(false)"
                >No</dynadrill-button
              >
            </span>
          </div>
        }
        <dynadrill-textarea
          label="Observaciones (opcional)"
          [rows]="2"
          [value]="observaciones()"
          (valueChange)="observaciones.set($event)"
        />

        @if (resultado() === 'rechazado') {
          <dynadrill-banner variant="critical" [message]="avisoRechazo()" />
        } @else if (resultado() === 'aprobado') {
          <dynadrill-banner
            variant="info"
            message="Con todos los criterios en orden la inspección queda aprobada y vale 3 meses."
          />
        }
      }
    </div>
    <footer class="ir__acciones">
      <dynadrill-text variant="caption">{{
        pendientes().length ? 'Falta: ' + pendientes().join('; ') : ''
      }}</dynadrill-text>
      <dynadrill-button variant="secondary" (clicked)="cancelar()">Cancelar</dynadrill-button>
      <dynadrill-button
        [disabled]="pendientes().length > 0 || enviando()"
        (clicked)="registrar()"
        >{{ enviando() ? 'Registrando…' : 'Registrar inspección' }}</dynadrill-button
      >
    </footer>
  `,
  styles: `
    .ir {
      display: flex;
      flex-direction: column;
      gap: 14px;
      max-height: 66vh;
      overflow-y: auto;
      padding-right: 4px;
    }
    .ir__criterios {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px;
      background: #faf9fc;
      border-radius: 8px;
    }
    .ir__criterio {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      font-size: 13.5px;
    }
    .ir__toggle {
      display: flex;
      gap: 6px;
      flex-shrink: 0;
    }
    .ir__acciones {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 8px;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #ecebf1;
    }
    .ir__acciones dynadrill-text {
      margin-right: auto;
    }
  `,
})
export class InspeccionRegistrarDialog {
  private readonly servicio = inject(InspeccionesService);
  private readonly flota = inject(FlotaUnidadesService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(
    NzModalRef<InspeccionRegistrarDialog, { id: string; codigo: string } | undefined>,
  );

  private readonly tipos = signal<TipoInspeccion[]>([]);
  protected readonly unidades = signal<UnidadElegible[]>([]);
  protected readonly tipoId = signal('');
  protected readonly equipoCodigo = signal('');
  protected readonly unidadId = signal('');
  protected readonly bumpTest = signal<boolean | null>(null);
  protected readonly observaciones = signal('');
  protected readonly evaluacion = signal<Evaluacion>(new Map());
  protected readonly enviando = signal(false);

  protected readonly tipo = computed(
    () => this.tipos().find((t) => t.id === this.tipoId()) ?? null,
  );
  protected readonly opcionesTipo = computed<DynadrillSelectOption[]>(() =>
    this.tipos().map((t) => ({ value: t.id, label: t.nombre })),
  );
  protected readonly opcionesUnidad = computed<DynadrillSelectOption[]>(() =>
    this.unidades().map((u) => ({ value: u.id, label: `${u.codigo} — ${u.nombre}` })),
  );
  protected readonly resultado = computed(() => {
    const t = this.tipo();
    return t ? resultadoDe(t, this.evaluacion()) : null;
  });
  protected readonly pendientes = computed(() =>
    pendientesDeInspeccion(
      this.tipo(),
      { equipoCodigo: this.equipoCodigo(), unidadId: this.unidadId(), bumpTest: this.bumpTest() },
      this.evaluacion(),
    ),
  );
  protected readonly avisoRechazo = computed(() => {
    const t = this.tipo();
    const fallan = t ? criteriosQueFallan(t, this.evaluacion()) : [];
    return `Queda rechazada (${fallan.join('; ')}): el equipo entra en cuarentena hasta una inspección nueva aprobada.${t?.generaCasoMantenimiento ? ' Se avisará a Mantenimiento para su revisión.' : ''}`;
  });

  constructor() {
    this.servicio
      .tipos()
      .subscribe({
        next: (t) => this.tipos.set(t),
        error: (err) =>
          this.notify.error(
            'Error',
            mensajeDeError(err, 'No se pudieron cargar los tipos de inspección.'),
          ),
      });
    // la lista de unidades es de Flota: si la cuenta no puede leerla, el selector queda vacío y se avisa
    this.flota
      .listar({ activa: 'true' })
      .pipe(catchError(() => of([])))
      .subscribe((us) =>
        this.unidades.set(us.map((u) => ({ id: u.id, codigo: u.codigo, nombre: u.nombre }))),
      );
  }

  protected elegirTipo(id: string): void {
    this.tipoId.set(id);
    this.evaluacion.set(new Map());
    this.bumpTest.set(null);
    this.unidadId.set('');
  }

  protected marcar(criterioId: string, cumple: boolean): void {
    this.evaluacion.update((e) => evaluar(e, criterioId, cumple));
  }

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected registrar(): void {
    const t = this.tipo();
    if (!t || this.pendientes().length || this.enviando()) return;
    const unidad = this.unidades().find((u) => u.id === this.unidadId());
    this.enviando.set(true);
    this.servicio
      .registrar({
        tipoId: t.id,
        equipoCodigo: t.requiereUnidad ? (unidad?.codigo ?? '') : this.equipoCodigo().trim(),
        ...(t.requiereUnidad && unidad ? { unidadId: unidad.id, unidadCodigo: unidad.codigo } : {}),
        ...(t.requiereBumpTest && this.bumpTest() !== null
          ? { bumpTestRealizado: this.bumpTest() as boolean }
          : {}),
        ...(this.observaciones().trim() ? { observaciones: this.observaciones().trim() } : {}),
        resultados: t.criterios.map((c) => ({
          criterioId: c.id,
          cumple: this.evaluacion().get(c.id) as boolean,
        })),
      })
      .subscribe({
        next: (r) => {
          this.notify.success(
            r.resultado === 'aprobado' ? 'Inspección aprobada' : 'Inspección rechazada',
            r.enCuarentena
              ? `${r.codigo}: el equipo queda en cuarentena.`
              : `${r.codigo} registrada.`,
          );
          this.modalRef.close(r);
        },
        error: (err) => {
          this.enviando.set(false);
          this.notify.error(
            'No se pudo registrar',
            mensajeDeError(err, 'No se pudo registrar la inspección.'),
          );
        },
      });
  }
}

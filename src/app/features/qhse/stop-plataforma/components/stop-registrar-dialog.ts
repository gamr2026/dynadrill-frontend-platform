import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NzModalRef } from 'ng-zorro-antd/modal';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  DynadrillButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTextareaComponent,
  DynadrillTextComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../core/services/auth.service';
import { mensajeDeError } from '../../../../shared/utils/mensaje-error.util';
import { CatalogosPlataformaService } from '../../../facturacion/pedidos-comercial/services/catalogos-plataforma.service';
import { RolesService } from '../../../users/services/users.service';
import {
  conteoMarcas,
  itemsDeMarcas,
  marcar,
  pendientesDeRegistro,
  type EstadoItemStop,
  type FormatoStop,
  type Marcas,
  type SubcategoriaFormato,
} from '../models/stop';
import { StopService } from '../services/stop.service';

/** Roles de cuenta que pueden ser la persona observada: quienes trabajan en campo y en oficina. */
const ROLES_OBSERVABLES = [
  'operador',
  'operador_fcr',
  'supervisor',
  'supervisor_pumping',
  'operador_mantenimiento',
  'conductor',
  'tecnico_hse',
  'bodeguero',
];

/**
 * Tarjeta de observación STOP (DYN-SGI-RE-008): el observador marca cada ítem que vio como seguro o inseguro. Lo abre cualquier trabajador
 * (también desde «Reportar»): el observador es quien tiene la sesión y la persona observada es opcional (sin elegir = anónimo).
 */
@Component({
  selector: 'app-stop-registrar-dialog',
  host: { class: 'app-dialog-sheet-mobile' },
  imports: [
    DynadrillButtonComponent,
    DynadrillInputComponent,
    DynadrillSelectComponent,
    DynadrillTextareaComponent,
    DynadrillTextComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sr">
      <dynadrill-text variant="caption"
        >Todo trabajador tiene la autoridad y la obligación de observar. Marque solo lo que
        observó.</dynadrill-text
      >

      @for (bloque of bloques(); track bloque.titulo) {
        <section class="sr__bloque">
          <dynadrill-text variant="h2">{{ bloque.titulo }}</dynadrill-text>
          @for (sub of bloque.subcategorias; track sub.id) {
            <div class="sr__sub">
              <span class="sr__sub-titulo">{{ sub.nombre }}</span>
              @for (item of sub.items; track item.id) {
                <div class="sr__item">
                  <span class="sr__item-nombre">{{ item.nombre }}</span>
                  <span class="sr__item-toggle">
                    <dynadrill-button
                      size="small"
                      [variant]="marcas().get(item.id) === 'seguro' ? 'success' : 'secondary'"
                      (clicked)="tocar(item.id, 'seguro')"
                      >Seguro</dynadrill-button
                    >
                    <dynadrill-button
                      size="small"
                      [variant]="marcas().get(item.id) === 'inseguro' ? 'error' : 'secondary'"
                      (clicked)="tocar(item.id, 'inseguro')"
                      >Inseguro</dynadrill-button
                    >
                  </span>
                </div>
              }
            </div>
          }
          <dynadrill-textarea
            label="Qué observa"
            [rows]="2"
            [value]="bloque.clave === 'acciones' ? accionesQueObserva() : condicionesQueObserva()"
            (valueChange)="
              bloque.clave === 'acciones'
                ? accionesQueObserva.set($event)
                : condicionesQueObserva.set($event)
            "
          />
          <dynadrill-textarea
            label="Acciones"
            [rows]="2"
            [value]="bloque.clave === 'acciones' ? accionesAccion() : condicionesAccion()"
            (valueChange)="
              bloque.clave === 'acciones'
                ? accionesAccion.set($event)
                : condicionesAccion.set($event)
            "
          />
        </section>
      }

      <section class="sr__bloque">
        <dynadrill-text variant="h2">Quién reporta</dynadrill-text>
        <dynadrill-text variant="caption">Observador: {{ observador() }}</dynadrill-text>
        <dynadrill-select
          label="Persona observada (opcional)"
          placeholder="Anónimo / no indicada"
          [options]="opcionesPersonas()"
          [value]="observadoId()"
          [searchable]="true"
          (valueChange)="observadoId.set($any($event) ?? '')"
        />
        @if (opcionesCampos().length) {
          <dynadrill-select
            label="Campo (opcional)"
            placeholder="Elija"
            [options]="opcionesCampos()"
            [value]="campoId()"
            [searchable]="true"
            (valueChange)="campoId.set($any($event) ?? '')"
          />
        }
        @if (opcionesOperadoras().length) {
          <dynadrill-select
            label="Operadora (opcional)"
            placeholder="Elija"
            [options]="opcionesOperadoras()"
            [value]="operadoraId()"
            [searchable]="true"
            (valueChange)="operadoraId.set($any($event) ?? '')"
          />
        }
        <dynadrill-input
          label="Lugar exacto (opcional)"
          [value]="lugar()"
          (valueChange)="lugar.set($event)"
        />
        <dynadrill-input
          label="Contacto (opcional)"
          [value]="contacto()"
          (valueChange)="contacto.set($event)"
        />
        <label class="sr__archivo"
          ><span>Foto (opcional)</span
          ><input type="file" accept="image/png,image/jpeg" (change)="elegirFoto($event)"
        /></label>
      </section>
    </div>
    <footer class="sr__acciones">
      <dynadrill-text variant="caption">{{ resumen() }}</dynadrill-text>
      <dynadrill-button variant="secondary" (clicked)="cancelar()">Cancelar</dynadrill-button>
      <dynadrill-button
        [disabled]="pendientes().length > 0 || enviando()"
        (clicked)="registrar()"
        >{{ enviando() ? 'Registrando…' : 'Registrar tarjeta' }}</dynadrill-button
      >
    </footer>
  `,
  styles: `
    .sr {
      display: flex;
      flex-direction: column;
      gap: 20px;
      max-height: 68vh;
      overflow-y: auto;
      padding-right: 4px;
    }
    .sr__bloque {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .sr__sub {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 10px 12px;
      background: #faf9fc;
      border-radius: 8px;
    }
    .sr__sub-titulo {
      font-size: 11.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: #5c5870;
      margin-bottom: 4px;
    }
    .sr__item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 4px 0;
    }
    .sr__item-nombre {
      font-size: 13.5px;
    }
    .sr__item-toggle {
      display: flex;
      gap: 6px;
      flex-shrink: 0;
    }
    .sr__archivo {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 14px;
    }
    .sr__acciones {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 8px;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #ecebf1;
    }
    .sr__acciones dynadrill-text {
      margin-right: auto;
    }
  `,
})
export class StopRegistrarDialog {
  private readonly servicio = inject(StopService);
  private readonly roles = inject(RolesService);
  private readonly catalogos = inject(CatalogosPlataformaService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(
    NzModalRef<StopRegistrarDialog, { id: string; codigo: string } | undefined>,
  );

  private readonly formato = signal<FormatoStop | null>(null);
  protected readonly marcas = signal<Marcas>(new Map());
  protected readonly accionesQueObserva = signal('');
  protected readonly accionesAccion = signal('');
  protected readonly condicionesQueObserva = signal('');
  protected readonly condicionesAccion = signal('');
  protected readonly observadoId = signal('');
  protected readonly campoId = signal('');
  protected readonly operadoraId = signal('');
  protected readonly lugar = signal('');
  protected readonly contacto = signal('');
  protected readonly foto = signal<File | null>(null);
  protected readonly enviando = signal(false);
  private readonly personas = signal<{ id: string; name: string }[]>([]);
  private readonly campos = signal<{ id: string; nombre: string }[]>([]);
  private readonly operadoras = signal<{ id: string; nombre: string }[]>([]);

  protected readonly observador = computed(() => this.auth.currentUser()?.name ?? '');
  protected readonly bloques = computed<
    { clave: 'acciones' | 'condiciones'; titulo: string; subcategorias: SubcategoriaFormato[] }[]
  >(() => {
    const f = this.formato();
    return f
      ? [
          { clave: 'acciones', titulo: 'Acciones', subcategorias: f.acciones },
          { clave: 'condiciones', titulo: 'Condiciones', subcategorias: f.condiciones },
        ]
      : [];
  });
  protected readonly opcionesPersonas = computed<DynadrillSelectOption[]>(() =>
    this.personas()
      .filter((p) => p.id !== this.auth.currentUser()?.id)
      .map((p) => ({ value: p.id, label: p.name })),
  );
  protected readonly opcionesCampos = computed<DynadrillSelectOption[]>(() =>
    this.campos().map((c) => ({ value: c.id, label: c.nombre })),
  );
  protected readonly opcionesOperadoras = computed<DynadrillSelectOption[]>(() =>
    this.operadoras().map((c) => ({ value: c.id, label: c.nombre })),
  );
  protected readonly pendientes = computed(() => pendientesDeRegistro(this.marcas()));
  protected readonly resumen = computed(() => {
    const c = conteoMarcas(this.marcas());
    return c.seguros + c.inseguros
      ? `${c.inseguros} inseguro(s) · ${c.seguros} seguro(s)`
      : 'Sin ítems marcados';
  });

  constructor() {
    this.servicio
      .formato()
      .subscribe({
        next: (f) => this.formato.set(f),
        error: (err) =>
          this.notify.error(
            'Error',
            mensajeDeError(err, 'No se pudo cargar el formato de la tarjeta.'),
          ),
      });
    // las listas opcionales (personas, campos, operadoras) se ofrecen solo si la cuenta puede leerlas
    forkJoin({
      personas: forkJoin(
        ROLES_OBSERVABLES.map((r) => this.roles.usuariosPorRol(r).pipe(catchError(() => of([])))),
      ),
      campos: this.catalogos.campos().pipe(catchError(() => of([]))),
      clientes: this.catalogos.clientes().pipe(catchError(() => of([]))),
    }).subscribe(({ personas, campos, clientes }) => {
      const unicas = new Map<string, { id: string; name: string }>();
      for (const u of personas.flat()) unicas.set(u.id, { id: u.id, name: u.name });
      this.personas.set([...unicas.values()].sort((a, b) => a.name.localeCompare(b.name, 'es')));
      this.campos.set(campos.map((c) => ({ id: c.id, nombre: c.nombre })));
      this.operadoras.set(clientes.map((c) => ({ id: c.id, nombre: c.nombreComercial })));
    });
  }

  protected tocar(itemId: string, estado: EstadoItemStop): void {
    this.marcas.update((m) => marcar(m, itemId, estado));
  }

  protected elegirFoto(evento: Event): void {
    this.foto.set((evento.target as HTMLInputElement).files?.[0] ?? null);
  }

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected registrar(): void {
    if (this.pendientes().length || this.enviando()) return;
    const texto = (s: string): string | undefined => (s.trim() ? s.trim() : undefined);
    this.enviando.set(true);
    this.servicio
      .registrar(
        {
          items: itemsDeMarcas(this.marcas()),
          observadoId: this.observadoId() || undefined,
          campoId: this.campoId() || undefined,
          operadoraId: this.operadoraId() || undefined,
          lugar: texto(this.lugar()),
          contacto: texto(this.contacto()),
          accionesQueObserva: texto(this.accionesQueObserva()),
          accionesAccion: texto(this.accionesAccion()),
          condicionesQueObserva: texto(this.condicionesQueObserva()),
          condicionesAccion: texto(this.condicionesAccion()),
        },
        this.foto(),
      )
      .subscribe({
        next: (r) => {
          this.notify.success(
            'Tarjeta registrada',
            `${r.codigo}: QHSE la revisará. Gracias por observar.`,
          );
          this.modalRef.close(r);
        },
        error: (err) => {
          this.enviando.set(false);
          this.notify.error(
            'No se pudo registrar',
            mensajeDeError(err, 'No se pudo registrar la tarjeta.'),
          );
        },
      });
  }
}

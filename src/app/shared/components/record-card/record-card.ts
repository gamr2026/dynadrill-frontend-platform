import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  DynadrillButtonComponent,
  DynadrillIconButtonComponent,
  DynadrillIconComponent,
  DynadrillTagComponent,
  type DynadrillIconName,
  type DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';

/** Acción de una fila/tarjeta — la misma lista alimenta la tabla de escritorio y la tarjeta móvil. */
export interface RecordAction {
  /** Ícono de ng-zorro (como en `dynadrill-icon-button`). */
  icon: string;
  label: string;
  /** Acción principal: en la tarjeta va como botón ancho con texto; el resto, como botones de ícono. */
  primary?: boolean;
  run: () => void;
}

export interface RecordField {
  label: string;
  value: string;
  /** Colorea el valor (ej. "Pendiente" ámbar, "Vencido" rojo, "Cargado" verde). */
  tone?: 'success' | 'warning' | 'error';
}

export interface RecordStatus {
  text: string;
  tone: DynadrillTagVariant;
}

/** Contenido de una tarjeta, para que las páginas armen sus listas tipadas. */
export interface RecordCardData {
  eyebrow: string;
  title: string;
  subtitle: string;
  status: RecordStatus | null;
  fields: RecordField[];
  actions: RecordAction[];
}

/** Íconos de ng-zorro que también existen en `dynadrill-icon` — los que puede mostrar el botón ancho. */
const LINE_ICONS: ReadonlySet<string> = new Set<DynadrillIconName>(['eye', 'edit', 'check', 'upload', 'users', 'file-text', 'tool']);

/**
 * Tarjeta de registro para listas en móvil (Card/Record en Figma):
 * código + estado, título, subtítulo, pares clave-valor y acciones.
 * Contenido extra (ej. sub-órdenes) por proyección.
 */
@Component({
  selector: 'app-record-card',
  imports: [DynadrillButtonComponent, DynadrillIconButtonComponent, DynadrillIconComponent, DynadrillTagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './record-card.html',
  styleUrl: './record-card.scss',
})
export class RecordCard {
  readonly eyebrow = input('');
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly status = input<RecordStatus | null>(null);
  readonly fields = input<RecordField[]>([]);
  readonly actions = input<RecordAction[]>([]);

  protected readonly primaryAction = computed(() => this.actions().find(a => a.primary) ?? this.actions()[0]);
  protected readonly secondaryActions = computed(() => this.actions().filter(a => a !== this.primaryAction()));
  protected readonly primaryIcon = computed(() => {
    const icon = this.primaryAction()?.icon;
    return icon && LINE_ICONS.has(icon) ? (icon as DynadrillIconName) : null;
  });
}

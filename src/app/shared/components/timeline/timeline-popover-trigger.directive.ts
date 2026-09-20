import { Directive, ElementRef, OnDestroy, ViewContainerRef, inject, input } from '@angular/core';
import { ConnectedPosition, Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { TimelineComponent } from './timeline';
import type { TimelineTramo } from '../../models/timeline.model';

const POSITIONS: ConnectedPosition[] = [
  { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 10, panelClass: 'app-timeline-popover-panel--below' },
  { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -10, panelClass: 'app-timeline-popover-panel--above' },
];

/**
 * Convierte cualquier nodo de fase (botón del stepper/lista) en el disparador
 * de un popover flotante con el detalle de trazabilidad de esa fase — anclado
 * al propio nodo vía CDK Overlay, en vez del bloque fijo que había antes.
 * Tolera `tramo` ausente (fase sin tramo calculado todavía) sin romper el click.
 */
@Directive({
  selector: '[appTimelinePopoverTrigger]',
  host: {
    '(click)': 'toggle()',
  },
})
export class TimelinePopoverTriggerDirective implements OnDestroy {
  readonly tramo = input<TimelineTramo | undefined>(undefined, { alias: 'appTimelinePopoverTrigger' });
  readonly faseIndice = input.required<number>();
  readonly faseLabel = input.required<string>();
  readonly esFaseActual = input(false);
  readonly responsableRolActual = input<string | null>(null);

  private readonly overlay = inject(Overlay);
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private overlayRef: OverlayRef | null = null;

  toggle(): void {
    if (this.overlayRef) {
      this.close();
      return;
    }
    if (this.tramo()) this.open();
  }

  private open(): void {
    const positionStrategy = this.overlay
      .position()
      .flexibleConnectedTo(this.elementRef)
      .withPositions(POSITIONS)
      .withPush(true);

    const overlayRef = this.overlay.create({
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      hasBackdrop: true,
      backdropClass: 'app-timeline-popover-backdrop',
    });
    this.overlayRef = overlayRef;

    overlayRef.backdropClick().subscribe(() => this.close());
    overlayRef.keydownEvents().subscribe(event => {
      if (event.key === 'Escape') this.close();
    });

    const portal = new ComponentPortal(TimelineComponent, this.viewContainerRef);
    const componentRef = overlayRef.attach(portal);
    componentRef.setInput('tramo', this.tramo());
    componentRef.setInput('faseIndice', this.faseIndice());
    componentRef.setInput('faseLabel', this.faseLabel());
    componentRef.setInput('esFaseActual', this.esFaseActual());
    componentRef.setInput('responsableRolActual', this.responsableRolActual());
  }

  close(): void {
    this.overlayRef?.dispose();
    this.overlayRef = null;
  }

  ngOnDestroy(): void {
    this.close();
  }
}

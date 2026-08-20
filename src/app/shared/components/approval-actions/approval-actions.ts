import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-approval-actions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="approval-actions">
      <button class="approval-actions__reject" (click)="rejected.emit()" [disabled]="disabled()">Rechazar</button>
      <button class="approval-actions__approve" (click)="approved.emit()" [disabled]="disabled()">Aprobar</button>
    </div>
  `,
  styles: `.approval-actions { display: flex; gap: 1rem; justify-content: flex-end; }`,
})
export class ApprovalActionsComponent {
  disabled = input(false);
  approved = output<void>();
  rejected = output<void>();
}

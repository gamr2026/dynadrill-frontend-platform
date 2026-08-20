import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-stepper',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="stepper" aria-label="Progress steps">
      @for (step of steps(); track step; let i = $index) {
        <div class="stepper__step" [class.stepper__step--active]="i === currentStep()" [class.stepper__step--completed]="i < currentStep()">
          <span class="stepper__index">{{ i + 1 }}</span>
          <span class="stepper__label">{{ step }}</span>
        </div>
      }
    </nav>
  `,
  styles: `.stepper { display: flex; gap: 0.5rem; overflow-x: auto; padding: 1rem 0; }
    .stepper__step { display: flex; align-items: center; gap: 0.25rem; padding: 0.5rem; border-radius: 4px; }
    .stepper__step--active { font-weight: 700; }
    .stepper__step--completed { opacity: 0.6; }`,
})
export class StepperComponent {
  steps = input<string[]>([]);
  currentStep = input(0);
}

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DynadrillTextComponent } from '@digitec-it-projects/dynadrill-ui';

@Component({
  selector: 'app-footer',
  imports: [DynadrillTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
})
export class Footer {}

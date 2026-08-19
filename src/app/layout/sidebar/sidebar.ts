import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { DynadrillIconComponent } from '@digitec-it-projects/dynadrill-ui';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, DynadrillIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {}

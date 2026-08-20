import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-upload-zone',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="upload-zone" role="button" tabindex="0" aria-label="Upload files" (drop)="onDrop($event)" (dragover)="$event.preventDefault()">
      <p>{{ label() }}</p>
      <input type="file" [multiple]="multiple()" [accept]="accept()" (change)="onFileChange($event)" />
    </div>
  `,
  styles: `.upload-zone { border: 2px dashed var(--border-color, #ccc); border-radius: 8px; padding: 2rem; text-align: center; }`,
})
export class UploadZoneComponent {
  label = input('Arrastra archivos aquí o haz clic para seleccionar');
  multiple = input(false);
  accept = input('');
  filesSelected = output<File[]>();

  onDrop(event: DragEvent): void {
    event.preventDefault();
    const files = Array.from(event.dataTransfer?.files ?? []);
    this.filesSelected.emit(files);
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    this.filesSelected.emit(files);
  }
}

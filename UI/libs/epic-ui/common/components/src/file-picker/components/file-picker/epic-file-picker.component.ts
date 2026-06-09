import { Component, forwardRef, Input } from '@angular/core'
import { NG_VALUE_ACCESSOR } from '@angular/forms'
import { TranslatePipe } from '@ngx-translate/core'
import { BaseFormValueControlComponent } from 'epic-ui/utils'

import { EpicFilePickerDropAreaComponent } from '../file-picker-drop-area'
import { EpicFilePickerFilePreviewComponent } from '../file-picker-file-preview'


@Component({
    selector: 'epic-file-picker',
    templateUrl: './epic-file-picker.component.html',
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => EpicFilePickerComponent),
            multi: true,
        },
    ],
    imports: [
        EpicFilePickerDropAreaComponent,
        EpicFilePickerFilePreviewComponent,
        TranslatePipe,
    ],
})
export class EpicFilePickerComponent extends BaseFormValueControlComponent<File | null> {

    @Input() acceptFileExtensions: string

    onFilesInserted(files: File[]): void {
        const refFile = files.length
            ? files[0]
            : null

        this.value = refFile
        this.onChange(refFile)
    }

    onFileDrop(files: File[]): void {
        this.onFilesInserted(files)
    }

    onFileRemoved(): void {
        this.value = null
        this.onChange(null)
    }

}

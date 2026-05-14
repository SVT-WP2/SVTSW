import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core'
import { TranslatePipe } from '@ngx-translate/core'
import { FileHelpers } from 'epic-ui/utils'

import { EpicIconComponent } from '../../../icon'
import { EpicLongTextComponent } from '../../../long-text'
import { EpicFileDragAndDropAreaDirective } from '../../directives'


@Component({
    selector: 'epic-file-picker-drop-area',
    templateUrl: './epic-file-picker-drop-area.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        EpicIconComponent,
        EpicLongTextComponent,
        TranslatePipe,
        EpicFileDragAndDropAreaDirective,
    ],
})
export class EpicFilePickerDropAreaComponent {

    @Input() acceptFileExtensions: string
    @Input() isMultiple = false

    @Output() fileDrop$ = new EventEmitter<File[]>()

    onFileDrop(filesList: FileList): void {
        this.onValueChanged(filesList)
    }

    handleInputChange(event: Event): void {
        const target = event.target as HTMLInputElement
        this.onValueChanged(target.files)
    }

    protected onValueChanged(filesList: FileList | null): void {
        const extensions = this.acceptFileExtensions?.length
            ? this.acceptFileExtensions
                .trim()
                .split(',')
                .map(
                    item => item.trim(),
                )
            : []

        const files = Array.from(filesList || [])
            .filter((file) => {
                if (!extensions.length) {
                    return true
                }
                const refExtension = `.${FileHelpers.getFileExtension(file.name)}`
                return extensions.includes(refExtension)
            })

        this.fileDrop$.emit(files)
    }

}

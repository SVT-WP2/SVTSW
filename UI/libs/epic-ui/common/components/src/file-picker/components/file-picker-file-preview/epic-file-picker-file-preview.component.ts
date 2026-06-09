import { DOCUMENT } from '@angular/common'
import { ChangeDetectionStrategy, Component, EventEmitter, Inject, Input, Output } from '@angular/core'
import { MatIconButton } from '@angular/material/button'
import { MatIcon } from '@angular/material/icon'
import { MatTooltip } from '@angular/material/tooltip'
import { TranslatePipe } from '@ngx-translate/core'
import { FileHelpers } from 'epic-ui/utils'

import { EpicIconComponent } from '../../../icon'
import { EpicLongTextComponent } from '../../../long-text'


@Component({
    selector: 'epic-file-picker-file-preview',
    templateUrl: './epic-file-picker-file-preview.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        MatIcon,
        MatTooltip,
        MatIconButton,
        EpicIconComponent,
        EpicLongTextComponent,
        TranslatePipe,
    ],
})
export class EpicFilePickerFilePreviewComponent {

    @Input() file: File
    @Input() readonly = false

    @Output() remove$ = new EventEmitter<void>()

    constructor(@Inject(DOCUMENT) protected readonly document: Document) {
    }

    onRemoveBtnClicked(): void {
        this.remove$.emit()
    }

    onFileNameClicked(): void {
        void this.file.arrayBuffer()
            .then(
                (arrayBuffer) => FileHelpers.saveFile(arrayBuffer, this.file.name, this.file.type, this.document),
            )
    }

}

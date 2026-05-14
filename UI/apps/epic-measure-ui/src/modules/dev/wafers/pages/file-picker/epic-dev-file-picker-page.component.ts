import { JsonPipe } from '@angular/common'
import { Component } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card'
import { MatDivider } from '@angular/material/divider'
import { EpicFilePickerComponent } from 'epic-ui/common/components'


@Component({
    selector: 'epic-dev-file-picker-page',
    templateUrl: './epic-dev-file-picker-page.component.html',
    imports: [
        MatCard,
        MatCardHeader,
        MatCardTitle,
        MatCardContent,
        EpicFilePickerComponent,
        MatDivider,
        FormsModule,
        JsonPipe,
    ],
})
export class EpicDevFilePickerPageComponent {

    value: File = null
    acceptFileExtensions = '.json'

    onValueChanged(value: File): void {
        console.log('onValueChanged', value)
    }

}


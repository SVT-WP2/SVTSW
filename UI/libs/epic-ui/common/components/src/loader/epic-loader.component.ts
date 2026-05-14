import { NgStyle } from '@angular/common'
import { Component, Input } from '@angular/core'
import { TranslatePipe } from '@ngx-translate/core'
import { DEFAULT_SYSTEM_COLORS } from 'epic-ui/utils/colors'


@Component({
    selector: 'epic-loader',
    templateUrl: './epic-loader.component.html',
    imports: [
        NgStyle,
        TranslatePipe,
    ],
})
export class EpicLoaderComponent {

    @Input() color = DEFAULT_SYSTEM_COLORS.PRIMARY_300
    @Input() loaderRadius = 60
    @Input() loadingText: string
    @Input() showLoadingText = true

    @Input() fillAllSection = false
    @Input() isTransparentBackground = true

}

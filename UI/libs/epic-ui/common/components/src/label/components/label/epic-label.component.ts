import { Component, HostBinding, Input } from '@angular/core'

import { EpicLabel } from '../../models'


@Component({
    selector: 'epic-label',
    templateUrl: './epic-label.component.html',
    standalone: false,
})
export class EpicLabelComponent {

    @Input() size: EpicLabel.LabelSize = EpicLabel.LabelSize.basic
    @Input() iconName: string

    @HostBinding('class.epic-label--small')
    get isSmall(): boolean {
        return this.size === EpicLabel.LabelSize.sm
    }

    @HostBinding('class.epic-label--large')
    get isLarge(): boolean {
        return this.size === EpicLabel.LabelSize.lg
    }

    @HostBinding('class.epic-label--extra-large')
    get isExtraLarge(): boolean {
        return this.size === EpicLabel.LabelSize.xl
    }

}

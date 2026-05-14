import { ChangeDetectionStrategy, Component, computed, HostBinding, model } from '@angular/core'
import { MatIcon } from '@angular/material/icon'

import { EpicIconSize, extractIconName, isMatOutlined } from '../../models'
import { EpicIconRegistry } from '../../services'


@Component({
    selector: 'epic-icon',
    templateUrl: './epic-icon.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        MatIcon,
    ],
})
export class EpicIconComponent {

    readonly name = model<string>('')
    readonly size = model<EpicIconSize>(EpicIconSize.basic)
    //
    readonly iconName = computed<string>(() => extractIconName(this.name()))
    readonly isMatOutlined = computed<boolean>(() => this.name() ? isMatOutlined(this.name()) : false)
    readonly isSvgIcon = computed<boolean>(() => this.name() ? this.epicIconRegistry.doesIconExist(this.name()) : false)

    constructor(protected readonly epicIconRegistry: EpicIconRegistry) {
    }

    @HostBinding('class.epic-font-icon-small')
    get isSmall(): boolean {
        return this.size() === EpicIconSize.small
    }


}

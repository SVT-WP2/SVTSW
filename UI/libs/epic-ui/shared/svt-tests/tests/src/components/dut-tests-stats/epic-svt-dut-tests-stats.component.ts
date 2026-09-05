import { Component, computed, input } from '@angular/core'
import { EpicIconComponent } from 'epic-ui/common/components'
import { BaseComponent } from 'epic-ui/utils'

import {
    EpicSvtDutTestsStats,
    EpicSvtDutTestsStatTile,
    getDefaultEpicSvtDutTestsStats,
    toEpicSvtDutTestsStatTiles,
} from '../../models'


/**
 * What the tests of one DUT add up to, as a strip of boxes above the list. It only ever reads what it is
 * handed: `stats` follow the filter bar, `totalStats` are the whole list behind it.
 */
@Component({
    selector: 'epic-svt-dut-tests-stats',
    templateUrl: 'epic-svt-dut-tests-stats.component.html',
    imports: [
        EpicIconComponent,
    ],
})
export class EpicSvtDutTestsStatsComponent extends BaseComponent {

    readonly stats = input<EpicSvtDutTestsStats>(getDefaultEpicSvtDutTestsStats())
    /** Only set while the filter bar narrows the list down — that is what puts a total next to every count. */
    readonly totalStats = input<EpicSvtDutTestsStats | null>(null)

    readonly tiles = computed<EpicSvtDutTestsStatTile[]>(() => (
        toEpicSvtDutTestsStatTiles(this.stats(), this.totalStats())
    ))

}

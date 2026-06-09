import { Component, ContentChild, EventEmitter, Input, OnInit, Output } from '@angular/core'
import { BaseComponent } from 'epic-ui/utils'

import { EpicTabContentDirective } from '../../directives'
import { EpicTabs } from '../../models'


@Component({
    selector: 'epic-tabs-base',
    template: '',
    standalone: false,
})
export abstract class EpicTabsBaseComponent extends BaseComponent implements OnInit {

    @Input() tabs: EpicTabs.TabInfo[]
    @Input() activeTabId: string

    @Output() activeTabChanged$ = new EventEmitter<EpicTabs.ActiveTabChangedEvent>()

    @ContentChild(EpicTabContentDirective) tabContentTemplate: EpicTabContentDirective

    ngOnInit(): void {
        // init active tab id
        if (!this.activeTabId) {
            const activeTab = this.tabs.find(item => item.isActive)
            this.activeTabId = activeTab ? activeTab.id : this.tabs[0].id
        }
    }

    onTabClicked(tabInfo: EpicTabs.TabInfo): void {
        this.activeTabChanged$
            .emit({
                tabInfo: tabInfo,
            })
    }

}

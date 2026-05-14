import { Directive, EventEmitter, HostBinding, HostListener, Output } from '@angular/core'


@Directive({
    selector: '[epicFileDragAndDropArea]',
})
export class EpicFileDragAndDropAreaDirective {

    @Output() fileDrop$ = new EventEmitter<FileList>()

    @HostBinding('class.nano-file-drag-and-drop-area--drag-over') isDragOver = false

    dragEventsCounter = 0

    @HostListener('dragenter', ['$event'])
    onDragEnter(event: DragEvent): void {
        event.preventDefault()
        event.stopPropagation()

        // update events counter
        this.dragEventsCounter++
        this.isDragOver = true
    }

    @HostListener('dragover', ['$event'])
    onDragOver(event: DragEvent): void {
        // prevent default browser behaviour
        event.preventDefault()
    }

    @HostListener('dragleave', ['$event'])
    onDragLeave(event: DragEvent): void {
        event.preventDefault()
        event.stopPropagation()

        // update events counter
        this.dragEventsCounter--
        if (this.dragEventsCounter === 0) {
            this.isDragOver = false
        }
    }

    @HostListener('drop', ['$event'])
    onDrop(event: DragEvent): void {
        event.preventDefault()
        event.stopPropagation()

        // update events counter
        this.dragEventsCounter = 0
        this.isDragOver = false

        const files = event.dataTransfer?.files
        if (files && files.length > 0) {
            this.fileDrop$.emit(files)
        }
    }

}

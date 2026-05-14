import { from, Observable } from 'rxjs'
import { map } from 'rxjs/operators'


export namespace FileHelpers {

    export function saveArrayBufferFile(file: ArrayBuffer, fileName: string, fileType: string, document: Document): void {
        // create blob
        const blob = new Blob([file], { type: fileType })

        saveBlobFile(blob, fileName, document)
    }

    export function saveBlobFile(file: Blob, fileName: string, document: Document): void {
        const objectURL = window.URL.createObjectURL(file)

        const link = document.createElement('a')
        link.href = objectURL
        link.download = fileName
        link.click()

        window.URL.revokeObjectURL(objectURL)
    }

    export function saveFile(file: ArrayBuffer, fileName: string, fileType: string, document: Document): void {
        // create blob
        const blob = new Blob([file], { type: fileType })

        saveBlobFile(blob, fileName, document)
    }

    export function getFileExtension(fileName: string): string {
        const segments = fileName.split('.')
        return segments[segments.length - 1]
    }

    export function fileToBlob(file: File): Observable<Blob> {
        return from(file.arrayBuffer())
            .pipe(
                map(arrayBuffer => new Blob([new Uint8Array(arrayBuffer)], { type: file.type })),
            )
    }

    export function stringContentToJsonFile(jsonString: string, fileName: string): File {
        const blob = new Blob([jsonString], { type: 'application/json' })
        return new File([ blob ], fileName)
    }

    export async function extractFileStringContent(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const fileReader = new FileReader()
            fileReader.onload = event => resolve(event.target?.result as string)
            fileReader.onerror = error => reject(new Error('FileReader error'))
            fileReader.readAsText(file)
        })
    }

}

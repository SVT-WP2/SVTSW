import { TemplateRef } from '@angular/core'
import { get, orderBy } from 'lodash-es'


export namespace DynamicSection {

    export type SectionInfo = {
        id: string
        template: TemplateRef<unknown>
        order?: number
        alias?: string
    }

    export type SectionsCollection = {
        current: {
            [sectionName: string]: SectionInfo[]
        }
        parents: {
            [sectionName: string]: {
                [sectionAlias: string]: SectionInfo[]
            }
        }
    }

    export function getDefaultCollection(): SectionsCollection {
        return {
            current: {},
            parents: {},
        }
    }

    export function registerSection(
        collection: SectionsCollection,
        sectionName: string,
        sectionInfo: SectionInfo,
        multiple = true): SectionsCollection {

        const targetSectionCollection: SectionInfo[] = multiple ? (collection.current[sectionName] || []) : []
        const highestSectionOrder = multiple
            ? (targetSectionCollection[targetSectionCollection.length - 1]?.order || 0) // TODO: some adjustments are needed here.
            : 0
        // calculate order
        const order = sectionInfo.order !== undefined
            ? sectionInfo.order
            : (highestSectionOrder + 1)

        const newSectionsCollection = orderBy<SectionInfo>(
            [
                ...targetSectionCollection
                    .filter(
                        // exclude / replace items with the same id / alias
                        item =>
                            item.id !== sectionInfo.id
                            && (
                                sectionInfo.alias === undefined || item.alias !== sectionInfo.alias
                            ),
                    ),
                {
                    ...sectionInfo,
                    order,
                },
            ],
            'order',
            'desc',
        )


        const parentSection = sectionInfo.alias !== undefined
            ? targetSectionCollection.find(item => item.alias === sectionInfo.alias)
            : undefined

        return {
            ...collection,
            current: {
                ...collection.current,
                [sectionName]: newSectionsCollection,
            },
            parents: parentSection
                ? {
                    ...collection.parents,
                    [sectionName]: {
                        ...(collection.parents[sectionName] || {}),
                        [sectionInfo.alias!]: [parentSection, ...get(collection, ['parents', sectionName, sectionInfo.alias!], [])],
                    },
                }
                : collection.parents,
        }
    }

    export function unregisterSection(collection: SectionsCollection, sectionName: string, sectionId: string): SectionsCollection {
        const targetSectionCollection = collection.current[sectionName] || []
        const refSection = targetSectionCollection.find(item => item.id === sectionId)

        if (refSection === undefined) {
            // DO NOTHING
            return collection
        }

        const parentsCollection: SectionInfo[] = refSection?.alias?.length
            ? get(collection, ['parents', sectionName, refSection.alias], [])
            : []
        const parentSection = parentsCollection[0]


        const collectionWithoutSection = {
            ...collection,
            current: {
                ...collection.current,
                [sectionName]: targetSectionCollection.filter(item => item.id !== sectionId),
            },
            parents: parentSection
                ? {
                    ...collection.parents,
                    [sectionName]: {
                        ...collection.parents[sectionName],
                        [refSection.alias!]: parentsCollection.slice(1),
                    },
                }
                : { ...collection.parents },
        }

        if (parentSection) {
            return registerSection(
                collectionWithoutSection,
                sectionName,
                parentSection,
            )
        }

        return collectionWithoutSection
    }
}

import { TemplateRef } from '@angular/core'

import { DynamicSection } from '../dynamic-section.models'


describe('DynamicSection', () => {

    const refSectionName = 'SomeSection'

    const existedSection: DynamicSection.SectionInfo = {
        id: 'SOME_ID',
        template: '' as any as TemplateRef<any>,
        alias: 'SOME_ALIAS',
    }
    const collection: DynamicSection.SectionsCollection = {
        current: {
            [refSectionName]: [existedSection],
        },
        parents: {},
    }

    describe('registerSection', () => {

        test('multiple == true => add new item', () => {
            const newSection = {
                ...existedSection,
                id: 'someNewId',
                alias: 'newAlias',
            }
            const newCollection = DynamicSection.registerSection(
                { ...collection },
                refSectionName,
                newSection,
                true,
            )

            expect(newCollection.current[refSectionName].length).toEqual(2)
        })

        test('multiple == false => override existed items', () => {
            const newSection = {
                ...existedSection,
                id: 'someNewId',
            }
            const newCollection = DynamicSection.registerSection(
                { ...collection },
                refSectionName,
                newSection,
                false,
            )

            expect(newCollection.current[refSectionName].length).toEqual(1)
            expect(newCollection.current[refSectionName][0].id).toEqual(newSection.id)
        })

        test('the same alias => replace existed item + move old one to the parents section', () => {
            const newSection = {
                ...existedSection,
                id: 'someNewId',
            }
            const newCollection = DynamicSection.registerSection(
                { ...collection },
                refSectionName,
                newSection,
                true,
            )

            expect(newCollection.current[refSectionName].length).toEqual(1)
            expect(newCollection.parents[refSectionName][newSection.alias!].length).toEqual(1)
            expect(newCollection.parents[refSectionName][newSection.alias!][0].id).toEqual(existedSection.id)
        })

        test('different alias & the same id => replace existed item', () => {
            const newSection = {
                ...existedSection,
                alias: 'newAlias',
            }
            const newCollection = DynamicSection.registerSection(
                { ...collection },
                refSectionName,
                newSection,
                true,
            )

            expect(newCollection.current[refSectionName].length).toEqual(1)
            expect(newCollection.parents[refSectionName]).toBeUndefined()
        })

    })

    describe('unregisterSection', () => {

        test('remove from the current collection', () => {

            const newCollection = DynamicSection.unregisterSection(
                { ...collection },
                refSectionName,
                existedSection.id,
            )

            expect(newCollection.current[refSectionName].length).toEqual(0)
        })

        test('remove not existed item => no changes & no errors', () => {

            const newCollection = DynamicSection.unregisterSection(
                { ...collection },
                refSectionName,
                'notExistedId',
            )

            expect(newCollection).toEqual(collection)
        })

        test('remove from the current collection WITH ALIAS PARENTS', () => {

            const parentSection = {
                ...existedSection,
                id: 'parentId',
            }

            const parentSection2 = {
                ...existedSection,
                id: 'parentId2',
            }

            const newCollection = DynamicSection.unregisterSection(
                {
                    ...collection,
                    parents: {
                        [refSectionName]: {
                            [parentSection.alias!]: [parentSection, parentSection2],
                        },
                    },
                },
                refSectionName,
                existedSection.id,
            )

            expect(newCollection.current[refSectionName].length).toEqual(1)
            expect(newCollection.current[refSectionName][0].id).toEqual(parentSection.id)
            expect(newCollection.parents[refSectionName][existedSection.alias!].length).toEqual(1)
            expect(newCollection.parents[refSectionName][existedSection.alias!][0].id).toEqual(parentSection2.id)
        })
    })
})

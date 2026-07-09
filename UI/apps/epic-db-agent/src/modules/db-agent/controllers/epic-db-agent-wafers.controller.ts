import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import {
    SvtDbAgentKafka,
    SvtDbAgentKafkaAsics,
    SvtDbAgentKafkaChipBlocks,
    SvtDbAgentKafkaChips,
    SvtDbAgentKafkaEnums,
    SvtDbAgentKafkaEquipment,
    SvtDbAgentKafkaEquipmentTypes,
    SvtDbAgentKafkaSvtTestSetupConfigs,
    SvtDbAgentKafkaSvtTestSetups,
    SvtDbAgentKafkaSvtTests,
    SvtDbAgentKafkaSvtTestTemplates,
    SvtDbAgentKafkaSvtTestTypeConfigs,
    SvtDbAgentKafkaSvtTestTypes,
    SvtDbAgentKafkaWafers,
    SvtDbAgentKafkaWaferTypes,
    SvtDbAgentKafkaWpMachines,
    SvtDbAgentKafkaWpProbeCards,
    SvtDbAgentKafkaWpProjects,
} from 'epic/entities'
import { map } from 'rxjs'

import {
    EpicDbAgentAsicsService,
    EpicDbAgentChipBlocksService,
    EpicDbAgentChipsService,
    EpicDbAgentEnumsService,
    EpicDbAgentEquipmentService,
    EpicDbAgentEquipmentTypesService,
    EpicDbAgentSvtTestSetupConfigsService,
    EpicDbAgentSvtTestSetupService,
    EpicDbAgentSvtTestsService,
    EpicDbAgentSvtTestTemplatesService,
    EpicDbAgentSvtTestTypeConfigsService,
    EpicDbAgentSvtTestTypesService,
    EpicDbAgentWafersService,
    EpicDbAgentWaferTypesService,
    EpicDbAgentWpMachinesService,
    EpicDbAgentWpProbeCardsService,
    EpicDbAgentWpProjectsService,
} from '../services'


@Controller('auth')
export class EpicDbAgentWafersController {

    constructor(
        private readonly epicDbAgentWpProjectsService: EpicDbAgentWpProjectsService,
        private readonly epicDbAgentWpProbeCardsService: EpicDbAgentWpProbeCardsService,
        private readonly epicDbAgentWpMachinesService: EpicDbAgentWpMachinesService,
        private readonly epicDbAgentWafersService: EpicDbAgentWafersService,
        private readonly epicDbAgentWaferTypesService: EpicDbAgentWaferTypesService,
        private readonly epicDbAgentEquipmentTypesService: EpicDbAgentEquipmentTypesService,
        private readonly epicDbAgentEquipmentService: EpicDbAgentEquipmentService,
        private readonly epicDbAgentChipsService: EpicDbAgentChipsService,
        private readonly epicDbAgentChipBlocksService: EpicDbAgentChipBlocksService,
        private readonly epicDbAgentEnumsService: EpicDbAgentEnumsService,
        private readonly epicDbAgentSvtTestSetupService: EpicDbAgentSvtTestSetupService,
        private readonly epicDbAgentSvtTestSetupConfigsService: EpicDbAgentSvtTestSetupConfigsService,
        private readonly epicDbAgentSvtTestTypesService: EpicDbAgentSvtTestTypesService,
        private readonly epicDbAgentSvtTestTypeConfigsService: EpicDbAgentSvtTestTypeConfigsService,
        private readonly epicDbAgentSvtTestTemplatesService: EpicDbAgentSvtTestTemplatesService,
        private readonly epicDbAgentSvtTestsService: EpicDbAgentSvtTestsService,
        private readonly epicDbAgentAsicsService: EpicDbAgentAsicsService) {
    }

    @MessagePattern(SvtDbAgentKafka.TopicName.Request)
    handleDbRequest(
        @Payload() message: SvtDbAgentKafkaWafers.Message | SvtDbAgentKafkaAsics.Message
            | SvtDbAgentKafkaWaferTypes.Message | SvtDbAgentKafkaWpMachines.Message | SvtDbAgentKafkaEnums.Message
            | SvtDbAgentKafkaWpProbeCards.Message | SvtDbAgentKafkaWpProjects.Message | SvtDbAgentKafkaChips.Message
            | SvtDbAgentKafkaChipBlocks.Message
            | SvtDbAgentKafkaEquipmentTypes.Message | SvtDbAgentKafkaEquipment.Message | SvtDbAgentKafkaSvtTestSetups.Message
            | SvtDbAgentKafkaSvtTestSetupConfigs.Message | SvtDbAgentKafkaSvtTestTypes.Message
            | SvtDbAgentKafkaSvtTestTypeConfigs.Message
            | SvtDbAgentKafkaSvtTestTemplates.Message
            | SvtDbAgentKafkaSvtTests.Message) {
        switch (message.type) {
            // WAFERS
            case SvtDbAgentKafkaWafers.MessageType.GetAllWafers:
                return this.epicDbAgentWafersService.getAllWafers(message.data.filter)
                    .pipe(
                        map(wafers => JSON.stringify(new SvtDbAgentKafkaWafers.GetAllWafersReplyMessage({ items: wafers }))),
                    )
            case SvtDbAgentKafkaWafers.MessageType.CreateWafer:
                return this.epicDbAgentWafersService.createWafer(message.data.create)
                    .pipe(
                        map(wafer => JSON.stringify(new SvtDbAgentKafkaWafers.CreateWaferReplyMessage({ entity: wafer }))),
                    )
            case SvtDbAgentKafkaWafers.MessageType.UpdateWafer:
                return this.epicDbAgentWafersService.updateWafer(message.data.id, message.data.update)
                    .pipe(
                        map(wafer => JSON.stringify(new SvtDbAgentKafkaWafers.UpdateWaferReplyMessage({ entity: wafer }))),
                    )

            // WAFER LOCATION
            case SvtDbAgentKafkaWafers.MessageType.UpdateWaferLocation:
                return this.epicDbAgentWafersService.updateWaferLocation(message.data)
                    .pipe(
                        map(entity => JSON.stringify(new SvtDbAgentKafkaWafers.UpdateWaferLocationReplyMessage({ entity }))),
                    )
            case SvtDbAgentKafkaWafers.MessageType.GetWaferLocationHistory:
                return this.epicDbAgentWafersService.getWaferLocationHistory(message.data.waferId)
                    .pipe(
                        map(items => JSON.stringify(new SvtDbAgentKafkaWafers.GetWaferLocationHistoryReplyMessage({ items }))),
                    )
            // ASICS
            case SvtDbAgentKafkaAsics.MessageType.GetAllAsics:
                return this.epicDbAgentAsicsService.getAllAsics(message.data?.filter, message.data?.pager)
                    .pipe(
                        map(result => JSON.stringify(new SvtDbAgentKafkaAsics.GetAllAsicsReplyMessage(result))),
                    )
            case SvtDbAgentKafkaAsics.MessageType.CreateAsic:
                return this.epicDbAgentAsicsService.createAsic(message.data.create)
                    .pipe(
                        map(entity => JSON.stringify(new SvtDbAgentKafkaAsics.CreateAsicReplyMessage({ entity }))),
                    )
            // CHIP
            case SvtDbAgentKafkaChips.MessageType.GetAllChips:
                return this.epicDbAgentChipsService.getAllChips(message.data.filter)
                    .pipe(
                        map(result => JSON.stringify(new SvtDbAgentKafkaChips.GetAllChipsReplyMessage(result))),
                    )
            case SvtDbAgentKafkaChips.MessageType.CreateChip:
                return this.epicDbAgentChipsService.createChip(message.data.create)
                    .pipe(
                        map(entity => JSON.stringify(new SvtDbAgentKafkaChips.CreateChipReplyMessage({ entity }))),
                    )
            case SvtDbAgentKafkaChips.MessageType.CreateManyChips:
                return this.epicDbAgentChipsService.createMany(message.data.create)
                    .pipe(
                        map(items => JSON.stringify(new SvtDbAgentKafkaChips.CreateManyChipsReplyMessage({ items }))),
                    )

            // CHIP BLOCKS
            case SvtDbAgentKafkaChipBlocks.MessageType.GetAllChipBlocks:
                return this.epicDbAgentChipBlocksService.getAll(message.data.filter)
                    .pipe(
                        map(items => JSON.stringify(new SvtDbAgentKafkaChipBlocks.GetAllChipBlocksReplyMessage({ items }))),
                    )

            // CHIP LOCATION
            case SvtDbAgentKafkaChips.MessageType.UpdateChipLocation:
                return this.epicDbAgentChipsService.updateChipLocation(message.data)
                    .pipe(
                        map(entity => JSON.stringify(new SvtDbAgentKafkaChips.UpdateChipLocationReplyMessage({ entity }))),
                    )
            case SvtDbAgentKafkaChips.MessageType.GetChipLocationHistory:
                return this.epicDbAgentChipsService.getChipLocationHistory(message.data.chipId)
                    .pipe(
                        map(items => JSON.stringify(new SvtDbAgentKafkaChips.GetChipLocationHistoryReplyMessage({ items }))),
                    )
            // WAFER TYPES
            case SvtDbAgentKafkaWaferTypes.MessageType.GetAllWaferTypes:
                return this.epicDbAgentWaferTypesService.getAll()
                    .pipe(
                        map(items => JSON.stringify(new SvtDbAgentKafkaWaferTypes.GetAllWaferTypesReplyMessage({ items }))),
                    )
            case SvtDbAgentKafkaWaferTypes.MessageType.CreateWaferType:
                return this.epicDbAgentWaferTypesService.create(message.data.create)
                    .pipe(
                        map(entity => JSON.stringify(new SvtDbAgentKafkaWaferTypes.CreateWaferTypeReplyMessage({ entity }))),
                    )
            case SvtDbAgentKafkaWaferTypes.MessageType.GetWaferTypeMap:
                return this.epicDbAgentWaferTypesService.getWaferTypeMap(message.data.waferTypeId)
                    .pipe(
                        map(entity => JSON.stringify(new SvtDbAgentKafkaWaferTypes.GetWaferTypeMapReplyMessage({ entity }))),
                    )
            // WP MACHINES
            case SvtDbAgentKafkaWpMachines.MessageType.GetAllWpMachines:
                return this.epicDbAgentWpMachinesService.getAll(message.data.filter)
                    .pipe(
                        map(items => JSON.stringify(new SvtDbAgentKafkaWpMachines.GetAllWpMachinesReplyMessage({ items }))),
                    )
            case SvtDbAgentKafkaWpMachines.MessageType.CreateWpMachine:
                return this.epicDbAgentWpMachinesService.create(message.data.create)
                    .pipe(
                        map(entity => JSON.stringify(new SvtDbAgentKafkaWpMachines.CreateWpMachineReplyMessage({ entity }))),
                    )
            case SvtDbAgentKafkaWpMachines.MessageType.UpdateWpMachine:
                return this.epicDbAgentWpMachinesService.update(message.data.id, message.data.update)
                    .pipe(
                        map(entity => JSON.stringify(new SvtDbAgentKafkaWpMachines.UpdateWpMachineReplyMessage({ entity }))),
                    )
            case SvtDbAgentKafkaWpMachines.MessageType.UpdateWpMachineLoadedWafer:
                return this.epicDbAgentWpMachinesService.updateLoadedWafer(message.data)
                    .pipe(
                        map(entity => JSON.stringify(new SvtDbAgentKafkaWpMachines.UpdateWpMachineLoadedWaferReplyMessage({
                            entity: entity,
                        }))),
                    )
            case SvtDbAgentKafkaWpMachines.MessageType.UpdateWpMachineInstalledProbeCard:
                return this.epicDbAgentWpMachinesService.updateInstalledProbeCard(message.data)
                    .pipe(
                        map(entity => JSON.stringify(new SvtDbAgentKafkaWpMachines.UpdateWpMachineInstalledProbeCardReplyMessage({
                            entity: entity,
                        }))),
                    )
            // ENUMS
            case SvtDbAgentKafkaEnums.MessageType.GetAllEnums:
                return this.epicDbAgentEnumsService.getCollection(message.data?.filter?.enumNames)
                    .pipe(
                        map(collection => JSON.stringify(new SvtDbAgentKafkaEnums.GetAllEnumsReplyMessage(collection))),
                    )
            // WP PROBE CARDS
            case SvtDbAgentKafkaWpProbeCards.MessageType.GetAllWpProbeCards:
                return this.epicDbAgentWpProbeCardsService.getAll(message.data.filter)
                    .pipe(
                        map(items => JSON.stringify(new SvtDbAgentKafkaWpProbeCards.GetAllWpProbeCardsReplyMessage({ items }))),
                    )
            // WP PROJECTS
            case SvtDbAgentKafkaWpProjects.MessageType.GetAllWpProjects:
                return this.epicDbAgentWpProjectsService.getAll(message.data.filter)
                    .pipe(
                        map(items => JSON.stringify(new SvtDbAgentKafkaWpProjects.GetAllWpProjectsReplyMessage({ items }))),
                    )
            case SvtDbAgentKafkaWpProjects.MessageType.CreateWpProject:
                return this.epicDbAgentWpProjectsService.create(message.data.create)
                    .pipe(
                        map(entity => JSON.stringify(new SvtDbAgentKafkaWpProjects.CreateWpProjectReplyMessage({ entity }))),
                    )
            // EQUIPMENT TYPES
            case SvtDbAgentKafkaEquipmentTypes.MessageType.GetAllEquipmentTypes:
                return this.epicDbAgentEquipmentTypesService.getAll()
                    .pipe(
                        map(items => JSON.stringify(new SvtDbAgentKafkaEquipmentTypes.GetAllEquipmentTypesReplyMessage({ items }))),
                    )
            case SvtDbAgentKafkaEquipmentTypes.MessageType.CreateEquipmentType:
                return this.epicDbAgentEquipmentTypesService.create(message.data.create)
                    .pipe(
                        map(entity => JSON.stringify(new SvtDbAgentKafkaEquipmentTypes.CreateEquipmentTypeReplyMessage({ entity }))),
                    )
            // EQUIPMENT
            case SvtDbAgentKafkaEquipment.MessageType.GetAllEquipment:
                return this.epicDbAgentEquipmentService.getAll()
                    .pipe(
                        map(items => JSON.stringify(new SvtDbAgentKafkaEquipment.GetAllEquipmentReplyMessage({ items }))),
                    )
            case SvtDbAgentKafkaEquipment.MessageType.CreateEquipment:
                return this.epicDbAgentEquipmentService.create(message.data.create)
                    .pipe(
                        map(entity => JSON.stringify(new SvtDbAgentKafkaEquipment.CreateEquipmentReplyMessage({ entity }))),
                    )
            // EQUIPMENT LOCATION
            case SvtDbAgentKafkaEquipment.MessageType.UpdateEquipmentLocation:
                return this.epicDbAgentEquipmentService.updateEquipmentLocation(message.data)
                    .pipe(
                        map(entity => JSON.stringify(new SvtDbAgentKafkaEquipment.UpdateEquipmentLocationReplyMessage({ entity }))),
                    )
            case SvtDbAgentKafkaEquipment.MessageType.GetEquipmentLocationHistory:
                return this.epicDbAgentEquipmentService.getEquipmentLocationHistory(message.data.equipmentId)
                    .pipe(
                        map(items => JSON.stringify(new SvtDbAgentKafkaEquipment.GetEquipmentLocationHistoryReplyMessage({ items }))),
                    )
            // SVT TEST SETUPS
            case SvtDbAgentKafkaSvtTestSetups.MessageType.GetAllSvtTestSetups:
                return this.epicDbAgentSvtTestSetupService.getAll(message.data.filter)
                    .pipe(
                        map(items => JSON.stringify(new SvtDbAgentKafkaSvtTestSetups.GetAllSvtTestSetupsReplyMessage({ items }))),
                    )
            case SvtDbAgentKafkaSvtTestSetups.MessageType.CreateSvtTestSetup:
                return this.epicDbAgentSvtTestSetupService.create(message.data.create)
                    .pipe(
                        map(entity => JSON.stringify(new SvtDbAgentKafkaSvtTestSetups.CreateSvtTestSetupReplyMessage({ entity }))),
                    )
            case SvtDbAgentKafkaSvtTestSetups.MessageType.UpdateSvtTestSetup:
                return this.epicDbAgentSvtTestSetupService.update(message.data.id, message.data.update)
                    .pipe(
                        map(entity => JSON.stringify(new SvtDbAgentKafkaSvtTestSetups.UpdateSvtTestSetupReplyMessage({ entity }))),
                    )

            // SVT TEST SETUP CONFIGS
            case SvtDbAgentKafkaSvtTestSetupConfigs.MessageType.GetAllSvtTestSetupConfigs:
                return this.epicDbAgentSvtTestSetupConfigsService.getAll(message.data.filter)
                    .pipe(
                        map(items => JSON.stringify(
                            new SvtDbAgentKafkaSvtTestSetupConfigs.GetAllSvtTestSetupConfigsReplyMessage({ items })),
                        ),
                    )

            case SvtDbAgentKafkaSvtTestSetupConfigs.MessageType.CreateSvtTestSetupConfig:
                return this.epicDbAgentSvtTestSetupConfigsService.create(message.data.create)
                    .pipe(
                        map(entity => JSON.stringify(
                            new SvtDbAgentKafkaSvtTestSetupConfigs.CreateSvtTestSetupConfigReplyMessage({ entity })),
                        ),
                    )

            case SvtDbAgentKafkaSvtTestSetupConfigs.MessageType.GetSvtTestSetupConfigBody:
                return this.epicDbAgentSvtTestSetupConfigsService.getConfigBody(message.data.id)
                    .pipe(
                        map(entity => JSON.stringify(
                            new SvtDbAgentKafkaSvtTestSetupConfigs.GetSvtTestSetupConfigBodyReplyMessage({ entity })),
                        ),
                    )

            // SVT TEST TYPES
            case SvtDbAgentKafkaSvtTestTypes.MessageType.GetAllSvtTestTypes:
                return this.epicDbAgentSvtTestTypesService.getAll(message.data.filter)
                    .pipe(
                        map(items => JSON.stringify(new SvtDbAgentKafkaSvtTestTypes.GetAllSvtTestTypesReplyMessage({ items }))),
                    )
            case SvtDbAgentKafkaSvtTestTypes.MessageType.CreateSvtTestType:
                return this.epicDbAgentSvtTestTypesService.create(message.data.create)
                    .pipe(
                        map(entity => JSON.stringify(new SvtDbAgentKafkaSvtTestTypes.CreateSvtTestTypeReplyMessage({ entity }))),
                    )
            case SvtDbAgentKafkaSvtTestTypes.MessageType.UpdateSvtTestType:
                return this.epicDbAgentSvtTestTypesService.update(message.data.id, message.data.update)
                    .pipe(
                        map(entity => JSON.stringify(new SvtDbAgentKafkaSvtTestTypes.UpdateSvtTestTypeReplyMessage({ entity }))),
                    )

            // SVT TEST TYPE CONFIGS
            case SvtDbAgentKafkaSvtTestTypeConfigs.MessageType.GetAllSvtTestTypeConfigs:
                return this.epicDbAgentSvtTestTypeConfigsService.getAll(message.data.filter)
                    .pipe(
                        map(items => JSON.stringify(
                            new SvtDbAgentKafkaSvtTestTypeConfigs.GetAllSvtTestTypeConfigsReplyMessage({ items })),
                        ),
                    )
            case SvtDbAgentKafkaSvtTestTypeConfigs.MessageType.CreateSvtTestTypeConfig:
                return this.epicDbAgentSvtTestTypeConfigsService.create(message.data.create)
                    .pipe(
                        map(entity => JSON.stringify(
                            new SvtDbAgentKafkaSvtTestTypeConfigs.CreateSvtTestTypeConfigReplyMessage({ entity })),
                        ),
                    )
            case SvtDbAgentKafkaSvtTestTypeConfigs.MessageType.GetSvtTestTypeConfigBody:
                return this.epicDbAgentSvtTestTypeConfigsService.getConfigBody(message.data.id)
                    .pipe(
                        map(entity => JSON.stringify(
                            new SvtDbAgentKafkaSvtTestTypeConfigs.GetSvtTestTypeConfigBodyReplyMessage({ entity })),
                        ),
                    )

            // SVT TEST TEMPLATES
            case SvtDbAgentKafkaSvtTestTemplates.MessageType.GetAllSvtTestTemplates:
                return this.epicDbAgentSvtTestTemplatesService.getAll(message.data.filter)
                    .pipe(
                        map(items => JSON.stringify(new SvtDbAgentKafkaSvtTestTemplates.GetAllSvtTestTemplatesReplyMessage({ items }))),
                    )
            case SvtDbAgentKafkaSvtTestTemplates.MessageType.CreateSvtTestTemplate:
                return this.epicDbAgentSvtTestTemplatesService.create(message.data.create)
                    .pipe(
                        map(entity => JSON.stringify(new SvtDbAgentKafkaSvtTestTemplates.CreateSvtTestTemplateReplyMessage({ entity }))),
                    )
            case SvtDbAgentKafkaSvtTestTemplates.MessageType.UpdateSvtTestTemplate:
                return this.epicDbAgentSvtTestTemplatesService.update(message.data.id, message.data.update)
                    .pipe(
                        map(entity => JSON.stringify(new SvtDbAgentKafkaSvtTestTemplates.UpdateSvtTestTemplateReplyMessage({ entity }))),
                    )

            // SVT TESTS
            case SvtDbAgentKafkaSvtTests.MessageType.GetAllSvtTests:
                return this.epicDbAgentSvtTestsService.getAll(message.data.filter)
                    .pipe(
                        map(items => JSON.stringify(new SvtDbAgentKafkaSvtTests.GetAllSvtTestsReplyMessage({ items }))),
                    )
            case SvtDbAgentKafkaSvtTests.MessageType.CreateSvtTest:
                return this.epicDbAgentSvtTestsService.create(message.data.create)
                    .pipe(
                        map(entity => JSON.stringify(new SvtDbAgentKafkaSvtTests.CreateSvtTestReplyMessage({ entity }))),
                    )

            default:
                throw new Error('Unknown request')
        }

    }

}

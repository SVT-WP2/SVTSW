import { Migration } from '@mikro-orm/migrations'


/**
 * Migration 0: the production baseline.
 *
 * GENERATED on 2026-11-08 from `Dev/db-example/2026-11-08-backup_prod.dump`
 * (`pg_restore --schema-only --no-owner --no-privileges`) and made idempotent (IF NOT EXISTS, guarded DO blocks),
 * so it runs to completion both on an empty database and on one restored from the dump. Not edited by hand:
 * see `docs/dev-plan/02-mikro-orm.md`. Migration 1 brings this layout to the dev one.
 */
export class Migration20261108000000_baseline_prod extends Migration {

    override up(): void {
        this.addSql(`
            CREATE SCHEMA IF NOT EXISTS main;
        `)
        this.addSql(`
            DO $$ BEGIN
                CREATE TYPE main."asicFamilyType" AS ENUM (
                    'MOST',
                    'MOSS',
                    'BABYMOSS',
                    'BABYMOST',
                    'NKF7',
                    'MOSAIX',
                    'BABYMOSAIX',
                    'LAS',
                    'AncMPW1',
                    'AncMPW2',
                    'AncMPW3',
                    'AncBrain',
                    'AncASIC',
                    'CE65_V1CG_15U_SQ',
                    'CE65_V2CG_15U_SQ',
                    'CE65_V2CG_18U_SQ',
                    'CE65_V2CG_18U_HSQ',
                    'CE65_V2CG_22U5_SQ',
                    'CE65_V2CG_22U5_HSQ',
                    'CE65_V2CN_15U_SQ',
                    'CE65_V2CN_18U_SQ',
                    'CE65_V2CN_18U_HSQ',
                    'CE65_V2CN_22U5_SQ',
                    'CE65_V2CN_22U5_HSQ',
                    'AO10P',
                    'AO10',
                    'AO10B',
                    'S',
                    'DESY',
                    'NONAME1',
                    'CE65_V1CN_15U_SQ',
                    'NONAME2',
                    'CE65_V1CB_15U_SQ',
                    'dPTSN',
                    'dPTS',
                    'AF15P',
                    'AF15B',
                    'AF15',
                    'RAL_TXRX_ER1',
                    'TTS_5',
                    'TTS_4',
                    'CE65_V2CB_15U_SQ',
                    'CE65_V2CB_22U5_SQ',
                    'CE65_V2CB_18U_HSQ',
                    'CE65_V2CB_22U5_HSQ',
                    'CE65_V2CB_18U_SQ',
                    'NKF5',
                    'NKF6',
                    'NONAME5',
                    'SEU_2_INFN_BAR_GDR',
                    'SEU_1_INFN_BAR_GDR',
                    'TTS_3',
                    'TTS_2',
                    'TTS_1',
                    'ER2_APTS_OA_10_G',
                    'ER2_APTS_OA_10_P3',
                    'ER2_APTS_OA_10_P4',
                    'ER2_APTS_OA_10_P5',
                    'ER2_APTS_SF_10_G',
                    'ER2_APTS_SF_10_P3',
                    'ER2_APTS_SF_10_P4',
                    'ER2_APTS_SF_10_P5',
                    'ER2_APTS_SF_12_G',
                    'ER2_APTS_SF_15_S',
                    'ER2_APTS_SF_15_M',
                    'ER2_APTS_SF_15_G',
                    'ER2_APTS_SF_30_G',
                    'ER2_APTS_SF_40_G',
                    'ER2_APTS_SF_50_G',
                    'ER2_APTS_SF_50_NW',
                    'ER2_APTS_SF_MOSAIX',
                    'ER2_BNL_ADC',
                    'ER2_BNL_DATATR',
                    'ER2_BG_TMON',
                    'ER2_DPTS',
                    'ER2_DPTS_P3',
                    'ER2_DPTS_P5',
                    'ER2_NAPA_v2',
                    'ER2_RING_OSC_v1',
                    'ER2_RING_OSC_v2',
                    'ER2_SEU3',
                    'ER2_SERIALIZER',
                    'ER2_SPARC',
                    'ER2_TDC_HEID',
                    'ER2_TTS1',
                    'ER2_TTS2'
                );
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                CREATE TYPE main."asicQuality" AS ENUM (
                    'MechanicallyDamaged',
                    'MechanicallyInteger',
                    'CoveredByGreenLayer'
                );
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                CREATE TYPE main."blockType" AS ENUM (
                    'AncMPW1_SLDO',
                    'AncMPW1_NVBG',
                    'AncMPW1_CML_TRANSCEIVER',
                    'AncMPW2_SLDO',
                    'AncMPW2_NVBG',
                    'AncMPW2_CML_TRANSCEIVER'
                );
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                CREATE TYPE main."dutType" AS ENUM (
                    'MOSAIX',
                    'BABYMOSAIX',
                    'AncMPW2_SLDO'
                );
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                CREATE TYPE main."engineeringRun" AS ENUM (
                    'ER1',
                    'ER2',
                    'ER3',
                    'LAS1',
                    'AncMPW1',
                    'AncMPW2'
                );
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                CREATE TYPE main."foundryName" AS ENUM (
                    'TowerSemiconductor',
                    'Xfab'
                );
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                CREATE TYPE main."moduleType" AS ENUM (
                    'IB0',
                    'IB1',
                    'IB2'
                );
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                CREATE TYPE main."pcLocation" AS ENUM (
                    'CERN',
                    'Prague',
                    'LosAlamos',
                    'BNL',
                    'RAL'
                );
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                CREATE TYPE main."pcModel" AS ENUM (
                    'NKF7-TS3500-CABLEOUT-MLO(EVS-P)',
                    'MOSAIX-LEC-TS3500-CABLEOUT-OTHERS-MLOO-EVS-P-VY540',
                    'MosaixLeft',
                    'MosaixRight',
                    'LAS',
                    'BabyMOSS',
                    'Ancillary'
                );
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                CREATE TYPE main."pcName" AS ENUM (
                    'NKF7_MPI',
                    'MOSAIX_LEC',
                    'BabyMOSS_Korea',
                    'Mosaix_Korea'
                );
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                CREATE TYPE main."pcType" AS ENUM (
                    'Vertical',
                    'Cantilever'
                );
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                CREATE TYPE main."pcVendor" AS ENUM (
                    'MPI',
                    'Korea',
                    'Synergie',
                    'FormFactorPC'
                );
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                CREATE TYPE main."waferInMachineStatus" AS ENUM (
                    'Loaded',
                    'Unloaded'
                );
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                CREATE TYPE main."waferMapOrientation" AS ENUM (
                    'North',
                    'South',
                    'East',
                    'West'
                );
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                CREATE TYPE main."waferTech" AS ENUM (
                    'TPSCo65',
                    'Xfab110'
                );
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                CREATE TYPE main."wpConnectionType" AS ENUM (
                    'TCPIP',
                    'GPIB',
                    'RS232',
                    'USB',
                    'Ethernet',
                    'Modbus',
                    'LAN'
                );
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                CREATE TYPE main."wpGeneralLocation" AS ENUM (
                    'CERN',
                    'CERN_186_R_E10',
                    'Prague',
                    'LosAlamos',
                    'BNL',
                    'RAL',
                    'Darsburry',
                    'Brunel',
                    'Birmingham',
                    'Liverpool',
                    'LBL'
                );
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                CREATE TYPE main."wpSwType" AS ENUM (
                    'Sentio',
                    'VeloxCascade'
                );
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                CREATE TYPE main."wpVendor" AS ENUM (
                    'MPI',
                    'CascadeMicrotech',
                    'FormFactor'
                );
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
        `)
        this.addSql(`
            CREATE TABLE IF NOT EXISTS main."Asic" (
                id integer NOT NULL,
                "waferId" integer NOT NULL,
                "serialNumber" character varying(50) NOT NULL,
                "familyType" main."asicFamilyType" NOT NULL,
                "waferMapPosition" character varying(50) NOT NULL,
                quality main."asicQuality" NOT NULL
            );
        `)
        this.addSql(`
            CREATE TABLE IF NOT EXISTS main."AsicFamilyTypeBlockList" (
                "asicFamilyType" main."asicFamilyType" NOT NULL,
                "blockType" main."blockType" NOT NULL
            );
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_attribute a
                    JOIN pg_class c ON c.oid = a.attrelid
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = 'main' AND c.relname = 'Asic' AND a.attname = 'id' AND a.attidentity <> ''
                ) THEN
                    ALTER TABLE main."Asic" ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
                        SEQUENCE NAME main."Asic_id_seq"
                        START WITH 1
                        INCREMENT BY 1
                        NO MINVALUE
                        NO MAXVALUE
                        CACHE 1
                    );
                END IF;
            END $$;
        `)
        this.addSql(`
            CREATE TABLE IF NOT EXISTS main."Chip" (
                id integer NOT NULL,
                "asicId" integer NOT NULL,
                "serialNumber" character varying(50) NOT NULL,
                "generalLocation" main."wpGeneralLocation" NOT NULL
            );
        `)
        this.addSql(`
            CREATE TABLE IF NOT EXISTS main."ChipBlock" (
                id integer NOT NULL,
                "chipId" integer NOT NULL,
                "blockType" main."blockType" NOT NULL,
                "serialNumber" character varying(50) NOT NULL
            );
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_attribute a
                    JOIN pg_class c ON c.oid = a.attrelid
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = 'main' AND c.relname = 'ChipBlock' AND a.attname = 'id' AND a.attidentity <> ''
                ) THEN
                    ALTER TABLE main."ChipBlock" ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
                        SEQUENCE NAME main."ChipBlock_id_seq"
                        START WITH 1
                        INCREMENT BY 1
                        NO MINVALUE
                        NO MAXVALUE
                        CACHE 1
                    );
                END IF;
            END $$;
        `)
        this.addSql(`
            CREATE TABLE IF NOT EXISTS main."ChipLocation" (
                "chipId" integer NOT NULL,
                "generalLocation" main."wpGeneralLocation" NOT NULL,
                date date DEFAULT CURRENT_DATE,
                username character varying(50),
                note text
            );
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_attribute a
                    JOIN pg_class c ON c.oid = a.attrelid
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = 'main' AND c.relname = 'Chip' AND a.attname = 'id' AND a.attidentity <> ''
                ) THEN
                    ALTER TABLE main."Chip" ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
                        SEQUENCE NAME main."Chip_id_seq"
                        START WITH 1
                        INCREMENT BY 1
                        NO MINVALUE
                        NO MAXVALUE
                        CACHE 1
                    );
                END IF;
            END $$;
        `)
        this.addSql(`
            CREATE TABLE IF NOT EXISTS main."Equipment" (
                id integer NOT NULL,
                name character varying(50) NOT NULL,
                "equipmentTypeId" integer NOT NULL,
                "generalLocation" main."wpGeneralLocation" NOT NULL,
                specification json
            );
        `)
        this.addSql(`
            CREATE TABLE IF NOT EXISTS main."EquipmentLocation" (
                "equipmentId" integer NOT NULL,
                "generalLocation" main."wpGeneralLocation" NOT NULL,
                date date DEFAULT CURRENT_DATE,
                username character varying(50),
                note text
            );
        `)
        this.addSql(`
            CREATE TABLE IF NOT EXISTS main."EquipmentType" (
                id integer NOT NULL,
                name character varying(50) NOT NULL
            );
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_attribute a
                    JOIN pg_class c ON c.oid = a.attrelid
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = 'main' AND c.relname = 'EquipmentType' AND a.attname = 'id' AND a.attidentity <> ''
                ) THEN
                    ALTER TABLE main."EquipmentType" ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
                        SEQUENCE NAME main."EquipmentType_id_seq"
                        START WITH 1
                        INCREMENT BY 1
                        NO MINVALUE
                        NO MAXVALUE
                        CACHE 1
                    );
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_attribute a
                    JOIN pg_class c ON c.oid = a.attrelid
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = 'main' AND c.relname = 'Equipment' AND a.attname = 'id' AND a.attidentity <> ''
                ) THEN
                    ALTER TABLE main."Equipment" ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
                        SEQUENCE NAME main."Equipment_id_seq"
                        START WITH 1
                        INCREMENT BY 1
                        NO MINVALUE
                        NO MAXVALUE
                        CACHE 1
                    );
                END IF;
            END $$;
        `)
        this.addSql(`
            CREATE TABLE IF NOT EXISTS main."Module" (
                id integer NOT NULL,
                "modType" main."moduleType" NOT NULL,
                "serialNumber" character varying(50) NOT NULL,
                "generalLocation" main."wpGeneralLocation" NOT NULL
            );
        `)
        this.addSql(`
            CREATE TABLE IF NOT EXISTS main."ModuleChipList" (
                "modId" integer NOT NULL,
                "chipId" integer NOT NULL
            );
        `)
        this.addSql(`
            CREATE TABLE IF NOT EXISTS main."ModuleLocation" (
                "modId" integer NOT NULL,
                "generalLocation" main."wpGeneralLocation" NOT NULL,
                date date DEFAULT CURRENT_DATE,
                username character varying(50),
                note text
            );
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_attribute a
                    JOIN pg_class c ON c.oid = a.attrelid
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = 'main' AND c.relname = 'Module' AND a.attname = 'id' AND a.attidentity <> ''
                ) THEN
                    ALTER TABLE main."Module" ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
                        SEQUENCE NAME main."Module_id_seq"
                        START WITH 1
                        INCREMENT BY 1
                        NO MINVALUE
                        NO MAXVALUE
                        CACHE 1
                    );
                END IF;
            END $$;
        `)
        this.addSql(`
            CREATE TABLE IF NOT EXISTS main."ProbeCard" (
                id integer NOT NULL,
                "serialNumber" character varying(50) NOT NULL,
                vendor main."pcVendor" NOT NULL,
                name main."pcName" NOT NULL,
                model main."pcModel" NOT NULL,
                version integer NOT NULL,
                "arriveDate" date NOT NULL,
                location main."pcLocation" NOT NULL,
                type main."pcType" NOT NULL,
                "vendorCleaningInterval" integer NOT NULL
            );
        `)
        this.addSql(`
            CREATE TABLE IF NOT EXISTS main."ProbeCardFamilyType" (
                "probeCardId" integer NOT NULL,
                "asicFamilyType" main."asicFamilyType" NOT NULL
            );
        `)
        this.addSql(`
            CREATE TABLE IF NOT EXISTS main."ProbeCardInstalledInMachine" (
                "machineId" integer NOT NULL,
                "probeCardId" integer NOT NULL,
                orientation main."waferMapOrientation",
                date date DEFAULT CURRENT_DATE,
                username character varying(50)
            );
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_attribute a
                    JOIN pg_class c ON c.oid = a.attrelid
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = 'main' AND c.relname = 'ProbeCard' AND a.attname = 'id' AND a.attidentity <> ''
                ) THEN
                    ALTER TABLE main."ProbeCard" ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
                        SEQUENCE NAME main."ProbeCard_id_seq"
                        START WITH 1
                        INCREMENT BY 1
                        NO MINVALUE
                        NO MAXVALUE
                        CACHE 1
                    );
                END IF;
            END $$;
        `)
        this.addSql(`
            CREATE TABLE IF NOT EXISTS main."SvtAsicTestList" (
                "asicId" integer NOT NULL,
                "testId" integer NOT NULL
            );
        `)
        this.addSql(`
            CREATE TABLE IF NOT EXISTS main."SvtChipBlockTestList" (
                "blockId" integer NOT NULL,
                "testId" integer NOT NULL
            );
        `)
        this.addSql(`
            CREATE TABLE IF NOT EXISTS main."SvtChipTestList" (
                "chipId" integer NOT NULL,
                "testId" integer NOT NULL
            );
        `)
        this.addSql(`
            CREATE TABLE IF NOT EXISTS main."SvtTestList" (
                id integer NOT NULL,
                "testTypeConfigId" integer NOT NULL,
                "testSetupConfigId" integer,
                "createsAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
                "startedAt" timestamp without time zone,
                "finishedAt" timestamp without time zone,
                "pathToResult" text,
                "testResultStatus" character varying(50)
            );
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_attribute a
                    JOIN pg_class c ON c.oid = a.attrelid
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = 'main' AND c.relname = 'SvtTestList' AND a.attname = 'id' AND a.attidentity <> ''
                ) THEN
                    ALTER TABLE main."SvtTestList" ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
                        SEQUENCE NAME main."SvtTestList_id_seq"
                        START WITH 1
                        INCREMENT BY 1
                        NO MINVALUE
                        NO MAXVALUE
                        CACHE 1
                    );
                END IF;
            END $$;
        `)
        this.addSql(`
            CREATE TABLE IF NOT EXISTS main."SvtTestSetup" (
                id integer NOT NULL,
                name character varying(100),
                "generalLocation" main."wpGeneralLocation"
            );
        `)
        this.addSql(`
            CREATE TABLE IF NOT EXISTS main."SvtTestSetupConfig" (
                id integer NOT NULL,
                "setupId" integer NOT NULL,
                name character varying(100) NOT NULL,
                note text,
                "configBody" json NOT NULL,
                "createdAt" date DEFAULT CURRENT_DATE
            );
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_attribute a
                    JOIN pg_class c ON c.oid = a.attrelid
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = 'main' AND c.relname = 'SvtTestSetupConfig' AND a.attname = 'id' AND a.attidentity <> ''
                ) THEN
                    ALTER TABLE main."SvtTestSetupConfig" ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
                        SEQUENCE NAME main."SvtTestSetupConfig_id_seq"
                        START WITH 1
                        INCREMENT BY 1
                        NO MINVALUE
                        NO MAXVALUE
                        CACHE 1
                    );
                END IF;
            END $$;
        `)
        this.addSql(`
            CREATE TABLE IF NOT EXISTS main."SvtTestSetupDefaultConfig" (
                "setupId" integer NOT NULL,
                "defaultConfigId" integer
            );
        `)
        this.addSql(`
            CREATE TABLE IF NOT EXISTS main."SvtTestSetupEquipList" (
                "setupId" integer NOT NULL,
                "equipId" integer NOT NULL
            );
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_attribute a
                    JOIN pg_class c ON c.oid = a.attrelid
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = 'main' AND c.relname = 'SvtTestSetup' AND a.attname = 'id' AND a.attidentity <> ''
                ) THEN
                    ALTER TABLE main."SvtTestSetup" ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
                        SEQUENCE NAME main."SvtTestSetup_id_seq"
                        START WITH 1
                        INCREMENT BY 1
                        NO MINVALUE
                        NO MAXVALUE
                        CACHE 1
                    );
                END IF;
            END $$;
        `)
        this.addSql(`
            CREATE TABLE IF NOT EXISTS main."SvtTestTemplate" (
                id integer NOT NULL,
                "dutType" main."dutType",
                "testTypeConfigId" integer,
                "isEnabled" boolean DEFAULT true
            );
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_attribute a
                    JOIN pg_class c ON c.oid = a.attrelid
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = 'main' AND c.relname = 'SvtTestTemplate' AND a.attname = 'id' AND a.attidentity <> ''
                ) THEN
                    ALTER TABLE main."SvtTestTemplate" ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
                        SEQUENCE NAME main."SvtTestTemplate_id_seq"
                        START WITH 1
                        INCREMENT BY 1
                        NO MINVALUE
                        NO MAXVALUE
                        CACHE 1
                    );
                END IF;
            END $$;
        `)
        this.addSql(`
            CREATE TABLE IF NOT EXISTS main."SvtTestType" (
                id integer NOT NULL,
                name character varying(100) NOT NULL
            );
        `)
        this.addSql(`
            CREATE TABLE IF NOT EXISTS main."SvtTestTypeConfig" (
                id integer NOT NULL,
                "testTypeId" integer NOT NULL,
                name character varying(100) NOT NULL,
                note text,
                "configBody" json NOT NULL,
                "createdAt" date DEFAULT CURRENT_DATE
            );
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_attribute a
                    JOIN pg_class c ON c.oid = a.attrelid
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = 'main' AND c.relname = 'SvtTestTypeConfig' AND a.attname = 'id' AND a.attidentity <> ''
                ) THEN
                    ALTER TABLE main."SvtTestTypeConfig" ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
                        SEQUENCE NAME main."SvtTestTypeConfig_id_seq"
                        START WITH 1
                        INCREMENT BY 1
                        NO MINVALUE
                        NO MAXVALUE
                        CACHE 1
                    );
                END IF;
            END $$;
        `)
        this.addSql(`
            CREATE TABLE IF NOT EXISTS main."SvtTestTypeDUTTypeList" (
                "dutType" main."dutType" NOT NULL,
                "testTypeId" integer NOT NULL
            );
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_attribute a
                    JOIN pg_class c ON c.oid = a.attrelid
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = 'main' AND c.relname = 'SvtTestType' AND a.attname = 'id' AND a.attidentity <> ''
                ) THEN
                    ALTER TABLE main."SvtTestType" ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
                        SEQUENCE NAME main."SvtTestType_id_seq"
                        START WITH 1
                        INCREMENT BY 1
                        NO MINVALUE
                        NO MAXVALUE
                        CACHE 1
                    );
                END IF;
            END $$;
        `)
        this.addSql(`
            CREATE TABLE IF NOT EXISTS main."Wafer" (
                id integer NOT NULL,
                "waferTypeId" integer NOT NULL,
                "serialNumber" character varying(50) NOT NULL,
                "batchNumber" integer NOT NULL,
                "thinningDate" date,
                "dicingDate" date,
                "productionDate" date,
                "generalLocation" main."wpGeneralLocation"
            );
        `)
        this.addSql(`
            CREATE TABLE IF NOT EXISTS main."WaferLoadedInMachine" (
                "machineId" integer NOT NULL,
                "waferId" integer NOT NULL,
                orientation main."waferMapOrientation",
                date date DEFAULT CURRENT_DATE,
                username character varying(50),
                status main."waferInMachineStatus"
            );
        `)
        this.addSql(`
            CREATE TABLE IF NOT EXISTS main."WaferLocation" (
                "waferId" integer NOT NULL,
                "generalLocation" main."wpGeneralLocation" NOT NULL,
                date date DEFAULT CURRENT_DATE,
                username character varying(50),
                note text
            );
        `)
        this.addSql(`
            CREATE TABLE IF NOT EXISTS main."WaferProbeMachine" (
                id integer NOT NULL,
                "serialNumber" character varying(50) NOT NULL,
                name character varying(50) NOT NULL,
                "hostName" character varying(200) NOT NULL,
                "connectionType" main."wpConnectionType" NOT NULL,
                "connectionPort" integer NOT NULL,
                "generalLocation" main."wpGeneralLocation" NOT NULL,
                software main."wpSwType" NOT NULL,
                "swVersion" character varying(50) NOT NULL,
                vendor main."wpVendor" NOT NULL,
                "loadedWaferId" integer,
                "loadedWaferOrientation" main."waferMapOrientation",
                "installedProbeCardId" integer,
                "installedProbeCardOrientation" main."waferMapOrientation"
            );
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_attribute a
                    JOIN pg_class c ON c.oid = a.attrelid
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = 'main' AND c.relname = 'WaferProbeMachine' AND a.attname = 'id' AND a.attidentity <> ''
                ) THEN
                    ALTER TABLE main."WaferProbeMachine" ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
                        SEQUENCE NAME main."WaferProbeMachine_id_seq"
                        START WITH 1
                        INCREMENT BY 1
                        NO MINVALUE
                        NO MAXVALUE
                        CACHE 1
                    );
                END IF;
            END $$;
        `)
        this.addSql(`
            CREATE TABLE IF NOT EXISTS main."WaferProbeProject" (
                id integer NOT NULL,
                "wpMachineId" integer NOT NULL,
                "waferTypeId" integer NOT NULL,
                "asicFamilyType" main."asicFamilyType",
                orientation main."waferMapOrientation",
                name character varying(100) NOT NULL,
                "alignmentDie" character varying(100),
                "homeDie" character varying(100),
                "local2GlobalMap" json
            );
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_attribute a
                    JOIN pg_class c ON c.oid = a.attrelid
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = 'main' AND c.relname = 'WaferProbeProject' AND a.attname = 'id' AND a.attidentity <> ''
                ) THEN
                    ALTER TABLE main."WaferProbeProject" ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
                        SEQUENCE NAME main."WaferProbeProject_id_seq"
                        START WITH 1
                        INCREMENT BY 1
                        NO MINVALUE
                        NO MAXVALUE
                        CACHE 1
                    );
                END IF;
            END $$;
        `)
        this.addSql(`
            CREATE TABLE IF NOT EXISTS main."WaferType" (
                id integer NOT NULL,
                name character varying(50) NOT NULL,
                "engineeringRun" main."engineeringRun" NOT NULL,
                foundry main."foundryName" NOT NULL,
                technology main."waferTech" NOT NULL
            );
        `)
        this.addSql(`
            CREATE TABLE IF NOT EXISTS main."WaferTypeImage" (
                "waferTypeId" integer NOT NULL,
                "imageBase64String" text NOT NULL
            );
        `)
        this.addSql(`
            CREATE TABLE IF NOT EXISTS main."WaferTypeMap" (
                "waferTypeId" integer NOT NULL,
                "waferMap" json NOT NULL
            );
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_attribute a
                    JOIN pg_class c ON c.oid = a.attrelid
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = 'main' AND c.relname = 'WaferType' AND a.attname = 'id' AND a.attidentity <> ''
                ) THEN
                    ALTER TABLE main."WaferType" ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
                        SEQUENCE NAME main."WaferType_id_seq"
                        START WITH 1
                        INCREMENT BY 1
                        NO MINVALUE
                        NO MAXVALUE
                        CACHE 1
                    );
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_attribute a
                    JOIN pg_class c ON c.oid = a.attrelid
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = 'main' AND c.relname = 'Wafer' AND a.attname = 'id' AND a.attidentity <> ''
                ) THEN
                    ALTER TABLE main."Wafer" ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
                        SEQUENCE NAME main."Wafer_id_seq"
                        START WITH 1
                        INCREMENT BY 1
                        NO MINVALUE
                        NO MAXVALUE
                        CACHE 1
                    );
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."AsicFamilyTypeBlockList"'::regclass AND conname = 'AsicFamilyTypeBlockList_pkey'
                ) THEN
                    ALTER TABLE ONLY main."AsicFamilyTypeBlockList"
                        ADD CONSTRAINT "AsicFamilyTypeBlockList_pkey" PRIMARY KEY ("asicFamilyType", "blockType");
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."Asic"'::regclass AND conname = 'Asic_pkey'
                ) THEN
                    ALTER TABLE ONLY main."Asic"
                        ADD CONSTRAINT "Asic_pkey" PRIMARY KEY (id);
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."Asic"'::regclass AND conname = 'Asic_serialNumber_key'
                ) THEN
                    ALTER TABLE ONLY main."Asic"
                        ADD CONSTRAINT "Asic_serialNumber_key" UNIQUE ("serialNumber");
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."ChipBlock"'::regclass AND conname = 'ChipBlock_pkey'
                ) THEN
                    ALTER TABLE ONLY main."ChipBlock"
                        ADD CONSTRAINT "ChipBlock_pkey" PRIMARY KEY (id);
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."ChipBlock"'::regclass AND conname = 'ChipBlock_serialNumber_key'
                ) THEN
                    ALTER TABLE ONLY main."ChipBlock"
                        ADD CONSTRAINT "ChipBlock_serialNumber_key" UNIQUE ("serialNumber");
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."Chip"'::regclass AND conname = 'Chip_pkey'
                ) THEN
                    ALTER TABLE ONLY main."Chip"
                        ADD CONSTRAINT "Chip_pkey" PRIMARY KEY (id);
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."Chip"'::regclass AND conname = 'Chip_serialNumber_key'
                ) THEN
                    ALTER TABLE ONLY main."Chip"
                        ADD CONSTRAINT "Chip_serialNumber_key" UNIQUE ("serialNumber");
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."EquipmentType"'::regclass AND conname = 'EquipmentType_name_key'
                ) THEN
                    ALTER TABLE ONLY main."EquipmentType"
                        ADD CONSTRAINT "EquipmentType_name_key" UNIQUE (name);
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."EquipmentType"'::regclass AND conname = 'EquipmentType_pkey'
                ) THEN
                    ALTER TABLE ONLY main."EquipmentType"
                        ADD CONSTRAINT "EquipmentType_pkey" PRIMARY KEY (id);
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."Equipment"'::regclass AND conname = 'Equipment_name_key'
                ) THEN
                    ALTER TABLE ONLY main."Equipment"
                        ADD CONSTRAINT "Equipment_name_key" UNIQUE (name);
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."Equipment"'::regclass AND conname = 'Equipment_pkey'
                ) THEN
                    ALTER TABLE ONLY main."Equipment"
                        ADD CONSTRAINT "Equipment_pkey" PRIMARY KEY (id);
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."ModuleChipList"'::regclass AND conname = 'ModuleChipList_pkey'
                ) THEN
                    ALTER TABLE ONLY main."ModuleChipList"
                        ADD CONSTRAINT "ModuleChipList_pkey" PRIMARY KEY ("modId", "chipId");
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."Module"'::regclass AND conname = 'Module_pkey'
                ) THEN
                    ALTER TABLE ONLY main."Module"
                        ADD CONSTRAINT "Module_pkey" PRIMARY KEY (id);
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."Module"'::regclass AND conname = 'Module_serialNumber_key'
                ) THEN
                    ALTER TABLE ONLY main."Module"
                        ADD CONSTRAINT "Module_serialNumber_key" UNIQUE ("serialNumber");
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."ProbeCardFamilyType"'::regclass AND conname = 'ProbeCardFamilyType_pkey'
                ) THEN
                    ALTER TABLE ONLY main."ProbeCardFamilyType"
                        ADD CONSTRAINT "ProbeCardFamilyType_pkey" PRIMARY KEY ("probeCardId", "asicFamilyType");
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."ProbeCard"'::regclass AND conname = 'ProbeCard_name_key'
                ) THEN
                    ALTER TABLE ONLY main."ProbeCard"
                        ADD CONSTRAINT "ProbeCard_name_key" UNIQUE (name);
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."ProbeCard"'::regclass AND conname = 'ProbeCard_pkey'
                ) THEN
                    ALTER TABLE ONLY main."ProbeCard"
                        ADD CONSTRAINT "ProbeCard_pkey" PRIMARY KEY (id);
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."ProbeCard"'::regclass AND conname = 'ProbeCard_serialNumber_key'
                ) THEN
                    ALTER TABLE ONLY main."ProbeCard"
                        ADD CONSTRAINT "ProbeCard_serialNumber_key" UNIQUE ("serialNumber");
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."SvtAsicTestList"'::regclass AND conname = 'SvtAsicTestList_pkey'
                ) THEN
                    ALTER TABLE ONLY main."SvtAsicTestList"
                        ADD CONSTRAINT "SvtAsicTestList_pkey" PRIMARY KEY ("asicId", "testId");
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."SvtChipBlockTestList"'::regclass AND conname = 'SvtChipBlockTestList_pkey'
                ) THEN
                    ALTER TABLE ONLY main."SvtChipBlockTestList"
                        ADD CONSTRAINT "SvtChipBlockTestList_pkey" PRIMARY KEY ("blockId", "testId");
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."SvtChipTestList"'::regclass AND conname = 'SvtChipTestList_pkey'
                ) THEN
                    ALTER TABLE ONLY main."SvtChipTestList"
                        ADD CONSTRAINT "SvtChipTestList_pkey" PRIMARY KEY ("chipId", "testId");
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."SvtTestList"'::regclass AND conname = 'SvtTestList_pkey'
                ) THEN
                    ALTER TABLE ONLY main."SvtTestList"
                        ADD CONSTRAINT "SvtTestList_pkey" PRIMARY KEY (id);
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."SvtTestSetupConfig"'::regclass AND conname = 'SvtTestSetupConfig_name_key'
                ) THEN
                    ALTER TABLE ONLY main."SvtTestSetupConfig"
                        ADD CONSTRAINT "SvtTestSetupConfig_name_key" UNIQUE (name);
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."SvtTestSetupConfig"'::regclass AND conname = 'SvtTestSetupConfig_pkey'
                ) THEN
                    ALTER TABLE ONLY main."SvtTestSetupConfig"
                        ADD CONSTRAINT "SvtTestSetupConfig_pkey" PRIMARY KEY (id);
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."SvtTestSetupDefaultConfig"'::regclass AND conname = 'SvtTestSetupDefaultConfig_pkey'
                ) THEN
                    ALTER TABLE ONLY main."SvtTestSetupDefaultConfig"
                        ADD CONSTRAINT "SvtTestSetupDefaultConfig_pkey" PRIMARY KEY ("setupId");
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."SvtTestSetupEquipList"'::regclass AND conname = 'SvtTestSetupEquipList_pkey'
                ) THEN
                    ALTER TABLE ONLY main."SvtTestSetupEquipList"
                        ADD CONSTRAINT "SvtTestSetupEquipList_pkey" PRIMARY KEY ("setupId", "equipId");
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."SvtTestSetup"'::regclass AND conname = 'SvtTestSetup_pkey'
                ) THEN
                    ALTER TABLE ONLY main."SvtTestSetup"
                        ADD CONSTRAINT "SvtTestSetup_pkey" PRIMARY KEY (id);
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."SvtTestTemplate"'::regclass AND conname = 'SvtTestTemplate_pkey'
                ) THEN
                    ALTER TABLE ONLY main."SvtTestTemplate"
                        ADD CONSTRAINT "SvtTestTemplate_pkey" PRIMARY KEY (id);
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."SvtTestTypeConfig"'::regclass AND conname = 'SvtTestTypeConfig_pkey'
                ) THEN
                    ALTER TABLE ONLY main."SvtTestTypeConfig"
                        ADD CONSTRAINT "SvtTestTypeConfig_pkey" PRIMARY KEY (id);
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."SvtTestTypeDUTTypeList"'::regclass AND conname = 'SvtTestTypeDUTTypeList_pkey'
                ) THEN
                    ALTER TABLE ONLY main."SvtTestTypeDUTTypeList"
                        ADD CONSTRAINT "SvtTestTypeDUTTypeList_pkey" PRIMARY KEY ("dutType", "testTypeId");
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."SvtTestType"'::regclass AND conname = 'SvtTestType_name_key'
                ) THEN
                    ALTER TABLE ONLY main."SvtTestType"
                        ADD CONSTRAINT "SvtTestType_name_key" UNIQUE (name);
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."SvtTestType"'::regclass AND conname = 'SvtTestType_pkey'
                ) THEN
                    ALTER TABLE ONLY main."SvtTestType"
                        ADD CONSTRAINT "SvtTestType_pkey" PRIMARY KEY (id);
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."WaferProbeMachine"'::regclass AND conname = 'WaferProbeMachine_name_key'
                ) THEN
                    ALTER TABLE ONLY main."WaferProbeMachine"
                        ADD CONSTRAINT "WaferProbeMachine_name_key" UNIQUE (name);
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."WaferProbeMachine"'::regclass AND conname = 'WaferProbeMachine_pkey'
                ) THEN
                    ALTER TABLE ONLY main."WaferProbeMachine"
                        ADD CONSTRAINT "WaferProbeMachine_pkey" PRIMARY KEY (id);
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."WaferProbeMachine"'::regclass AND conname = 'WaferProbeMachine_serialNumber_key'
                ) THEN
                    ALTER TABLE ONLY main."WaferProbeMachine"
                        ADD CONSTRAINT "WaferProbeMachine_serialNumber_key" UNIQUE ("serialNumber");
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."WaferProbeProject"'::regclass AND conname = 'WaferProbeProject_name_key'
                ) THEN
                    ALTER TABLE ONLY main."WaferProbeProject"
                        ADD CONSTRAINT "WaferProbeProject_name_key" UNIQUE (name);
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."WaferProbeProject"'::regclass AND conname = 'WaferProbeProject_pkey'
                ) THEN
                    ALTER TABLE ONLY main."WaferProbeProject"
                        ADD CONSTRAINT "WaferProbeProject_pkey" PRIMARY KEY (id);
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."WaferTypeImage"'::regclass AND conname = 'WaferTypeImage_pkey'
                ) THEN
                    ALTER TABLE ONLY main."WaferTypeImage"
                        ADD CONSTRAINT "WaferTypeImage_pkey" PRIMARY KEY ("waferTypeId");
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."WaferTypeMap"'::regclass AND conname = 'WaferTypeMap_pkey'
                ) THEN
                    ALTER TABLE ONLY main."WaferTypeMap"
                        ADD CONSTRAINT "WaferTypeMap_pkey" PRIMARY KEY ("waferTypeId");
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."WaferType"'::regclass AND conname = 'WaferType_engineeringRun_key'
                ) THEN
                    ALTER TABLE ONLY main."WaferType"
                        ADD CONSTRAINT "WaferType_engineeringRun_key" UNIQUE ("engineeringRun");
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."WaferType"'::regclass AND conname = 'WaferType_name_key'
                ) THEN
                    ALTER TABLE ONLY main."WaferType"
                        ADD CONSTRAINT "WaferType_name_key" UNIQUE (name);
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."WaferType"'::regclass AND conname = 'WaferType_pkey'
                ) THEN
                    ALTER TABLE ONLY main."WaferType"
                        ADD CONSTRAINT "WaferType_pkey" PRIMARY KEY (id);
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."Wafer"'::regclass AND conname = 'Wafer_pkey'
                ) THEN
                    ALTER TABLE ONLY main."Wafer"
                        ADD CONSTRAINT "Wafer_pkey" PRIMARY KEY (id);
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."Wafer"'::regclass AND conname = 'Wafer_serialNumber_key'
                ) THEN
                    ALTER TABLE ONLY main."Wafer"
                        ADD CONSTRAINT "Wafer_serialNumber_key" UNIQUE ("serialNumber");
                END IF;
            END $$;
        `)
        this.addSql(`
            CREATE UNIQUE INDEX IF NOT EXISTS "SvtTestTemplate_dutType_testTypeConfigId_idx" ON main."SvtTestTemplate" USING btree
                        ("dutType", "testTypeConfigId");
        `)
        this.addSql(`
            CREATE UNIQUE INDEX IF NOT EXISTS "SvtTestTypeConfig_testTypeId_name_idx" ON main."SvtTestTypeConfig" USING btree
                        ("testTypeId", name);
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."Asic"'::regclass AND conname = 'Asic_waferId_fkey'
                ) THEN
                    ALTER TABLE ONLY main."Asic"
                        ADD CONSTRAINT "Asic_waferId_fkey" FOREIGN KEY ("waferId") REFERENCES main."Wafer"(id) DEFERRABLE;
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."ChipBlock"'::regclass AND conname = 'ChipBlock_chipId_fkey'
                ) THEN
                    ALTER TABLE ONLY main."ChipBlock"
                        ADD CONSTRAINT "ChipBlock_chipId_fkey" FOREIGN KEY ("chipId") REFERENCES main."Chip"(id) DEFERRABLE;
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."ChipLocation"'::regclass AND conname = 'ChipLocation_chipId_fkey'
                ) THEN
                    ALTER TABLE ONLY main."ChipLocation"
                        ADD CONSTRAINT "ChipLocation_chipId_fkey" FOREIGN KEY ("chipId") REFERENCES main."Chip"(id) DEFERRABLE;
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."Chip"'::regclass AND conname = 'Chip_asicId_fkey'
                ) THEN
                    ALTER TABLE ONLY main."Chip"
                        ADD CONSTRAINT "Chip_asicId_fkey" FOREIGN KEY ("asicId") REFERENCES main."Asic"(id) DEFERRABLE;
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."EquipmentLocation"'::regclass AND conname = 'EquipmentLocation_equipmentId_fkey'
                ) THEN
                    ALTER TABLE ONLY main."EquipmentLocation"
                        ADD CONSTRAINT "EquipmentLocation_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES
                        main."Equipment"(id) DEFERRABLE;
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."Equipment"'::regclass AND conname = 'Equipment_equipmentTypeId_fkey'
                ) THEN
                    ALTER TABLE ONLY main."Equipment"
                        ADD CONSTRAINT "Equipment_equipmentTypeId_fkey" FOREIGN KEY ("equipmentTypeId") REFERENCES
                        main."EquipmentType"(id) DEFERRABLE;
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."ModuleChipList"'::regclass AND conname = 'ModuleChipList_chipId_fkey'
                ) THEN
                    ALTER TABLE ONLY main."ModuleChipList"
                        ADD CONSTRAINT "ModuleChipList_chipId_fkey" FOREIGN KEY ("chipId") REFERENCES main."Chip"(id) DEFERRABLE;
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."ModuleChipList"'::regclass AND conname = 'ModuleChipList_modId_fkey'
                ) THEN
                    ALTER TABLE ONLY main."ModuleChipList"
                        ADD CONSTRAINT "ModuleChipList_modId_fkey" FOREIGN KEY ("modId") REFERENCES main."Module"(id) DEFERRABLE;
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."ModuleLocation"'::regclass AND conname = 'ModuleLocation_modId_fkey'
                ) THEN
                    ALTER TABLE ONLY main."ModuleLocation"
                        ADD CONSTRAINT "ModuleLocation_modId_fkey" FOREIGN KEY ("modId") REFERENCES main."Module"(id) DEFERRABLE;
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."ProbeCardFamilyType"'::regclass AND conname = 'ProbeCardFamilyType_probeCardId_fkey'
                ) THEN
                    ALTER TABLE ONLY main."ProbeCardFamilyType"
                        ADD CONSTRAINT "ProbeCardFamilyType_probeCardId_fkey" FOREIGN KEY ("probeCardId") REFERENCES
                        main."ProbeCard"(id) DEFERRABLE;
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."ProbeCardInstalledInMachine"'::regclass AND conname =
                        'ProbeCardInstalledInMachine_machineId_fkey'
                ) THEN
                    ALTER TABLE ONLY main."ProbeCardInstalledInMachine"
                        ADD CONSTRAINT "ProbeCardInstalledInMachine_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES
                        main."WaferProbeMachine"(id) DEFERRABLE;
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."ProbeCardInstalledInMachine"'::regclass AND conname =
                        'ProbeCardInstalledInMachine_probeCardId_fkey'
                ) THEN
                    ALTER TABLE ONLY main."ProbeCardInstalledInMachine"
                        ADD CONSTRAINT "ProbeCardInstalledInMachine_probeCardId_fkey" FOREIGN KEY ("probeCardId") REFERENCES
                        main."ProbeCard"(id) DEFERRABLE;
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."SvtAsicTestList"'::regclass AND conname = 'SvtAsicTestList_asicId_fkey'
                ) THEN
                    ALTER TABLE ONLY main."SvtAsicTestList"
                        ADD CONSTRAINT "SvtAsicTestList_asicId_fkey" FOREIGN KEY ("asicId") REFERENCES main."Asic"(id) DEFERRABLE;
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."SvtAsicTestList"'::regclass AND conname = 'SvtAsicTestList_testId_fkey'
                ) THEN
                    ALTER TABLE ONLY main."SvtAsicTestList"
                        ADD CONSTRAINT "SvtAsicTestList_testId_fkey" FOREIGN KEY ("testId") REFERENCES main."SvtTestList"(id)
                        DEFERRABLE;
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."SvtChipBlockTestList"'::regclass AND conname = 'SvtChipBlockTestList_blockId_fkey'
                ) THEN
                    ALTER TABLE ONLY main."SvtChipBlockTestList"
                        ADD CONSTRAINT "SvtChipBlockTestList_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES main."ChipBlock"(id)
                        DEFERRABLE;
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."SvtChipBlockTestList"'::regclass AND conname = 'SvtChipBlockTestList_testId_fkey'
                ) THEN
                    ALTER TABLE ONLY main."SvtChipBlockTestList"
                        ADD CONSTRAINT "SvtChipBlockTestList_testId_fkey" FOREIGN KEY ("testId") REFERENCES main."SvtTestList"(id)
                        DEFERRABLE;
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."SvtChipTestList"'::regclass AND conname = 'SvtChipTestList_chipId_fkey'
                ) THEN
                    ALTER TABLE ONLY main."SvtChipTestList"
                        ADD CONSTRAINT "SvtChipTestList_chipId_fkey" FOREIGN KEY ("chipId") REFERENCES main."Chip"(id) DEFERRABLE;
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."SvtChipTestList"'::regclass AND conname = 'SvtChipTestList_testId_fkey'
                ) THEN
                    ALTER TABLE ONLY main."SvtChipTestList"
                        ADD CONSTRAINT "SvtChipTestList_testId_fkey" FOREIGN KEY ("testId") REFERENCES main."SvtTestList"(id)
                        DEFERRABLE;
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."SvtTestList"'::regclass AND conname = 'SvtTestList_testTypeConfigId_fkey'
                ) THEN
                    ALTER TABLE ONLY main."SvtTestList"
                        ADD CONSTRAINT "SvtTestList_testTypeConfigId_fkey" FOREIGN KEY ("testTypeConfigId") REFERENCES
                        main."SvtTestTypeConfig"(id) DEFERRABLE;
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."SvtTestSetupConfig"'::regclass AND conname = 'SvtTestSetupConfig_setupId_fkey'
                ) THEN
                    ALTER TABLE ONLY main."SvtTestSetupConfig"
                        ADD CONSTRAINT "SvtTestSetupConfig_setupId_fkey" FOREIGN KEY ("setupId") REFERENCES
                        main."SvtTestSetup"(id) DEFERRABLE;
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."SvtTestSetupDefaultConfig"'::regclass AND conname =
                        'SvtTestSetupDefaultConfig_defaultConfigId_fkey'
                ) THEN
                    ALTER TABLE ONLY main."SvtTestSetupDefaultConfig"
                        ADD CONSTRAINT "SvtTestSetupDefaultConfig_defaultConfigId_fkey" FOREIGN KEY ("defaultConfigId") REFERENCES
                        main."SvtTestSetupConfig"(id) DEFERRABLE;
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."SvtTestSetupDefaultConfig"'::regclass AND conname =
                        'SvtTestSetupDefaultConfig_setupId_fkey'
                ) THEN
                    ALTER TABLE ONLY main."SvtTestSetupDefaultConfig"
                        ADD CONSTRAINT "SvtTestSetupDefaultConfig_setupId_fkey" FOREIGN KEY ("setupId") REFERENCES
                        main."SvtTestSetup"(id) DEFERRABLE;
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."SvtTestSetupEquipList"'::regclass AND conname = 'SvtTestSetupEquipList_equipId_fkey'
                ) THEN
                    ALTER TABLE ONLY main."SvtTestSetupEquipList"
                        ADD CONSTRAINT "SvtTestSetupEquipList_equipId_fkey" FOREIGN KEY ("equipId") REFERENCES
                        main."Equipment"(id) DEFERRABLE;
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."SvtTestSetupEquipList"'::regclass AND conname = 'SvtTestSetupEquipList_setupId_fkey'
                ) THEN
                    ALTER TABLE ONLY main."SvtTestSetupEquipList"
                        ADD CONSTRAINT "SvtTestSetupEquipList_setupId_fkey" FOREIGN KEY ("setupId") REFERENCES
                        main."SvtTestSetup"(id) DEFERRABLE;
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."SvtTestTemplate"'::regclass AND conname = 'SvtTestTemplate_testTypeConfigId_fkey'
                ) THEN
                    ALTER TABLE ONLY main."SvtTestTemplate"
                        ADD CONSTRAINT "SvtTestTemplate_testTypeConfigId_fkey" FOREIGN KEY ("testTypeConfigId") REFERENCES
                        main."SvtTestTypeConfig"(id) DEFERRABLE;
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."SvtTestTypeConfig"'::regclass AND conname = 'SvtTestTypeConfig_testTypeId_fkey'
                ) THEN
                    ALTER TABLE ONLY main."SvtTestTypeConfig"
                        ADD CONSTRAINT "SvtTestTypeConfig_testTypeId_fkey" FOREIGN KEY ("testTypeId") REFERENCES
                        main."SvtTestType"(id) DEFERRABLE;
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."SvtTestTypeDUTTypeList"'::regclass AND conname =
                        'SvtTestTypeDUTTypeList_testTypeId_fkey'
                ) THEN
                    ALTER TABLE ONLY main."SvtTestTypeDUTTypeList"
                        ADD CONSTRAINT "SvtTestTypeDUTTypeList_testTypeId_fkey" FOREIGN KEY ("testTypeId") REFERENCES
                        main."SvtTestType"(id) DEFERRABLE;
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."WaferLoadedInMachine"'::regclass AND conname = 'WaferLoadedInMachine_machineId_fkey'
                ) THEN
                    ALTER TABLE ONLY main."WaferLoadedInMachine"
                        ADD CONSTRAINT "WaferLoadedInMachine_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES
                        main."WaferProbeMachine"(id) DEFERRABLE;
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."WaferLoadedInMachine"'::regclass AND conname = 'WaferLoadedInMachine_waferId_fkey'
                ) THEN
                    ALTER TABLE ONLY main."WaferLoadedInMachine"
                        ADD CONSTRAINT "WaferLoadedInMachine_waferId_fkey" FOREIGN KEY ("waferId") REFERENCES main."Wafer"(id)
                        DEFERRABLE;
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."WaferLocation"'::regclass AND conname = 'WaferLocation_waferId_fkey'
                ) THEN
                    ALTER TABLE ONLY main."WaferLocation"
                        ADD CONSTRAINT "WaferLocation_waferId_fkey" FOREIGN KEY ("waferId") REFERENCES main."Wafer"(id)
                        DEFERRABLE;
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."WaferProbeMachine"'::regclass AND conname =
                        'WaferProbeMachine_installedProbeCardId_fkey'
                ) THEN
                    ALTER TABLE ONLY main."WaferProbeMachine"
                        ADD CONSTRAINT "WaferProbeMachine_installedProbeCardId_fkey" FOREIGN KEY ("installedProbeCardId")
                        REFERENCES main."ProbeCard"(id) DEFERRABLE;
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."WaferProbeMachine"'::regclass AND conname = 'WaferProbeMachine_loadedWaferId_fkey'
                ) THEN
                    ALTER TABLE ONLY main."WaferProbeMachine"
                        ADD CONSTRAINT "WaferProbeMachine_loadedWaferId_fkey" FOREIGN KEY ("loadedWaferId") REFERENCES
                        main."Wafer"(id) DEFERRABLE;
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."WaferProbeProject"'::regclass AND conname = 'WaferProbeProject_waferTypeId_fkey'
                ) THEN
                    ALTER TABLE ONLY main."WaferProbeProject"
                        ADD CONSTRAINT "WaferProbeProject_waferTypeId_fkey" FOREIGN KEY ("waferTypeId") REFERENCES
                        main."WaferType"(id) DEFERRABLE;
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."WaferProbeProject"'::regclass AND conname = 'WaferProbeProject_wpMachineId_fkey'
                ) THEN
                    ALTER TABLE ONLY main."WaferProbeProject"
                        ADD CONSTRAINT "WaferProbeProject_wpMachineId_fkey" FOREIGN KEY ("wpMachineId") REFERENCES
                        main."WaferProbeMachine"(id) DEFERRABLE;
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."WaferTypeImage"'::regclass AND conname = 'WaferTypeImage_waferTypeId_fkey'
                ) THEN
                    ALTER TABLE ONLY main."WaferTypeImage"
                        ADD CONSTRAINT "WaferTypeImage_waferTypeId_fkey" FOREIGN KEY ("waferTypeId") REFERENCES
                        main."WaferType"(id) DEFERRABLE;
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."WaferTypeMap"'::regclass AND conname = 'WaferTypeMap_waferTypeId_fkey'
                ) THEN
                    ALTER TABLE ONLY main."WaferTypeMap"
                        ADD CONSTRAINT "WaferTypeMap_waferTypeId_fkey" FOREIGN KEY ("waferTypeId") REFERENCES main."WaferType"(id)
                        DEFERRABLE;
                END IF;
            END $$;
        `)
        this.addSql(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'main."Wafer"'::regclass AND conname = 'Wafer_waferTypeId_fkey'
                ) THEN
                    ALTER TABLE ONLY main."Wafer"
                        ADD CONSTRAINT "Wafer_waferTypeId_fkey" FOREIGN KEY ("waferTypeId") REFERENCES main."WaferType"(id)
                        DEFERRABLE;
                END IF;
            END $$;
        `)
    }

}

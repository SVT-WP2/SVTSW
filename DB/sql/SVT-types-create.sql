--Taking from
CREATE TYPE "engineeringRun" AS ENUM (
  'ER1',
  'ER2',
  'ER3',
  'LAS1',
  'Ancillary1'
);

CREATE TYPE "foundryName" AS ENUM (
  'TowerSemiconductor',
  'Xfab'
);

CREATE TYPE "waferTech" AS ENUM (
  'TPSCo65',
  'Xfab110'
);

CREATE TYPE "asicFamilyType" AS ENUM (
  'MOST',
  'MOSS',
  'BABYMOSS',
  'BABYMOST',
  'NKF7',
  'MOSAIX',
  'BabyMOSAIX',
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
  'TTS_1'
);

CREATE TYPE "waferMapOrientation" AS ENUM (
  'North',
  'South',
  'East',
  'West'
);

CREATE TYPE "wpConnectionType" AS ENUM (
  'TCPIP',
  'GPIB',
  'RS232',
  'USB',
  'Ethernet',
  'Modbus',
  'LAN'
);

CREATE TYPE "wpGeneralLocation" AS ENUM (
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

CREATE TYPE "wpSwType" AS ENUM (
  'Sentio',
  'VeloxCascade'
);

CREATE TYPE "wpVendor" AS ENUM (
  'MPI',
  'CascadeMicrotech',
  'FormFactor'
);

CREATE TYPE "pcVendor" AS ENUM (
  'MPI',
  'Korea',
  'Synergie',
  'FormFactorPC'
);

CREATE TYPE "pcName" AS ENUM (
  'NKF7_MPI',
  'BabyMOSS_Korea',
  'Mosaix_Korea'
);

CREATE TYPE "pcModel" AS ENUM (
  'NKF7-TS3500-CABLEOUT-MLO(EVS-P)',
  'MosaixLeft',
  'MosaixRight',
  'LAS',
  'BabyMOSS',
  'Ancillary'
);

CREATE TYPE "pcLocation" AS ENUM (
  'CERN',
  'Prague',
  'LosAlamos',
  'BNL',
  'RAL'
);

CREATE TYPE "pcType" AS ENUM (
  'Vertical',
  'Cantilever'
);

CREATE TYPE "asicQuality" AS ENUM (
  'MechanicallyDamaged',
  'MechanicallyInteger',
  'CoveredByGreenLayer'
);

CREATE TYPE "contactMechanicalQuality" AS ENUM (
  'Good',
  'Bad',
  'AvoidIfPossible'
);

CREATE TYPE "waferInMachineStatus" AS ENUM (
  'Loaded',
  'Unloaded'
);

CREATE TYPE "testEquipments" AS ENUM (
  'oscilloscope',
  'powerSupply',
  'signalGenetaor',
  'SMU'
);

CREATE TYPE "SLDOTestTypes" AS ENUM (
  'Power_ramp_up',
  'PSRR',
  'Power_Ramp_rate',
  'DAC_Scan',
  'Overcurrent',
  'Irradiation'
);

CREATE TYPE "SLDOTestModes" AS ENUM (
  'Mode0',
  'Mode1'
);

CREATE TYPE "SLDOTestRampTime" AS ENUM (
  '100us',
  '1ms',
  '10ms',
  '100ms',
  '1s'
);

CREATE TYPE "SLDOTestLoadCap" AS ENUM (
  '10nF',
  '100nF',
  '1uF',
  '10uF'
);

CREATE TYPE "SLDOTestLoadCurrent" AS ENUM (
  '40mA',
  '500mA',
  '900mA'
);

CREATE TYPE "SLDOTestTemparature" AS ENUM (
  'minus_20',
  '27C',
  '60C',
  '105C'
);

CREATE TYPE "testSetupType" AS ENUM (
  'SLDO_MPW1',
  'NVG_MPW2',
  'ER1_MOSAIX'
);


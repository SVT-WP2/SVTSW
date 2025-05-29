--Create schema
CREATE SCHEMA IF NOT EXISTS prod;
-- SELECT SCHEMA
SET search_path TO Prod;

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
  'MOSS',
  'BABYMOSS',
  'NKF7',
  'MOSAIX',
  'BabyMOSAIX',
  'LAS',
  'Ancillary',
  'CE65_V1CG_I5U_SQ',
  'CE65_V2CG_I5U_SQ',
  'CE65_V2CG_I8U_SQ',
  'CE65_V2CG_I8U_HSQ',
  'CE65_V2CG_22U5_SQ',
  'CE65_V2CG_22U5_HSQ',
  'CE65_V2CN_I5U_SQ',
  'CE65_V2CN_I8U_SQ',
  'CE65_V2CN_18U_HSQ',
  'CE65_V2CN_22U5_SQ',
  'CE65_V2CN_22U5_HSQ',
  'AOIO_P',
  'AO_IO',
  'AOIO_8',
  'S',
  'DESY',
  'NONAME1',
  'CE65_V1CN_I5U_SQ',
  'NONAME2',
  'CE65_V1CB_I5U_SQ',
  'dPTSN',
  'dP_TS',
  'AFISP',
  'AFISB',
  'AF_IS',
  'RAL_TXRX_ER1',
  'TTS_5',
  'TTS_4',
  'CE65_V2CB_I5U_SQ',
  'CE65_V2CB_22U5_SQ',
  'CE65_V2CB_I8U_HSQ',
  'CE65_V2CB_22U5_HSQ',
  'CE65_V2CB_I8U_SQ',
  'NKF5',
  'NKF6',
  'NONAME5',
  'SEU_2_INFN_BAR_GDR',
  'SEU_1_INFN_BAR_GDR',
  'TTS_3',
  'TTS_2',
  'TTS_1',
  'NONAME4',
  'NONAME_LONG'
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
  'RAL'
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
  'NKF7',
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

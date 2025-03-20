\set SchemaName 'Test'
--\set SchemaName 'Prod'
-- CREATE Schema :SchemaName
CREATE SCHEMA IF NOT EXISTS :SchemaName;

-- CREATE TABLE VERSION
CREATE TABLE IF NOT EXISTS :SchemaName.VERSION (
		id INT,
		name VARCHAR(50),
		baseVersion INT,
		creationTime TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		description TEXT,
		PRIMARY KEY (Id),
		FOREIGN KEY (baseVersion) REFERENCES :SchemaName.VERSION (id)
);

-- DROP TYPE <type_name>
-- CREATE type enum EngineeringRun
CREATE TYPE :SchemaName.enum_engineeringRun AS ENUM (
		'ER1'
);

-- CREATE type enum Foundry
CREATE TYPE :SchemaName.enum_foundry AS ENUM (
		'TowerJazz'
);

-- CREATE type enum waferTechnology
CREATE TYPE :SchemaName.enum_waferTech AS ENUM (
	'TPSCo65'
);

-- CREATE type enum waferType
CREATE TYPE :SchemaName.enum_waferType AS ENUM (
  'ER1-MOSS'
);

-- CREATE type enum asic_family_type
CREATE TYPE :SchemaName.enum_familyType AS ENUM (
  --
);

-- CREATE TABLE WAFER
CREATE TABLE IF NOT EXISTS :SchemaName.wafer (
	id SERIAL,
	serialNumber VARCHAR(50) UNIQUE,
	batchNumber INT,
	engineeringRun :SchemaName.enum_engineeringRun,
	foundry :SchemaName.enum_foundry,
	technology :SchemaName.enum_waferTech,
	thinningDate DATE,
	dicingDate DATE,
	productionDate DATE,
	waferType :SchemaName.enum_waferType,
	PRIMARY KEY (id)
);

-- CREATE TABLE Asic
CREATE TABLE IF NOT EXISTS :SchemaName.asic (
	id SERIAL,
	waferId INT NOT NULL,
	serialNumber VARCHAR(50) UNIQUE,
	familyType :SchemaName.enum_familyType,
	waferMapPosition VARCHAR(50),
	PRIMARY KEY (id),
	FOREIGN KEY (waferId) REFERENCES :SchemaName.wafer (id)
);

-- CREATE TABLE WaferTopography
CREATE TABLE IF NOT EXISTS :SchemaName.waferTopography (
	id SERIAL,
	name TEXT,
	imageBase64String TEXT,
	waferMap TEXT,
	PRIMARY KEY (id)
);

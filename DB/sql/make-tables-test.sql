-- CREATE Schema test
CREATE SCHEMA IF NOT EXISTS test;

-- CREATE TABLE VERSION
CREATE TABLE IF NOT EXISTS test.VERSION (
		id INT,
		name VARCHAR(50),
		baseVersion INT,
		creationTime TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		description TEXT,
		PRIMARY KEY (Id),
		FOREIGN KEY (baseVersion) REFERENCES test.VERSION (id)
);

-- DROP TYPE <type_name>
-- CREATE type enum EngineeringRun
CREATE TYPE test.enum_engineeringRun AS ENUM (
		'ER1'
);

-- CREATE type enum Foundry
CREATE TYPE test.enum_foundry AS ENUM (
		'TowerJazz'
);

-- CREATE type enum waferTechnology
CREATE TYPE test.enum_waferTech AS ENUM (
	--
);

-- CREATE type enum waferType
CREATE TYPE test.enum_waferType AS ENUM (
	--
);

-- CREATE type enum asic_family_type
CREATE TYPE test.enum_familyType AS ENUM (
	--
);

-- CREATE TABLE WAFER
CREATE TABLE IF NOT EXISTS test.wafer (
	id SERIAL,
	serialNumber VARCHAR(50) UNIQUE,
	batchNumber INT,
	engineeringRun test.enum_engineeringRun,
	foundry test.enum_foundry,
	technology test.enum_waferTech,
	thinningDate DATE,
	dicingDate DATE,
	waferType test.enum_waferType,
	PRIMARY KEY (id)
);

-- CREATE TABLE Asic
CREATE TABLE IF NOT EXISTS test.asic (
	id SERIAL,
	waferId INT NOT NULL,
	familyType test.enum_familyType,
	topographyDieId INT,
	PRIMARY KEY (id),
	FOREIGN KEY (waferId) REFERENCES test.wafer (id)
);

-- CREATE TABLE WaferTopography
CREATE TABLE IF NOT EXISTS test.waferTopography (
	id SERIAL,
	name TEXT,
	filePath TEXT,
	PRIMARY KEY (id)
);

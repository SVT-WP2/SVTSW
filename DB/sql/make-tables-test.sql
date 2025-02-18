-- CREATE Schema test
CREATE SCHEMA test;

-- CREATE TABLE VERSION
CREATE TABLE test.VERSION (
		id INT,
		name VARCHAR(50),
		baseVersion INT,
		creationTime TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		description TEXT,
		PRIMARY KEY (Id),
		FOREIGN KEY (baseVersion) REFERENCES test.VERSION (id)
);


-- CREATE type enum EngineeringRun
CREATE TYPE enum_EngineeringRun AS ENUM (
		'eng_run_0',
		'eng_run_1'
);
 
-- CREATE type enum waferType
CREATE TYPE enum_WaferType AS ENUM (
	'wafer_type_0',
	'wafer_type_1'
);

-- CREATE type enum asic_family_type
CREATE TYPE enum_FamilyType AS ENUM (
	'asic_family_type_0',
	'asic_family_type_1'
);

-- CREATE TABLE WAFER
CREATE TABLE test.WAFER (
	id SERIAL,
	serialNumber VARCHAR(50) UNIQUE,
	batchNumber INT,
	engineeringRun enum_EngineeringRun,
	foundry VARCHAR(50),
	technology VARCHAR(50),
	thinningDate DATE,
	dicingDate DATE,
	waferType enum_WaferType,
	PRIMARY KEY (id)
);

-- CREATE TABLE Asic
CREATE TABLE test.ASIC (
	id SERIAL,
	waferId INT NOT NULL,
	familyType enum_FamilyType,
	topographyDieId INT,
	PRIMARY KEY (id),
	FOREIGN KEY (waferId) REFERENCES test.WAFER (id)
);

-- CREATE TABLE WaferTopography
CREATE TABLE test.WAFER_TOPOGRAPHY (
	id SERIAL,
	name TEXT,
	filePath TEXT,
	PRIMARY KEY (id)
);

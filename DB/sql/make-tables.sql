\set SchemaName 'Test'
--\set SchemaName 'Prod'

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

-- CREATE TABLE WAFER TYPE
CREATE TABLE IF NOT EXISTS :SchemaName.waferType (
	id SERIAL,
	name VARCHAR(50) UNIQUE,
	engineeringRun :SchemaName.enum_engineeringRun,
	foundry :SchemaName.enum_foundry,
	technology :SchemaName.enum_waferTech,
	waferMap TEXT,
	PRIMARY KEY (id)
);

-- CREATE TABLE WAFER TYPE imageBase64String
CREATE TABLE IF NOT EXISTS :SchemaName.waferTypeImage (
	waferTypeId INT NOT NULL,
	imageBase64String TEXT NOT NULL,
	FOREIGN KEY (waferTypeId) REFERENCES :SchemaName.waferType (id)
);

-- CREATE TABLE WAFER SUBMAP
CREATE TABLE IF NOT EXISTS :SchemaName.waferTypeSubMap (
	waferTypeId INT,
	Orientation :SchemaName.enum_waferMapOrientation,
	waferTypeSubMap TEXT,
	FOREIGN KEY (waferTypeId) REFERENCES :SchemaName.waferType (id)
);

-- CREATE TABLE WAFER
CREATE TABLE IF NOT EXISTS :SchemaName.wafer (
	id SERIAL,
	serialNumber VARCHAR(50) UNIQUE,
	batchNumber INT,
	thinningDate DATE,
	dicingDate DATE,
	productionDate DATE,
	waferTypeId INT,
	PRIMARY KEY (id),
	FOREIGN KEY (waferTypeId) REFERENCES :SchemaName.waferType (id)
);

-- CREATE TABLE Asic
CREATE TABLE IF NOT EXISTS :SchemaName.asic (
	id SERIAL,
	waferId INT NOT NULL,
	serialNumber VARCHAR(50) UNIQUE,
	familyType :SchemaName.enum_asicFamilyType,
	waferMapPosition VARCHAR(50),
	PRIMARY KEY (id),
	FOREIGN KEY (waferId) REFERENCES :SchemaName.wafer (id)
);

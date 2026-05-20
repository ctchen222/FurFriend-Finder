CREATE TABLE "user" (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	email TEXT NOT NULL UNIQUE,
	"emailVerified" BOOLEAN NOT NULL,
	image TEXT,
	"createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt" TIMESTAMP NOT NULL,

	"isLostAnimalMailEnabled" BOOLEAN DEFAULT FALSE,
	"isSmsEnabled" BOOLEAN DEFAULT FALSE
);

CREATE TABLE session (
	id TEXT NOT NULL PRIMARY KEY,
	"expiresAt" TIMESTAMP NOT NULL,
	token TEXT NOT NULL UNIQUE,
	"createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt" TIMESTAMP NOT NULL,
	"ipAddress" TEXT,
	"userAgent" TEXT,
	"userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE TABLE account (
	id TEXT NOT NULL PRIMARY KEY,
	"accountId" TEXT NOT NULL,
	"providerId" TEXT NOT NULL,
	"userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
	"accessToken" TEXT,
	"refreshToken" TEXT,
	"idToken" TEXT,
	"accessTokenExpiresAt" TIMESTAMP,
	"refreshTokenExpiresAt" TIMESTAMP,
	scope TEXT,
	password TEXT,
	"createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt" TIMESTAMP NOT NULL
);

CREATE TABLE verification (
	id TEXT NOT NULL PRIMARY KEY,
	identifier TEXT NOT NULL,
	value TEXT NOT NULL,
	"expiresAt" TIMESTAMP NOT NULL,
	"createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE animal_shelter (
	id INTEGER PRIMARY KEY,
	name VARCHAR(100) NOT NULL,    -- shelter_name in API
	address VARCHAR(100) NOT NULL, -- shelter_address in API
	tel VARCHAR(30) NOT NULL       -- shelter_tel in API
);

CREATE TABLE animal (
	id SERIAL NOT NULL PRIMARY KEY,
	sub_id VARCHAR(20) UNIQUE,
	kind VARCHAR(20),
	variety VARCHAR(20),
	sex VARCHAR(5),
	age text,
	body_type VARCHAR(20),
	colour VARCHAR(20),
	found_place VARCHAR(50),
	remark text,
	picture text,

	status VARCHAR(20),
	open_date DATE,
	close_date DATE,
	update_date DATE,

	animal_shelter_id INTEGER NOT NULL REFERENCES animal_shelter(id) ON DELETE CASCADE
);

CREATE TABLE owner (
	id SERIAL PRIMARY KEY,
	name TEXT,
	phone TEXT,
	email TEXT,
	CONSTRAINT unique_phone_email UNIQUE(phone, email)
);

CREATE TABLE animal_lost (
	id SERIAL NOT NULL PRIMARY KEY,
	chip_id TEXT unique,
	name TEXT,
	kind TEXT,
	variety TEXT,
	sex TEXT,
	colour TEXT,
	outlook TEXT,
	feature TEXT,
	lost_time DATE,
	lost_place TEXT,
	picture TEXT,

	owner_id INTEGER NOT NULL REFERENCES owner(id) ON DELETE CASCADE
);

-- TRIGGER
CREATE OR REPLACE FUNCTION handle_user_on_insert()
RETURNS TRIGGER AS $$
BEGIN
    NEW."isLostAnimalMailEnabled" = (NEW.email IS NOT NULL AND NEW.email != '');

    -- NEW.isSmsEnabled = (NEW.phone IS NOT NULL AND NEW.phone != '');

    INSERT INTO owner(name, email)
    VALUES (NEW.name, NEW.email);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_user_on_insert
BEFORE INSERT ON "user"
FOR EACH ROW
EXECUTE FUNCTION handle_user_on_insert();

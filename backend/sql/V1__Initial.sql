CREATE TABLE users (
	id SERIAL PRIMARY KEY,
	name VARCHAR(20) NOT NULL,
	email TEXT,
	phone VARCHAR(15) NOT NULL,

	is_registered_via_line BOOLEAN NOT NULL,
	is_registered_via_google BOOLEAN NOT NULL,
	is_active BOOLEAN NOT NULL
);

-- Line User
CREATE TABLE user_line (
	id INTEGER NOT NULL PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
	sent_from text,
	user_id text
);

-- Google User
CREATE TABLE user_google (
	id INTEGER NOT NULL PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE
);


CREATE TABLE animal_shelters (
	id INTEGER PRIMARY KEY,
	name VARCHAR(100) NOT NULL,    -- shelter_name in API
	address VARCHAR(100) NOT NULL, -- shelter_address in API
	tel VARCHAR(30) NOT NULL       -- shelter_tel in API
);

CREATE TABLE animals (
	id SERIAL NOT NULL PRIMARY KEY,
	sub_id VARCHAR(20) UNIQUE NOT NULL,
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

	animal_shelter_id INTEGER NOT NULL REFERENCES animal_shelters(id) ON DELETE CASCADE
);


CREATE TABLE owners (
	id SERIAL PRIMARY KEY,
	name TEXT,
	phone TEXT,
	email TEXT,
	CONSTRAINT unique_phone_email UNIQUE(phone, email)
);

CREATE TABLE animal_losts (
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

	owner_id INTEGER NOT NULL REFERENCES owners(id) ON DELETE CASCADE
);

-- FUNCTION
-- CREATE OR REPLACE FUNCTION convert_sex_to_mf()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     IF NEW.sex = '公' THEN
--        NEW.sex = 'M';
--    ELSIF NEW.sex = '母' THEN
--        NEW.sex = 'F';
--    END IF;
--
--    RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- TRIGGER
-- CREATE TRIGGER convert_sex_trigger
-- BEFORE INSERT OR UPDATE ON animal_losts
-- FOR EACH ROW
-- EXECUTE FUNCTION convert_sex_to_mf();

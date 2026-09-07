CREATE TABLE organization_animals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    request_id UUID NOT NULL,
    request_hash CHAR(64) NOT NULL,
    name VARCHAR(80) NOT NULL CHECK (length(trim(name)) > 0),
    species TEXT NOT NULL CHECK (species IN ('CAT','DOG','OTHER')),
    sex TEXT NOT NULL DEFAULT 'UNKNOWN' CHECK (sex IN ('MALE','FEMALE','UNKNOWN')),
    age_group TEXT NOT NULL DEFAULT 'UNKNOWN' CHECK (age_group IN ('BABY','YOUNG','ADULT','SENIOR','UNKNOWN')),
    size TEXT NOT NULL DEFAULT 'UNKNOWN' CHECK (size IN ('SMALL','MEDIUM','LARGE','UNKNOWN')),
    city VARCHAR(30) NOT NULL DEFAULT '',
    description VARCHAR(3000) NOT NULL DEFAULT '',
    adoption_requirements VARCHAR(2000) NOT NULL DEFAULT '',
    adoption_status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (adoption_status IN ('AVAILABLE','IN_DISCUSSION','ADOPTED')),
    published_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    created_by TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (organization_id,request_id)
);
CREATE INDEX organization_animals_page ON organization_animals(organization_id,id);

CREATE TABLE organization_animal_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    animal_id UUID NOT NULL REFERENCES organization_animals(id) ON DELETE CASCADE,
    position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 5),
    image BYTEA NOT NULL CHECK (octet_length(image) BETWEEN 1 AND 1048576),
    UNIQUE (animal_id,position) DEFERRABLE INITIALLY DEFERRED
);


-- create animal table
create table animal(
animal_id Int not null PRIMARY KEY,
kind varchar(10) not null,
variety varchar(20),
sex varchar(1),
-- sex varchar(1) check (sex in ('F', 'M')),
age varchar(10),
bodytype varchar(10),
colour varchar(6),
status varchar(10),
remark text,
opendate date,
createtime date,
photo text,
shelterName varchar(20) not null
);

-- CREATE TABLE
-- CREATE table animal_sheltername_address(
-- sheltername varchar(20) not null primary key,
-- address varchar(255) not null,
-- tel varchar(20) not null);

-- -- CREATE TABLE
-- ALTER TABLE animal
-- ADD CONSTRAINT fk_sheltername
-- FOREIGN KEY (sheltername) REFERENCES animal_sheltername_address(sheltername);
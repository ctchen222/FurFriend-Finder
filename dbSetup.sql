
-- create animal table
create table animal(
animal_id varchar(20) not null,
kind varchar(10) not null,
variety varchar(20),
sex varchar(1) check (sex in ('F', 'M')),
age varchar(10),
bodytype varchar(10),
colour varchar(6),
status varchar(10),
remark text,
opendate date,
photo text,
shelterName varchar(20) not null
) partition by list(substring(shelterName from 1 for 2));

-- ALTER TABLE 
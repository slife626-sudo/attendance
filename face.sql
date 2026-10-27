alter table staff add column if not exists face text default '';
insert into settings(k,v) values('FaceRequired','0'),('FaceThreshold','0.5') on conflict do nothing;

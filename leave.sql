-- ছুটি ব্যবস্থা: এই পুরো লেখাটা Neon > SQL Editor এ পেস্ট করে একবার Run করুন (বারবার চালালেও ক্ষতি নেই)
alter table leaves add column if not exists status text default 'Approved';
alter table leaves add column if not exists applied_on text default '';
alter table leaves add column if not exists reason text default '';
update leaves set status='Approved' where status is null or status='';
create table if not exists leave_types(id serial primary key,ltype text unique not null,days text default '',paid text default 'Yes',kind text default 'Leave');
insert into leave_types(ltype,days,paid,kind) values
 ('সংরক্ষিত ছুটি','12','Yes','Leave'),
 ('শাখা ছুটি','','Yes','Holiday'),
 ('বিনা বেতনে ছুটি','','No','Leave')
on conflict(ltype) do nothing;

-- Holidays: তারিখের পরিসীমা (To) ও শাখা (Branch)। Branch ফাঁকা = সব শাখা।
alter table holidays add column if not exists d_to text default '';
alter table holidays add column if not exists branch text default '';

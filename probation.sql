-- শিক্ষানবিস কাল: এই পুরো লেখাটা Neon > SQL Editor এ পেস্ট করে একবার Run করুন (বারবার চালালেও ক্ষতি নেই)
alter table leave_types add column if not exists probation text default '';
update leave_types set probation='6' where ltype='সংরক্ষিত ছুটি' and (probation is null or probation='');

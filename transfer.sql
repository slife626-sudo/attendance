-- শাখা বদলির তালিকা: এই পুরো লেখাটা Neon > SQL Editor এ পেস্ট করে একবার Run করুন (বারবার চালালেও ক্ষতি নেই)
create table if not exists transfers(id serial primary key,code text not null,eff text not null,from_branch text default '',to_branch text default '');

-- কর্মীর যোগদান ও শেষ কর্মদিবসের তারিখ: এই পুরো লেখাটা Neon > SQL Editor এ পেস্ট করে একবার Run করুন (বারবার চালালেও ক্ষতি নেই)
alter table staff add column if not exists join_date text default '';
alter table staff add column if not exists leave_date text default '';

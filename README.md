# ওয়াহীদিয়া হাজিরা সিস্টেম (Vercel + Neon)

## ১. Neon (ডাটাবেস)
1. neon.tech-এ নতুন Project খুলুন (Region: **Singapore** ভালো)।
2. **SQL Editor** খুলে `setup.sql`-এর পুরো লেখা paste করে Run করুন (টেবিল + আপনার পুরনো ডাটা তৈরি হবে)।
3. Dashboard থেকে **Connection string** কপি করুন (`postgresql://...`)।

## ২. GitHub
নতুন Repository খুলে এই ফোল্ডারের সব ফাইল (api, public, package.json, vercel.json, setup.sql...) upload করুন।

## ৩. Vercel
1. vercel.com > Add New > Project > GitHub repo Import করুন।
2. **Environment Variables** যোগ করুন:
   - `DATABASE_URL` = Neon-এর connection string
   - `ADMIN_PASS` = আপনার অ্যাডমিন পাসওয়ার্ড
3. Deploy চাপুন।

## লিংক
- কর্মী: `https://আপনার-সাইট.vercel.app/?code=01`
- অ্যাডমিন: `https://আপনার-সাইট.vercel.app/admin`

পাসওয়ার্ড বদলাতে Vercel > Settings > Environment Variables এ `ADMIN_PASS` বদলে Redeploy করুন।

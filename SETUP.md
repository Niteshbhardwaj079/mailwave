# MailWave — chalane ka tarika

Yeh file un logon ke liye hai jo coding nahi jaante. Har step ke saath likha hai
ki **kyun** kar rahe hain, taki aage koi dikkat aaye to samajh aa jaye.

---

## 1. Ek baar ka kaam — Node install karo

Node ek program hai jo yeh project chalata hai. Ek baar install karo, phir kabhi
zarurat nahi.

1. Kholo: **https://nodejs.org**
2. **LTS** wala bada button dabao (LTS matlab "sabse stable")
3. Download hui file par double-click → Next → Next → Install
4. Computer ek baar restart kar lo

**Check karne ke liye:** Start menu me `cmd` type karo, kholo, aur likho:

```
node --version
```

`v20.x.x` jaisa kuch dikhna chahiye. Dikh gaya matlab ho gaya.

> **Abhi ka halaat:** aapke computer me Node ek downloaded folder me pada hai,
> theek se install nahi hai. Isliye `start-mailwave.bat` file me uska rasta likh
> diya hai — abhi kaam kar jayega. Par upar wala install kar lena behtar hai,
> warna woh folder hat gaya to project band ho jayega.

---

## 2. Project chalao

Project folder me **`start-mailwave.bat`** file par **double-click** karo.

Bas. Yeh file khud hi:

- packages install karegi (pehli baar, 2-3 minute)
- database banayegi aur sample data bharegi (pehli baar)
- do windows kholegi
- browser me website khol degi

**Login:**

```
Email    : rohit@gowebkart.com
Password : mailwave
```

---

## 3. Do windows kyun khulti hain?

| Window | Kya karti hai | Address |
|---|---|---|
| **MailWave API** | Backend — data sambhalta hai, email bhejta hai | http://localhost:4000 |
| **MailWave Website** | Jo screen par dikhta hai | http://localhost:5173 |

**Dono chalti rehni chahiye.** Ek band kar di to website adhoori chalegi.

Band karna ho to dono windows me `Ctrl + C` dabao.

> **Zaroori:** window ko cross (X) se band karne ke bajaye `Ctrl + C` dabao.
> `Ctrl + C` server ko theek se band karta hai. Achanak band karne se database
> ka folder toot sakta hai (agar aap PGlite par ho — niche point 5 padho).

---

## 4. Agar kuch na chale — pehle yeh dekho

**Website khulti hi nahi**
- Dono windows khuli hain? Nahi to `start-mailwave.bat` dobara chalao.
- Browser me khud se kholo: http://localhost:5173

**"Port already in use" likha aa raha hai**
- Matlab pehle se ek copy chal rahi hai. Purani windows band karo, phir dobara chalao.

**"Database folder khul nahi raha" jaisa message aa raha hai**
- Server pichli baar achanak band hua tha. **Aapko kuch nahi karna** — app khud
  sabse naya backup chadha kar chal padta hai. Bas neeche padh lena ki backup
  kis waqt ka tha, uske baad ka kaam wapas nahi aata. (Point 6 me poora likha hai.)
- Agar likhe ki koi backup bhi nahi mila, to `server\data\pgdata` folder delete
  karke `npm run server:seed` chalao — sample data wapas aa jayega.

**"node is not recognized"**
- Node install nahi hai. Step 1 dobara karo.

---

## 5. Client ke server par: ASLI POSTGRES lagana ZAROORI hai

Yeh sabse zaroori baat hai.

Abhi database **PGlite** par chal raha hai — kuch install nahi karna padta,
seedha chal jata hai. Apne computer par try karne ke liye bilkul theek hai.

**Par client ke server par yeh nahi chalega.**

PGlite database ko ek folder me rakhta hai. Server achanak band ho jaye — bijli
gayi, ya process kill ho gaya — to woh folder **toot sakta hai aur saara data ja
sakta hai**. Humne test karte waqt khud yeh hote dekha hai.

Asli Postgres isi ke liye bana hai: achanak band hone par bhi data bacha leta hai.

### Kaise lagana hai (5 minute)

**Step 1.** Ek Postgres database lo. Free options:

- **Supabase** — supabase.com
- **Neon** — neon.tech
- **Render** — render.com
- Ya apne VPS par khud install karo

**Step 2.** Woh aapko ek address denge, aisa dikhega:

```
postgres://user:password@host:5432/dbname
```

**Step 3.** `server\.env` file kholo aur ye do line daal do:

```
DATABASE_URL=postgres://user:password@host:5432/dbname
DATABASE_SSL=true
```

**Step 4.** Server chalu karo, phir ek baar seed chala do:

```
npm run server:seed
```

Bas. Code me kuch nahi badalna — SQL dono me bilkul ek jaisa hai.

### Kaise pata chalega ki sahi laga?

Server chalu hote hi API window me ye line dikhegi:

```
[db] Asli Postgres se juda
```

Agar ye dikhe to samajh jao ki abhi bhi PGlite par ho:

```
[db] PGlite chalu (sirf local istemal ke liye)
[db] CHETAVNI: client ke server par DATABASE_URL me asli Postgres lagana zaroori hai
```

---

## 6. Backup

App me **Backups** page par jao (sidebar me, Administration ke neeche).

### Ek click backup

**"Back up now"** dabao — backup ban jayega. Uske aage **Download** dabakar
use apne computer ya Google Drive par rakh lo.

Purana backup wapas daalna ho to upar **"Upload a backup"** se `.tar.gz` file
chun lo.

### Apne aap backup

Har **7 din** me backup khud ban jata hai. Sabse naye **8** rakhe jate hain,
usse purane apne aap hat jate hain — disk kabhi nahi bharegi.

Badalna ho to `server\.env` me:

```
BACKUP_EVERY_DAYS=7
BACKUP_KEEP=8
```

### Backup se wapas laana (restore)

1. Backup ke aage **Restore** dabao — pakka karne ke liye `RESTORE` likhna padega
2. Server band karke dobara chalu karo
3. Ho gaya — data us backup wale din jaisa ho jayega

> **`RESTORE` kyun likhwate hain:** restore poora data badal deta hai. Sirf ek
> button hota to galti se dab sakta tha. Naam likhna padta hai, isliye galti se
> kabhi nahi hota.
>
> **Server restart kyun:** chalte hue database ko beech me badalna khatarnak
> hai — aadha purana, aadha naya reh sakta hai. Isliye nishaan lagta hai aur
> agli baar chalu hone par saaf-saaf lagta hai.

Darne ki baat nahi: restore se pehle purane data ka copy
`server\data\pgdata.before-restore` me rakh diya jata hai.

> **Asli Postgres par:** yeh file wala backup kaam nahi karta. Wahan aapka
> hosting provider (Supabase / Neon / Render) khud roz backup leta hai — bas
> ek baar unke panel me jaakar confirm kar lena ki woh chalu hai.

### Data toot jaye to app KHUD theek kar leta hai

Agar server achanak band ho jaye (bijli chali gayi, computer band ho gaya), to
PGlite ka folder kabhi-kabhi toot jata hai. Aisa hone par **aapko kuch nahi
karna padta** — agli baar chalu karte hi app khud sabse naya backup chadha leta
hai aur chal padta hai.

Console par yeh dikhega:

```
[db] Database folder khul nahi raha...
[db] Toota hua folder yahan rakh diya: ...\pgdata.broken-1787983980976
[db] APNE AAP THEEK KAR DIYA — backup "mailwave-backup-...tar.gz" chadha diya.
[db] Us backup ke BAAD ka kaam wapas nahi aayega.
```

Aakhri line dhyan se padhna: **us backup ke baad ka kaam wapas nahi aata.**
Backup har baar server chalu hone par banta hai, isliye zyada se zyada utna hi
kaam jayega jitna pichhli baar chalu karne ke baad kiya tha.

Toota hua folder mitaya nahi jata — `pgdata.broken-<number>` naam se pada rehta
hai. Sab theek chalne lage to use haath se delete kar dena, disk khaali ho
jayegi.

**Yeh dikkat asli Postgres par hoti hi nahi.** Isliye client ke server par
`DATABASE_URL` lagana zaroori hai (section 5).

---

## 7. Database kahan hai (PGlite wale case me)

```
server\data\pgdata
```

Yahi poora database hai. Yeh folder gaya to sab gaya — isliye backup lete raho.

---

## 8. Contacts import karna (Excel / CSV)

Contacts page par **Import** dabao aur apni file chuno — `.xlsx`, `.xls` ya
`.csv`, teenon chalti hain.

App khud aapke column pehchan leta hai: "Email Address" ko email, "Full Name"
ko naam. Galat lage to dropdown se badal sakte ho.

### Duplicate ka poora hisaab

Import se **pehle** ek jaanch chalti hai — us waqt database me kuch save nahi
hota. Aapko saaf dikh jata hai kya milega:

| Kya | Matlab |
|---|---|
| **Valid** | yeh log judenge |
| **already in your contacts** | pehle se list me hain, dobara nahi judenge |
| **repeated inside this file** | isi file me do baar aa gaye |
| **unsubscribed or bounced before** | inhone mana kiya tha — inhe kabhi mail nahi jayegi |
| **Invalid** | email khali hai ya galat likha hai |

Har row par nishaan lagta hai, aur wajah bhi saath likhi hoti hai. Kuch bhi
chup-chap nahi hota.

> **Ek email sirf ek baar:** database khud rokta hai ki wahi email do baar na
> jude. Isliye galti se do baar import kar do to bhi list gandi nahi hoti —
> doosri baar sab "already in your contacts" dikhega.

---

## 9. Template me apna code aur image lagana

Templates page par **Create template** dabao. Apna poora HTML paste kar sakte
ho — comment, `<style>`, `<table>`, sab waisa ka waisa save hota hai.

### Image lagana

Editor me **Images** wale tab par jao:

| Button | Kya karta hai |
|---|---|
| **Upload** | apne computer se image chuno (2 MB tak) |
| **Copy link** | uska link copy — kabhi bhi, kisi bhi template me lagao |
| **Insert into HTML** | seedha `<img>` tag editor me lag jata hai |
| 🗑 | image hata do (pehle poochta hai) |

Upload ki hui saari images wahin padi rehti hain — page band karo, kal wapas
aao, sab milengi. Wo server par hain, aapke browser me nahi, isliye team ke
doosre logon ko bhi dikhti hain.

### `PUBLIC_URL` sahi hona ZAROORI hai

Image ka link `server\.env` ki **`PUBLIC_URL`** se banta hai:

```
PUBLIC_URL=https://mail.aapkidomain.com
```

Abhi wo `http://localhost:4000` hai — wo link **sirf aapke computer par
khulta hai**. Aise me bheje gaye email me recipient ko tooti hui image
dikhegi. Client ko dene se pehle ise asli domain par set karna hi padega.

> **Image ka link bina login ke kyun khulta hai:** email me lagi image ko
> Gmail ya Outlook ka server kholta hai, aapka browser nahi — aur wo kabhi
> login nahi kar sakta. Isliye yeh raasta jaan-boojh kar khula rakha hai.
> Wahan se sirf image milti hai, aur wahi image jo aap khud email me duniya
> ko bhej rahe ho.

### Image delete karne se pehle

Agar wo image kisi **ja chuki campaign** me lagi thi, to wo email logon ke
inbox me pade hain. Image hatate hi unme bhi tooti hui image dikhne lagegi —
hamesha ke liye, kyunki wo email wapas nahi bulaye ja sakte.

Isliye delete karte waqt app pehle batata hai ki image kahan-kahan lagi hai.
"Not used anywhere" likha aaye to bina soche hata sakte ho.

---

## 10. Campaign baad me bhejna (schedule)

Campaign banate waqt "Sending" wale step par **"Later"** chuno aur tareekh-time
daal do. Campaign **Scheduled** me chali jayegi — us waqt tak kuch nahi jayega.

Server har minute dekhta rehta hai ki kiska time aa gaya, aur time aate hi
apne aap bhejna shuru kar deta hai.

**Aapko browser khula rakhne ki zarurat nahi.** Bhejna server par hota hai, na
ki aapke computer par — laptop band ho, koi logged in na ho, phir bhi mail chali
jayegi.

### Us waqt server band raha to?

Kuch nahi bigadta. Campaign **Scheduled** hi padi rehti hai, aur server wapas
chalu hote hi uska time "nikal chuka" mil jata hai — to wo turant chali jati
hai. Bas thodi der se jayegi, gum nahi hogi.

### Schedule hatana / badalna

Campaign khol kar **"Cancel schedule"** dabao — wo wapas Draft ho jati hai,
mitti nahi. Galat time chun liya ho to yahi karna hai.

Chalti hui campaign ka time nahi badla ja sakta — email ja hi chuke hain, unhe
wapas nahi bulaya ja sakta.

> **Time zone:** aap jo time chunte ho wo **aapke computer ke time** ke hisaab
> se hota hai. Screen par bhi wahi dikhta hai. Client doosre desh me ho to use
> uska apna time dikhega — dono ka matlab ek hi rehta hai.

---

## 11. Email account jodna (Gmail / Outlook / koi bhi)

App me Email Accounts page par jao, provider chuno, email aur password daalo.

**Sabse badi dikkat jo sabke saath hoti hai:** Gmail aur Outlook aapka **normal
password nahi lete**. Unhe "App Password" chahiye — ek alag 16-akshar ka password
jo sirf is app ke liye banta hai.

App khud ye batata hai — provider chunte hi steps screen par aa jate hain, aur
galat password daalo to saaf likha aata hai ki kya karna hai.

| Provider | Kya chahiye |
|---|---|
| Gmail / Google Workspace | 2-Step Verification chalu karo → App Password banao |
| Outlook / Hotmail | Two-step verification → App Password |
| Microsoft 365 (company) | IT admin se "Authenticated SMTP" chalu karwao |
| Yahoo, Zoho | App Password |
| SendGrid, Brevo | API key (username apne aap set ho jata hai) |
| Koi aur | Host, port, username, password — hosting wale se poocho |

Save karne se **pehle** app khud connection test karta hai. Galat hoga to wahin
pata chal jayega — na ki 500 email fail hone ke baad.

### App khud bhi email bhejta hai

Password reset ka link, naye user ka invite, "aapka password badal gaya" — yeh
sab app khud bhejta hai. Yeh **usi email account se** jate hain jo aapne joda
hai (jo sabse pehle juda tha).

Alag "no-reply@..." se bhejna ho to `server\.env` me:

```
SYSTEM_EMAIL_FROM=no-reply@aapkidomain.com
```

Yeh email pehle app me joda hua hona chahiye.

> **Jab tak koi email account juda nahi hai:** password reset ka link email se
> nahi ja sakta, isliye app use server ke console (kaali window) par chhap deta
> hai. Wahan se copy karke browser me khol sakte ho. Yeh sirf shuru ke setup ke
> liye hai — client ko dene se pehle ek email account zaroor jod dena.

In email ka matter **System Emails** page se badla ja sakta hai, aur wahin se
"Send test" dabakar apne inbox me dekh bhi sakte ho ki kaisa dikhta hai. Kuch
bigad jaye to "Reset" se wapas asli matter aa jata hai.

---

## 12. Client ko dene se pehle — checklist

| Cheez | Kahan | Kyun |
|---|---|---|
| `DATABASE_URL` | `server\.env` | **Sabse zaroori.** Bina iske data ja sakta hai |
| Login password | `server\.env` me `SEED_PASSWORD` | `mailwave` sabko pata hai |
| `JWT_SECRET` | `server\.env` | Client ke server par naya banna chahiye |
| `MAIL_TRANSPORT` | `server\.env` | `ethereal` hai to hata do, warna asli mail nahi jayegi |
| `PUBLIC_URL` | `server\.env` | Tracking, unsubscribe **aur image ke link** isi se bante hain. Galat raha to email me image tooti dikhegi |
| Company naam, logo | `brand.config.js` | Poore app me ek jagah se badalta hai |
| Postal address | `brand.config.js` me `address` | Bulk email me kanoonan zaroori hai |
| Email account | App me Email Accounts | Bina iske mail jayegi hi nahi (invite/reset bhi) |

`server\.env` file **kabhi kisi ko mat bhejo** aur GitHub par mat daalo — usme
secret keys hoti hain. (`.gitignore` me daal rakhi hai, phir bhi dhyan rakhna.)

---

## 13. Roz ka istemaal

Har baar bas **`start-mailwave.bat`** par double-click. Pehli baar ke baad
install/seed dobara nahi hota, seedha chalu ho jata hai.

---

## Command line pasand ho to

```bash
npm install              # ek baar
npm run server:install   # ek baar
npm run server:seed      # ek baar

npm run server           # terminal 1  -> backend
npm run dev              # terminal 2  -> website
```

---

## Sab kuch theek chal raha hai ya nahi — khud check karo

Kuch badalne ke baad yeh chala lo. Ismein asli Chrome khulta hai aur wahi kaam
karke dekha jata hai jo ek insaan karega — login, har page, naya user banana,
permission badalna, aur reload karke dekhna ki save hua ya nahi.

Pehle backend aur website dono chalu hone chahiye, phir:

```bash
npm test             # sab kuch (lagbhag 8-10 minute)

npm run test:login   # sirf login / logout / session
npm run test:api     # sirf API (browser ke bina, jaldi)
npm run test:app     # har page khulta hai, aur save hota hai
npm run test:screens # contacts, segments, campaigns, accounts, reports
npm run test:send    # sirf campaign banana aur bhejna
```

Ismein yeh sab jaancha jata hai:

| Test | Kya dekhta hai |
|---|---|
| `test-login` | login, galat password, logout, refresh par session bacha ya nahi |
| `test-users` | user/role banana, permissions, aakhri Super Admin ki suraksha |
| `test-routes` | activity, subscribers, system emails, segments, images |
| `test-app` | har page khulta hai, mobile par side-scroll nahi |
| `test-save` | UI se kiya badlaav server par sach me bacha ya nahi |
| `test-contacts` | 120 contacts daal kar pagination aur "Select all" |
| `test-import` | asli Excel/CSV file se import, aur teenon tarah ke duplicate |
| `test-segments` | rule ki ginti sahi hai, builder me live count |
| `test-pages` | campaigns ki search/sort/filter, aur test email |
| `test-stats` | dashboard ke number, report download, campaign ka log |
| `test-send` | wizard se campaign banakar asli email bhejna |
| `test-template-image` | apna HTML + image ka link email tak pahunchta hai |
| `test-imagelib` | image upload, link copy, aur delete |
| `test-backup` | one-click backup, download, aur restore ki suraksha |
| `test-schedule` | schedule ki hui campaign time par apne aap jati hai |

Har line ke aage `PASS` ya `FAIL` likha aata hai, aur aakhir me ginti. Kuch
`FAIL` aaye to wahi line padho — usme wajah bhi likhi hoti hai.


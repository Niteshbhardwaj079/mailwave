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

**"Database folder kharab hai" jaisa message aa raha hai**
- Server pichli baar achanak band hua tha. Do raaste hain:
  1. Koi backup restore karo (point 6 dekho), ya
  2. `server\data\pgdata` folder delete karke `npm run seed` chalao

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

### Ek click backup

Backup ka button dabao, backup ban jayega. Use download karke apne computer ya
Google Drive par rakh lo.

### Apne aap backup

Har **7 din** me backup khud ban jata hai. Sabse naye **8** rakhe jate hain,
usse purane apne aap hat jate hain — disk kabhi nahi bharegi.

Badalna ho to `server\.env` me:

```
BACKUP_EVERY_DAYS=7
BACKUP_KEEP=8
```

### Backup se wapas laana (restore)

1. Backup chuno aur Restore dabao — confirm ke liye `RESTORE` likhna padega
2. Server band karke dobara chalu karo
3. Ho gaya — data us backup wale din jaisa ho jayega

Darne ki baat nahi: restore se pehle purane data ka copy
`server\data\pgdata.before-restore` me rakh diya jata hai.

> **Asli Postgres par:** yeh file wala backup kaam nahi karta. Wahan aapka
> hosting provider (Supabase / Neon / Render) khud roz backup leta hai — bas
> ek baar unke panel me jaakar confirm kar lena ki woh chalu hai.

---

## 7. Database kahan hai (PGlite wale case me)

```
server\data\pgdata
```

Yahi poora database hai. Yeh folder gaya to sab gaya — isliye backup lete raho.

---

## 8. Email account jodna (Gmail / Outlook / koi bhi)

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

---

## 9. Client ko dene se pehle — checklist

| Cheez | Kahan | Kyun |
|---|---|---|
| `DATABASE_URL` | `server\.env` | **Sabse zaroori.** Bina iske data ja sakta hai |
| Login password | `server\.env` me `SEED_PASSWORD` | `mailwave` sabko pata hai |
| `JWT_SECRET` | `server\.env` | Client ke server par naya banna chahiye |
| `MAIL_TRANSPORT` | `server\.env` | `ethereal` hai to hata do, warna asli mail nahi jayegi |
| `PUBLIC_URL` | `server\.env` | Tracking aur unsubscribe link isi se bante hain |
| Company naam, logo | `src\config\appConfig.js` | Poore app me ek jagah se badalta hai |
| Email account | App me Email Accounts | Bina iske mail jayegi hi nahi |

`server\.env` file **kabhi kisi ko mat bhejo** aur GitHub par mat daalo — usme
secret keys hoti hain. (`.gitignore` me daal rakhi hai, phir bhi dhyan rakhna.)

---

## 10. Roz ka istemaal

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

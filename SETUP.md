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

Band karna ho to dono windows me `Ctrl + C` dabao, ya seedha window band kar do.

---

## 4. Agar kuch na chale — pehle yeh dekho

**Website khulti hi nahi**
- Dono windows khuli hain? Nahi to `start-mailwave.bat` dobara chalao.
- Browser me khud se kholo: http://localhost:5173

**"Port already in use" likha aa raha hai**
- Matlab pehle se ek copy chal rahi hai. Purani windows band karo, phir dobara chalao.

**Login nahi ho raha**
- API wali window me error dikh raha hai? Wahan ka message padho.
- Password reset karna ho to niche "Database naya karna" dekho.

**"node is not recognized"**
- Node install nahi hai. Step 1 dobara karo.

---

## 5. Database kahan hai (yeh sabse zaroori hai)

Saara data yahan hai:

```
server\data\pgdata
```

Yahi **poora database** hai — contacts, campaigns, users, sab kuch.

### Backup zaroor lena

Client ko dene se pehle aur har kuch din baad:

1. `server\data\pgdata` folder copy karo
2. Kahin safe jagah paste kar do (pendrive, Google Drive)

Yeh folder chala gaya to **saara data chala jayega**. Iska koi doosra copy nahi hota.

### Database naya karna (sab data mit jayega)

Sirf tab jab sach me sab kuch nayi tarah se shuru karna ho:

1. Dono windows band karo
2. `server\data\pgdata` folder delete karo
3. `start-mailwave.bat` dobara chalao — naya database sample data ke saath ban jayega

---

## 6. Client ko dene se pehle

Yeh cheezein badalni **zaroori** hain, warna client ke server par dikkat hogi:

| Cheez | Kahan | Kyun |
|---|---|---|
| Login password | `server\.env` me `SEED_PASSWORD` | `mailwave` sabko pata hai |
| `JWT_SECRET` | `server\.env` | Apne aap ban jata hai, par client ke server par naya banna chahiye |
| Company ka naam, logo | `src\config\appConfig.js` | Poore app me ek jagah se badal jata hai |
| Email account | App ke andar → Email Accounts | Bina iske email bhejega nahi |

`server\.env` file ko **kabhi kisi ko mat bhejo** aur GitHub par mat daalo —
usme secret keys hoti hain.

---

## 7. Roz ka istemaal

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

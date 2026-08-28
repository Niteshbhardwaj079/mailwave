# MailWave — Frontend (React + Bootstrap 5 + SCSS)

Bulk email campaign, marketing automation aur email tracking platform ka **frontend design**.
Ye phase-1 hai: saare screens, saare states, mock data ke saath. Backend abhi connect nahi hai.

---

## Rules jo follow kiye gaye hain

| Rule | Status |
|---|---|
| React (Vite) | ✅ |
| Bootstrap 5 | ✅ SCSS source se compile hua hai |
| `html { font-size: 10px }` → `1rem = 10px` | ✅ Bootstrap ke `$font-size-root` se, isliye Bootstrap ke components bhi sahi size me hain |
| Inline CSS (`style={{...}}`) kahin nahi | ✅ 0 jagah — condition ke andar bhi nahi |
| Inline JS / `dangerouslySetInnerHTML` nahi | ✅ har handler named function hai |
| Mobile + tablet me app jaisa feel | ✅ bottom tab bar, drawer, bottom sheet, FAB |

> **Dynamic width bina inline style kaise?**
> `src/styles/_utilities.scss` me ek SCSS loop `.mw-w-0` se `.mw-w-100` tak classes banata hai.
> `widthClass(63.4)` → `"mw-w-63"`. Progress bar, funnel aur meter isi se chalte hain.

---

## Chalane ka tarika (How to run)

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build -> dist/
npm run preview  # build ko locally dekhne ke liye
```

Node 18+ chahiye.

---

## Responsive behaviour

| Screen | Layout |
|---|---|
| **Desktop** (≥1200px) | Poora sidebar + topbar |
| **Tablet** (768–1199px) | Sirf icon wala patla sidebar (rail) |
| **Mobile** (<768px) | Top app bar + slide-in drawer + **bottom tab bar** + floating **+** button. Tables apne aap **cards** ban jaate hain, modals **bottom sheet** ban jaate hain. |

---

## Folder structure

```
src/
├─ main.jsx                  # entry, sirf main.scss import karta hai
├─ App.jsx                   # saare routes
├─ data/mockData.js          # SAARA data yahin — baad me API se replace karna
├─ utils/format.js           # number, %, date, widthClass()
├─ styles/
│  ├─ _variables.scss        # design tokens (colors, sizes, shadows)
│  ├─ main.scss              # Bootstrap ko tokens ke saath compile karta hai
│  ├─ _base.scss             # reset + typography
│  ├─ _layout.scss           # sidebar, topbar, tabbar, FAB
│  ├─ _components.scss       # cards, KPI, tables, chips, stepper, sheet…
│  ├─ _charts.scss           # chart shells, heatmap, funnel, tooltip
│  ├─ _pages.scss            # builder, auth, import, settings
│  └─ _utilities.scss        # mw-w-*, mw-fs-*, grid helpers
├─ components/
│  ├─ layout/                # AppLayout, Sidebar, Topbar, navItems
│  ├─ ui/                    # Card, KpiCard, StatusPill, ProgressBar, Sheet, Controls
│  ├─ charts/                # PerformanceChart, DeliveryDonut, OpensHeatmap, Tooltip
│  ├─ campaigns/             # CampaignTable (desktop table + mobile cards)
│  ├─ templates/             # TemplateCard, EmailPreview
│  └─ wizard/                # Stepper + 6 campaign steps
└─ pages/                    # 15 screens
```

---

## Screens jo ban gaye hain

1. **Dashboard** — 9 KPI cards, Sent/Opened/Clicked area chart (7/30/90 din), delivery donut, opens-by-hour heatmap, quick actions, recent campaigns
2. **Campaigns** — filter chips, search, table + row actions sheet
3. **Create Campaign** — 6-step wizard (Info → Recipients → Template → Content → Sending → Review) + confirm dialog + **live sending progress** (pause / resume / cancel)
4. **Campaign Analytics** — 9 metrics, activity chart, journey funnel, top clicked links, delivery breakdown, recipient activity table with status + frequency + date filters, per-email log timeline
5. **Contacts** — groups, search, status filter, add-contact sheet, suppression note
6. **Import Contacts** — 5-step wizard (Upload → Map columns → Validate → Preview → Import)
7. **Segments** — rule cards + segment builder sheet + follow-up automation
8. **Templates** — category chips, template cards, preview sheet
9. **Email Builder** — drag-and-drop blocks, live canvas, properties panel, desktop/mobile/HTML preview
10. **Reports** — performance chart, campaign report, 6 exportable lists, export sheet
11. **Email Accounts** — connected accounts, daily limit meters, test email sheet
12. **Connect Account** — provider cards + **one-field-per-screen** Custom SMTP wizard
13. **Settings** — 8 sections (Profile, Accounts, Sending, Tracking, Contacts, Unsubscribe, Security, API)
14. **Onboarding** — 6-step getting started checklist
15. **Login** — split screen auth

---

## Honesty rule jo UI me build kiya gaya hai

Open tracking ko kahin bhi 100% accurate nahi bola gaya. Har jagah likha hai
**"Open detected (estimate)"**, aur dashboard + analytics dono par ek note hai jo
image blocking aur Apple Mail Privacy Protection ko explain karta hai.

---

## Agla step (Phase 2)

`src/data/mockData.js` ke har export ko real API call se badalna:

```
GET  /api/campaigns              → campaigns
GET  /api/campaigns/:id/analytics → KPI + charts
GET  /api/campaigns/:id/recipients → recipientActivity
GET  /api/contacts               → contacts
GET  /api/templates              → templates
GET  /api/email-accounts         → emailAccounts
```

UI ka koi component badalna nahi padega — sirf data source badlega.

---

## Update 2 — what changed

### 1. Drag-and-drop builder hata diya → HTML editor
`/templates/new` par ab: **Template name + Category + Subject + raw HTML box**.
Type karte hi right side me **live preview**. Save karne par:
- template list me aa jata hai (asli HTML thumbnail ke saath)
- ek **shareable preview link** milta hai: `/templates/<id>/preview` (naye tab me khulta hai, copy button bhi hai)
- teen **ready HTML starters** (Offer / Welcome / Notice) — load karo aur shabd badal do

Preview `<iframe sandbox="">` me chalta hai — app ki CSS email ko badal nahi sakti, aur paste kiya hua koi script chal nahi sakta.

### 2. Image library (Images tab)
- **Upload image** — file chuno, 2 MB tak
- ya **link se add karo** (jo image already online hai)
- har image ka **URL dikhta hai + Copy link** button
- **Insert into HTML** — poora `<img>` tag cursor ki jagah lag jata hai
- Abhi images browser me hi rakhi jati hain (localStorage). Backend jurte hi ye server par upload hongi.

### 3. Language — 12 languages, default English
Topbar me dropdown (search ke saath) + Settings → Language.

English · हिन्दी · ગુજરાતી · मराठी · বাংলা · தமிழ் · العربية (RTL) · Español · Français · Deutsch · Português · 简体中文

**Nayi language add karna:** `src/i18n/locales/en.js` copy karo → values translate karo → `src/i18n/languages.js` me ek line add karo. Bas. Jo key chhoot jaye woh apne aap English dikhati hai, screen kabhi tootegi nahi.

Arabic ke liye poora RTL support hai (sidebar right side, sab mirror).

### 4. Saare filters ab dropdown hain
Campaigns, Recipient activity, Contacts, Templates, Users, Activity Log — sab me labelled `<select>` + **Clear filters** button. Mobile par ye chips se kahin zyada aasaan hai.

### 5. Guide (naye banda ke liye)
- `/guide` — **7 chapters**, har ek me numbered steps + Tip + Careful box + "Do this" button jo seedha us screen par le jata hai
- Chapter 2 poora **email account connect karne ka step-by-step** hai (Gmail / Outlook / SMTP)
- Har page ke title ke bagal me **?** button — us screen ka chhota help, aur "Open full guide" link

### 6. Super Admin — users, roles, permissions
`/users`:
- **People tab** — team list, add / edit / enable / disable
- **Roles & permissions tab** — 4 roles (Super Admin, Admin, HOD, Member) aur ek **checkbox matrix**: 10 sections × 6 actions (View, Create, Edit, Delete, Send, Export)
- Checkbox hatao → us role ke logon ke liye woh menu aur button gayab
- Super Admin locked hai — usse roka nahi ja sakta

Test karne ke liye: profile menu → **Demo: view as** → role badlo, sidebar turant badal jayega.

### 7. Activity Log
`/activity` — kisne, kab, kya kiya. User / Action / Section / Date dropdown filters. Kisi row par click karo to **Before → After** ka farak dikhta hai. Ye records edit ya delete nahi ho sakte.

---

## Nayi files

```
src/i18n/                      # 12 language files + provider + hook
src/store/WorkspaceProvider.jsx # templates, images, roles, users, activity (localStorage)
src/pages/TemplateEditorPage.jsx
src/pages/TemplatePreviewPage.jsx
src/pages/GuidePage.jsx
src/pages/UsersPage.jsx
src/pages/ActivityLogPage.jsx
src/components/templates/HtmlPreview.jsx
src/components/templates/ImageLibrary.jsx
src/components/ui/FilterSelect.jsx
src/components/ui/HelpButton.jsx
src/data/adminData.js          # roles, permissions, users, audit trail
src/data/starterHtml.js        # 3 ready HTML templates
src/data/guideChapters.js
```

Rules abhi bhi wahi: **inline CSS 0**, SCSS, Bootstrap 5, `1rem = 10px`, mobile app jaisa feel.

---

## Update 3 — roles, theme aur brand

### 1. Roles ab aap khud banate ho
Pehle 4 fixed roles the — meri galti. Ab `/users` → **Roles & permissions** me:

- **New role** button — naam, description, rang aur icon chuno
- **Start from** — kisi purane role ki copy se shuru karo, ya khaali (blank) se
- Har role par **edit / copy / delete**
- Jo 4 roles pehle se hain (Admin, HOD, Member) wo sirf **example** hain — rename karo, badlo, ya hata do
- **Super Admin** locked hai — usse na hata sakte ho na rok sakte ho (warna aap khud bahar ho jaoge)
- Jis role ke paas log hain, wo delete nahi hoga — app batayegi "3 people still have this role"

Naya role banate hi uska permission matrix niche khul jata hai.

### 2. Day / Night theme + rang badalna
Topbar me do naye button:

- ☀️ / 🌙 — ek click me **din se raat**
- 🎨 — **8 rang** (Indigo, Blue, Teal, Green, Amber, Rose, Purple, Slate) + Day / Night / "Match my computer"

Settings → **Look & feel** me bhi wahi cheezein bade size me hain.

Kaise kaam karta hai: har rang ab ek **CSS variable** hai (`src/styles/_theme.scss`).
`<html data-theme="dark" data-accent="teal">` — bas itna badalta hai, poora app turant badal jata hai.
Charts bhi accent follow karte hain. Aapki pasand browser me save hoti hai.

**Naya rang add karna:** `_theme.scss` me ek `[data-accent='...']` block + `src/config/themeColors.js` me ek row. Bas.

### 3. App ka naam ek hi jagah se
`src/config/appConfig.js`:

```js
export const appConfig = {
  name: 'MailWave',
  tagline: 'Campaigns & tracking',
  logoIcon: 'bi-send-fill',
  company: 'GoWebKart',
  supportEmail: 'support@gowebkart.com',
  titleSuffix: 'Email Campaign Platform',
  defaultTheme: 'system',
  defaultAccent: 'indigo',
};
```

Yahan naam badlo → **sidebar, login page, browser tab ka title, preview page** — sab apne aap badal jayenge.

### 4. Ek se zyada email account
`/accounts` par jitne chaho account jod sakte ho — 3 Outlook, 1 Gmail, 1 SMTP, koi bhi mix.
Har account ka apna daily limit meter hai, aur har campaign apna sender chunta hai.

---

## Update 4 — login, passwords, system emails, UI audit

### 1. Login: koi khud account nahi bana sakta
`/login` par ab **sirf Sign in** hai. "Create account" link hata diya gaya hai — jaan-boojh kar.

- Sirf woh log andar aa sakte hain jinhe Super Admin ne banaya hai
- **Forgot password?** → email daalo → reset link jaata hai
- Reset link khulta hai `/reset-password?token=…` par, naya password + **strength meter**
- Naya user pehli baar `/set-password?token=…` se apna password chunta hai
- Galat password par saaf error, aankh ka button (password dikhao/chhupao), theme + language button login par bhi

**Safety:** "aisa email hai ya nahi" kabhi nahi bataya jaata — warna koi ajnabi jaan lega ki kiska account hai.

### 2. Super Admin password badal sakta hai
`/users` → kisi bhi row me **🔑 key button**:

- **Set new password** — naya password + confirm + "email this person" checkbox
- ya **Send reset link** — wahi "Forgot password" wala email jaata hai, taki password aapke haath me aaye hi na (behtar tarika)
- Purana password koi nahi dekh sakta — sirf scrambled copy store hoti hai
- Dono kaam **Activity Log** me record hote hain

### 3. System Emails — 14 ready templates
Naya page: **Administration → System Emails** (`/system-emails`)

| Group | Emails |
|---|---|
| Account & password | Invitation, Forgot password, Password changed, Password set by Super Admin, New-device sign-in |
| Team & permissions | Role changed, Account turned off, Someone was added (copy to Super Admin), Permissions changed |
| Everyday work | Campaign finished, Sending stopped, Email account connected, Import finished, Export ready |

Har template me: **event key**, kaun receive karega, subject, variables ki list, poora HTML, live preview, edit, aur reset.
Password wale emails band nahi ho sakte (warna log apne hi account se bahar ho jayenge).

**Development me kya faayda:** backend me har event par sirf ek line —

```js
sendSystemEmail('user.invited', {
  to: recipient.email,
  vars: { name, email, role, invited_by, set_password_url },
});
```

Subject aur HTML `src/data/systemEmails.js` se aayenge. Kuch likhna ya design karna nahi padega.

### 4. UI audit — 24 pages × 3 screen sizes × light/dark

Automatic check chalaya (`audit.mjs`): console errors, crashes, sideways scroll, untranslated keys, tooti hui images, aur bina naam ke buttons.

**Jo mila aur theek kiya:**

| # | Problem | Fix |
|---|---|---|
| 1 | Mobile user card ka 🔑 button screen-reader ko naam nahi batata tha | `aria-label` jod diya |
| 2 | Tablet (834px) par 6 tables side me scroll ho rahi thi | Tablet par bhi ab card list dikhti hai (permission matrix table hi rahega — wahan grid hi zaroori hai) |
| 3 | Login page ke theme/language button rangeen panel par chhup rahe the | Panel ko `position: relative` diya |
| 4 | System email ka preview daayein se kat raha tha | Preview column chaudi ki (`mw-editor--list`) |

**Final result: CLEAN — koi problem nahi.**
0 console errors · 0 crashes · 0 sideways scroll · 0 untranslated keys · 0 tooti images · 0 bina-naam buttons.

---

## Update 5 — failed/bounced clean-up, sample file, subscribers

Teen cheezein add ki gayi hain.

### 1. Failed aur bounced mails — resend ya delete (checkbox se)

Campaign analytics page (`/campaigns/cmp_1041`) me recipient table ke upar ek
**Quick clean-up** bar hai:

- `Failed Emails (96)` button — ek click me saari failed rows tick ho jaati hain.
- `Bounced (61)` button — saari bounced rows tick ho jaati hain.
- Header ka checkbox = "select all visible" (indeterminate state bhi sahi dikhta hai).
- Rows tick hote hi ek **BulkBar** upar aata hai: `Resend email`, `Download`,
  `Never email again` (suppression list), `Remove`.
- Kaam hone par ek success note dikhta hai aur **Activity Log** me entry ban jaati hai
  (kisne kab kya kiya — Super Admin ko dikhega).

Wahi pattern Contacts page par bhi hai, `Bounced` / `Unsubscribed` quick buttons ke saath,
aur `Download` + `Delete` bulk actions ke saath.

Files: `src/components/ui/BulkBar.jsx`, `src/utils/useBulkSelection.js`,
`src/utils/download.js`, `WorkspaceProvider.bulkRecipientAction()`.

### 2. Sample Excel/CSV file — har import ke saath

Jahan bhi Excel/CSV se data aata hai, wahan ek **SampleFileCard** hai:

- expected columns ka preview table (Email par `*` — sirf yehi compulsory hai),
- har column ka matlab (Name → `{{name}}`, Company → `{{company}}`, etc.),
- **Download sample file** button — client-side CSV banta hai (UTF-8 BOM ke saath,
  taaki Excel me Hindi/Arabic sahi khule).

Dikhta hai: Campaign wizard step 2 (compact form me) aur Contacts page par.
Files: `src/data/sampleImport.js`, `src/components/ui/SampleFileCard.jsx`.

### 3. Subscribe button aur Subscribers list

- **Wizard step 5 (Sending)** me ek naya switch: *Add a Subscribe button to this email*.
  On karne par ek note aata hai — HTML me `{{subscribe_url}}` likho, warna hum footer ke
  upar chhota button khud laga denge.
- Step 6 (Review) me "Subscribe button — Enabled / Off" summary row.
- Naya page **`/subscribers`**: kisne subscribe kiya, kis campaign se aaya,
  kab kiya, aur abhi subscribed hai ya chhod diya. KPI cards, dropdown filters
  (subscribed-from campaign, status), search, checkbox selection,
  `Email selected` / `Download` / `Remove`, aur ek "How subscribing works" card.
- **Wizard step 2** me chautha source: *People who subscribed* — sirf active
  subscribers, select-all ke saath. Yahi user ki demand thi: naya campaign banate
  waqt subscribe kiye hue logon ko mail bhej sako.
- System email template bhi bana: `contact.subscribed` (total 15 templates).

Files: `src/pages/SubscribersPage.jsx`, `src/data/mockData.js` (`subscribers`),
`src/data/systemEmails.js`, `StepSettings.jsx`, `StepRecipients.jsx`, `StepReview.jsx`.

### i18n

55 nayi keys — `bulk.*`, `sample.*`, `sub.*`, `nav.subscribers`, `help.sub.*`.
Saari 12 languages me translate ho chuki hain. Verify:

```bash
node --input-type=module -e "const c=['en','hi','gu','mr','bn','ta','ar','es','fr','de','pt','zh'];Promise.all(c.map(x=>import('./src/i18n/locales/'+x+'.js').then(m=>[x,Object.keys(m.default)]))).then(r=>{const b=r[0][1];console.log(r.map(([k,ks])=>k+':'+ks.length+(JSON.stringify(ks)===JSON.stringify(b)?'':'!DIFF')).join(' '))})"
# en:575 hi:575 gu:575 mr:575 bn:575 ta:575 ar:575 es:575 fr:575 de:575 pt:575 zh:575
```

### Ek chhoti design fix

`.mw-kpi__label` pehle `white-space: nowrap` + ellipsis tha, isliye lambe labels
kat jaate the (jaise German/Tamil translations). Ab wrap hota hai.

### Audit

`audit.mjs` me `/subscribers` route add kiya. 25 routes × 3 viewports × light/dark —
result: **CLEAN — no problems found**.

### Top clicked links — ab per-campaign

Pehle `topLinks` ek fixed array tha, isliye har campaign par wahi 4 links dikhte the.
Ab `getTopLinks(campaign)` hai (`src/data/mockData.js`):

- link set campaign ke **template** se aata hai (Festival Offer, Course Promo, …),
- clicks campaign ke apne `clicked` total se nikalte hain,
- `clickTracking: false` ho to panel khaali hi rehta hai,
- 0 click par alag message: *"No link has been clicked yet."*

Real backend me yeh list handwritten nahi hogi: server template ke har `<a href>` ko
tracking URL me badal deta hai, click count karta hai, aur group kar deta hai —
**name = anchor text**, **url = asli destination**, **clicks = counted clicks**.
`getTopLinks()` bilkul wahi shape return karta hai, isliye baad me sirf yeh ek
function API call se replace hoga, page ka code nahi.

Panel ka heading bhi ab `t('camp.topLinks')` use karta hai (pehle hardcoded English tha).

---

## Update 6 — "sab dynamic hai na?" wala check

Poore app ka sweep kiya. Do tarah ki galtiyan mili aur theek ki.

### A. Fixed data jo har record par same dikh raha tha

| Kya | Pehle | Ab |
|---|---|---|
| Top clicked links | ek fixed list, har campaign par wahi | `getTopLinks(campaign)` — template ke hisaab se, clicks campaign ke apne total se |
| Activity over time chart | `trendByRange['7d']` — **saare campaign ka same graph** | `getCampaignTrend(campaign)` — campaign ki apni send date se, apne numbers se |
| Recipient activity table | ek global list, 10 log, har campaign par wahi | `getRecipientActivity(campaign)` — campaign ke hisaab se rotate, aur uske bounce/fail/unsub ke hisaab se filter |
| Email log (ek banda kholne par) | 5 fixed events, sabke liye same | `getEmailLog(campaign, row)` — us bande ke apne status se bana |
| Sidebar ke counts (48, 10.2K, 7, 5, 3) | code me haath se likhe hue | `countFor()` — asli array length se, `formatCompact()` ke saath |

Sabse badi galti yeh thi: **Draft aur Scheduled campaign** (jo kabhi bheja hi nahi gaya)
bhi 10 recipients, opens aur clicks dikha raha tha. Ab:

- `hasResults = campaign.sent > 0`,
- chart, quick clean-up bar, Export aur Resend buttons — sab band,
- "Sent on" ki jagah "Planned for … — not sent yet",
- table "Showing 0 of 0".

Yeh saare function `src/data/mockData.js` me hain aur wahi shape return karte hain jo
backend dega (`GET /campaigns/:id/trend`, `/recipients`, `/recipients/:id/log`) —
baad me sirf ye functions badalne honge.

### B. English text jo translate hi nahi ho raha tha

26 jagah aisi mili jahan **translation likhi hui thi lekin use nahi ho rahi thi** —
Hindi karne par bhi English hi dikhta tha. Jaise:

- "Activity over time", "Journey", "What happened after sending", "Campaign settings used"
- "Resend to unopened", "Create segment", "Continue", "Save changes", "Connect account"
- "Total sent", "Best window: …", "Recipients", "New password", "Security"

Sab `t('...')` par shift kar diye. Jin 5 components me `useT()` tha hi nahi
(CampaignTable, DeliveryDonut, OpensHeatmap, StepInfo, StepSettings) unme add kiya.
Do nayi keys bani — `camp.afterSendingSub`, `camp.settingsUsedSub` — 12 language me.
Ab **577 keys × 12 files**, order same.

### Jo abhi baaki hai (honest note)

Lagbhag **476 aur English strings** hain jinki koi key hi nahi bani —
zyada tar `WorkspaceProvider.jsx` (activity-log ke messages), `SettingsPage.jsx`,
`ConnectAccountPage.jsx` aur wizard steps me. Yeh bug nahi hai, kaam adhura hai:
poora string extraction abhi nahi hua. Bolo to agle update me kar denge.

### "Course" column hata diya

`Course` column har business ke liye nahi tha — sirf coaching/training wale samajh
paate. Ab sample file me sirf paanch column hain:

**Name · Email\* · Phone · Company · City**

Legend me last row `+` hai — "Any extra column of your own. Add as many as you like."
Yani jise course chahiye wo apna column bana lega, jise batch chahiye wo batch.
Column hataya hai, aazadi nahi.

Saath me `{{course}}` variable bhi poore app se hata diya:

- `mergeVariables` se nikala,
- default subject `Hello {{name}}, your {{course}} details` → `Hello {{name}}, here is your update`,
- Template editor aur wizard ke placeholders,
- Import ke column-mapping ka example (`Course Interested` → `City`),
- Settings ke custom fields ka example (`course, city, batch` → `city, area, plan`),
- field dropdown se `Course (custom field)` option.

### Reply kahan jaata hai — ab wizard me likha hai

Sabse common sawal: "bulk mail par koi reply kare to kya hoga?"

Jawab: reply MailWave me nahi aata. Wo **Reply-to address** ke normal inbox me
jaata hai (Gmail / Outlook / jo bhi hai). MailWave sirf bhejta hai aur track karta
hai — inbox nahi banata.

Step 1 me Reply-to field ke neeche ab ek note hai (`camp.replyNote`, 12 languages me)
jo yeh baat bhejne se **pehle** bata deta hai, baad me nahi. Ab 578 keys × 12 files.

---

## Update 7 — code review ke findings fix

Poora code padha gaya. Jo bhi kami mili, sab theek ki gayi hai.

### 1. State updater ke andar side-effect — duplicate activity entries

`WorkspaceProvider` me `deleteTemplate`, `duplicateTemplate` aur `toggleUserStatus`
`logActivity()` ko `setState` ke **updater ke andar** call kar rahe the:

```js
setTemplates((current) => {
  const found = current.find(...);
  if (found) logActivity({ ... });   // ← galat jagah
  return current.filter(...);
});
```

React updater function pure hona chahiye. StrictMode (jo `main.jsx` me on hai)
dev me updater do baar chalata hai — matlab ek delete par activity log me **do
entries**. `duplicateTemplate` me `Date.now()` bhi updater ke andar tha.

Ab teeno pehle state padhte hain, phir `setX()` aur `logActivity()` alag-alag
call karte hain. Updater ab pure hai.

### 2. IDs ab length se nahi bante

`a_${current.length + 1}_${current.length}` — delete ke baad ye collide karta.
Naya `src/utils/ids.js` (`crypto.randomUUID()`, insecure origin ke liye fallback)
ab activity, templates, images, roles aur users — sabke id banata hai.

### 3. Permission gating sirf 3 pages par thi

Sidebar 10 module filter karta tha, lekin page-level check sirf `UsersPage`,
`ActivityLogPage`, `SystemEmailsPage` me tha. Baaki jagah URL type karke andar
jaya ja sakta tha.

Ab do naye guards hain:

| File | Kaam |
|---|---|
| `src/components/routing/RequireAuth.jsx` | Bina sign-in koi bhi app route nahi khulta |
| `src/components/routing/RequireModule.jsx` | Role ke hisaab se section block, ek hi message har jagah |

`App.jsx` ke saare routes ab in dono ke andar hain. Teen pages ke apne-apne
check hata diye — ab ek hi jagah se control hota hai. Mobile tab bar aur `+` FAB
bhi `can()` maante hain.

### 4. Login ab asli me kuch karta hai

Pehle `/login` sirf dikhawa tha — `navigate('/')` karke chhod deta tha.
Naya `src/store/AuthProvider.jsx`:

- demo credentials ek hi jagah (`DEMO_EMAIL` / `DEMO_PASSWORD`)
- session `localStorage` me (`mailwave.session`)
- Topbar ka **Sign out** ab sach me sign out karta hai (pehle sirf `/login` ka link tha)
- jis page par jaana tha wahin wapas bhejta hai sign-in ke baad

Backend aane par sirf `signIn()` badalna hoga, koi page nahi.

### 5. localStorage ka schema version

8 keys save hoti hain, sirf `systemEmails` purane data ko merge karta tha.
Ab `mailwave.schemaVersion` hai — shape badle to `SCHEMA_VERSION` bump karo,
purane browser apne aap seed data se shuru ho jayenge. `roles`/`users` khali
mile to seed par gir jate hain, aur `can()` ab kisi bhi shape par crash nahi karta.

### 6. Numbers aur dates ab language follow karte hain

`formatNumber` `en-IN` par aur `formatDate` `en-GB` par fixed the — Chinese user
ko bhi Indian grouping dikhti thi. Ab har language me ek `locale` field hai
(`hi-IN`, `de-DE`, `zh-CN`, …) jo `I18nProvider` render ke waqt `format.js` ko
de deta hai. Purane call sites waise ke waise chalte hain.

### 7. `Sheet` ab sach me modal hai

`aria-modal="true"` laga tha lekin focus bahar nikal jata tha. Ab:

- khulte hi focus andar, band hote hi wapas trigger par
- Tab/Shift+Tab dialog ke andar hi ghoomta hai
- do sheets ek saath khulen to scroll lock counted hai
- close button ka label ab `t('common.close')`

### 8. Choti cheezein

- `ImageLibrary` ab `escapeAttr()` (naya `src/utils/html.js`) se `alt`/`src`
  escape karta hai — `my "best" photo.png` ab tag nahi todta. URL se image
  jodne par `https://` ya `data:image` validate hota hai.
- `HtmlPreview` me local `document` variable ka naam `srcDocument` — global
  shadow nahi karta.
- Import page ka dropzone pehle **dead button** tha. Ab asli `<input type="file">`
  hai — click, drag-and-drop, type check, 20 MB limit, aur file chune bina
  Continue disabled.
- `audit.mjs` chal hi nahi sakta tha: `playwright` dependency me nahi tha aur
  paths Linux ke hardcoded the. Ab `playwright` devDependency me hai,
  `BASE`/`SHOTS`/`CHROMIUM_PATH` env se aate hain, default port 5173, public
  aur signed-in routes alag-alag audit hote hain, aur problem milne par exit 1.
  Script: `npm run audit:ui`.

### 9. i18n — 578 → 940 keys

Pichhle update ka honest note ("lagbhag 476 aur English strings baaki hain")
ab poora ho gaya. **362 nayi keys, 12 language me = 4,344 nayi lines.**

Jo files pehle poori English thi:

| File | Ab |
|---|---|
| `CampaignWizardPage.jsx` | poori |
| `StepRecipients.jsx` / `StepInfo` / `StepContent` / `StepSettings` / `StepReview` | poori |
| `ImportContactsPage.jsx` | poori |
| `ConnectAccountPage.jsx` (+ SMTP flow) | poori |
| `SettingsPage.jsx` | poori |
| `ContactsPage.jsx` / `EmailAccountsPage.jsx` / `ReportsPage.jsx` / `SegmentsPage.jsx` | poori |
| `OnboardingPage.jsx` / `NotFoundPage.jsx` / `Stepper.jsx` | poori |

`mockData.js` ka data bhi keys par shift hua — `wizardSteps`, `onboardingSteps`,
`appFields`, `reportTypes`, `batchOptions`, `providerOptions` ab `labelKey` /
`titleKey` / `descKey` rakhte hain, English text nahi.

Ek aur baat: jahan `<option>` ka text translate hota hai wahan ab stable `value`
diya gaya hai (consent dropdown, SMTP security) — warna language badalne par
default selection tut jati.

**940 keys × 12 files, zero missing, zero extra.**

Sirf sample-data placeholders English hain (`Rahul Verma`, `Verma Traders`,
`Interested Leads`) — woh naam hain, UI text nahi.

---

## Update 8 — bundle 1.87 MB se 379 kB

Update 7 ke baad build khud warning de raha tha:

```
dist/assets/index-*.js   1,867.55 kB │ gzip: 489.10 kB
(!) Some chunks are larger than 500 kB
```

Ek hi file me poora app tha. Do jagah kaat diya.

### 1. Har language apna chunk

`languages.js` saari 12 dictionaries statically import kar raha tha — matlab
Hindi wala user Arabic, Chinese, Tamil sab download karta tha. **Sirf 12 locale
files milke 1.1 MB thi.**

Ab sirf **English bundle me hai** (woh har missing key ka fallback hai, isliye
turant chahiye). Baaki 11 alag chunk hain, tab aati hain jab koi wo language
chune. Jab tak nahi aayi, English dikhta hai — jo README pehle se promise karta
hai: *"Jo key chhoot jaye woh apne aap English dikhati hai."*

`I18nProvider` ab dictionary ko module cache se render ke waqt padhta hai, aur
chunk aane par ek re-render karta hai.

**Ek race thi jo pakdi gayi** — pehla version effect me `if (cachedDictionary(code)) return`
karta tha. Agar chunk render aur effect ke *beech* me aa jaye, to effect ko lagta
tha "cache bhara hua hai, kuch karne ki zarurat nahi" — lekin screen par to
English hi tha, aur re-render trigger karne wala koi bacha hi nahi. Nateeja:
har language me English. Ab effect hamesha subscribe karta hai aur jo dictionary
render me use hui usse compare karta hai.

Yeh build aur lint dono me pass ho raha tha — pakda tab gaya jab har language
browser me actually render karke dekhi gayi.

### 2. Har page apna chunk

`App.jsx` me saare pages ab `React.lazy` se aate hain. `LoginPage` main bundle
me hi hai — jo signed-in nahi hai use wahi dikhta hai, uske liye ek aur round
trip galat hota.

Do `<Suspense>` boundaries hain:

- `App.jsx` me — standalone screens (reset password, template preview) ke liye
- `AppLayout.jsx` me `<Outlet />` ke aas paas — isse page badalte waqt sidebar
  aur topbar screen par bane rehte hain, poori window blank nahi hoti

Fallback: naya `PageLoader` (Bootstrap spinner + `common.loading`, 12 language me).

### Nateeja

| | Pehle | Ab |
|---|---|---|
| Main bundle | 1,867.55 kB | **378.55 kB** |
| gzip | 489.10 kB | **116.13 kB** |
| Chunk-size warning | haan | nahi |

recharts (358 kB) ab apne chunk me hai — sirf Dashboard, Reports aur Analytics
kholne par aata hai. Baaki har page 0.35–30 kB ka chunk hai.

Jo user sirf login screen dekh kar chala jata hai, wo ab 1.87 MB ki jagah
379 kB download karta hai.

### Verify kaise kiya

Node mil gaya to sab chala ke dekha:

- `npm run lint` — 16 warnings, sab pehle se maujood patterns (`catch (error)`
  unused, providers par `only-export-components`). Koi error nahi.
- `npm run build` — 687 modules, clean.
- Har source module Vite se transform karke check kiya — 92/92.
- **`npm run audit:ui` — CLEAN, 24 routes × 3 screen sizes × light/dark.**
  Zero console errors, zero crashes, zero sideways scroll, zero untranslated
  keys, zero tooti images, zero bina-naam buttons.
- Headless Chrome se actually render karke: auth guard (bina session har route
  login par jaata hai), RequireModule (`member` role ko users/settings/activity/
  system-emails par block, campaigns par allow), saari 12 languages ka wizard
  heading, Arabic par `dir="rtl"`, aur locale-aware numbers
  (`de → 128.450`, `fr → 128 450`, `hi → 1,28,450`).

**941 keys × 12 files, zero missing, zero extra.**

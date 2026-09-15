import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import PageHeader from '../components/ui/PageHeader';
import { appConfig } from '../config/appConfig';
import { useT } from '../i18n/I18nProvider';
import { Card } from '../components/ui/Card';
import { Note } from '../components/ui/Controls';
import Sheet from '../components/ui/Sheet';
import ProgressBar from '../components/ui/ProgressBar';
import Stepper from '../components/wizard/Stepper';
import StepInfo from '../components/wizard/StepInfo';
import StepRecipients from '../components/wizard/StepRecipients';
import StepTemplate from '../components/wizard/StepTemplate';
import StepContent from '../components/wizard/StepContent';
import StepSettings from '../components/wizard/StepSettings';
import StepReview from '../components/wizard/StepReview';
import { wizardSteps } from '../data/constants';
import { useWorkspace } from '../store/WorkspaceProvider';
import { useAuth } from '../store/AuthProvider';
import { ApiError, api } from '../api/client';
import { useApi } from '../api/useApi';
import { useToast } from '../components/ui/ToastProvider';
import { formatDateTime, formatNumber, percentValue } from '../utils/format';
import { isValidEmail, parseContactFilterLimit } from '../utils/validation';

const INITIAL_DRAFT = {
  name: '',
  account: '',
  senderName: appConfig.company,
  replyTo: '',
  subject: '',
  preheader: '',
  recipientSource: 'all',
  manualList: '',
  groups: [],
  subscriberIds: [],
  contactFilter: { search: '', city: '', tag: '', groupId: '', excludeAlreadyEmailed: false, limit: '' },
  templateId: '',
  templateName: '',
  templateHtml: '',
  language: 'en',
  batchSize: 100,
  batchDelay: 2,
  openTracking: true,
  clickTracking: true,
  subscribeButton: false,
  schedule: 'now',
  scheduleAt: '',
};

/**
 * Screen ka chuna hua time server wale roop me badalta hai.
 *
 * datetime-local box "2026-09-05T14:30" deta hai — ismein time zone likha hi
 * nahi hota. Use seedha bhej dete to server use apne hisaab se padhta aur mail
 * galat waqt par jati. `new Date()` ise user ke apne time zone me padhta
 * hai, aur toISOString() usse ek aisa roop banata hai jise duniya me har jagah
 * ek hi matlab me samjha jata hai.
 */
function toServerTime(localValue) {
  if (!localValue) return null;
  const when = new Date(localValue);
  return Number.isNaN(when.getTime()) ? null : when.toISOString();
}

/** toServerTime() ka ulta — server ki ISO date se datetime-local box ki value. */
function toLocalInputValue(isoValue) {
  if (!isoValue) return '';
  const when = new Date(isoValue);
  if (Number.isNaN(when.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}T${pad(when.getHours())}:${pad(when.getMinutes())}`;
}

/** Manual list ke box me likhe email nikalta hai. */
function parseManualList(text) {
  return String(text || '')
    .split(/[\n,;]+/)
    .map((line) => line.trim())
    .filter((line) => line.includes('@'))
    .map((email) => ({ email }));
}

export default function CampaignWizardPage() {
  const t = useT();
  const toast = useToast();
  const navigate = useNavigate();
  const { templates } = useWorkspace();
  const { role } = useAuth();

  // Route me id ho to ek maujooda Draft edit ho rahi hai, warna naya banana hai.
  const { campaignId: editId } = useParams();
  const isEditing = Boolean(editId);

  // Segments page ke "Use in campaign" se aaya ho to ?segment=seg_xxx milta
  // hai — usi segment ko Recipients step me pehle se chuna hua dikhana hai,
  // warna button sirf ek khaali wizard khol deta, segment kahin lagta hi nahi.
  const [searchParams] = useSearchParams();
  const preselectedSegment = searchParams.get('segment');

  const accountsCall = useApi('/api/accounts');
  // null = koi rok nahi (har account); array ho to sirf usi list tak —
  // dekho server/src/middleware/permissions.js ka allowedAccountIds().
  const allowedAccountIds = role?.allowedAccountIds ?? null;
  const accounts = useMemo(() => {
    const all = accountsCall.data?.accounts ?? [];
    if (!allowedAccountIds) return all;
    return all.filter((item) => allowedAccountIds.includes(item.id));
  }, [accountsCall.data, allowedAccountIds]);

  // Settings page ke "Sending"/"Tracking" defaults yahin lagte hain — naya
  // campaign inhi se shuru hota hai, taki Settings me chuna hua batch size ya
  // tracking default sach me kaam kare, na ki sirf ek table me pada rahe.
  const workspaceSettingsCall = useApi('/api/settings');

  // "Existing contacts" step ke Groups/Segments dono asli data se aate hain.
  const contactGroupsCall = useApi('/api/contacts/groups/all');
  const contactGroups = useMemo(() => contactGroupsCall.data?.groups ?? [], [contactGroupsCall.data]);
  const segmentsCall = useApi('/api/segments');
  const segments = useMemo(() => segmentsCall.data?.segments ?? [], [segmentsCall.data]);

  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(() =>
    preselectedSegment
      ? { ...INITIAL_DRAFT, recipientSource: 'existing', groups: [preselectedSegment] }
      : INITIAL_DRAFT
  );

  // StepSettings ka send-time estimate isi se, apne aap, us account ki ASLI
  // (fixed 500 nahi) dailyLimit/sentToday padhta hai — jo bhi account draft
  // me abhi chuna ho, wahi, har render par fresh.
  const selectedAccount = useMemo(
    () => accounts.find((item) => item.email === draft.account) || null,
    [accounts, draft.account]
  );

  // Ek hi baar, jab Settings load ho jayein — naya campaign inhi defaults se
  // shuru hota hai. Edit mode me nahi (wahan asli campaign ki apni values
  // aati hain), aur ek baar lagne ke baad dobara nahi (warna user ka khud
  // badla hua batch size wapas purane default par chala jata).
  const appliedWorkspaceDefaults = useRef(false);
  useEffect(() => {
    if (isEditing || appliedWorkspaceDefaults.current) return;
    const sending = workspaceSettingsCall.data?.settings?.sending;
    const tracking = workspaceSettingsCall.data?.settings?.tracking;
    if (!sending && !tracking) return;

    appliedWorkspaceDefaults.current = true;
    setDraft((current) => ({
      ...current,
      batchSize: sending?.defaultBatchSize ?? current.batchSize,
      batchDelay: sending?.batchDelayMinutes ?? current.batchDelay,
      openTracking: tracking?.openByDefault ?? current.openTracking,
      clickTracking: tracking?.clickByDefault ?? current.clickTracking,
    }));
  }, [isEditing, workspaceSettingsCall.data]);

  const [category, setCategory] = useState('All');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState('');
  // Continue/Send dabane par jo step galat nikla, sirf uske field laal
  // border/nishaan dikhate hain — khaali form kholte hi sab laal dikhna
  // ghabra deta hai.
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(isEditing);

  // Ek baar campaign ban jane ke baad uski id yahan rehti hai — dobara
  // "Send" dabane par nayi campaign nahi banti. Edit mode me shuru se hi
  // maujood hai.
  const [campaignId, setCampaignId] = useState(editId ?? null);
  const [live, setLive] = useState(null);
  const [recipientCount, setRecipientCount] = useState(0);
  // Draft me pehle se kitne log jude the — dubara jodne se koi aur na jud
  // jaye isliye yaad rakhte hain (source yaad nahi rehta, sirf ginti).
  const [originalRecipientCount, setOriginalRecipientCount] = useState(0);

  // Edit mode: maujooda Draft ka data laa kar wizard bhar dete hain.
  useEffect(() => {
    if (!editId) return undefined;
    let alive = true;

    (async () => {
      try {
        const data = await api.get(`/api/campaigns/${editId}`);
        if (!alive) return;
        const c = data.campaign;

        if (c.status !== 'Draft') {
          // Sirf Draft yahan se badalti hai — baaki ke liye analytics page.
          navigate(`/campaigns/${editId}`, { replace: true });
          return;
        }

        setDraft((current) => ({
          ...current,
          name: c.name ?? '',
          account: c.sender ?? '',
          senderName: c.senderName || appConfig.company,
          replyTo: c.replyTo ?? '',
          subject: c.subject ?? '',
          preheader: c.preheader ?? '',
          templateId: c.templateId ?? '',
          templateName: c.template ?? '',
          templateHtml: c.html ?? '',
          language: c.language ?? 'en',
          batchSize: c.batchSize ?? 100,
          batchDelay: c.batchDelay ?? 2,
          openTracking: c.openTracking ?? true,
          clickTracking: c.clickTracking ?? false,
          subscribeButton: c.subscribeButton ?? false,
          schedule: c.scheduledAt ? 'later' : 'now',
          scheduleAt: toLocalInputValue(c.scheduledAt),
        }));
        setOriginalRecipientCount(c.recipients ?? 0);
        setRecipientCount(c.recipients ?? 0);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : t('toast.networkError'));
        navigate('/campaigns');
      } finally {
        if (alive) setLoadingDraft(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // Pehla template aur pehla account apne aap chun lete hain — zyadatar log
  // yahi chunte hain, aur khali form se shuru karna bura lagta hai.
  useEffect(() => {
    const template = templates[0];
    const account = accounts[0];

    setDraft((current) => ({
      ...current,
      templateId: current.templateId || template?.id || '',
      templateName: current.templateName || template?.name || '',
      templateHtml: current.templateHtml || template?.html || '',
      language: current.templateId ? current.language : template?.language || current.language,
      account: current.account || account?.email || '',
      senderName: current.senderName || account?.displayName || appConfig.company,
    }));
  }, [templates, accounts]);

  /**
   * "Kitne logon tak jayega" — asli ginti, server se.
   *
   * Yeh number bhejne se pehle dikhta hai, isliye iska sahi hona zaroori hai.
   * Server bilkul wahi shart lagata hai jo asli me recipients jodte waqt
   * lagegi — jo unsubscribe kar chuke hain wo yahan bhi nahi gine jate.
   */
  const [willReach, setWillReach] = useState(0);
  // Filter source par "Limit to" field se willReach chhota ho sakta hai
  // (asal me jayega utna), par ContactFilterFields ka apna "X of Y match"
  // note poora, bina-limit-wala match count chahta hai — isliye alag rakha.
  const [filterMatchCount, setFilterMatchCount] = useState(0);
  const [countingRecipients, setCountingRecipients] = useState(false);

  // Group id aur segment id alag prefix se bante hain (g_ aur seg_) — isi se
  // pata chal jata hai "existing" step me kya chuna gaya hai, alag se yaad
  // rakhne ki zarurat nahi.
  const selectedExistingId = draft.groups[0] ?? '';
  const selectedIsSegment = selectedExistingId.startsWith('seg_');

  useEffect(() => {
    if (draft.recipientSource === 'manual') {
      setWillReach(parseManualList(draft.manualList).length);
      return undefined;
    }

    if (draft.recipientSource === 'existing' && selectedIsSegment) {
      // Segment ki ginti server se hi live aati hai (segments list ke saath) —
      // dobara pochne ki zarurat nahi.
      const segment = segments.find((item) => item.id === selectedExistingId);
      setWillReach(segment?.count ?? 0);
      return undefined;
    }

    if (draft.recipientSource === 'subscribers') {
      // Yeh humein pehle se pata hai (checkbox se) — server se dobara poochna
      // nahi padta, aur isse count hamesha wahi dikhata hai jo tick kiya gaya.
      setWillReach(draft.subscriberIds.length);
      return undefined;
    }

    let alive = true;

    (async () => {
      try {
        const params = new URLSearchParams({ source: recipientSourceKey() });
        if (draft.recipientSource === 'existing' && selectedExistingId) {
          params.set('groupId', selectedExistingId);
        }
        if (draft.recipientSource === 'filter') {
          const f = draft.contactFilter;
          if (f.search) params.set('search', f.search);
          if (f.city) params.set('city', f.city);
          if (f.tag) params.set('tag', f.tag);
          if (f.groupId) params.set('filterGroupId', f.groupId);
          if (f.excludeAlreadyEmailed) params.set('excludeAlreadyEmailed', 'true');
          // Draft edit kar rahe ho to isi campaign me pehle se jude logon ko
          // ginti me dobara mat gino.
          if (editId) params.set('excludeCampaignId', editId);
        }

        setCountingRecipients(true);
        const data = await api.get(`/api/campaigns/recipient-count?${params}`);
        if (!alive) return;
        // Filter wale source par ek "limit to N" field bhi hota hai — baaki
        // saare wizard steps (batch estimate, review, "X ko jayega") ko
        // hamesha WAHI number dikhna chahiye jo asal me jode jayenge, poora
        // match count nahi. ContactFilterFields ko poora (bina-limit) count
        // alag se milta hai, taaki uska apna "X of Y match" note sahi rahe.
        const rawCount = data.count ?? 0;
        setFilterMatchCount(rawCount);
        const limit = draft.recipientSource === 'filter' ? parseContactFilterLimit(draft.contactFilter.limit) : undefined;
        setWillReach(limit ? Math.min(rawCount, limit) : rawCount);
      } catch (err) {
        if (alive) setWillReach(0);
      } finally {
        if (alive) setCountingRecipients(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draft.recipientSource,
    draft.manualList,
    selectedExistingId,
    selectedIsSegment,
    segments,
    draft.contactFilter,
    draft.subscriberIds,
  ]);

  /** Screen ka naam server ke naam me badalta hai. */
  function recipientSourceKey() {
    if (draft.recipientSource === 'existing' && !selectedIsSegment) return 'group';
    if (draft.recipientSource === 'subscribers') return 'subscribers';
    if (draft.recipientSource === 'filter') return 'filter';
    return 'all';
  }

  // Bhejte waqt har 2 second me asli haal poochte hain. Yeh andaza nahi hai —
  // seedha server se aata hai, isliye number kabhi jhooth nahi bolte.
  const timerRef = useRef(null);

  const poll = useCallback(async (id) => {
    try {
      const data = await api.get(`/api/campaigns/${id}`);
      setLive(data.campaign);
      return data.campaign;
    } catch (err) {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!campaignId || !live) return undefined;
    if (live.status !== 'Sending') return undefined;

    timerRef.current = window.setInterval(() => poll(campaignId), 2000);
    return () => window.clearInterval(timerRef.current);
  }, [campaignId, live, poll]);

  function updateDraft(patch) {
    setDraft((current) => ({ ...current, ...patch }));
    setError('');
  }

  function goNext() {
    const missing = stepError(step);
    if (missing) {
      setError(missing);
      setShowErrors(true);
      // Yeh banner card ke UPAR dikhta hai — agar screen scroll ki hui hai
      // (jaise Template step me 20+ templates ke beech), to woh dikhta hi
      // nahi. Toast hamesha fixed-position hota hai, isliye scroll kahin
      // bhi ho, turant dikh jata hai.
      toast.error(missing);
      return;
    }
    setError('');
    setShowErrors(false);
    setStep((current) => Math.min(wizardSteps.length - 1, current + 1));
  }

  function goBack() {
    setError('');
    setShowErrors(false);
    setStep((current) => Math.max(0, current - 1));
  }

  /**
   * Stepper ke header se seedha kisi bhi step par jump kar sakte hain.
   * Peechhe jaana hamesha theek hai; aage jaana sirf tabhi jab beech ke sab
   * steps bhare hue hon — warna khaali steps chhupe rehte aur galti pata hi
   * na chalti.
   */
  function jumpToStep(index) {
    if (index <= step) {
      setError('');
      setShowErrors(false);
      setStep(index);
      return;
    }

    for (let i = step; i < index; i += 1) {
      const missing = stepError(i);
      if (missing) {
        setError(missing);
        setShowErrors(true);
        toast.error(missing);
        setStep(i);
        return;
      }
    }

    setError('');
    setShowErrors(false);
    setStep(index);
  }

  /**
   * Dono "Send" aur "Save as Draft" ke liye ek hi jaanch — jahan bhi ruki
   * hai, wahin le jaao aur laal nishaan dikhao (sirf ek banner me "kuch
   * chhoot gaya" bolna kaafi nahi, dikhna bhi chahiye kahan). Sab theek ho to
   * true deta hai, warna khud hi error dikha kar false de deta hai.
   */
  function validateBeforeSubmit() {
    for (let i = 0; i < wizardSteps.length; i += 1) {
      const missing = stepError(i);
      if (missing) {
        setError(missing);
        setShowErrors(true);
        toast.error(missing);
        setStep(i);
        return false;
      }
    }

    const missing = whatIsMissing();
    if (missing) {
      setError(missing);
      toast.error(missing);
      return false;
    }
    setError('');
    return true;
  }

  function openConfirm() {
    if (validateBeforeSubmit()) setConfirmOpen(true);
  }

  function closeConfirm() {
    setConfirmOpen(false);
  }

  function handleSaveDraftClick() {
    // Draft save karne me confirm-sheet ki zarurat nahi — kuch bheja nahi ja
    // raha, non-destructive hai, seedha save ho jaata hai.
    if (validateBeforeSubmit()) saveDraft();
  }

  /**
   * Ek step ke liye jo bhi zaroori hai — index 0=Info, 1=Recipients,
   * 2=Template, 3=Content, 4=Settings, 5=Review.
   *
   * "Continue" par isi step ki jaanch hoti hai, taaki galti turant pata chale
   * — sabse aakhir tak intezaar karke ek saath sab kuch batana bura lagta hai.
   */
  function stepError(index) {
    if (index === 0) {
      if (!draft.name.trim()) return t('wiz.needName');
      if (!draft.account) return t('wiz.needAccount');
      if (!draft.subject.trim()) return t('wiz.needSubject');
      if (draft.replyTo.trim() && !isValidEmail(draft.replyTo)) return t('wiz.badReplyTo');
      return '';
    }

    if (index === 1) {
      if (draft.recipientSource === 'manual' && parseManualList(draft.manualList).length === 0) {
        return t('wiz.needRecipients');
      }
      if (draft.recipientSource === 'existing' && draft.groups.length === 0) {
        return t('wiz.needGroupOrSegment');
      }
      if (draft.recipientSource === 'subscribers' && draft.subscriberIds.length === 0) {
        return t('wiz.needRecipients');
      }
      if (draft.recipientSource === 'filter' && willReach === 0) {
        return t('wiz.needRecipients');
      }
      return '';
    }

    if (index === 3) {
      if (!draft.templateHtml.trim()) return t('wiz.needContent');
      return '';
    }

    if (index === 4) {
      if (draft.schedule === 'later') {
        const when = toServerTime(draft.scheduleAt);
        if (!when) return t('wiz.needTime');
        // Beeta hua time chunna kisi kaam ka nahi — wo turant chal padegi.
        if (new Date(when) <= new Date()) return t('wiz.timeInPast');
      }
      return '';
    }

    return '';
  }

  /** Bhejne se pehle sab steps ek-ek karke jaanch leta hai — aakhri suraksha. */
  function whatIsMissing() {
    for (let index = 0; index < wizardSteps.length; index += 1) {
      const message = stepError(index);
      if (message) return message;
    }

    return '';
  }

  /**
   * Campaign banata hai (ya edit mode me maujooda Draft update karta hai) aur
   * log jodta hai — startSending() aur saveDraft() dono isi ek jagah se guzarte
   * hain, taaki "campaign banao + log jodo" ka tarika dono jagah hamesha ek
   * jaisa rahe. `sendAt` diya ho to campaign seedha 'Scheduled' bhi ban jaati
   * hai (backend campaignInput accepts scheduledAt) — bhejna alag step hai.
   */
  async function createOrUpdateCampaign(sendAt) {
    const account = accounts.find((item) => item.email === draft.account);
    if (!account) throw new ApiError(400, 'bad_request', t('wiz.needAccount'));

    const payload = {
      scheduledAt: sendAt,
      name: draft.name.trim(),
      accountId: account.id,
      senderName: draft.senderName || null,
      replyTo: draft.replyTo?.trim() || null,
      subject: draft.subject.trim(),
      preheader: draft.preheader?.trim() || null,
      templateId: draft.templateId || null,
      html: draft.templateHtml,
      language: draft.language || 'en',
      batchSize: Number(draft.batchSize) || 100,
      batchDelay: Number(draft.batchDelay) || 2,
      openTracking: Boolean(draft.openTracking),
      clickTracking: Boolean(draft.clickTracking),
      subscribeButton: Boolean(draft.subscribeButton),
    };

    // 1. campaign banao, ya (edit mode me) maujooda Draft update karo
    const created = isEditing
      ? await api.put(`/api/campaigns/${editId}`, payload)
      : await api.post('/api/campaigns', payload);

    const id = created.campaign.id;
    setCampaignId(id);

    // 2. log jodo — jaha se user ne chuna hai. Edit me agar Draft me pehle
    // se log jude the, unhe waisa hi rehne dete hain — dobara jodne se
    // source yaad na hone ki wajah se galat log bhi jud sakte hain.
    let count = originalRecipientCount;
    if (count === 0) {
      const added = await api.post(`/api/campaigns/${id}/recipients`, await recipientPayload());
      count = added.added ?? added.total ?? 0;
      setRecipientCount(count);
    }

    return { campaign: created.campaign, id, count };
  }

  /**
   * Asli campaign banata hai, log jodta hai, aur bhejna shuru karta hai.
   *
   * Teen alag kaam hain, teen alag request. Beech me kuch fail ho jaye to
   * campaign Draft me bacha rehta hai — kuch gum nahi hota, user Campaigns
   * page se use dobara khol sakta hai.
   */
  async function startSending() {
    setConfirmOpen(false);
    setBusy(true);
    setError('');

    // Abhi bhejna hai ya baad me — yahi ek line poora farq tay karti hai.
    const sendAt = draft.schedule === 'later' ? toServerTime(draft.scheduleAt) : null;

    try {
      const { campaign, id, count } = await createOrUpdateCampaign(sendAt);

      if (count === 0) {
        setError(t('wiz.noRecipients'));
        setLive({ ...campaign, status: 'Draft' });
        return;
      }

      // 3. ab bhejo — ya time par bhejne ke liye chhod do
      if (sendAt) {
        // Campaign pehle hi 'Scheduled' bani hai. Server har minute dekhta
        // rehta hai ki kiska time aa gaya. Yahan kuch aur karne ki zarurat
        // nahi — bas user ko saaf batana hai ki kab jayegi.
        setLive({ ...campaign, status: 'Scheduled', recipients: count });
        toast.success(t('wiz.scheduledToast', { count: formatNumber(count) }));
        return;
      }

      await api.post(`/api/campaigns/${id}/send`);
      const fresh = await poll(id);
      setLive(fresh ?? { ...campaign, status: 'Sending' });

      toast.success(t('wiz.startedToast', { count: formatNumber(count) }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('toast.networkError'));
    } finally {
      setBusy(false);
    }
  }

  /**
   * Campaign ko sirf Draft me chhod deta hai — kuch nahi bheja jaata, na
   * schedule hota hai. Isi se A/B test set up karna sambhav hota hai (uski
   * apni shuruaat sirf Draft/Scheduled campaign par hi ho sakti hai) — seedha
   * campaign ke Analytics page par le jaate hain, jahan se "Set up an A/B
   * test" ya normal Send dono aage kiya ja sakta hai.
   */
  async function saveDraft() {
    setBusy(true);
    setError('');
    try {
      const { id, count } = await createOrUpdateCampaign(null);
      toast.success(t('wiz.savedAsDraftToast', { count: formatNumber(count) }));
      navigate(`/campaigns/${id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('toast.networkError'));
    } finally {
      setBusy(false);
    }
  }

  /** Recipients ki request kis shape me jayegi. */
  async function recipientPayload() {
    if (draft.recipientSource === 'manual') {
      return { source: 'list', people: parseManualList(draft.manualList) };
    }

    if (draft.recipientSource === 'existing' && selectedExistingId) {
      if (selectedIsSegment) {
        // Segment ka apna "source" backend nahi jaanta — uske asli contacts
        // nikaal kar seedhi list bhej dete hain, jaisi manually type ki gayi ho.
        const data = await api.get(`/api/segments/${selectedExistingId}/contacts`);
        const people = (data.contacts ?? []).map((c) => ({ email: c.email, name: c.name ?? null }));
        return { source: 'list', people };
      }
      return { source: 'group', groupId: selectedExistingId };
    }

    if (draft.recipientSource === 'subscribers') {
      return { source: 'subscribers', subscriberIds: draft.subscriberIds };
    }

    if (draft.recipientSource === 'filter') {
      return {
        source: 'filter',
        filter: { ...draft.contactFilter, limit: parseContactFilterLimit(draft.contactFilter.limit) },
      };
    }

    return { source: 'all' };
  }

  /**
   * Schedule hata do — campaign wapas Draft ho jati hai.
   *
   * Galti se galat time chun liya, ya campaign hi nahi bhejni — dono me yahi
   * kaam aata hai. Campaign mitti nahi, Campaigns page par Draft me padi
   * rehti hai.
   */
  async function cancelSchedule() {
    if (!campaignId) return;

    setBusy(true);
    try {
      const data = await api.post(`/api/campaigns/${campaignId}/schedule`, { at: null });
      setLive(data.campaign);
      toast.success(t('wiz.scheduleCancelled'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('toast.networkError'));
    } finally {
      setBusy(false);
    }
  }

  async function togglePause() {
    if (!campaignId) return;

    try {
      if (live?.status === 'Sending') {
        await api.post(`/api/campaigns/${campaignId}/pause`);
      } else {
        await api.post(`/api/campaigns/${campaignId}/send`);
      }
      setLive(await poll(campaignId));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t('toast.networkError'));
    }
  }

  function goToCampaigns() {
    navigate(campaignId ? `/campaigns/${campaignId}` : '/campaigns');
  }

  // --- bhejte waqt wali screen ---------------------------------------------
  // Schedule chuna hai ya nahi — screen par kai jagah isi se farq padta hai,
  // isliye ek hi jagah se tay karte hain.
  const isScheduled = draft.schedule === 'later';

  // --- edit mode: maujooda Draft ka data aane tak intezaar --------------------
  if (loadingDraft) {
    return (
      <div className="mw-stack">
        <PageHeader title={t('camp.editCampaign')} breadcrumb={[{ label: t('nav.campaigns'), to: '/campaigns' }]} />
        <Card>
          <div className="mw-card__body p-5 text-center mw-text-muted">
            <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
            {t('common.loading')}
          </div>
        </Card>
      </div>
    );
  }

  // --- schedule ho gayi: kuch bhejna nahi hai, bas batana hai --------------
  //
  // Yeh screen alag isliye hai ki progress bar aur "0 / 500" dikhana yahan
  // jhooth hoga — abhi kuch gaya hi nahi hai. User ko sirf yeh jaanna hai ki
  // kab jayegi, aur zarurat pade to rok kaise sake.
  if (live && live.status === 'Scheduled') {
    const when = live.scheduledAt ?? toServerTime(draft.scheduleAt);

    return (
      <div className="mw-stack">
        <PageHeader
          title={t('wiz.scheduledTitle')}
          subtitle={t('wiz.scheduledSub')}
          breadcrumb={[{ label: t('nav.campaigns'), to: '/campaigns' }, { label: draft.name }]}
        />

        {error ? (
          <Note tone="warning" icon="bi-exclamation-triangle">
            {error}
          </Note>
        ) : null}

        <Card>
          <div className="mw-card__body text-center py-5">
            <span className="mw-empty__icon mx-auto" aria-hidden="true">
              <i className="bi bi-calendar-check" />
            </span>

            <h2 className="mw-fs-20 mw-fw-700 mb-2">
              {t('wiz.willGoAt', { when: formatDateTime(when) })}
            </h2>
            <p className="mw-fs-14 mw-text-muted mb-4">
              {t('wiz.willGoTo', { count: formatNumber(recipientCount || live.recipients || 0) })}
            </p>

            <div className="mw-row justify-content-center mw-row--wrap">
              <button
                type="button"
                className="btn btn-outline-danger"
                onClick={cancelSchedule}
                disabled={busy}
              >
                <i className="bi bi-x-circle me-2" />
                {busy ? t('common.loading') : t('wiz.cancelSchedule')}
              </button>
              <button type="button" className="btn btn-primary" onClick={goToCampaigns}>
                {t('wiz.viewAnalytics')}
              </button>
            </div>
          </div>
        </Card>

        <Note tone="info" icon="bi-info-circle">
          {t('wiz.scheduleNote')}
        </Note>
      </div>
    );
  }

  if (live) {
    const total = recipientCount || live.recipients || 0;
    const sent = live.sent ?? 0;
    const failed = live.failed ?? 0;
    const pending = Math.max(0, total - sent - failed);
    const progress = percentValue(sent + failed, total);
    const running = live.status === 'Sending';
    const done = !running && pending === 0 && total > 0;
    // Insaan ne khud roka tha ya aaj ki bhejne ki limit khatam ho gayi —
    // dono "Paused" jaise dikhte the, ab reason saaf dikhta hai.
    const pausedLabel = live.pauseReason === 'quota' ? t('camp.pausedQuota') : t('camp.pausedManual');

    return (
      <div className="mw-stack">
        <PageHeader
          title={done ? t('wiz.doneTitle') : running ? t('wiz.sendingTitle') : t('wiz.paused')}
          subtitle={done ? t('wiz.doneSub') : running ? t('wiz.sendingSub') : pausedLabel}
          breadcrumb={[{ label: t('nav.campaigns'), to: '/campaigns' }, { label: draft.name }]}
        />

        {error ? (
          <Note tone="warning" icon="bi-exclamation-triangle">
            {error}
          </Note>
        ) : null}

        <div className="mw-sending">
          <div className="mw-row mw-row--between mw-row--wrap">
            <div>
              <span className="mw-sending__count">{formatNumber(sent)}</span>
              <span className="mw-sending__total"> / {formatNumber(total)}</span>
            </div>
            <span className="mw-row mw-fs-13 mw-fw-600">
              {done ? (
                <>
                  <i className="bi bi-check-circle-fill mw-text-success" /> {t('wiz.completed')}
                </>
              ) : running ? (
                <>
                  <span className="mw-pulse" />{' '}
                  {t('wiz.sendingBatch', {
                    number: Math.max(1, Math.ceil((sent + 1) / (Number(draft.batchSize) || 100))),
                  })}
                </>
              ) : (
                <>
                  <i className="bi bi-pause-circle-fill mw-text-warning" /> {pausedLabel}
                </>
              )}
            </span>
          </div>

          <div className="mt-3">
            <ProgressBar
              value={progress}
              size="lg"
              tone={done ? 'success' : 'primary'}
              label={t('wiz.progressLabel')}
            />
          </div>

          <div className="mw-sending__stats">
            <div className="mw-sending__stat">
              <div className="mw-fs-20 mw-fw-700 mw-num">{formatNumber(sent)}</div>
              <div className="mw-fs-12 mw-text-muted">{t('wiz.sent')}</div>
            </div>
            <div className="mw-sending__stat">
              <div className="mw-fs-20 mw-fw-700 mw-num mw-text-warning">{formatNumber(pending)}</div>
              <div className="mw-fs-12 mw-text-muted">{t('wiz.pending')}</div>
            </div>
            <div className="mw-sending__stat">
              <div className="mw-fs-20 mw-fw-700 mw-num mw-text-danger">{formatNumber(failed)}</div>
              <div className="mw-fs-12 mw-text-muted">{t('wiz.failed')}</div>
            </div>
            <div className="mw-sending__stat">
              <div className="mw-fs-20 mw-fw-700 mw-num">{formatNumber(Math.round(progress))}%</div>
              <div className="mw-fs-12 mw-text-muted">{t('wiz.progress')}</div>
            </div>
          </div>

          <div className="mw-row mw-row--wrap mt-4">
            {done ? (
              <button type="button" className="btn btn-primary mw-btn-block-mobile" onClick={goToCampaigns}>
                <i className="bi bi-graph-up me-2" />
                {t('wiz.viewAnalytics')}
              </button>
            ) : (
              <>
                <button type="button" className="btn btn-outline-secondary" onClick={togglePause}>
                  <i className={`bi ${running ? 'bi-pause-fill' : 'bi-play-fill'} me-2`} />
                  {running ? t('wiz.pause') : t('wiz.resume')}
                </button>
                <button type="button" className="btn btn-outline-secondary" onClick={goToCampaigns}>
                  <i className="bi bi-graph-up me-2" />
                  {t('wiz.viewAnalytics')}
                </button>
              </>
            )}
          </div>

          {/* Rokne par kuch gum nahi hota — jo bacha hai wo wahin ruka rehta
              hai aur baad me wahi se aage chalta hai. */}
          <p className="mw-fs-12 mw-text-muted mt-3 mb-0">{t('wiz.pauseNote')}</p>
        </div>
      </div>
    );
  }

  // --- wizard ---------------------------------------------------------------
  return (
    <div className="mw-stack">
      <PageHeader
        title={isEditing ? t('camp.editCampaign') : t('dash.createCampaign')}
        subtitle={t('wiz.subtitle')}
        helpTopic="wizard"
        breadcrumb={[
          { label: t('nav.campaigns'), to: '/campaigns' },
          { label: isEditing ? t('camp.editCampaign') : t('dash.createCampaign') },
        ]}
        actions={
          // Recipients jodna, A/B test set up karna, poora Analytics — sab
          // us campaign ke Analytics page par hai, wizard par nahi. Ek draft
          // edit karte waqt wahan tak ek click me pahunchna chahiye, warna
          // sirf "..." row action se hi mil pata (aasani se miss ho jaata hai).
          isEditing ? (
            <Link to={`/campaigns/${editId}`} className="btn btn-outline-primary">
              <i className="bi bi-graph-up me-2" />
              {t('wiz.viewAnalytics')}
            </Link>
          ) : null
        }
      />

      {/* Bina email account ke kuch nahi ja sakta — yeh sabse pehle batana
          zaroori hai, aakhri step par nahi. */}
      {!accountsCall.loading && accounts.length === 0 ? (
        <Note tone="warning" icon="bi-exclamation-triangle">
          {t('wiz.noAccountNote')}
        </Note>
      ) : null}

      {error ? (
        <Note tone="warning" icon="bi-exclamation-triangle">
          {error}
        </Note>
      ) : null}

      <Card flush>
        <Stepper steps={wizardSteps} current={step} onJump={jumpToStep} ariaLabel={t('wiz.steps')} />

        <div className="mw-card__body">
          {step === 0 ? (
            <StepInfo draft={draft} onChange={updateDraft} accounts={accounts} showErrors={showErrors} />
          ) : null}
          {step === 1 ? (
            <StepRecipients
              draft={draft}
              onChange={updateDraft}
              filterMatchCount={filterMatchCount}
              countingRecipients={countingRecipients}
              contactGroups={contactGroups}
              segments={segments}
              showErrors={showErrors}
            />
          ) : null}
          {step === 2 ? (
            <StepTemplate draft={draft} onChange={updateDraft} category={category} onCategoryChange={setCategory} onNext={goNext} />
          ) : null}
          {step === 3 ? <StepContent draft={draft} onChange={updateDraft} showErrors={showErrors} /> : null}
          {step === 4 ? (
            <StepSettings
              draft={draft}
              onChange={updateDraft}
              recipientCount={willReach}
              account={selectedAccount}
              showErrors={showErrors}
            />
          ) : null}
          {step === 5 ? <StepReview draft={draft} recipientCount={willReach} onSend={openConfirm} /> : null}
        </div>

        <div className="mw-wizard-foot">
          <button type="button" className="btn btn-outline-secondary" onClick={goBack} disabled={step === 0}>
            <i className="bi bi-arrow-left me-2" />
            {t('common.back')}
          </button>

          <span className="mw-fs-12 mw-text-muted ms-auto mw-hide-mobile">
            {t('wiz.stepCounter', {
              current: step + 1,
              total: wizardSteps.length,
              label: t(wizardSteps[step].labelKey),
            })}
          </span>

          {step < wizardSteps.length - 1 ? (
            <button type="button" className="btn btn-primary ms-auto ms-md-3" onClick={goNext}>
              {t('common.continue')}
              <i className="bi bi-arrow-right ms-2" />
            </button>
          ) : (
            <div className="d-flex gap-2 ms-auto ms-md-3">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={handleSaveDraftClick}
                disabled={busy || accounts.length === 0}
              >
                <i className="bi bi-file-earmark me-2" />
                {busy ? t('common.loading') : t('wiz.saveAsDraft')}
              </button>
              <button type="button" className="btn btn-primary" onClick={openConfirm} disabled={busy || accounts.length === 0}>
                <i className="bi bi-send me-2" />
                {busy ? t('common.loading') : t('wiz.send')}
              </button>
            </div>
          )}
        </div>
      </Card>

      <Sheet
        open={confirmOpen}
        title={t('wiz.confirmTitle')}
        onClose={closeConfirm}
        footer={
          <>
            <button type="button" className="btn btn-outline-secondary flex-fill" onClick={closeConfirm}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn btn-primary flex-fill" onClick={startSending} disabled={busy}>
              {busy ? t('common.loading') : t('wiz.confirmYes')}
            </button>
          </>
        }
      >
        <p className="mw-fs-14 mb-3">
          {isScheduled
            ? t('wiz.confirmSchedule', {
                name: draft.name,
                count: formatNumber(willReach),
                when: formatDateTime(toServerTime(draft.scheduleAt)),
              })
            : t('wiz.confirmBody', {
                name: draft.name,
                count: formatNumber(willReach),
                account: draft.account,
              })}
        </p>
        <p className="mw-fs-13 mw-text-muted mb-0">
          {t('wiz.confirmNote', { size: formatNumber(draft.batchSize), delay: draft.batchDelay })}
        </p>
      </Sheet>
    </div>
  );
}

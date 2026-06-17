// PhotoQuote v2 — priority flow: Camera (photo-first + voice), Estimate (AI + editing), Attach client
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { Icon } from '../Icon';
import { colors, fonts, radii, shadow } from '../theme';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { buildStarterEstimate, calcTotals, fmt, LineItem, split } from '../data';
import { MAX_AI_PHOTOS, requestEstimate, transcribeAudio } from '../lib/ai';
import { createClient, createJob, fetchClients, fetchCompanyProfile, getMyLocation, lookupZip, Region } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Avatar, Between, Btn, Card, Chip, CatChip, DecimalInput, Divider, Field, Input, Nav, NavBtn, Row, SearchBar, SectionTitle, Sheet, Switch, useStore } from '../ui';

type NavProp = { go: (n: string, p?: any, mode?: string) => void; back: () => void; params?: any };
const scroll = { paddingHorizontal: 20, paddingBottom: 120 };
const actionbar = { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 };

const SERVICE_7 = ['Painting', 'Roofing', 'Flooring', 'Drywall', 'Plumbing', 'Electrical', 'Carpentry'];

/* ---------------- CAMERA (photo-first, dark) ---------------- */
export function CameraScreen({ go, back }: NavProp) {
  const { store, up } = useStore();
  const photos = store.photos || [];
  const svcs = store.svcs || [];
  const toggle = (s: string) => up((st) => ({ svcs: st.svcs.includes(s) ? st.svcs.filter((x) => x !== s) : [...st.svcs, s] }));

  // live camera (expo-camera) — request camera + mic permission as soon as the screen opens
  const camRef = useRef<CameraView>(null);
  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [, requestMicPerm] = useMicrophonePermissions();
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [capturing, setCapturing] = useState(false);
  useEffect(() => {
    (async () => { await requestCamPerm(); await requestMicPerm(); })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // job location → regional cost multiplier (applied to the estimate prices when generating)
  const zip = store.aZip || '';
  const loc = store.aLoc;
  const [zipBusy, setZipBusy] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const setRegion = (r: Region | null) =>
    r
      ? up({ aZip: r.zip, aLoc: { city: [r.city, r.state].filter(Boolean).join(', '), region: r.label }, regionMult: r.multiplier, regionState: r.state })
      : up({ aLoc: null, regionMult: 1, regionState: '' });
  const onZip = async (z: string) => {
    const clean = z.replace(/\D/g, '').slice(0, 5);
    up({ aZip: clean });
    if (clean.length < 5) { setRegion(null); return; }
    setZipBusy(true);
    const r = await lookupZip(clean);
    setZipBusy(false);
    setRegion(r);
  };
  const onGps = async () => {
    setGpsBusy(true);
    const r = await getMyLocation();
    setGpsBusy(false);
    if (!r) { Alert.alert('Location unavailable', 'Allow location access, or enter the ZIP manually.'); return; }
    setRegion(r);
  };

  const addAssets = (assets: { uri: string }[]) =>
    up((st) => ({ photos: [...st.photos, ...assets.map((a) => ({ uri: a.uri }))].slice(0, 30) }));

  // capture straight from the live preview
  const takePhoto = async () => {
    if (!camRef.current || capturing) return;
    try {
      setCapturing(true);
      const p = await camRef.current.takePictureAsync({ quality: 0.8 });
      if (p?.uri) addAssets([{ uri: p.uri }]);
    } catch (e: any) {
      Alert.alert('Could not take the photo', e?.message || 'Try again.');
    } finally {
      setCapturing(false);
    }
  };

  const pickLibrary = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 30, quality: 0.8 });
    if (!res.canceled) addAssets(res.assets);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0C1116' }}>
      {/* live camera view */}
      <View style={{ flex: 1 }}>
        {camPerm?.granted ? (
          <CameraView ref={camRef} style={{ flex: 1 }} facing={facing} />
        ) : (
          <LinearGradient colors={['#2A3340', '#0C1116']} start={{ x: 0.5, y: 0.1 }} end={{ x: 0.5, y: 1 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
            <View style={{ width: 66, height: 66, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="camera" size={28} color="rgba(255,255,255,0.55)" />
            </View>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 14, textAlign: 'center' }}>
              {camPerm && !camPerm.granted ? 'Camera access needed' : 'Starting camera…'}
            </Text>
            {camPerm && !camPerm.granted ? (
              camPerm.canAskAgain ? (
                <Btn variant="soft" sm icon="camera" title="Allow camera" onPress={() => requestCamPerm()} style={{ marginTop: 14, paddingHorizontal: 18 }} />
              ) : (
                <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: 'rgba(255,255,255,0.4)', marginTop: 8, textAlign: 'center' }}>Enable it in Settings, or pick from your library below.</Text>
              )
            ) : null}
          </LinearGradient>
        )}
        {/* close button overlay */}
        <View style={{ position: 'absolute', top: 50, left: 0, right: 0, paddingHorizontal: 18, flexDirection: 'row', justifyContent: 'space-between' }}>
          <CamSide icon="x" onPress={back} />
        </View>
      </View>

      {/* photo strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingVertical: 14 }}>
        {photos.map((p, i) => (
          <View key={`${p.uri}-${i}`}>
            <Image source={{ uri: p.uri }} style={{ width: 56, height: 56, borderRadius: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.18)' }} />
            <Pressable
              onPress={() => up((st) => ({ photos: st.photos.filter((_, x) => x !== i) }))}
              style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: '#0C1116', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)' }}
            >
              <Icon name="x" size={12} sw={3} color="#fff" />
            </Pressable>
          </View>
        ))}
        <Pressable onPress={takePhoto} style={{ width: 56, height: 56, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{photos.length}/30</Text>
        </Pressable>
      </ScrollView>

      {/* controls */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 28, paddingBottom: 14, paddingTop: 4 }}>
        <CamSide icon="image" big onPress={pickLibrary} />
        <Pressable
          onPress={takePhoto}
          disabled={capturing || !camPerm?.granted}
          style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#fff', borderWidth: 5, borderColor: 'rgba(255,255,255,0.35)', opacity: capturing || !camPerm?.granted ? 0.5 : 1, alignItems: 'center', justifyContent: 'center' }}
        >
          {capturing ? <ActivityIndicator color="#0C1116" /> : null}
        </Pressable>
        <CamSide icon="flip" big onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))} />
      </View>

      {/* bottom sheet card */}
      <ScrollView style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: 380 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 26 }} keyboardShouldPersistTaps="handled">
        <Row style={{ gap: 6 }}>
          <Text style={{ fontFamily: fonts.extrabold, fontSize: 13, color: colors.ink, letterSpacing: 0.5 }}>SERVICE TYPES</Text>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.muted }}>· helps the AI</Text>
        </Row>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2, marginTop: 12 }}>
          {SERVICE_7.map((s) => (
            <Chip key={s} label={s} selected={svcs.includes(s)} onPress={() => toggle(s)} />
          ))}
          <Chip label="Custom" icon="plus" />
        </ScrollView>
        <DescriptionInput />

        {/* job location → regional pricing */}
        <Row style={{ gap: 8, marginTop: 16, alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Input placeholder="ZIP — sets regional pricing" keyboardType="number-pad" value={zip} onChangeText={onZip} maxLength={5} />
          </View>
          <Pressable onPress={onGps} disabled={gpsBusy} style={{ width: 50, height: 50, borderRadius: 13, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' }}>
            {gpsBusy ? <ActivityIndicator size="small" color={colors.primary} /> : <Icon name="gps" size={20} color={colors.primary} />}
          </Pressable>
        </Row>
        {zipBusy ? (
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, marginTop: 7 }}>Looking up ZIP…</Text>
        ) : loc ? (
          <Row style={{ gap: 6, marginTop: 8 }}>
            <Icon name="mapPin" size={13} color={colors.primary} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.ink }}>{loc.city}</Text>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted }}>
              · {store.regionMult === 1 ? 'Standard pricing' : `${loc.region} ${store.regionMult > 1 ? '+' : ''}${Math.round((store.regionMult - 1) * 100)}%`}
            </Text>
          </Row>
        ) : null}

        <Btn title="Generate estimate" icon="sparkles" disabled={!photos.length} onPress={() => go('estimate', { fresh: true })} style={{ marginTop: 16 }} />
      </ScrollView>
    </View>
  );
}
function CamSide({ icon, onPress, big }: { icon: string; onPress?: () => void; big?: boolean }) {
  const s = big ? 52 : 40;
  return (
    <Pressable onPress={onPress} style={{ width: s, height: s, borderRadius: big ? 15 : 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={big ? 22 : 20} color="#fff" />
    </Pressable>
  );
}

/* ---------------- DESCRIPTION (type OR record voice) ---------------- */
export function DescriptionInput() {
  const { store, up } = useStore();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [mode, setMode] = useState<'idle' | 'recording' | 'transcribing'>('idle');
  const [secs, setSecs] = useState(0);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (mode === 'recording') {
      const t = setInterval(() => setSecs((s) => s + 1), 1000);
      return () => clearInterval(t);
    }
  }, [mode]);
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const bars = [...Array(28)].map((_, i) => 7 + ((i * 11 + 9) % 21));

  const startRec = async () => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) { Alert.alert('Microphone access needed', 'Allow microphone access to dictate a voice note.'); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setErr(''); setSecs(0); setMode('recording');
    } catch (e: any) {
      Alert.alert('Could not start recording', e?.message || 'Try again.');
    }
  };

  // stop → transcribe (OpenAI via Edge Function) → append the text into the description
  const stopRec = async () => {
    setMode('transcribing');
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error('No recording captured.');
      const r = await transcribeAudio(uri);
      if (r.ok) {
        const prev = (store.descText || '').trim();
        up({ descText: prev ? `${prev} ${r.text}` : r.text });
      } else {
        setErr(r.error);
      }
    } catch (e: any) {
      setErr(e?.message || 'Could not transcribe the recording.');
    } finally {
      setMode('idle');
    }
  };

  if (mode === 'recording') {
    return (
      <View style={{ marginTop: 16 }}>
        <View style={[voicebar, { backgroundColor: colors.errorTint, borderColor: 'transparent' }]}>
          <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: colors.error }} />
          <Wave bars={bars} color={colors.error} />
          <Text style={{ fontFamily: fonts.num, fontSize: 12.5, color: colors.error }}>{mmss(secs)}</Text>
          <Pressable onPress={stopRec} style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 15, height: 15, borderRadius: 4, backgroundColor: '#fff' }} />
          </Pressable>
        </View>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, marginTop: 9, textAlign: 'center' }}>Recording… tap ◼ to stop & transcribe</Text>
      </View>
    );
  }

  if (mode === 'transcribing') {
    return (
      <View style={{ marginTop: 16 }}>
        <View style={voicebar}>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 13, color: colors.ink }}>Transcribing your note…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ marginTop: 16 }}>
      <Row style={{ gap: 10, alignItems: 'flex-end' }}>
        <TextInput
          multiline
          placeholder="Describe the job (optional)"
          placeholderTextColor={colors.faint}
          value={store.descText || ''}
          onChangeText={(t) => up({ descText: t })}
          style={{ flex: 1, minHeight: 50, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 13, fontSize: 15, fontFamily: fonts.semibold, color: colors.ink, ...shadow.sm }}
        />
        <Pressable onPress={startRec} style={mic}><Icon name="mic" size={22} color={colors.primary} /></Pressable>
      </Row>
      <Row style={{ gap: 6, marginTop: 9 }}>
        <Icon name={err ? 'flag' : 'mic'} size={13} color={err ? colors.error : colors.muted} />
        <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 12, color: err ? colors.error : colors.muted }}>
          {err || 'Or tap the mic to dictate — we’ll transcribe it into the description.'}
        </Text>
      </Row>
    </View>
  );
}
const voicebar = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingVertical: 11, paddingHorizontal: 13, ...shadow.sm };
const mic = { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.primaryTint, alignItems: 'center' as const, justifyContent: 'center' as const };
function Wave({ bars, color }: { bars: number[]; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, height: 34, flex: 1 }}>
      {bars.map((h, i) => (
        <View key={i} style={{ width: 3, height: h, borderRadius: 3, backgroundColor: color }} />
      ))}
    </View>
  );
}

/* ---------------- ESTIMATE (AI + editing) ---------------- */
type EstPhase = 'analyzing' | 'done' | 'rejected' | 'error';

export function EstimateScreen({ go, back, params }: NavProp) {
  const { store, up } = useStore();
  const items = store.items || [];
  const taxRate = store.taxRate ?? 8.25;
  const marginRate = store.marginRate ?? 0;
  const editing = store.editing;
  const count = (store.photos || []).length;
  const analyzed = Math.min(count, MAX_AI_PHOTOS); // how many actually went to the AI

  // Real AI flow: call the ai-estimate Edge Function once when arriving fresh from the camera.
  // Guard on items.length so navigating back INTO this screen doesn't re-run the AI or wipe edits
  // (the lightweight Navigator remounts a screen each time it becomes the stack top).
  const needsAI = !!(params && params.fresh) && (store.items?.length || 0) === 0;
  const [phase, setPhase] = useState<EstPhase>(needsAI ? 'analyzing' : 'done');
  const [reason, setReason] = useState(''); // rejection reason or error message
  const ranRef = useRef(false);

  // pre-fill tax/margin from the company defaults on a fresh estimate (once the profile loads)
  const { user } = useAuth();
  const { data: companyProfile } = useQuery({ queryKey: ['company', user?.id], queryFn: () => fetchCompanyProfile(user!.id), enabled: !!user?.id });
  const defaultsRef = useRef(false);
  useEffect(() => {
    const p = companyProfile as any;
    if (needsAI && p && !defaultsRef.current) {
      defaultsRef.current = true;
      const patch: Partial<{ taxRate: number; marginRate: number }> = {};
      // only seed while still at the initial defaults — never clobber a manual edit made before the profile loaded
      if (store.taxRate === 8.25 && p.default_tax_percent != null) patch.taxRate = Number(p.default_tax_percent);
      if (store.marginRate === 0 && p.default_margin_percent != null) patch.marginRate = Number(p.default_margin_percent);
      if (Object.keys(patch).length) up(patch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyProfile, needsAI]);

  const runAI = async () => {
    setPhase('analyzing');
    setReason('');
    const r = await requestEstimate({ photos: store.photos, services: store.svcs, description: store.descText, regionMult: store.regionMult });
    if (r.ok) {
      up({ items: r.items, confidence: r.confidence, aiNotes: r.notes });
      setPhase('done');
    } else if ('error' in r) {
      setReason(r.error);
      setPhase('error');
    } else {
      setReason(r.reason);
      setPhase('rejected');
    }
  };

  useEffect(() => {
    if (needsAI && !ranRef.current) {
      ranRef.current = true;
      runAI();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const analyzing = phase === 'analyzing';
  const conf = Math.round(store.confidence || 0);
  const showEstimate = phase === 'done' || analyzing;
  const t = calcTotals(items, taxRate, marginRate);
  const [d, c] = split(t.total);
  const updateItem = (id: number, patch: Partial<LineItem>) => up((st) => ({ items: st.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }));
  const removeItem = (id: number) => up((st) => ({ items: st.items.filter((it) => it.id !== id), editing: null }));
  const addItem = () => {
    const it: LineItem = { id: Date.now(), cat: 'Labor', desc: 'New line item', qty: 1, unit: 'ea', price: 0, taxable: false };
    up((st) => ({ items: [...st.items, it], editing: it }));
  };

  return (
    <>
      <Nav title="Estimate" center onBack={back} right={<NavBtn icon="share" size={17} />} />
      <ScrollView contentContainerStyle={scroll} showsVerticalScrollIndicator={false}>
        {/* AI status banner */}
        {analyzing ? (
          <LinearGradient colors={[colors.primaryTint, colors.card]} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, borderRadius: radii.lg, padding: 16, borderWidth: 1, borderColor: colors.primaryTint2 }}>
            <ActivityIndicator color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.extrabold, fontSize: 14.5, color: colors.ink }}>Analyzing {analyzed} {analyzed === 1 ? 'photo' : 'photos'}…</Text>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted, marginTop: 2 }}>Reading surfaces, materials & scope</Text>
            </View>
          </LinearGradient>
        ) : phase === 'rejected' ? (
          <Card style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 13, padding: 16 }}>
            <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: colors.errorTint, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="flag" size={20} color={colors.error} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.extrabold, fontSize: 14.5, color: colors.ink }}>These don’t look like job photos</Text>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted, marginTop: 3, lineHeight: 18 }}>{reason}</Text>
              <Btn variant="soft" sm icon="camera" title="Retake photos" onPress={back} style={{ marginTop: 12, alignSelf: 'flex-start', paddingHorizontal: 16 }} />
            </View>
          </Card>
        ) : phase === 'error' ? (
          <Card style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 13, padding: 16 }}>
            <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: colors.errorTint, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="flag" size={20} color={colors.error} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.extrabold, fontSize: 14.5, color: colors.ink }}>Couldn’t generate the estimate</Text>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted, marginTop: 3, lineHeight: 18 }}>{reason}</Text>
              <Row style={{ gap: 10, marginTop: 12 }}>
                <Btn variant="soft" sm icon="sparkles" title="Try again" onPress={runAI} style={{ paddingHorizontal: 16 }} />
                <Btn variant="ghost" sm title="Starter estimate" onPress={() => { up({ items: buildStarterEstimate(store.svcs, store.regionMult), confidence: 0, aiNotes: 'Starter estimate (AI unavailable) — review and edit the items below.' }); setPhase('done'); }} style={{ paddingHorizontal: 16 }} />
              </Row>
            </View>
          </Card>
        ) : (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 13, padding: 14 }}>
            <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="sparkles" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.extrabold, fontSize: 14.5, color: colors.ink }}>AI analyzed {analyzed} {analyzed === 1 ? 'photo' : 'photos'}</Text>
              <Text numberOfLines={2} style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted, marginTop: 2, lineHeight: 17 }}>{store.aiNotes || 'Review the items below and adjust as needed.'}</Text>
            </View>
            {conf > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: 9, borderRadius: radii.pill, backgroundColor: colors.accentTint, borderWidth: 1, borderColor: colors.accentBorder }}>
                <Icon name="check" size={12} sw={2.6} color={colors.accentInk} />
                <Text style={{ fontFamily: fonts.extrabold, fontSize: 11, color: colors.accentInk }}>{conf}%</Text>
              </View>
            ) : null}
          </Card>
        )}

        {showEstimate ? (
        <>
        {/* hero total */}
        <View style={{ paddingHorizontal: 4, paddingTop: 22 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.4, color: colors.muted }}>ESTIMATED TOTAL</Text>
          {analyzing ? (
            <View style={{ height: 48, width: 220, marginTop: 10, borderRadius: 8, backgroundColor: '#EEF1F4' }} />
          ) : (
            <Text style={{ fontFamily: fonts.num, fontSize: 52, color: colors.ink, marginTop: 10, letterSpacing: -1.2 }}>
              {d}<Text style={{ color: colors.muted }}>{c}</Text>
            </Text>
          )}
          {!analyzing ? (
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, marginTop: 12 }}>
              Subtotal <Text style={{ fontFamily: fonts.bold, color: colors.ink }}>{fmt(t.subtotal)}</Text> · Tax ({taxRate}%) <Text style={{ fontFamily: fonts.bold, color: colors.ink }}>{fmt(t.tax)}</Text>
            </Text>
          ) : null}
          {!analyzing && store.regionMult !== 1 && store.aLoc ? (
            <Row style={{ gap: 6, marginTop: 8 }}>
              <Icon name="mapPin" size={13} color={colors.accentInk} />
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted }}>
                {store.aLoc.city} · regional pricing {store.regionMult > 1 ? '+' : ''}{Math.round((store.regionMult - 1) * 100)}% applied
              </Text>
            </Row>
          ) : null}
        </View>

        <SectionTitle title="Line items" link="Add" onLink={addItem} />
        {analyzing ? (
          <View style={{ gap: 10 }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={{ height: 84, borderRadius: radii.r, backgroundColor: '#EEF1F4' }} />
            ))}
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {items.map((it) => (
              <Pressable key={it.id} onPress={() => up({ editing: it })}>
                <Card style={{ padding: 14 }}>
                  <Between>
                    <CatChip label={it.cat} />
                    <Text style={{ fontFamily: fonts.extrabold, fontSize: 16, color: colors.ink }}>{fmt(it.qty * it.price)}</Text>
                  </Between>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink, marginTop: 9 }}>{it.desc}</Text>
                  <Between style={{ marginTop: 7 }}>
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted }}>{it.qty} {it.unit} × {fmt(it.price)}</Text>
                    <View style={{ paddingVertical: 4, paddingHorizontal: 9, borderRadius: radii.pill, backgroundColor: it.taxable ? colors.primaryTint : '#EEF1F4' }}>
                      <Text style={{ fontFamily: fonts.extrabold, fontSize: 11, color: it.taxable ? colors.primary : colors.faint }}>{it.taxable ? 'Taxable' : 'No tax'}</Text>
                    </View>
                  </Between>
                </Card>
              </Pressable>
            ))}
          </View>
        )}

        {!analyzing ? (
          <Card pad style={{ marginTop: 16 }}>
            <Between>
              <Row style={{ gap: 9 }}>
                <Icon name="percent" size={17} color={colors.muted} />
                <Text style={{ fontFamily: fonts.extrabold, fontSize: 14, color: colors.ink }}>Tax rate</Text>
              </Row>
              <Stepper value={`${taxRate}%`} onMinus={() => up({ taxRate: Math.max(0, +(taxRate - 0.25).toFixed(2)) })} onPlus={() => up({ taxRate: +(taxRate + 0.25).toFixed(2) })} />
            </Between>
            <Divider />
            <Between>
              <Row style={{ gap: 9 }}>
                <Icon name="lock" size={16} color={colors.accentInk} />
                <View>
                  <Text style={{ fontFamily: fonts.extrabold, fontSize: 14, color: colors.ink }}>Internal markup</Text>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted }}>Hidden from client</Text>
                </View>
              </Row>
              <Stepper value={`${marginRate}%`} onMinus={() => up({ marginRate: Math.max(0, marginRate - 5) })} onPlus={() => up({ marginRate: marginRate + 5 })} />
            </Between>
          </Card>
        ) : null}
        </>
        ) : null}
      </ScrollView>
      <View style={actionbar}>
        <Btn title="Continue" icon="arrowRight" disabled={phase !== 'done'} onPress={() => go('attach', {})} />
      </View>

      <Sheet open={!!editing} onClose={() => up({ editing: null })} title="Edit item">
        {editing ? (
          <ItemEditor
            it={editing}
            onChange={(p) => { updateItem(editing.id, p); up({ editing: { ...editing, ...p } }); }}
            onRemove={() => removeItem(editing.id)}
            onDone={() => up({ editing: null })}
          />
        ) : null}
      </Sheet>
    </>
  );
}

function Stepper({ value, onMinus, onPlus }: { value: string; onMinus: () => void; onPlus: () => void }) {
  return (
    <Row style={{ gap: 8 }}>
      <NavBtn icon="back" size={14} onPress={onMinus} />
      <Text style={{ fontFamily: fonts.num, fontSize: 15, color: colors.ink, width: 54, textAlign: 'center' }}>{value}</Text>
      <NavBtn icon="fwd" size={14} onPress={onPlus} />
    </Row>
  );
}

function ItemEditor({ it, onChange, onRemove, onDone }: { it: LineItem; onChange: (p: Partial<LineItem>) => void; onRemove: () => void; onDone: () => void }) {
  const cats = ['Labor', 'Materials', 'Service', 'Equipment'];
  return (
    <View>
      <Field label="Description"><Input value={it.desc} onChangeText={(v) => onChange({ desc: v })} /></Field>
      <Field label="Category">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {cats.map((cc) => <Chip key={cc} label={cc} selected={it.cat === cc} onPress={() => onChange({ cat: cc })} />)}
        </ScrollView>
      </Field>
      <Row style={{ gap: 10, alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}><Field label="Qty"><DecimalInput value={it.qty} onChangeValue={(v) => onChange({ qty: v })} /></Field></View>
        <View style={{ flex: 1 }}><Field label="Unit"><Input value={it.unit} onChangeText={(v) => onChange({ unit: v })} /></Field></View>
        <View style={{ flex: 1 }}><Field label="Unit price"><DecimalInput value={it.price} onChangeValue={(v) => onChange({ price: v })} /></Field></View>
      </Row>
      <Between style={{ backgroundColor: colors.bg, borderRadius: radii.lg, padding: 16 }}>
        <View>
          <Text style={{ fontFamily: fonts.extrabold, fontSize: 14, color: colors.ink }}>Taxable</Text>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted }}>Apply sales tax to this item</Text>
        </View>
        <Switch on={it.taxable} onPress={() => onChange({ taxable: !it.taxable })} />
      </Between>
      <Row style={{ gap: 10, marginTop: 16 }}>
        <Btn variant="danger" sm icon="trash" onPress={onRemove} style={{ width: 54 }} />
        <Btn title={`Done · ${fmt(it.qty * it.price)}`} onPress={onDone} style={{ flex: 1 }} />
      </Row>
    </View>
  );
}

/* ---------------- ATTACH CLIENT ---------------- */
export function AttachScreen({ go, back }: NavProp) {
  const { store, up } = useStore();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const q = store.aQ || '';
  const sel = store.aSel;
  const loc = store.aLoc; // captured on the setup screen (for the project's city fallback)
  const [saving, setSaving] = useState(false);

  // search the user's REAL clients (was a mock list before)
  const { data: clients = [] } = useQuery({ queryKey: ['clients', user?.id], queryFn: () => fetchClients(user!.id), enabled: !!user?.id });
  const ql = q.toLowerCase();
  const results = q
    ? clients.filter((c) => c.name.toLowerCase().includes(ql) || (c.phone || '').includes(q) || (c.email || '').toLowerCase().includes(ql))
    : [];
  // existing client → its real id; quick-add (name only) → create it first
  async function resolveClientId(): Promise<string | null> {
    if (!sel || !user?.id) return null;
    if (sel.id) return sel.id;
    const created = await createClient(user.id, { name: sel.name || 'New client' });
    return created.id;
  }

  async function onSave(skipClient = false) {
    if (!store.items.length) { Alert.alert('Nothing to save', 'Generate an estimate first.'); return; }
    if (!user?.id) { Alert.alert('Not signed in', 'Please sign in again.'); return; }
    setSaving(true);
    try {
      const clientId = skipClient ? null : await resolveClientId(); // client is optional
      const client = skipClient ? null : sel; // for address/city autofill
      const { projectId } = await createJob({
        userId: user.id,
        clientId,
        name: store.svcs[0] ? `${store.svcs[0]} job` : 'New estimate',
        address: client?.addr || undefined,
        city: client?.city || loc?.city || undefined,
        taxRate: store.taxRate ?? 8.25,
        marginRate: store.marginRate ?? 0,
        confidence: store.confidence,
        notes: store.aiNotes,
        services: store.svcs,
        items: store.items,
        photos: store.photos,
        zip: store.aZip || undefined,
        state: store.regionState || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ['jobs'] });
      await queryClient.invalidateQueries({ queryKey: ['clients'] });
      go('job', { id: projectId });
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Nav title="Add client" sub="Optional — you can do this later" center onBack={back} />
      <ScrollView contentContainerStyle={scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <SectionTitle title="Client" />
        {!sel ? (
          <>
            <SearchBar placeholder="Search name, phone or email" value={q} onChangeText={(t) => up({ aQ: t })} />
            {results.length > 0 ? (
              <Card style={{ paddingHorizontal: 16, marginTop: 12 }}>
                {results.map((c, idx) => (
                  <Pressable key={c.id} onPress={() => up({ aSel: c })} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 14, borderBottomWidth: idx === results.length - 1 ? 0 : 1, borderBottomColor: colors.border }}>
                    <Avatar text={c.name.split(' ').map((w) => w[0]).slice(0, 2).join('')} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: fonts.extrabold, fontSize: 15, color: colors.ink }}>{c.name}</Text>
                      <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted, marginTop: 2 }}>{c.phone} · {c.jobs} jobs</Text>
                    </View>
                    <Icon name="plus" size={18} color={colors.primary} />
                  </Pressable>
                ))}
              </Card>
            ) : q ? (
              <Card pad style={{ marginTop: 12, alignItems: 'center' }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted }}>No client named "{q}"</Text>
                <Row style={{ gap: 10, marginTop: 12 }}>
                  <Btn variant="soft" sm icon="zap" title="Add quick" onPress={() => up({ aSel: { name: q || 'New client', quick: true } })} style={{ flex: 1 }} />
                  <Btn variant="ghost" sm title="Full form" onPress={() => go('clientEdit', { from: 'attach' })} style={{ flex: 1 }} />
                </Row>
              </Card>
            ) : (
              <Row style={{ gap: 10, marginTop: 12 }}>
                <Btn variant="soft" sm icon="zap" title="Add quick" onPress={() => up({ aSel: { name: 'New client', quick: true } })} style={{ flex: 1 }} />
                <Btn variant="ghost" sm icon="user" title="Full form" onPress={() => go('clientEdit', { from: 'attach' })} style={{ flex: 1 }} />
              </Row>
            )}
          </>
        ) : (
          <Card pad>
            <Between>
              <Row style={{ gap: 12 }}>
                <Avatar text={sel.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('')} />
                <View>
                  <Text style={{ fontFamily: fonts.extrabold, fontSize: 16, color: colors.ink }}>{sel.name}</Text>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted }}>{sel.quick ? 'Quick add — name only' : `${sel.phone} · ${sel.email}`}</Text>
                </View>
              </Row>
              <NavBtn icon="x" size={17} onPress={() => up({ aSel: null })} />
            </Between>
            {!sel.quick ? (
              <>
                <Divider />
                <Row style={{ gap: 6 }}>
                  <Icon name="mapPin" size={13} color={colors.muted} />
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted }}>{sel.addr}, {sel.city} · pulled automatically</Text>
                </Row>
              </>
            ) : null}
          </Card>
        )}

        {loc ? (
          <>
            <SectionTitle title="Job location" />
            <Card pad style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.primaryTint, borderWidth: 0 }}>
              <Icon name="mapPin" size={17} color={colors.primary} />
              <Text style={{ flex: 1, fontFamily: fonts.extrabold, fontSize: 14, color: colors.ink }}>{loc.city}</Text>
              {store.regionMult !== 1 ? (
                <View style={{ paddingVertical: 5, paddingHorizontal: 9, borderRadius: radii.pill, backgroundColor: colors.accentTint, borderWidth: 1, borderColor: colors.accentBorder }}>
                  <Text style={{ fontFamily: fonts.extrabold, fontSize: 11, color: colors.accentInk }}>{loc.region} {store.regionMult > 1 ? '+' : ''}{Math.round((store.regionMult - 1) * 100)}%</Text>
                </View>
              ) : null}
            </Card>
          </>
        ) : null}
      </ScrollView>
      <View style={actionbar}>
        <Row style={{ gap: 10 }}>
          <Btn variant="ghost" title="Skip" disabled={saving} onPress={() => onSave(true)} style={{ flex: 0.4 }} />
          <Btn title={saving ? 'Saving…' : 'Save job'} icon={saving ? undefined : 'arrowRight'} disabled={saving} onPress={() => onSave(false)} style={{ flex: 1 }} />
        </Row>
      </View>
    </>
  );
}

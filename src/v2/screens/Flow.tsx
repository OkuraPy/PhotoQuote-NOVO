// PhotoQuote v2 — priority flow: Camera (photo-first + voice), Estimate (AI + editing), Attach client
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '../Icon';
import { colors, fonts, radii, shadow } from '../theme';
import { calcTotals, CLIENTS, fmt, LineItem, split } from '../data';
import { Avatar, Between, Btn, Card, Chip, CatChip, Divider, Field, Input, Nav, NavBtn, Row, SearchBar, SectionTitle, Sheet, Switch, useStore } from '../ui';

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
  return (
    <View style={{ flex: 1, backgroundColor: '#0C1116' }}>
      {/* camera view */}
      <LinearGradient colors={['#2A3340', '#0C1116']} start={{ x: 0.5, y: 0.1 }} end={{ x: 0.5, y: 1 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ alignItems: 'center' }}>
          <Icon name="camera" size={30} color="rgba(255,255,255,0.35)" />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 8 }}>Point at the work area</Text>
        </View>
        <View style={{ position: 'absolute', top: 50, left: 0, right: 0, paddingHorizontal: 18, flexDirection: 'row', justifyContent: 'space-between' }}>
          <CamSide icon="x" onPress={back} />
          <CamSide icon="zap" />
        </View>
      </LinearGradient>

      {/* photo strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingVertical: 14 }}>
        {photos.map((p, i) => (
          <View key={i}>
            <LinearGradient colors={['#CBD5D0', '#E9EEEB']} style={{ width: 56, height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.18)' }}>
              <Icon name="image" size={18} color="rgba(255,255,255,0.7)" />
            </LinearGradient>
            <Pressable
              onPress={() => up((st) => ({ photos: st.photos.filter((_, x) => x !== i) }))}
              style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: '#0C1116', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)' }}
            >
              <Icon name="x" size={12} sw={3} color="#fff" />
            </Pressable>
          </View>
        ))}
        <View style={{ width: 56, height: 56, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{photos.length}/30</Text>
        </View>
      </ScrollView>

      {/* controls */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 28, paddingBottom: 14, paddingTop: 4 }}>
        <CamSide icon="image" big />
        <Pressable
          onPress={() => up((st) => ({ photos: [...st.photos, (st.photos[st.photos.length - 1] || 0) + 1] }))}
          style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#fff', borderWidth: 5, borderColor: 'rgba(255,255,255,0.35)' }}
        />
        <CamSide icon="camera" big />
      </View>

      {/* bottom sheet card */}
      <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 26, maxHeight: 320 }}>
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
        <Btn title="Generate estimate" icon="sparkles" disabled={!photos.length} onPress={() => go('estimate', { fresh: true, count: photos.length })} style={{ marginTop: 16 }} />
      </View>
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
  const [rec, setRec] = useState<'idle' | 'recording'>('idle');
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (rec === 'recording') {
      const t = setInterval(() => setSecs((s) => s + 1), 1000);
      return () => clearInterval(t);
    }
  }, [rec]);
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const bars = [...Array(28)].map((_, i) => 7 + ((i * 11 + 9) % 21));

  if (store.voice) {
    return (
      <View style={{ marginTop: 16 }}>
        <View style={voicebar}>
          <Pressable style={[mic, { width: 42, height: 42 }]}><Icon name="play" size={17} color={colors.primary} /></Pressable>
          <Wave bars={bars} color={colors.primary} />
          <Text style={{ fontFamily: fonts.num, fontSize: 12.5, color: colors.ink }}>{store.voice.dur}</Text>
          <NavBtn icon="trash" size={15} onPress={() => up({ voice: null })} />
        </View>
        <Row style={{ gap: 6, marginTop: 9 }}>
          <Icon name="sparkles" size={13} color={colors.accentInk} />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted }}>Voice note — AI will transcribe it into the description.</Text>
        </Row>
      </View>
    );
  }
  if (rec === 'recording') {
    return (
      <View style={{ marginTop: 16 }}>
        <View style={[voicebar, { backgroundColor: colors.errorTint, borderColor: 'transparent' }]}>
          <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: colors.error }} />
          <Wave bars={bars} color={colors.error} />
          <Text style={{ fontFamily: fonts.num, fontSize: 12.5, color: colors.error }}>{mmss(secs)}</Text>
          <Pressable onPress={() => { up({ voice: { dur: mmss(Math.max(secs, 1)) } }); setRec('idle'); }} style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 15, height: 15, borderRadius: 4, backgroundColor: '#fff' }} />
          </Pressable>
        </View>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, marginTop: 9, textAlign: 'center' }}>Recording… tap ◼ to stop</Text>
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
        <Pressable onPress={() => { setSecs(0); setRec('recording'); }} style={mic}><Icon name="mic" size={22} color={colors.primary} /></Pressable>
      </Row>
      <Row style={{ gap: 6, marginTop: 9 }}>
        <Icon name="mic" size={13} color={colors.muted} />
        <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted }}>Or tap the mic to record a voice note instead of typing.</Text>
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
export function EstimateScreen({ go, back, params }: NavProp) {
  const { store, up } = useStore();
  const items = store.items || [];
  const taxRate = store.taxRate ?? 8.25;
  const marginRate = store.marginRate ?? 0;
  const editing = store.editing;
  const [analyzing, setAnalyzing] = useState(!!(params && params.fresh));
  const count = (params && params.count) || 6;
  useEffect(() => {
    if (analyzing) {
      const t = setTimeout(() => setAnalyzing(false), 2200);
      return () => clearTimeout(t);
    }
  }, [analyzing]);

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
        {/* AI banner */}
        {analyzing ? (
          <LinearGradient colors={[colors.primaryTint, colors.card]} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, borderRadius: radii.lg, padding: 14, borderWidth: 1, borderColor: colors.primaryTint2 }}>
            <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2.5, borderColor: colors.primaryTint2, borderTopColor: colors.primary }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.extrabold, fontSize: 14.5, color: colors.ink }}>Analyzing {count} photos…</Text>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted, marginTop: 2 }}>Detecting surfaces & scope</Text>
            </View>
          </LinearGradient>
        ) : (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 13, padding: 14 }}>
            <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="sparkles" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.extrabold, fontSize: 14.5, color: colors.ink }}>AI analyzed {count} photos</Text>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted, marginTop: 2 }}>Exterior repaint · 2 surfaces detected</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: 9, borderRadius: radii.pill, backgroundColor: colors.accentTint, borderWidth: 1, borderColor: colors.accentBorder }}>
              <Icon name="check" size={12} sw={2.6} color={colors.accentInk} />
              <Text style={{ fontFamily: fonts.extrabold, fontSize: 11, color: colors.accentInk }}>High confidence</Text>
            </View>
          </Card>
        )}

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
      </ScrollView>
      <View style={actionbar}>
        <Btn title="Continue" icon="arrowRight" disabled={analyzing} onPress={() => go('attach', {})} />
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
        <View style={{ flex: 1 }}><Field label="Qty"><Input keyboardType="decimal-pad" value={String(it.qty)} onChangeText={(v) => onChange({ qty: parseFloat(v) || 0 })} /></Field></View>
        <View style={{ flex: 1 }}><Field label="Unit"><Input value={it.unit} onChangeText={(v) => onChange({ unit: v })} /></Field></View>
        <View style={{ flex: 1 }}><Field label="Unit price"><Input keyboardType="decimal-pad" value={String(it.price)} onChangeText={(v) => onChange({ price: parseFloat(v) || 0 })} /></Field></View>
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
  const q = store.aQ || '';
  const sel = store.aSel;
  const zip = store.aZip || '';
  const loc = store.aLoc;
  const results = q ? CLIENTS.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())) : [];
  const lookupZip = (z: string) => up({ aZip: z, aLoc: z.length >= 5 ? { city: 'Austin, TX', region: '+4% regional' } : null });

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

        <SectionTitle title="Job location" link="sets regional price" />
        <Btn variant="ghost" icon="gps" title="Use my location" onPress={() => up({ aZip: '78701', aLoc: { city: 'Austin, TX', region: '+4% regional' } })} />
        <Input placeholder="or enter ZIP" keyboardType="number-pad" value={zip} onChangeText={lookupZip} style={{ marginTop: 12 }} />
        {loc ? (
          <Card pad style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, backgroundColor: colors.primaryTint, borderWidth: 0 }}>
            <Icon name="check" size={18} color={colors.primary} sw={3} />
            <Text style={{ flex: 1, fontFamily: fonts.extrabold, fontSize: 14, color: colors.ink }}>{loc.city}</Text>
            <View style={{ paddingVertical: 5, paddingHorizontal: 9, borderRadius: radii.pill, backgroundColor: colors.accentTint, borderWidth: 1, borderColor: colors.accentBorder }}>
              <Text style={{ fontFamily: fonts.extrabold, fontSize: 11, color: colors.accentInk }}>{loc.region}</Text>
            </View>
          </Card>
        ) : null}
      </ScrollView>
      <View style={actionbar}>
        <Row style={{ gap: 10 }}>
          <Btn variant="ghost" title="Skip" onPress={() => go('job', { id: 'new' })} style={{ flex: 0.4 }} />
          <Btn title="Save job" icon="arrowRight" onPress={() => go('job', { id: 'new' })} style={{ flex: 1 }} />
        </Row>
      </View>
    </>
  );
}

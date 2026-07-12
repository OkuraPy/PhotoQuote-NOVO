// PhotoQuote v2 — shared UI primitives (ported from handoff app/ui.jsx + styles/app.css) for React Native.
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from './Icon';
import { colors, fonts, radii, shadow, Stage, stageColors } from './theme';
import { registerStrings, useT } from './lib/i18n';

registerStrings({
  'ui.optional': { en: 'optional', es: 'opcional', pt: 'opcional' },
  // pipeline stage labels (the Stage value stays English in logic; only the label is translated)
  'stage.Draft': { en: 'Draft', es: 'Borrador', pt: 'Rascunho' },
  'stage.Quoted': { en: 'Quoted', es: 'Cotizado', pt: 'Orçado' },
  'stage.Sent': { en: 'Sent', es: 'Enviado', pt: 'Enviado' },
  'stage.Approved': { en: 'Approved', es: 'Aprobado', pt: 'Aprovado' },
  'stage.Invoiced': { en: 'Invoiced', es: 'Facturado', pt: 'Faturado' },
  'stage.Paid': { en: 'Paid', es: 'Pagado', pt: 'Pago' },
  // bottom tab bar
  'ui.tab.home': { en: 'Home', es: 'Inicio', pt: 'Início' },
  'ui.tab.jobs': { en: 'Jobs', es: 'Trabajos', pt: 'Trabalhos' },
  'ui.tab.clients': { en: 'Clients', es: 'Clientes', pt: 'Clientes' },
  'ui.tab.profile': { en: 'Profile', es: 'Perfil', pt: 'Perfil' },
  // send sheet
  'ui.sendTitle.quote': { en: 'Send quote', es: 'Enviar cotización', pt: 'Enviar orçamento' },
  'ui.sendTitle.invoice': { en: 'Send invoice', es: 'Enviar factura', pt: 'Enviar fatura' },
  'ui.sendTitle.contract': { en: 'Send contract', es: 'Enviar contrato', pt: 'Enviar contrato' },
  'ui.sendSub': { en: 'Pick how you want to deliver it.', es: 'Elige cómo quieres enviarlo.', pt: 'Escolha como quer enviar.' },
  'ui.send.email': { en: 'Email', es: 'Correo', pt: 'E-mail' },
  'ui.send.emailDesc': { en: 'Opens your email app with the details as text', es: 'Abre tu app de correo con los detalles en texto', pt: 'Abre seu app de e-mail com os detalhes em texto' },
  'ui.send.sms': { en: 'SMS', es: 'SMS', pt: 'SMS' },
  'ui.send.smsDesc': { en: 'Text message with the details', es: 'Mensaje de texto con los detalles', pt: 'Mensagem de texto com os detalhes' },
  'ui.send.whatsapp': { en: 'WhatsApp', es: 'WhatsApp', pt: 'WhatsApp' },
  'ui.send.whatsappDesc': { en: 'Share via WhatsApp message', es: 'Comparte por mensaje de WhatsApp', pt: 'Compartilhe por mensagem do WhatsApp' },
  'ui.send.pdf': { en: 'Send as PDF', es: 'Enviar como PDF', pt: 'Enviar como PDF' },
  'ui.send.pdfDesc': { en: 'Creates the PDF and opens sharing — WhatsApp, email, save…', es: 'Crea el PDF y abre el compartir — WhatsApp, correo, guardar…', pt: 'Cria o PDF e abre o compartilhar — WhatsApp, e-mail, salvar…' },
});

/* ============================ shared store ============================ */
export type V2Store = {
  photos: import('./data').Photo[];
  svcs: string[];
  descText: string;
  voice: { dur: string } | null;
  items: import('./data').LineItem[];
  confidence: number; // AI confidence 0-100 for the current estimate
  aiNotes: string; // AI's "what I saw / assumptions" note
  aiSig: string; // photo-set signature of the last AI run — changing the photos re-runs the AI
  taxRate: number;
  marginRate: number;
  editing: import('./data').LineItem | null;
  aQ: string;
  aSel: any;
  aZip: string;
  aLoc: { city: string; region: string } | null;
  jobStreet: string; // job-site street address (G5) — GPS pre-fills it, the Attach step edits it
  custNote: string; // client-facing note that prints on documents (G1) — English when translated
  custNoteSrc: string; // original pt/es text when custNote came from the AI translation ('' = none)
  regionMult: number; // regional cost multiplier applied to the estimate (1.0 = national avg)
  regionState: string;
  jobTab: string;
  sheet: boolean;
  stageOverride: Record<string, Stage>;
  jobFilter: string;
  jobQ: string;
  clientQ: string;
};
type Ctx = { store: V2Store; up: (patch: Partial<V2Store> | ((s: V2Store) => Partial<V2Store>)) => void };
export const StoreCtx = createContext<Ctx>({ store: {} as V2Store, up: () => {} });
export const useStore = () => useContext(StoreCtx);

// Everything the capture flow touches — applied when a new flow starts (camera) and after a job
// is saved, so an abandoned/finished flow never leaks photos/items/client into the next one.
export const FLOW_RESET = {
  photos: [] as import('./data').Photo[],
  svcs: [] as string[],
  descText: '',
  voice: null,
  items: [] as import('./data').LineItem[],
  confidence: 0,
  aiNotes: '',
  aiSig: '',
  taxRate: 8.25,
  marginRate: 0,
  editing: null,
  aQ: '',
  aSel: null,
  aZip: '',
  aLoc: null,
  jobStreet: '',
  custNote: '',
  custNoteSrc: '',
  regionMult: 1,
  regionState: '',
} satisfies Partial<V2Store>;

/* ============================ text helpers ============================ */
export function T(props: { style?: StyleProp<TextStyle>; children: React.ReactNode; numberOfLines?: number }) {
  return (
    <Text style={[{ fontFamily: fonts.semibold, color: colors.ink }, props.style]} numberOfLines={props.numberOfLines}>
      {props.children}
    </Text>
  );
}
export const Row = ({ style, children }: { style?: StyleProp<ViewStyle>; children: React.ReactNode }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10 }, style]}>{children}</View>
);
export const Between = ({ style, children }: { style?: StyleProp<ViewStyle>; children: React.ReactNode }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, style]}>{children}</View>
);
export const Divider = ({ style }: { style?: StyleProp<ViewStyle> }) => (
  <View style={[{ height: 1, backgroundColor: colors.border, marginVertical: 16 }, style]} />
);

/* ============================ buttons ============================ */
type BtnVariant = 'primary' | 'ghost' | 'soft' | 'danger' | 'quiet';
export function Btn({
  title,
  onPress,
  variant = 'primary',
  sm,
  icon,
  disabled,
  style,
}: {
  title?: string;
  onPress?: () => void;
  variant?: BtnVariant;
  sm?: boolean;
  icon?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const bg = {
    primary: colors.primary,
    ghost: colors.card,
    soft: colors.primaryTint,
    danger: colors.errorTint,
    quiet: 'transparent',
  }[variant];
  const fg = {
    primary: colors.onPrimary,
    ghost: colors.ink,
    soft: colors.primary,
    danger: colors.error,
    quiet: colors.muted,
  }[variant];
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        {
          height: sm ? 44 : 54,
          borderRadius: sm ? 12 : 16,
          backgroundColor: bg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 9,
          paddingHorizontal: sm ? 18 : 16,
          opacity: disabled ? 0.5 : pressed ? 0.96 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        variant === 'ghost' && { borderWidth: 1, borderColor: colors.border, ...shadow.sm },
        variant === 'primary' && shadow.btn,
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={sm ? 17 : 20} color={fg} /> : null}
      {title ? <Text style={{ fontFamily: fonts.bold, fontSize: sm ? 14.5 : 16, color: fg }}>{title}</Text> : null}
    </Pressable>
  );
}

/* ============================ cards ============================ */
export const Card = ({ style, pad, children }: { style?: StyleProp<ViewStyle>; pad?: boolean; children: React.ReactNode }) => (
  <View
    style={[
      { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, ...shadow.sm },
      pad && { padding: 16 },
      style,
    ]}
  >
    {children}
  </View>
);

export function SectionTitle({ title, link, onLink }: { title: string; link?: string; onLink?: () => void }) {
  return (
    <Between style={{ marginTop: 22, marginBottom: 12 }}>
      <Text style={{ fontFamily: fonts.extrabold, fontSize: 16, color: colors.ink, letterSpacing: -0.2 }}>{title}</Text>
      {link ? (
        <Pressable onPress={onLink}>
          <Row style={{ gap: 5 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.primary }}>{link}</Text>
            <Icon name="chevR" size={15} color={colors.primary} />
          </Row>
        </Pressable>
      ) : null}
    </Between>
  );
}

export const LinkBtn = ({ title, icon, onPress }: { title: string; icon?: string; onPress?: () => void }) => (
  <Pressable onPress={onPress}>
    <Row style={{ gap: 5 }}>
      {icon ? <Icon name={icon} size={14} color={colors.primary} /> : null}
      <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.primary }}>{title}</Text>
    </Row>
  </Pressable>
);

/* ============================ chips ============================ */
export function Chip({ label, selected, icon, onPress }: { label: string; selected?: boolean; icon?: string; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 5,
        paddingHorizontal: 11,
        borderRadius: radii.pill,
        backgroundColor: selected ? colors.primary : colors.card,
        borderWidth: 1,
        borderColor: selected ? colors.primary : colors.border,
      }}
    >
      {icon ? <Icon name={icon} size={14} color={selected ? '#fff' : colors.ink2} /> : null}
      <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: selected ? '#fff' : colors.ink2 }}>{label}</Text>
    </Pressable>
  );
}

export const CatChip = ({ label }: { label: string }) => (
  <View style={{ backgroundColor: colors.chipBg, borderRadius: 7, paddingVertical: 4, paddingHorizontal: 9 }}>
    <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#4A5260' }}>{label}</Text>
  </View>
);

export function StageChip({ stage, lg }: { stage: Stage; lg?: boolean }) {
  const t = useT();
  const s = stageColors[stage];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: lg ? 6 : 5,
        paddingHorizontal: lg ? 12 : 10,
        borderRadius: radii.pill,
        backgroundColor: s.t,
      }}
    >
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: s.c }} />
      <Text style={{ fontFamily: fonts.extrabold, fontSize: lg ? 12.5 : 11.5, color: s.c }}>{t('stage.' + stage)}</Text>
    </View>
  );
}

/* ============================ forms ============================ */
export function Field({ label, opt, children }: { label?: string; opt?: boolean; children: React.ReactNode }) {
  const t = useT();
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? (
        <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.ink2, marginBottom: 7 }}>
          {label}
          {opt ? <Text style={{ fontFamily: fonts.medium, color: colors.faint }}> · {t('ui.optional')}</Text> : null}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

export const Input = React.forwardRef<TextInput, TextInputProps & { style?: StyleProp<TextStyle> }>(function Input({ style, ...props }, ref) {
  const [focus, setFocus] = useState(false);
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={colors.faint}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={[
        {
          height: 50,
          borderRadius: 13,
          borderWidth: 1,
          borderColor: focus ? colors.primary : colors.border,
          backgroundColor: colors.card,
          paddingHorizontal: 15,
          fontSize: 15,
          fontFamily: fonts.semibold,
          color: colors.ink,
          ...shadow.sm,
        },
        focus && { borderColor: colors.primary },
        style,
      ]}
      {...props}
    />
  );
});

// Numeric input with its own text buffer so the user can type "6." / "6.50"
// without an eager parseFloat/String round-trip stripping it (ported from the v1 DecimalInput fix).
export function DecimalInput({ value, onChangeValue, style, placeholder }: { value: number; onChangeValue: (n: number) => void; style?: StyleProp<TextStyle>; placeholder?: string }) {
  const [text, setText] = useState(() => (!value ? '' : String(value)));
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    const parsed = parseFloat(text);
    const current = isNaN(parsed) ? 0 : parsed;
    if (current !== value) setText(!value ? '' : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <TextInput
      value={text}
      keyboardType="decimal-pad"
      placeholder={placeholder}
      placeholderTextColor={colors.faint}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      onChangeText={(t) => {
        const raw = t.replace(/[^0-9.,]/g, '');
        let clean: string;
        if (raw.includes('.') && raw.includes(',')) {
          // pasted with thousands separators ("1.234,56" / "1,234.56") — the LAST separator is the decimal
          const sep = Math.max(raw.lastIndexOf('.'), raw.lastIndexOf(','));
          clean = `${raw.slice(0, sep).replace(/[.,]/g, '')}.${raw.slice(sep + 1).replace(/[.,]/g, '')}`;
        } else {
          // live typing: es/pt comma acts as the dot; keep only the first decimal point
          clean = raw.replace(/,/g, '.').replace(/(\..*)\./g, '$1');
        }
        setText(clean);
        const n = parseFloat(clean);
        onChangeValue(isNaN(n) ? 0 : n);
      }}
      style={[
        { height: 50, borderRadius: 13, borderWidth: 1, borderColor: focus ? colors.primary : colors.border, backgroundColor: colors.card, paddingHorizontal: 15, fontSize: 15, fontFamily: fonts.semibold, color: colors.ink, ...shadow.sm },
        style,
      ]}
    />
  );
}

export function SearchBar({ placeholder, value, onChangeText }: { placeholder: string; value: string; onChangeText: (t: string) => void }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        height: 48,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        paddingHorizontal: 14,
        ...shadow.sm,
      }}
    >
      <Icon name="search" size={18} color={colors.faint} />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        value={value}
        onChangeText={onChangeText}
        style={{ flex: 1, fontSize: 15, fontFamily: fonts.semibold, color: colors.ink }}
      />
    </View>
  );
}

export function Switch({ on, onPress }: { on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ width: 46, height: 28, borderRadius: 999, backgroundColor: on ? colors.primary : colors.borderStrong, justifyContent: 'center' }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: '#fff',
          marginLeft: on ? 21 : 3,
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 3,
          shadowOffset: { width: 0, height: 1 },
          elevation: 2,
        }}
      />
    </Pressable>
  );
}

/* ============================ nav (top bar) ============================ */
export function Nav({
  title,
  sub,
  onBack,
  right,
  center,
}: {
  title: string;
  sub?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  center?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8 }}>
      <Pressable onPress={onBack} style={[navStyles.btn, !onBack && { opacity: 0 }]} disabled={!onBack}>
        <Icon name="back" size={19} sw={2.4} />
      </Pressable>
      <View style={{ flex: 1, alignItems: center ? 'center' : 'flex-start', marginLeft: center ? 0 : 4 }}>
        <Text numberOfLines={1} style={{ fontFamily: fonts.extrabold, fontSize: 17, color: colors.ink }}>
          {title}
        </Text>
        {sub ? <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted }}>{sub}</Text> : null}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, minWidth: 40, justifyContent: 'flex-end' }}>{right}</View>
    </View>
  );
}

export const NavBtn = ({ icon, onPress, size = 19, color }: { icon: string; onPress?: () => void; size?: number; color?: string }) => (
  <Pressable onPress={onPress} style={navStyles.btn}>
    <Icon name={icon} size={size} color={color} />
  </Pressable>
);

const navStyles = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
});

/* ============================ stepper ============================ */
// − value + control (tax/markup %, plan days & counts). The caller pre-formats the value string.
export function Stepper({ value, onMinus, onPlus, width = 54 }: { value: string; onMinus: () => void; onPlus: () => void; width?: number }) {
  return (
    <Row style={{ gap: 8 }}>
      <NavBtn icon="back" size={14} onPress={onMinus} />
      <Text style={{ fontFamily: fonts.num, fontSize: 15, color: colors.ink, width, textAlign: 'center' }}>{value}</Text>
      <NavBtn icon="fwd" size={14} onPress={onPlus} />
    </Row>
  );
}

/* ============================ bottom tab bar ============================ */
// `hidden` drops tabs a role must not see (field mode hides Clients) — the bar itself stays,
// so the layout & muscle memory of the remaining tabs don't shift around per role.
export function TabBar({ active, onNav, hidden }: { active: string; onNav: (k: string) => void; hidden?: string[] }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const tabs: [string, string][] = (
    [
      ['home', 'home'],
      ['jobs', 'layers'],
      ['clients', 'users'],
      ['profile', 'user'],
    ] as [string, string][]
  ).filter(([k]) => !hidden?.includes(k));
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'flex-start',
        paddingTop: 8,
        paddingBottom: Math.max(insets.bottom, 12),
        paddingHorizontal: 22,
        backgroundColor: 'rgba(255,255,255,0.96)',
        borderTopWidth: 1,
        borderTopColor: colors.border,
      }}
    >
      {tabs.map(([k, ico]) => {
        const on = active === k;
        return (
          <Pressable key={k} onPress={() => onNav(k)} style={{ alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 14 }}>
            <Icon name={ico} size={23} sw={on ? 2.4 : 2} color={on ? colors.primary : colors.faint} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: on ? colors.primary : colors.faint }}>{t('ui.tab.' + k)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ============================ keyboard-safe wrapper ============================ */
// Lifts the content above the keyboard (screens/sheets with inputs near the bottom).
// 'padding' on BOTH platforms: with edge-to-edge Android the window never auto-resizes
// (softwareKeyboardLayoutMode is ignored), so the KAV must compensate — and 'padding'
// shifts content smoothly where 'height' re-lays-out the whole subtree.
// NOTE: 'padding' overrides the style's own paddingBottom — keep spacing on an inner view.
export function Kav({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <KeyboardAvoidingView behavior="padding" style={[{ flex: 1 }, style]}>
      {children}
    </KeyboardAvoidingView>
  );
}

/* ============================ bottom sheet ============================ */
export function Sheet({ open, onClose, title, sub, children }: { open: boolean; onClose: () => void; title?: string; sub?: string; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <Kav>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(12,17,22,0.42)' }} onPress={onClose} />
      {/* tapping blank space inside the sheet dismisses the keyboard — number pads on iOS have
          no return key, so without this the user gets stuck behind the keyboard */}
      <Pressable
        onPress={Keyboard.dismiss}
        style={{
          backgroundColor: colors.card,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingHorizontal: 20,
          paddingTop: 10,
          // translucent nav bars draw UNDER the sheet — keep the last control above them
          paddingBottom: 16 + Math.max(insets.bottom, 12),
          ...shadow.up,
        }}
      >
        <View style={{ width: 38, height: 5, borderRadius: 3, backgroundColor: colors.borderStrong, alignSelf: 'center', marginTop: 6, marginBottom: 16 }} />
        {title ? <Text style={{ fontFamily: fonts.extrabold, fontSize: 18, color: colors.ink, marginBottom: 4 }}>{title}</Text> : null}
        {sub ? <Text style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: colors.muted, marginBottom: 16 }}>{sub}</Text> : null}
        {children}
      </Pressable>
      </Kav>
    </Modal>
  );
}

export function SendSheet({ open, onClose, what = 'quote', onSent }: { open: boolean; onClose: () => void; what?: string; onSent?: (t: string) => void }) {
  const tr = useT();
  // key = the logical value passed to onSent/sendDoc (must stay English); label/desc are translated
  // PDF first: it's the document clients expect (field feedback 07/07) — the share sheet it opens
  // is the only way to attach a FILE (wa.me/mailto links are text-only by platform design)
  const opts: { key: string; ico: string; col: string; bg: string; k: string }[] = [
    { key: 'Save PDF', ico: 'pdf', col: colors.primary, bg: colors.primaryTint, k: 'pdf' },
    { key: 'WhatsApp', ico: 'whatsapp', col: colors.success, bg: colors.successTint, k: 'whatsapp' },
    { key: 'Email', ico: 'mail', col: colors.info, bg: colors.infoTint, k: 'email' },
    { key: 'SMS', ico: 'msg', col: colors.success, bg: colors.successTint, k: 'sms' },
  ];
  return (
    <Sheet open={open} onClose={onClose} title={tr('ui.sendTitle.' + what)} sub={tr('ui.sendSub')}>
      {opts.map((o) => (
        <Pressable
          key={o.key}
          onPress={() => onSent && onSent(o.key)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 10 }}
        >
          <View style={{ width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: o.bg }}>
            <Icon name={o.ico} size={20} color={o.col} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink }}>{tr('ui.send.' + o.k)}</Text>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, marginTop: 1 }}>{tr('ui.send.' + o.k + 'Desc')}</Text>
          </View>
          <Icon name="chevR" size={18} color="#C2C9D2" />
        </Pressable>
      ))}
    </Sheet>
  );
}

/* ============================ photo placeholder tile ============================ */
const TONES: [string, string][] = [
  ['#CBD5D0', '#E9EEEB'],
  ['#D2CBC0', '#EDE8DF'],
  ['#C9D0D8', '#E7ECF1'],
  ['#D5CDCB', '#EEE7E5'],
  ['#C7D2CB', '#E6EDE8'],
];
export function PhotoTile({ seed = 0, size = 56, radius = 12, label, style }: { seed?: number; size?: number; radius?: number; label?: string; style?: StyleProp<ViewStyle> }) {
  const [a, b] = TONES[seed % TONES.length];
  return (
    <LinearGradient colors={[a, b]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ width: size, height: size, borderRadius: radius, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, style]}>
      <Icon name="image" size={20} color="rgba(255,255,255,0.75)" />
      {label ? (
        <View style={{ position: 'absolute', left: 8, bottom: 8, backgroundColor: 'rgba(12,17,22,0.5)', paddingVertical: 2, paddingHorizontal: 7, borderRadius: 7 }}>
          <Text style={{ fontFamily: fonts.extrabold, fontSize: 10, color: '#fff' }}>{label}</Text>
        </View>
      ) : null}
    </LinearGradient>
  );
}

export const Avatar = ({ text, size = 46, radius = 14, fontSize = 16 }: { text: string; size?: number; radius?: number; fontSize?: number }) => (
  <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ fontFamily: fonts.extrabold, fontSize, color: colors.primary }}>{text}</Text>
  </View>
);

/* ============================ empty state ============================ */
export function Empty({ icon, title, body }: { icon: string; title: string; body?: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 30 }}>
      <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
        <Icon name={icon} size={30} color={colors.primary} />
      </View>
      <Text style={{ fontFamily: fonts.extrabold, fontSize: 19, color: colors.ink }}>{title}</Text>
      {body ? <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.muted, marginTop: 8, textAlign: 'center', lineHeight: 21 }}>{body}</Text> : null}
    </View>
  );
}

/* re-exports */
export { colors, fonts, radii, shadow, stageColors };
export type { Stage };

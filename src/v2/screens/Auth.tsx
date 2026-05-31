// PhotoQuote v2 — Auth & Onboarding screens, wired to real Supabase auth.
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Icon } from '../Icon';
import { colors, fonts } from '../theme';
import { Btn, Field, Input, Nav, Row } from '../ui';
import { useAuth } from '../lib/auth';

type NavProp = { go: (n: string, p?: any, mode?: string) => void; back: () => void; params?: any };
const pad = { paddingHorizontal: 20 };

export function LoginScreen({ go }: NavProp) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!email.trim() || !password) { setErr('Enter your email and password.'); return; }
    setBusy(true); setErr('');
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) setErr(error.message || 'Login failed.');
    // success: the auth listener swaps to the app automatically.
  };

  return (
    <View style={{ flex: 1, paddingHorizontal: 20, paddingBottom: 30 }}>
      <View style={{ marginTop: 48, marginBottom: 36 }}>
        <View style={{ width: 54, height: 54, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="camera" size={26} color="#fff" />
        </View>
        <Text style={{ fontFamily: fonts.extrabold, fontSize: 30, color: colors.ink, letterSpacing: -0.9, marginTop: 22 }}>Welcome back</Text>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.muted, marginTop: 8 }}>Photo to quote in seconds.</Text>
      </View>
      <Field label="Email">
        <Input value={email} onChangeText={setEmail} placeholder="you@email.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
      </Field>
      <Field label="Password">
        <View>
          <Input value={password} onChangeText={setPassword} placeholder="Your password" secureTextEntry={!show} style={{ paddingRight: 48 }} />
          <Pressable onPress={() => setShow(!show)} style={{ position: 'absolute', right: 14, top: 13 }}>
            <Icon name="eye" size={20} color={colors.faint} />
          </Pressable>
        </View>
      </Field>
      <Pressable onPress={() => go('forgot')} style={{ alignSelf: 'flex-end' }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.primary }}>Forgot password?</Text>
      </Pressable>
      {err ? <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.error, marginTop: 14 }}>{err}</Text> : null}
      <Btn title={busy ? 'Signing in…' : 'Sign in'} onPress={submit} disabled={busy} style={{ marginTop: 18 }} />
      <Row style={{ justifyContent: 'center', marginTop: 'auto', paddingTop: 24 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.muted }}>New here?</Text>
        <Pressable onPress={() => go('signup')}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.primary }}>Create an account</Text>
        </Pressable>
      </Row>
    </View>
  );
}

export function ForgotScreen({ back }: NavProp) {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!email.trim()) return;
    setBusy(true);
    const { error } = await resetPassword(email);
    setBusy(false);
    if (error) Alert.alert('Error', error.message);
    else { Alert.alert('Check your email', 'We sent you a secure link to reset your password.'); back(); }
  };
  return (
    <>
      <Nav title="Reset password" onBack={back} />
      <View style={pad}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.muted, marginTop: 8, lineHeight: 22 }}>
          Enter your email and we'll send a secure link to reset your password.
        </Text>
        <View style={{ height: 24 }} />
        <Field label="Email">
          <Input value={email} onChangeText={setEmail} placeholder="you@email.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
        </Field>
        <Btn title={busy ? 'Sending…' : 'Send reset link'} onPress={submit} disabled={busy} style={{ marginTop: 12 }} />
      </View>
    </>
  );
}

export function SignupScreen({ back }: NavProp) {
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async () => {
    if (!name.trim() || !email.trim() || !password) { setErr('Fill in name, email and password.'); return; }
    if (password.length < 6) { setErr('Password must be at least 6 characters.'); return; }
    setBusy(true); setErr('');
    const { error, needsConfirm } = await signUp(email, password, name.trim());
    setBusy(false);
    if (error) { setErr(error.message || 'Sign up failed.'); return; }
    if (needsConfirm) { Alert.alert('Almost there', 'Check your email to confirm your account, then sign in.'); back(); }
    // else: session created → app swaps automatically.
  };
  return (
    <>
      <Nav title="Create account" onBack={back} />
      <ScrollView style={pad} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.muted, marginTop: 4, lineHeight: 22 }}>
          Start quoting in under a minute. You can add company details later.
        </Text>
        <View style={{ height: 20 }} />
        <Field label="Full name"><Input value={name} onChangeText={setName} placeholder="Jordan Reyes" /></Field>
        <Field label="Email"><Input value={email} onChangeText={setEmail} placeholder="you@email.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} /></Field>
        <Field label="Password"><Input value={password} onChangeText={setPassword} placeholder="Create a password (min 6)" secureTextEntry /></Field>
        {err ? <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.error, marginBottom: 8 }}>{err}</Text> : null}
        <Btn title={busy ? 'Creating…' : 'Create account'} onPress={submit} disabled={busy} style={{ marginTop: 4 }} />
        <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted, textAlign: 'center', marginTop: 16, lineHeight: 19 }}>
          By continuing you agree to our Terms & Privacy Policy.
        </Text>
      </ScrollView>
    </>
  );
}

/* ---------------- ONBOARDING (kept for a later first-run gate; not in the critical path yet) ---------------- */
export function OnboardScreen({ go }: NavProp) {
  const [step, setStep] = useState(0);
  const steps = [
    { title: "What's your business called?", sub: 'This appears on every quote and invoice.', field: 'Company name', ph: 'Apex Renovations' },
    { title: 'How can clients reach you?', sub: 'Shown on documents you send.', field: 'Business phone', ph: '(512) 555-0190' },
    { title: 'Set your defaults', sub: 'You can change these anytime in Settings.', defaults: true },
  ];
  const s = steps[step] as any;
  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8 }}>
        <Pressable onPress={() => (step > 0 ? setStep(step - 1) : go('login'))} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="back" size={19} sw={2.4} />
        </Pressable>
        <Row style={{ gap: 6 }}>
          {steps.map((_, i) => (
            <View key={i} style={{ width: i === step ? 20 : 7, height: 7, borderRadius: 99, backgroundColor: i <= step ? colors.primary : colors.borderStrong }} />
          ))}
        </Row>
        <Pressable onPress={() => go('home', {}, 'tab')} style={{ width: 40, alignItems: 'flex-end' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.primary }}>Skip</Text>
        </Pressable>
      </View>
      <View style={[pad, { flex: 1 }]}>
        <Text style={{ fontFamily: fonts.extrabold, fontSize: 27, color: colors.ink, letterSpacing: -0.7, marginTop: 24, lineHeight: 31 }}>{s.title}</Text>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.muted, marginTop: 10 }}>{s.sub}</Text>
        <View style={{ height: 24 }} />
        {!s.defaults ? <Field label={s.field}><Input placeholder={s.ph} autoFocus /></Field> : null}
      </View>
      <View style={{ paddingHorizontal: 20, paddingBottom: 30, paddingTop: 12 }}>
        <Btn title={step < 2 ? 'Continue' : 'Finish setup'} onPress={() => (step < 2 ? setStep(step + 1) : go('home', {}, 'tab'))} />
      </View>
    </>
  );
}

// PhotoQuote v2 — Auth & Onboarding screens, wired to real Supabase auth.
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Icon } from '../Icon';
import { colors, fonts } from '../theme';
import { Btn, Field, Input, Nav, Row } from '../ui';
import { useAuth } from '../lib/auth';
import { registerStrings, useT } from '../lib/i18n';

registerStrings({
  // Shared
  'auth.email': { en: 'Email', es: 'Correo electrónico', pt: 'E-mail' },
  'auth.emailPlaceholder': { en: 'you@email.com', es: 'tu@email.com', pt: 'voce@email.com' },
  'auth.password': { en: 'Password', es: 'Contraseña', pt: 'Senha' },

  // Login
  'auth.enterEmailPassword': {
    en: 'Enter your email and password.',
    es: 'Ingresa tu correo electrónico y contraseña.',
    pt: 'Digite seu e-mail e senha.',
  },
  'auth.loginFailed': { en: 'Login failed.', es: 'Error al iniciar sesión.', pt: 'Falha no login.' },
  'auth.welcomeBack': { en: 'Welcome back', es: 'Bienvenido de nuevo', pt: 'Bem-vindo de volta' },
  'auth.photoToQuote': {
    en: 'Photo to quote in seconds.',
    es: 'De la foto al presupuesto en segundos.',
    pt: 'Da foto ao orçamento em segundos.',
  },
  'auth.passwordPlaceholder': { en: 'Your password', es: 'Tu contraseña', pt: 'Sua senha' },
  'auth.forgotPassword': { en: 'Forgot password?', es: '¿Olvidaste tu contraseña?', pt: 'Esqueceu a senha?' },
  'auth.signingIn': { en: 'Signing in…', es: 'Iniciando sesión…', pt: 'Entrando…' },
  'auth.signIn': { en: 'Sign in', es: 'Iniciar sesión', pt: 'Entrar' },
  'auth.newHere': { en: 'New here?', es: '¿Primera vez aquí?', pt: 'Novo por aqui?' },
  'auth.createAnAccount': { en: 'Create an account', es: 'Crea una cuenta', pt: 'Criar uma conta' },

  // Forgot password
  'auth.resetPassword': { en: 'Reset password', es: 'Restablecer contraseña', pt: 'Redefinir senha' },
  'auth.resetIntro': {
    en: "Enter your email and we'll send a secure link to reset your password.",
    es: 'Ingresa tu correo electrónico y te enviaremos un enlace seguro para restablecer tu contraseña.',
    pt: 'Digite seu e-mail e enviaremos um link seguro para redefinir sua senha.',
  },
  'auth.sending': { en: 'Sending…', es: 'Enviando…', pt: 'Enviando…' },
  'auth.sendResetLink': { en: 'Send reset link', es: 'Enviar enlace de restablecimiento', pt: 'Enviar link de redefinição' },
  'auth.errorTitle': { en: 'Error', es: 'Error', pt: 'Erro' },
  'auth.checkEmailTitle': { en: 'Check your email', es: 'Revisa tu correo', pt: 'Verifique seu e-mail' },
  'auth.resetLinkSent': {
    en: 'We sent you a secure link to reset your password.',
    es: 'Te enviamos un enlace seguro para restablecer tu contraseña.',
    pt: 'Enviamos um link seguro para redefinir sua senha.',
  },

  // Signup
  'auth.fillNameEmailPassword': {
    en: 'Fill in name, email and password.',
    es: 'Completa nombre, correo electrónico y contraseña.',
    pt: 'Preencha nome, e-mail e senha.',
  },
  'auth.passwordMinLength': {
    en: 'Password must be at least 6 characters.',
    es: 'La contraseña debe tener al menos 6 caracteres.',
    pt: 'A senha deve ter pelo menos 6 caracteres.',
  },
  'auth.signupFailed': { en: 'Sign up failed.', es: 'Error al registrarse.', pt: 'Falha no cadastro.' },
  'auth.almostThereTitle': { en: 'Almost there', es: 'Ya casi', pt: 'Quase lá' },
  'auth.confirmEmailMsg': {
    en: 'Check your email to confirm your account, then sign in.',
    es: 'Revisa tu correo para confirmar tu cuenta y luego inicia sesión.',
    pt: 'Verifique seu e-mail para confirmar sua conta e depois faça login.',
  },
  'auth.createAccount': { en: 'Create account', es: 'Crear cuenta', pt: 'Criar conta' },
  'auth.signupIntro': {
    en: 'Start quoting in under a minute. You can add company details later.',
    es: 'Empieza a cotizar en menos de un minuto. Puedes añadir los datos de tu empresa más tarde.',
    pt: 'Comece a orçar em menos de um minuto. Você pode adicionar os dados da empresa depois.',
  },
  'auth.fullName': { en: 'Full name', es: 'Nombre completo', pt: 'Nome completo' },
  'auth.fullNamePlaceholder': { en: 'Jordan Reyes', es: 'Jordan Reyes', pt: 'Jordan Reyes' },
  'auth.createPasswordPlaceholder': {
    en: 'Create a password (min 6)',
    es: 'Crea una contraseña (mín. 6)',
    pt: 'Crie uma senha (mín. 6)',
  },
  'auth.creating': { en: 'Creating…', es: 'Creando…', pt: 'Criando…' },
  'auth.termsNotice': {
    en: 'By continuing you agree to our Terms & Privacy Policy.',
    es: 'Al continuar aceptas nuestros Términos y Política de Privacidad.',
    pt: 'Ao continuar, você concorda com nossos Termos e Política de Privacidade.',
  },

  // Onboarding
  'auth.onboardBusinessTitle': {
    en: "What's your business called?",
    es: '¿Cómo se llama tu empresa?',
    pt: 'Qual é o nome da sua empresa?',
  },
  'auth.onboardBusinessSub': {
    en: 'This appears on every quote and invoice.',
    es: 'Aparece en cada presupuesto y factura.',
    pt: 'Aparece em cada orçamento e fatura.',
  },
  'auth.onboardCompanyName': { en: 'Company name', es: 'Nombre de la empresa', pt: 'Nome da empresa' },
  'auth.onboardCompanyPlaceholder': { en: 'Apex Renovations', es: 'Apex Renovations', pt: 'Apex Renovations' },
  'auth.onboardContactTitle': {
    en: 'How can clients reach you?',
    es: '¿Cómo pueden contactarte los clientes?',
    pt: 'Como os clientes podem falar com você?',
  },
  'auth.onboardContactSub': {
    en: 'Shown on documents you send.',
    es: 'Se muestra en los documentos que envías.',
    pt: 'Exibido nos documentos que você envia.',
  },
  'auth.onboardPhone': { en: 'Business phone', es: 'Teléfono comercial', pt: 'Telefone comercial' },
  'auth.onboardPhonePlaceholder': { en: '(512) 555-0190', es: '(512) 555-0190', pt: '(512) 555-0190' },
  'auth.onboardDefaultsTitle': { en: 'Set your defaults', es: 'Configura tus valores predeterminados', pt: 'Defina seus padrões' },
  'auth.onboardDefaultsSub': {
    en: 'You can change these anytime in Settings.',
    es: 'Puedes cambiarlos cuando quieras en Ajustes.',
    pt: 'Você pode alterá-los a qualquer momento nas Configurações.',
  },
  'auth.skip': { en: 'Skip', es: 'Omitir', pt: 'Pular' },
  'auth.continue': { en: 'Continue', es: 'Continuar', pt: 'Continuar' },
  'auth.finishSetup': { en: 'Finish setup', es: 'Finalizar configuración', pt: 'Concluir configuração' },
});

type NavProp = { go: (n: string, p?: any, mode?: string) => void; back: () => void; params?: any };
const pad = { paddingHorizontal: 20 };

export function LoginScreen({ go }: NavProp) {
  const t = useT();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!email.trim() || !password) { setErr(t('auth.enterEmailPassword')); return; }
    setBusy(true); setErr('');
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) setErr(error.message || t('auth.loginFailed'));
    // success: the auth listener swaps to the app automatically.
  };

  return (
    <View style={{ flex: 1, paddingHorizontal: 20, paddingBottom: 30 }}>
      <View style={{ marginTop: 48, marginBottom: 36 }}>
        <View style={{ width: 54, height: 54, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="camera" size={26} color="#fff" />
        </View>
        <Text style={{ fontFamily: fonts.extrabold, fontSize: 30, color: colors.ink, letterSpacing: -0.9, marginTop: 22 }}>{t('auth.welcomeBack')}</Text>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.muted, marginTop: 8 }}>{t('auth.photoToQuote')}</Text>
      </View>
      <Field label={t('auth.email')}>
        <Input value={email} onChangeText={setEmail} placeholder={t('auth.emailPlaceholder')} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
      </Field>
      <Field label={t('auth.password')}>
        <View>
          <Input value={password} onChangeText={setPassword} placeholder={t('auth.passwordPlaceholder')} secureTextEntry={!show} style={{ paddingRight: 48 }} />
          <Pressable onPress={() => setShow(!show)} style={{ position: 'absolute', right: 14, top: 13 }}>
            <Icon name="eye" size={20} color={colors.faint} />
          </Pressable>
        </View>
      </Field>
      <Pressable onPress={() => go('forgot')} style={{ alignSelf: 'flex-end' }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.primary }}>{t('auth.forgotPassword')}</Text>
      </Pressable>
      {err ? <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.error, marginTop: 14 }}>{err}</Text> : null}
      <Btn title={busy ? t('auth.signingIn') : t('auth.signIn')} onPress={submit} disabled={busy} style={{ marginTop: 18 }} />
      <Row style={{ justifyContent: 'center', marginTop: 'auto', paddingTop: 24 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.muted }}>{t('auth.newHere')}</Text>
        <Pressable onPress={() => go('signup')}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.primary }}>{t('auth.createAnAccount')}</Text>
        </Pressable>
      </Row>
    </View>
  );
}

export function ForgotScreen({ back }: NavProp) {
  const t = useT();
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!email.trim()) return;
    setBusy(true);
    const { error } = await resetPassword(email);
    setBusy(false);
    if (error) Alert.alert(t('auth.errorTitle'), error.message);
    else { Alert.alert(t('auth.checkEmailTitle'), t('auth.resetLinkSent')); back(); }
  };
  return (
    <>
      <Nav title={t('auth.resetPassword')} onBack={back} />
      <View style={pad}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.muted, marginTop: 8, lineHeight: 22 }}>
          {t('auth.resetIntro')}
        </Text>
        <View style={{ height: 24 }} />
        <Field label={t('auth.email')}>
          <Input value={email} onChangeText={setEmail} placeholder={t('auth.emailPlaceholder')} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
        </Field>
        <Btn title={busy ? t('auth.sending') : t('auth.sendResetLink')} onPress={submit} disabled={busy} style={{ marginTop: 12 }} />
      </View>
    </>
  );
}

export function SignupScreen({ back }: NavProp) {
  const t = useT();
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async () => {
    if (!name.trim() || !email.trim() || !password) { setErr(t('auth.fillNameEmailPassword')); return; }
    if (password.length < 6) { setErr(t('auth.passwordMinLength')); return; }
    setBusy(true); setErr('');
    const { error, needsConfirm } = await signUp(email, password, name.trim());
    setBusy(false);
    if (error) { setErr(error.message || t('auth.signupFailed')); return; }
    if (needsConfirm) { Alert.alert(t('auth.almostThereTitle'), t('auth.confirmEmailMsg')); back(); }
    // else: session created → app swaps automatically.
  };
  return (
    <>
      <Nav title={t('auth.createAccount')} onBack={back} />
      <ScrollView style={pad} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.muted, marginTop: 4, lineHeight: 22 }}>
          {t('auth.signupIntro')}
        </Text>
        <View style={{ height: 20 }} />
        <Field label={t('auth.fullName')}><Input value={name} onChangeText={setName} placeholder={t('auth.fullNamePlaceholder')} /></Field>
        <Field label={t('auth.email')}><Input value={email} onChangeText={setEmail} placeholder={t('auth.emailPlaceholder')} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} /></Field>
        <Field label={t('auth.password')}><Input value={password} onChangeText={setPassword} placeholder={t('auth.createPasswordPlaceholder')} secureTextEntry /></Field>
        {err ? <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.error, marginBottom: 8 }}>{err}</Text> : null}
        <Btn title={busy ? t('auth.creating') : t('auth.createAccount')} onPress={submit} disabled={busy} style={{ marginTop: 4 }} />
        <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted, textAlign: 'center', marginTop: 16, lineHeight: 19 }}>
          {t('auth.termsNotice')}
        </Text>
      </ScrollView>
    </>
  );
}

/* ---------------- ONBOARDING (kept for a later first-run gate; not in the critical path yet) ---------------- */
export function OnboardScreen({ go }: NavProp) {
  const t = useT();
  const [step, setStep] = useState(0);
  const steps = [
    { title: t('auth.onboardBusinessTitle'), sub: t('auth.onboardBusinessSub'), field: t('auth.onboardCompanyName'), ph: t('auth.onboardCompanyPlaceholder') },
    { title: t('auth.onboardContactTitle'), sub: t('auth.onboardContactSub'), field: t('auth.onboardPhone'), ph: t('auth.onboardPhonePlaceholder') },
    { title: t('auth.onboardDefaultsTitle'), sub: t('auth.onboardDefaultsSub'), defaults: true },
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
          <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.primary }}>{t('auth.skip')}</Text>
        </Pressable>
      </View>
      <View style={[pad, { flex: 1 }]}>
        <Text style={{ fontFamily: fonts.extrabold, fontSize: 27, color: colors.ink, letterSpacing: -0.7, marginTop: 24, lineHeight: 31 }}>{s.title}</Text>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.muted, marginTop: 10 }}>{s.sub}</Text>
        <View style={{ height: 24 }} />
        {!s.defaults ? <Field label={s.field}><Input placeholder={s.ph} autoFocus /></Field> : null}
      </View>
      <View style={{ paddingHorizontal: 20, paddingBottom: 30, paddingTop: 12 }}>
        <Btn title={step < 2 ? t('auth.continue') : t('auth.finishSetup')} onPress={() => (step < 2 ? setStep(step + 1) : go('home', {}, 'tab'))} />
      </View>
    </>
  );
}

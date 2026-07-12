// PhotoQuote v2 — Plans / paywall (Onda D). Shows the approved catalog (Solo/Team, monthly or
// annual) and the caller's current state (trial days left / expired / active plan).
// PURCHASES ARE A STUB ON PURPOSE: real billing (RevenueCat + Apple IAP) requires a native
// module that would break Expo Go/tunnel testing — it gets wired in the store build, with the
// owner's GO. Until then the CTA explains that, and nothing here charges anyone.
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { registerStrings, useT } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { fetchOwnBilling, fetchPlans, PlanRow } from '../lib/api';
import { billingState, trialDaysLeft } from '../data';
import { colors, fonts, radii } from '../theme';
import { Btn, Card, Nav, Row } from '../ui';
import { Icon } from '../Icon';

registerStrings({
  'plans.title': { en: 'Plans', es: 'Planes', pt: 'Planos' },
  'plans.trialLeft': { en: 'Free trial — {n} day(s) left', es: 'Prueba gratis — queda(n) {n} día(s)', pt: 'Teste grátis — falta(m) {n} dia(s)' },
  'plans.trialEnded': { en: 'Your free trial has ended', es: 'Tu prueba gratis terminó', pt: 'Seu teste grátis terminou' },
  'plans.activePlan': { en: 'Current plan: {plan}', es: 'Plan actual: {plan}', pt: 'Plano atual: {plan}' },
  'plans.monthly': { en: 'Monthly', es: 'Mensual', pt: 'Mensal' },
  'plans.annual': { en: 'Annual', es: 'Anual', pt: 'Anual' },
  'plans.annualSave': { en: 'save up to 25%', es: 'ahorra hasta 25%', pt: 'economize até 25%' },
  'plans.perMonth': { en: '/mo', es: '/mes', pt: '/mês' },
  'plans.billedYearly': { en: 'billed {price} yearly', es: 'facturado {price} al año', pt: 'cobrado {price} ao ano' },
  'plans.soloBlurb': { en: 'Everything for one contractor: AI quotes, invoices, payments, e-sign contracts, client portal, job phases.', es: 'Todo para un contratista: presupuestos con IA, facturas, pagos, contratos e-sign, portal del cliente, fases de obra.', pt: 'Tudo para um empreiteiro: orçamentos com IA, faturas, pagamentos, contratos e-sign, portal do cliente, fases da obra.' },
  'plans.teamBlurb': { en: 'Everything in Solo + your crew: field workers, job assignment, permissions. 3 seats included, +${extra}/extra seat.', es: 'Todo lo de Solo + tu equipo: personal de campo, asignación de obras, permisos. 3 asientos incluidos, +${extra}/asiento extra.', pt: 'Tudo do Solo + sua equipe: pessoal de campo, atribuição de obras, permissões. 3 assentos inclusos, +${extra}/assento extra.' },
  'plans.choose': { en: 'Choose {plan}', es: 'Elegir {plan}', pt: 'Escolher {plan}' },
  'plans.stubTitle': { en: 'Almost there', es: 'Casi listo', pt: 'Quase lá' },
  'plans.stubBody': { en: 'Subscriptions open with the App Store release. Until then you keep full access — enjoy the trial!', es: 'Las suscripciones se abren con el lanzamiento en el App Store. Hasta entonces tienes acceso completo. ¡Disfruta la prueba!', pt: 'As assinaturas abrem junto com o lançamento na App Store. Até lá você tem acesso completo — aproveite o teste!' },
  'plans.restore': { en: 'Restore purchases', es: 'Restaurar compras', pt: 'Restaurar compras' },
  'plans.trialNote': { en: '14-day free trial · no card required · cancel anytime', es: 'Prueba gratis de 14 días · sin tarjeta · cancela cuando quieras', pt: 'Teste grátis de 14 dias · sem cartão · cancele quando quiser' },
});

type NavProp = { go: (n: string, p?: any, mode?: string) => void; back: () => void; params?: any };
const scroll = { paddingHorizontal: 20, paddingBottom: 120 };

export function PlansScreen({ back }: NavProp) {
  const t = useT();
  const { user, role } = useAuth();
  const [yearly, setYearly] = useState(false);
  const { data: plans = [], isLoading } = useQuery({ queryKey: ['plans'], queryFn: fetchPlans });
  const { data: billing } = useQuery({
    queryKey: ['billing', user?.id],
    queryFn: () => fetchOwnBilling(user!.id),
    enabled: !!user?.id && role === 'owner',
  });
  const state = billingState(billing?.status, billing?.expiresAt);
  const days = trialDaysLeft(billing?.expiresAt);

  const statusLine =
    billing?.planName ? t('plans.activePlan', { plan: billing.planName })
    : state === 'trial' ? t('plans.trialLeft', { n: days })
    : state === 'expired' ? t('plans.trialEnded')
    : null;

  const onChoose = (p: PlanRow) => {
    // stub até a build da loja (RevenueCat/IAP são módulo nativo — quebraria o Expo Go)
    Alert.alert(t('plans.stubTitle'), t('plans.stubBody'));
  };

  return (
    <>
      <Nav title={t('plans.title')} center onBack={back} />
      <ScrollView contentContainerStyle={scroll} showsVerticalScrollIndicator={false}>
        {statusLine ? (
          <Card pad style={{ backgroundColor: state === 'expired' ? colors.errorTint : colors.primaryTint, borderWidth: 0, marginTop: 8 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: state === 'expired' ? colors.error : colors.primary }}>{statusLine}</Text>
          </Card>
        ) : null}

        {/* monthly / annual toggle */}
        <Row style={{ marginTop: 16, backgroundColor: colors.card2 ?? '#EEF1F4', borderRadius: radii.pill, padding: 4 }}>
          {([false, true] as const).map((y) => (
            <Pressable
              key={String(y)}
              onPress={() => setYearly(y)}
              style={{ flex: 1, paddingVertical: 9, borderRadius: radii.pill, backgroundColor: yearly === y ? '#fff' : 'transparent', alignItems: 'center' }}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: yearly === y ? colors.ink : colors.muted }}>
                {y ? `${t('plans.annual')} · ${t('plans.annualSave')}` : t('plans.monthly')}
              </Text>
            </Pressable>
          ))}
        </Row>

        {isLoading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}><ActivityIndicator color={colors.primary} /></View>
        ) : (
          <View style={{ gap: 14, marginTop: 16 }}>
            {plans.map((p) => {
              const team = p.name === 'Team';
              const monthlyEq = yearly ? Math.round(p.priceYearly / 12) : p.priceMonthly;
              const extra = Number((p.features as any)?.extra_seat_price_monthly) || 19;
              return (
                <Card key={p.id} pad style={team ? { borderColor: colors.primary, borderWidth: 2 } : undefined}>
                  <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View>
                      <Text style={{ fontFamily: fonts.extrabold, fontSize: 20, color: colors.ink }}>{p.name}</Text>
                      <Row style={{ gap: 4, alignItems: 'flex-end', marginTop: 6 }}>
                        <Text style={{ fontFamily: fonts.num, fontSize: 34, color: colors.ink, letterSpacing: -0.8 }}>${monthlyEq}</Text>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.muted, marginBottom: 5 }}>{t('plans.perMonth')}</Text>
                      </Row>
                      {yearly ? (
                        <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, marginTop: 2 }}>{t('plans.billedYearly', { price: `$${p.priceYearly}` })}</Text>
                      ) : null}
                    </View>
                    {team ? <Icon name="users" size={22} color={colors.primary} /> : <Icon name="user" size={22} color={colors.muted} />}
                  </Row>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, lineHeight: 19, marginTop: 10 }}>
                    {team ? t('plans.teamBlurb', { extra }) : t('plans.soloBlurb')}
                  </Text>
                  <Btn title={t('plans.choose', { plan: p.name })} onPress={() => onChoose(p)} style={{ marginTop: 14 }} variant={team ? undefined : 'ghost'} />
                </Card>
              );
            })}
          </View>
        )}

        <Pressable onPress={() => Alert.alert(t('plans.stubTitle'), t('plans.stubBody'))} style={{ alignItems: 'center', marginTop: 18 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.primary }}>{t('plans.restore')}</Text>
        </Pressable>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 10 }}>{t('plans.trialNote')}</Text>
      </ScrollView>
    </>
  );
}

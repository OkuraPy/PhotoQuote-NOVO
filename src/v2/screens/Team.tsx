// PhotoQuote v2 — Team screen (Onda B): the owner creates and manages field members.
// The owner creates the employee's login DIRECTLY (email + password, no invite flow — owner's
// call: "coloca e-mail e senha e já era") and hands the credentials over via the share sheet.
// MVP scope: only the 'field' role is creatable here; the office role ships in a later wave
// (the data layer & auth context already understand it).
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, Text, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '../Icon';
import { colors, fonts, radii } from '../theme';
import { credentialsMessage, initials, passwordFromBytes } from '../data';
import { Avatar, Between, Btn, Card, Empty, Field, Input, Nav, NavBtn, Row, Sheet, Switch } from '../ui';
import { useAuth } from '../lib/auth';
import { createTeamMember, fetchCompanyProfile, fetchTeam, removeTeamMember, TeamMember, updateTeamMember } from '../lib/api';
import { getLocale, registerStrings, useT } from '../lib/i18n';

registerStrings({
  'team.title': { en: 'Team', es: 'Equipo', pt: 'Equipe' },
  'team.members': { en: 'Members', es: 'Miembros', pt: 'Membros' },
  'team.ownerOnly': { en: 'Only the account owner can manage the team.', es: 'Solo el propietario de la cuenta puede administrar el equipo.', pt: 'Só o dono da conta pode gerenciar a equipe.' },
  'team.empty.title': { en: 'No members yet', es: 'Aún no hay miembros', pt: 'Nenhum membro ainda' },
  'team.empty.body': {
    en: 'Add someone from your crew — they sign in with the email and password you create here and see only the jobs you assign.',
    es: 'Agrega a alguien de tu personal: inicia sesión con el correo y la contraseña que crees aquí y solo ve los trabajos que le asignes.',
    pt: 'Adicione alguém da sua equipe — a pessoa entra com o e-mail e a senha que você criar aqui e vê só os trabalhos que você atribuir.',
  },
  'team.addMember': { en: 'Add member', es: 'Agregar miembro', pt: 'Adicionar membro' },
  'team.roleField': { en: 'Field crew', es: 'Equipo de campo', pt: 'Equipe de campo' },
  'team.roleOffice': { en: 'Office', es: 'Oficina', pt: 'Escritório' },
  'team.canSeePrices': { en: 'Can see prices', es: 'Puede ver precios', pt: 'Pode ver preços' },
  'team.removeTitle': { en: 'Remove member?', es: '¿Quitar miembro?', pt: 'Remover membro?' },
  'team.removeBody': {
    en: '{name} will lose access to your jobs. Their photos and comments are kept.',
    es: '{name} perderá el acceso a tus trabajos. Sus fotos y comentarios se conservan.',
    pt: '{name} vai perder o acesso aos seus trabalhos. As fotos e comentários ficam salvos.',
  },
  'team.remove': { en: 'Remove', es: 'Quitar', pt: 'Remover' },
  'team.cancel': { en: 'Cancel', es: 'Cancelar', pt: 'Cancelar' },
  'team.couldNotUpdate': { en: 'Could not update', es: 'No se pudo actualizar', pt: 'Não foi possível atualizar' },
  'team.couldNotRemove': { en: 'Could not remove', es: 'No se pudo quitar', pt: 'Não foi possível remover' },
  'team.tryAgain': { en: 'Try again.', es: 'Inténtalo de nuevo.', pt: 'Tente novamente.' },
  // add-member sheet
  'team.newMember': { en: 'New member', es: 'Nuevo miembro', pt: 'Novo membro' },
  'team.newMemberSub': {
    en: 'You create their login — send them the credentials right after.',
    es: 'Tú creas su acceso y le envías las credenciales justo después.',
    pt: 'Você cria o login e envia as credenciais logo em seguida.',
  },
  'team.nameLabel': { en: 'Name', es: 'Nombre', pt: 'Nome' },
  'team.namePh': { en: 'Employee name', es: 'Nombre del empleado', pt: 'Nome do funcionário' },
  'team.emailLabel': { en: 'Email', es: 'Correo', pt: 'E-mail' },
  'team.emailPh': { en: 'name@email.com', es: 'nombre@correo.com', pt: 'nome@email.com' },
  'team.passwordLabel': { en: 'Password', es: 'Contraseña', pt: 'Senha' },
  'team.passwordHint': { en: 'Suggested password — tap ⚡ for a new one or type your own.', es: 'Contraseña sugerida: toca ⚡ para otra o escribe la tuya.', pt: 'Senha sugerida — toque em ⚡ para outra ou digite a sua.' },
  'team.roleNote': {
    en: 'New members join as field crew: they see only assigned jobs and update progress, photos and comments.',
    es: 'Los nuevos miembros entran como equipo de campo: solo ven los trabajos asignados y actualizan progreso, fotos y comentarios.',
    pt: 'Novos membros entram como equipe de campo: veem só os trabalhos atribuídos e atualizam progresso, fotos e comentários.',
  },
  'team.creating': { en: 'Creating…', es: 'Creando…', pt: 'Criando…' },
  'team.create': { en: 'Create account', es: 'Crear cuenta', pt: 'Criar conta' },
  'team.nameRequired': { en: 'Name required', es: 'Falta el nombre', pt: 'Falta o nome' },
  'team.nameRequiredBody': { en: 'Enter the member’s name.', es: 'Escribe el nombre del miembro.', pt: 'Digite o nome do membro.' },
  'team.emailInvalid': { en: 'Invalid email', es: 'Correo no válido', pt: 'E-mail inválido' },
  'team.emailInvalidBody': { en: 'Enter a valid email address.', es: 'Escribe un correo válido.', pt: 'Digite um e-mail válido.' },
  'team.passwordShort': { en: 'Password too short', es: 'Contraseña muy corta', pt: 'Senha muito curta' },
  'team.passwordShortBody': { en: 'Use at least 8 characters.', es: 'Usa al menos 8 caracteres.', pt: 'Use pelo menos 8 caracteres.' },
  'team.emailInUseTitle': { en: 'Email already in use', es: 'Correo ya en uso', pt: 'E-mail já em uso' },
  'team.emailInUseBody': {
    en: 'That email already has an account. Use a different email for this member.',
    es: 'Ese correo ya tiene una cuenta. Usa otro correo para este miembro.',
    pt: 'Esse e-mail já tem uma conta. Use outro e-mail para este membro.',
  },
  'team.couldNotCreate': { en: 'Could not create the member', es: 'No se pudo crear el miembro', pt: 'Não foi possível criar o membro' },
  'team.limitTitle': { en: 'Team is full', es: 'Equipo lleno', pt: 'Equipe cheia' },
  'team.limitBody': {
    en: 'You reached the limit of 10 active members. Remove someone before adding another.',
    es: 'Alcanzaste el límite de 10 miembros activos. Elimina a alguien antes de añadir otro.',
    pt: 'Você atingiu o limite de 10 membros ativos. Remova alguém antes de adicionar outro.',
  },
  'team.weakPasswordTitle': { en: 'Password too weak', es: 'Contraseña muy débil', pt: 'Senha muito fraca' },
  'team.weakPasswordBody': { en: 'Use at least 8 characters.', es: 'Usa al menos 8 caracteres.', pt: 'Use pelo menos 8 caracteres.' },
  // success card
  'team.createdTitle': { en: 'Account created', es: 'Cuenta creada', pt: 'Conta criada' },
  'team.createdBody': {
    en: 'Send these credentials to {name} — they sign in with the normal app login.',
    es: 'Envía estas credenciales a {name}: entra con el acceso normal de la app.',
    pt: 'Envie estas credenciais para {name} — é só entrar pelo login normal do app.',
  },
  'team.share': { en: 'Share credentials', es: 'Compartir credenciales', pt: 'Compartilhar credenciais' },
  'team.done': { en: 'Done', es: 'Listo', pt: 'Concluído' },
});

type NavProp = { go: (n: string, p?: any, mode?: string) => void; back: () => void; params?: any };
const scroll = { paddingHorizontal: 20, paddingBottom: 120 };
const actionbar = { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 };

const suggestPassword = () => passwordFromBytes(Crypto.getRandomBytes(10), 10);

export function TeamScreen({ go, back }: NavProp) {
  const t = useT();
  const { ownerId, role } = useAuth();
  const qc = useQueryClient();
  const isOwner = role === 'owner';
  const { data: members = [], isLoading } = useQuery({ queryKey: ['team', ownerId], queryFn: () => fetchTeam(ownerId!), enabled: !!ownerId && isOwner });
  const { data: profile } = useQuery({ queryKey: ['company', ownerId], queryFn: () => fetchCompanyProfile(ownerId!), enabled: !!ownerId });
  const [addOpen, setAddOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // defensive: the Profile entry is owner-only, but a stale stack could still land here
  if (!isOwner) {
    return (
      <>
        <Nav title={t('team.title')} center onBack={back} />
        <Empty icon="users" title={t('team.title')} body={t('team.ownerOnly')} />
      </>
    );
  }

  const toggleMoney = async (m: TeamMember) => {
    if (busyId) return;
    const next = !m.canSeeFinancials;
    setBusyId(m.id);
    // optimistic — the switch answers the tap; the invalidate below re-syncs with the DB truth
    qc.setQueryData(['team', ownerId], (old?: TeamMember[]) => old?.map((x) => (x.id === m.id ? { ...x, canSeeFinancials: next } : x)));
    try {
      await updateTeamMember(m.id, { canSeeFinancials: next });
    } catch (e: any) {
      Alert.alert(t('team.couldNotUpdate'), e?.message || t('team.tryAgain'));
    } finally {
      await qc.invalidateQueries({ queryKey: ['team', ownerId] });
      setBusyId(null);
    }
  };

  const confirmRemove = (m: TeamMember) => {
    Alert.alert(t('team.removeTitle'), t('team.removeBody', { name: m.name }), [
      { text: t('team.cancel'), style: 'cancel' },
      {
        text: t('team.remove'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await removeTeamMember(m.id); // soft: status='removed', history stays
              await qc.invalidateQueries({ queryKey: ['team', ownerId] });
            } catch (e: any) {
              Alert.alert(t('team.couldNotRemove'), e?.message || t('team.tryAgain'));
            }
          })();
        },
      },
    ]);
  };

  return (
    <>
      <Nav title={t('team.title')} center onBack={back} />
      <ScrollView contentContainerStyle={scroll} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={{ paddingTop: 60, alignItems: 'center' }}><ActivityIndicator color={colors.primary} /></View>
        ) : members.length === 0 ? (
          <Empty icon="users" title={t('team.empty.title')} body={t('team.empty.body')} />
        ) : (
          <View style={{ gap: 10, marginTop: 8 }}>
            {members.map((m) => (
              <Card key={m.id} pad>
                <Between style={{ alignItems: 'flex-start' }}>
                  <Row style={{ gap: 12, flex: 1 }}>
                    <Avatar text={initials(m.name)} size={42} radius={13} fontSize={15} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ fontFamily: fonts.extrabold, fontSize: 15, color: colors.ink }}>{m.name}</Text>
                      <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted, marginTop: 1 }}>{m.email}</Text>
                      <View style={{ alignSelf: 'flex-start', backgroundColor: colors.chipBg, borderRadius: 7, paddingVertical: 3, paddingHorizontal: 8, marginTop: 7 }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 10.5, color: '#4A5260' }}>{m.role === 'office' ? t('team.roleOffice') : t('team.roleField')}</Text>
                      </View>
                    </View>
                  </Row>
                  <Pressable onPress={() => confirmRemove(m)} hitSlop={8}><Icon name="trash" size={16} color={colors.faint} /></Pressable>
                </Between>
                <Between style={{ marginTop: 12, backgroundColor: colors.bg, borderRadius: radii.lg, paddingVertical: 10, paddingHorizontal: 12 }}>
                  <Row style={{ gap: 8 }}>
                    <Icon name="eye" size={15} color={colors.muted} />
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.ink2 }}>{t('team.canSeePrices')}</Text>
                  </Row>
                  {busyId === m.id ? <ActivityIndicator size="small" color={colors.muted} /> : <Switch on={m.canSeeFinancials} onPress={() => toggleMoney(m)} />}
                </Between>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
      <View style={actionbar}>
        <Btn title={t('team.addMember')} icon="plus" onPress={() => setAddOpen(true)} />
      </View>

      <AddMemberSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        companyName={(profile as any)?.company_name || ''}
        onCreated={() => qc.invalidateQueries({ queryKey: ['team', ownerId] })}
      />
    </>
  );
}

/* ---------------- Add member sheet: form → created credentials card ---------------- */
function AddMemberSheet({ open, onClose, companyName, onCreated }: { open: boolean; onClose: () => void; companyName: string; onCreated: () => void }) {
  const t = useT();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [canSee, setCanSee] = useState(false);
  const [busy, setBusy] = useState(false);
  // after a successful create the sheet flips to the "send this to your employee" card
  const [created, setCreated] = useState<{ name: string; email: string; password: string } | null>(null);

  // fresh form (and a fresh suggested password) on every open — the Modal stays mounted closed
  useEffect(() => {
    if (!open) return;
    setName('');
    setEmail('');
    setPassword(suggestPassword());
    setCanSee(false);
    setCreated(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const create = async () => {
    if (busy) return;
    if (!name.trim()) { Alert.alert(t('team.nameRequired'), t('team.nameRequiredBody')); return; }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { Alert.alert(t('team.emailInvalid'), t('team.emailInvalidBody')); return; }
    if (password.length < 8) { Alert.alert(t('team.passwordShort'), t('team.passwordShortBody')); return; }
    setBusy(true);
    try {
      // MVP: always 'field' — the office role is a later wave (screen decision, not a data limit)
      await createTeamMember({ name, email, password, role: 'field', canSeeFinancials: canSee });
      onCreated();
      setCreated({ name: name.trim(), email: email.trim().toLowerCase(), password });
    } catch (e: any) {
      if (e?.code === 'email_in_use' || e?.code === 'member_exists') Alert.alert(t('team.emailInUseTitle'), t('team.emailInUseBody'));
      else if (e?.code === 'member_limit_reached') Alert.alert(t('team.limitTitle'), t('team.limitBody'));
      else if (e?.code === 'weak_password') Alert.alert(t('team.weakPasswordTitle'), t('team.weakPasswordBody'));
      else Alert.alert(t('team.couldNotCreate'), e?.message || t('team.tryAgain'));
    } finally {
      setBusy(false);
    }
  };

  // localized on purpose: this is the OWNER's message to their own employee, not client output.
  // The native share sheet also covers "copy" on both platforms (no clipboard dependency).
  const share = async () => {
    if (!created) return;
    try {
      await Share.share({ message: credentialsMessage(getLocale(), { company: companyName, email: created.email, password: created.password }) });
    } catch {
      /* user dismissed the share sheet */
    }
  };

  if (created) {
    return (
      <Sheet open={open} onClose={onClose} title={t('team.createdTitle')} sub={t('team.createdBody', { name: created.name })}>
        <View style={{ backgroundColor: colors.bg, borderRadius: radii.lg, padding: 14 }}>
          <Between>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted }}>{t('team.emailLabel')}</Text>
            <Text selectable style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink }}>{created.email}</Text>
          </Between>
          <Between style={{ marginTop: 10 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted }}>{t('team.passwordLabel')}</Text>
            <Text selectable style={{ fontFamily: fonts.num, fontSize: 15, color: colors.ink, letterSpacing: 0.5 }}>{created.password}</Text>
          </Between>
        </View>
        <Btn title={t('team.share')} icon="share" onPress={share} style={{ marginTop: 14 }} />
        <Btn variant="ghost" title={t('team.done')} onPress={onClose} style={{ marginTop: 10 }} />
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('team.newMember')} sub={t('team.newMemberSub')}>
      <Field label={t('team.nameLabel')}><Input value={name} onChangeText={setName} placeholder={t('team.namePh')} autoFocus /></Field>
      <Field label={t('team.emailLabel')}><Input value={email} onChangeText={setEmail} placeholder={t('team.emailPh')} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} /></Field>
      <Field label={t('team.passwordLabel')}>
        <Row style={{ gap: 10 }}>
          <View style={{ flex: 1 }}>
            {/* visible on purpose: the owner reads/sends this password to the employee */}
            <Input value={password} onChangeText={setPassword} autoCapitalize="none" autoCorrect={false} />
          </View>
          <NavBtn icon="zap" onPress={() => setPassword(suggestPassword())} />
        </Row>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 11.5, color: colors.muted, marginTop: 7 }}>{t('team.passwordHint')}</Text>
      </Field>
      <Between style={{ backgroundColor: colors.bg, borderRadius: radii.lg, padding: 14 }}>
        <Row style={{ gap: 8, flex: 1 }}>
          <Icon name="eye" size={15} color={colors.muted} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink }}>{t('team.canSeePrices')}</Text>
        </Row>
        <Switch on={canSee} onPress={() => setCanSee(!canSee)} />
      </Between>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, marginTop: 12, lineHeight: 17 }}>{t('team.roleNote')}</Text>
      <Btn title={busy ? t('team.creating') : t('team.create')} icon={busy ? undefined : 'check'} disabled={busy} onPress={create} style={{ marginTop: 14 }} />
    </Sheet>
  );
}

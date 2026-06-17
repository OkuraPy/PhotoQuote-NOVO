// PhotoQuote v2 — Client detail, Client edit, Company edit
import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '../Icon';
import { colors, fonts } from '../theme';
import { Client, initials } from '../data';
import { Avatar, Between, Btn, Card, Divider, Empty, Field, Input, Nav, NavBtn, Row, SectionTitle, useStore } from '../ui';
import { JobCard } from './Tabs';
import { useAuth } from '../lib/auth';
import { countClientProjects, createClient, deleteClient, fetchCompanyProfile, fetchJobs, lookupZip, updateClient, updateCompanyProfile, uploadCompanyLogo } from '../lib/api';
import { LOCALES, registerStrings, useLocale, useT } from '../lib/i18n';

type NavProp = { go: (n: string, p?: any, mode?: string) => void; back: () => void; params?: any };
const scroll = { paddingHorizontal: 20, paddingBottom: 120 };
const actionbar = { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 };

registerStrings({
  // ClientScreen
  'misc.clientTitle': { en: 'Client', es: 'Cliente', pt: 'Cliente' },
  'misc.clientNotFound': { en: 'Client not found', es: 'Cliente no encontrado', pt: 'Cliente não encontrado' },
  'misc.clientNotFoundBody': { en: 'Open a client from the list to see their details.', es: 'Abre un cliente de la lista para ver sus detalles.', pt: 'Abra um cliente da lista para ver os detalhes.' },
  'misc.call': { en: 'Call', es: 'Llamar', pt: 'Ligar' },
  'misc.text': { en: 'Text', es: 'Mensaje', pt: 'Mensagem' },
  'misc.email': { en: 'Email', es: 'Correo', pt: 'E-mail' },
  'misc.phone': { en: 'Phone', es: 'Teléfono', pt: 'Telefone' },
  'misc.jobHistory': { en: 'Job history', es: 'Historial de trabajos', pt: 'Histórico de trabalhos' },
  'misc.total': { en: '{count} total', es: '{count} en total', pt: '{count} no total' },
  'misc.noJobsYet': { en: 'No jobs yet for this client.', es: 'Aún no hay trabajos para este cliente.', pt: 'Ainda não há trabalhos para este cliente.' },
  'misc.newQuoteFor': { en: 'New quote for {name}', es: 'Nuevo presupuesto para {name}', pt: 'Novo orçamento para {name}' },
  // ClientEditScreen
  'misc.editClient': { en: 'Edit client', es: 'Editar cliente', pt: 'Editar cliente' },
  'misc.newClient': { en: 'New client', es: 'Nuevo cliente', pt: 'Novo cliente' },
  'misc.name': { en: 'Name', es: 'Nombre', pt: 'Nome' },
  'misc.namePlaceholder': { en: 'Client or company name', es: 'Nombre del cliente o empresa', pt: 'Nome do cliente ou empresa' },
  'misc.emailPlaceholder': { en: 'name@email.com', es: 'nombre@correo.com', pt: 'nome@email.com' },
  'misc.zip': { en: 'ZIP', es: 'Código postal', pt: 'CEP' },
  'misc.cityState': { en: 'City / State', es: 'Ciudad / Estado', pt: 'Cidade / Estado' },
  'misc.lookingUp': { en: 'Looking up…', es: 'Buscando…', pt: 'Buscando…' },
  'misc.autoFillsFromZip': { en: 'auto-fills from ZIP', es: 'se autocompleta con el código postal', pt: 'preenche automaticamente pelo CEP' },
  'misc.streetAddress': { en: 'Street address', es: 'Dirección', pt: 'Endereço' },
  'misc.streetAddressPlaceholder': { en: '123 Main St', es: 'Calle Principal 123', pt: 'Rua Principal, 123' },
  'misc.notes': { en: 'Notes', es: 'Notas', pt: 'Notas' },
  'misc.notesPlaceholder': { en: 'Gate code, preferred times, etc.', es: 'Código de portón, horarios preferidos, etc.', pt: 'Código do portão, horários preferidos, etc.' },
  'misc.deleteClient': { en: 'Delete client', es: 'Eliminar cliente', pt: 'Excluir cliente' },
  'misc.saving': { en: 'Saving…', es: 'Guardando…', pt: 'Salvando…' },
  'misc.saveChanges': { en: 'Save changes', es: 'Guardar cambios', pt: 'Salvar alterações' },
  'misc.createClient': { en: 'Create client', es: 'Crear cliente', pt: 'Criar cliente' },
  'misc.required': { en: 'Required', es: 'Obligatorio', pt: 'Obrigatório' },
  'misc.clientNameRequired': { en: 'Client name is required.', es: 'El nombre del cliente es obligatorio.', pt: 'O nome do cliente é obrigatório.' },
  'misc.error': { en: 'Error', es: 'Error', pt: 'Erro' },
  'misc.couldNotSaveClient': { en: 'Could not save client.', es: 'No se pudo guardar el cliente.', pt: 'Não foi possível salvar o cliente.' },
  'misc.couldNotDelete': { en: 'Could not delete.', es: 'No se pudo eliminar.', pt: 'Não foi possível excluir.' },
  'misc.deleteClientHasJobs': { en: "{name} has {count} job{plural}. Deleting keeps {them} but unlinks {them} from this client. This can't be undone.", es: '{name} tiene {count} trabajo{plural}. Al eliminarlo se conserva{plural} pero se desvincula{plural} de este cliente. Esto no se puede deshacer.', pt: '{name} tem {count} trabalho{plural}. Ao excluir, ele{plural} é mantido{plural}, mas desvinculado{plural} deste cliente. Isso não pode ser desfeito.' },
  'misc.removeConfirm': { en: "Remove {name}? This can't be undone.", es: '¿Eliminar a {name}? Esto no se puede deshacer.', pt: 'Remover {name}? Isso não pode ser desfeito.' },
  'misc.deleteClientQ': { en: 'Delete client?', es: '¿Eliminar cliente?', pt: 'Excluir cliente?' },
  'misc.cancel': { en: 'Cancel', es: 'Cancelar', pt: 'Cancelar' },
  'misc.delete': { en: 'Delete', es: 'Eliminar', pt: 'Excluir' },
  // CompanyScreen
  'misc.businessDetails': { en: 'Business details', es: 'Datos del negocio', pt: 'Dados do negócio' },
  'misc.uploading': { en: 'Uploading…', es: 'Subiendo…', pt: 'Enviando…' },
  'misc.changeLogo': { en: 'Change logo', es: 'Cambiar logo', pt: 'Alterar logo' },
  'misc.addLogo': { en: 'Add logo', es: 'Agregar logo', pt: 'Adicionar logo' },
  'misc.couldNotUploadLogo': { en: 'Could not upload logo', es: 'No se pudo subir el logo', pt: 'Não foi possível enviar o logo' },
  'misc.tryAgain': { en: 'Try again.', es: 'Inténtalo de nuevo.', pt: 'Tente novamente.' },
  'misc.couldNotSave': { en: 'Could not save.', es: 'No se pudo guardar.', pt: 'Não foi possível salvar.' },
  'misc.companyName': { en: 'Company name', es: 'Nombre de la empresa', pt: 'Nome da empresa' },
  'misc.companyNamePlaceholder': { en: 'Your company', es: 'Tu empresa', pt: 'Sua empresa' },
  'misc.licenseNum': { en: 'License #', es: 'N.º de licencia', pt: 'N.º de licença' },
  'misc.address': { en: 'Address', es: 'Dirección', pt: 'Endereço' },
  'misc.addressPlaceholder': { en: 'Street, city, state', es: 'Calle, ciudad, estado', pt: 'Rua, cidade, estado' },
  'misc.defaultTax': { en: 'Default tax %', es: 'Impuesto predeterminado %', pt: 'Imposto padrão %' },
  'misc.defaultTaxPlaceholder': { en: 'e.g. 8.25', es: 'p. ej. 8.25', pt: 'ex. 8.25' },
  'misc.defaultDeposit': { en: 'Default deposit %', es: 'Depósito predeterminado %', pt: 'Sinal padrão %' },
  'misc.defaultDepositPlaceholder': { en: 'e.g. 25', es: 'p. ej. 25', pt: 'ex. 25' },
  'misc.defaultMargin': { en: 'Default margin % (internal markup)', es: 'Margen predeterminado % (margen interno)', pt: 'Margem padrão % (margem interna)' },
  'misc.defaultMarginPlaceholder': { en: 'e.g. 15', es: 'p. ej. 15', pt: 'ex. 15' },
  'misc.save': { en: 'Save', es: 'Guardar', pt: 'Salvar' },
  // ChangePasswordScreen
  'misc.changePassword': { en: 'Change password', es: 'Cambiar contraseña', pt: 'Alterar senha' },
  'misc.tooShort': { en: 'Too short', es: 'Demasiado corta', pt: 'Muito curta' },
  'misc.useAtLeast6': { en: 'Use at least 6 characters.', es: 'Usa al menos 6 caracteres.', pt: 'Use pelo menos 6 caracteres.' },
  'misc.doesntMatch': { en: "Doesn't match", es: 'No coincide', pt: 'Não confere' },
  'misc.passwordsDifferent': { en: 'The two passwords are different.', es: 'Las dos contraseñas son diferentes.', pt: 'As duas senhas são diferentes.' },
  'misc.couldNotUpdatePassword': { en: 'Could not update password.', es: 'No se pudo actualizar la contraseña.', pt: 'Não foi possível atualizar a senha.' },
  'misc.passwordUpdated': { en: 'Password updated', es: 'Contraseña actualizada', pt: 'Senha atualizada' },
  'misc.passwordChanged': { en: 'Your password has been changed.', es: 'Tu contraseña ha sido cambiada.', pt: 'Sua senha foi alterada.' },
  'misc.newPassword': { en: 'New password', es: 'Nueva contraseña', pt: 'Nova senha' },
  'misc.atLeast6': { en: 'At least 6 characters', es: 'Al menos 6 caracteres', pt: 'Pelo menos 6 caracteres' },
  'misc.confirmNewPassword': { en: 'Confirm new password', es: 'Confirmar nueva contraseña', pt: 'Confirmar nova senha' },
  'misc.repeatPassword': { en: 'Repeat the password', es: 'Repite la contraseña', pt: 'Repita a senha' },
  'misc.updatePassword': { en: 'Update password', es: 'Actualizar contraseña', pt: 'Atualizar senha' },
  // LanguageScreen
  'misc.language': { en: 'Language', es: 'Idioma', pt: 'Idioma' },
  'misc.languageHint': { en: 'English is fully translated. Spanish & Portuguese are being added.', es: 'El inglés está totalmente traducido. El español y el portugués se están añadiendo.', pt: 'O inglês está totalmente traduzido. Espanhol e português estão sendo adicionados.' },
});

export function ClientScreen({ go, back, params }: NavProp) {
  const t = useT();
  const c: Client | undefined = params?.client;
  const { user } = useAuth();
  const { data: allJobs = [] } = useQuery({ queryKey: ['jobs', user?.id], queryFn: () => fetchJobs(user!.id), enabled: !!user?.id });
  const jobs = c?.id ? allJobs.filter((j) => j.clientId === c.id) : [];
  const acts: [string, string, string][] = [
    ['phone', t('misc.call'), colors.primary],
    ['msg', t('misc.text'), colors.info],
    ['mail', t('misc.email'), colors.accentInk],
  ];
  if (!c) {
    return (
      <>
        <Nav title={t('misc.clientTitle')} center onBack={back} />
        <Empty icon="users" title={t('misc.clientNotFound')} body={t('misc.clientNotFoundBody')} />
      </>
    );
  }
  return (
    <>
      <Nav title={t('misc.clientTitle')} center onBack={back} right={<NavBtn icon="edit" size={17} onPress={() => go('clientEdit', { client: c })} />} />
      <ScrollView contentContainerStyle={scroll} showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', paddingVertical: 8 }}>
          <Avatar text={initials(c.name)} size={72} radius={22} fontSize={26} />
          <Text style={{ fontFamily: fonts.extrabold, fontSize: 22, color: colors.ink, letterSpacing: -0.4, marginTop: 14 }}>{c.name}</Text>
          {c.addr || c.city ? (
            <Row style={{ gap: 6, marginTop: 8 }}>
              <Icon name="mapPin" size={13} color={colors.muted} />
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted }}>{[c.addr, c.city].filter(Boolean).join(', ')}</Text>
            </Row>
          ) : null}
        </View>
        <Row style={{ gap: 10, marginTop: 20 }}>
          {acts.map(([ico, l, col]) => (
            <View key={l} style={{ flex: 1 }}>
              <Btn variant="ghost" style={{ height: 64, flexDirection: 'column', gap: 5 }} title={l} icon={ico} />
            </View>
          ))}
        </Row>
        <Card pad style={{ marginTop: 16 }}>
          <Between>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted }}>{t('misc.phone')}</Text>
            <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.ink }}>{c.phone || '—'}</Text>
          </Between>
          <Divider />
          <Between>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted }}>{t('misc.email')}</Text>
            <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.ink }}>{c.email || '—'}</Text>
          </Between>
        </Card>
        <SectionTitle title={t('misc.jobHistory')} link={t('misc.total', { count: jobs.length })} />
        <View style={{ gap: 10 }}>
          {jobs.length ? (
            jobs.map((j, i) => <JobCard key={j.id} j={j} i={i} onPress={() => go('job', { job: j })} />)
          ) : (
            <Card pad style={{ alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted }}>{t('misc.noJobsYet')}</Text>
            </Card>
          )}
        </View>
      </ScrollView>
      <View style={actionbar}>
        <Btn title={t('misc.newQuoteFor', { name: c.name.split(' ')[0] })} icon="camera" onPress={() => go('camera')} />
      </View>
    </>
  );
}

export function ClientEditScreen({ back, params }: NavProp) {
  const t = useT();
  const existing: Client | undefined = params?.client;
  const editing = !!existing;
  const { user } = useAuth();
  const { up } = useStore();
  const qc = useQueryClient();
  const [name, setName] = useState(existing?.name || '');
  const [phone, setPhone] = useState(existing?.phone || '');
  const [email, setEmail] = useState(existing?.email || '');
  const [zip, setZip] = useState(existing?.zip || '');
  const [city, setCity] = useState(existing?.city || '');
  const [address, setAddress] = useState(existing?.addr || '');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [zipBusy, setZipBusy] = useState(false);

  // ZIP → real city/state via Zippopotam (was a hardcoded "Austin, TX" mock)
  const onZip = async (v: string) => {
    const clean = v.replace(/\D/g, '').slice(0, 5);
    setZip(clean);
    if (clean.length < 5) return;
    setZipBusy(true);
    const r = await lookupZip(clean);
    setZipBusy(false);
    if (r) setCity(`${r.city}, ${r.state}`);
  };

  const save = async () => {
    if (!name.trim()) { Alert.alert(t('misc.required'), t('misc.clientNameRequired')); return; }
    if (!user) return;
    setBusy(true);
    try {
      // the city field holds "City, ST" (from the ZIP lookup or typed) — split into structured parts
      const [cityName, stateRaw] = city.split(',').map((s) => s.trim());
      const state = (stateRaw || '').toUpperCase().slice(0, 2);
      const payload = { name, phone, email, street: address, city: cityName || '', state, zip, notes };
      if (editing && existing) {
        await updateClient(existing.id, payload);
      } else {
        const created = await createClient(user.id, payload);
        // coming from the estimate flow → pre-select the new client back on the Attach screen
        if (params?.from === 'attach' && created?.id) {
          up({ aSel: { id: created.id, name: name.trim(), phone, email, addr: address, city } });
        }
      }
      qc.invalidateQueries({ queryKey: ['clients'] });
      back();
    } catch (e: any) {
      Alert.alert(t('misc.error'), e.message || t('misc.couldNotSaveClient'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!existing) return;
    const doDelete = async () => {
      try {
        await deleteClient(existing.id);
        qc.invalidateQueries({ queryKey: ['clients'] });
        qc.invalidateQueries({ queryKey: ['jobs'] });
        back();
      } catch (e: any) {
        Alert.alert(t('misc.error'), e.message || t('misc.couldNotDelete'));
      }
    };
    // jobs are kept (FK is ON DELETE SET NULL) — warn that they'll just be unlinked
    const n = await countClientProjects(existing.id).catch(() => 0);
    const msg = n > 0
      ? t('misc.deleteClientHasJobs', { name: existing.name, count: n, plural: n > 1 ? 's' : '', them: n > 1 ? 'them' : 'it' })
      : t('misc.removeConfirm', { name: existing.name });
    Alert.alert(t('misc.deleteClientQ'), msg, [
      { text: t('misc.cancel'), style: 'cancel' },
      { text: t('misc.delete'), style: 'destructive', onPress: doDelete },
    ]);
  };

  return (
    <>
      <Nav title={editing ? t('misc.editClient') : t('misc.newClient')} center onBack={back} />
      <ScrollView contentContainerStyle={scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Field label={t('misc.name')}><Input value={name} onChangeText={setName} placeholder={t('misc.namePlaceholder')} autoFocus={!editing} /></Field>
        <Field label={t('misc.phone')} opt><Input value={phone} onChangeText={setPhone} placeholder="(555) 000-0000" keyboardType="phone-pad" /></Field>
        <Field label={t('misc.email')} opt><Input value={email} onChangeText={setEmail} placeholder={t('misc.emailPlaceholder')} keyboardType="email-address" autoCapitalize="none" /></Field>
        <Row style={{ gap: 10, alignItems: 'flex-start' }}>
          <View style={{ flex: 0.4 }}>
            <Field label={t('misc.zip')}><Input value={zip} onChangeText={onZip} placeholder={t('misc.zip')} keyboardType="number-pad" maxLength={5} /></Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label={t('misc.cityState')}><Input value={city} onChangeText={setCity} placeholder={zipBusy ? t('misc.lookingUp') : t('misc.autoFillsFromZip')} /></Field>
          </View>
        </Row>
        <Field label={t('misc.streetAddress')} opt><Input value={address} onChangeText={setAddress} placeholder={t('misc.streetAddressPlaceholder')} /></Field>
        <Field label={t('misc.notes')} opt><Input value={notes} onChangeText={setNotes} multiline placeholder={t('misc.notesPlaceholder')} style={{ height: 80, paddingTop: 13 }} /></Field>
        {editing ? <Btn variant="danger" icon="trash" title={t('misc.deleteClient')} onPress={remove} style={{ marginTop: 8 }} /> : null}
      </ScrollView>
      <View style={actionbar}>
        <Btn title={busy ? t('misc.saving') : editing ? t('misc.saveChanges') : t('misc.createClient')} onPress={save} disabled={busy} />
      </View>
    </>
  );
}

export function CompanyScreen({ back }: NavProp) {
  const t = useT();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: profile } = useQuery({ queryKey: ['company', user?.id], queryFn: () => fetchCompanyProfile(user!.id), enabled: !!user?.id });
  const [name, setName] = useState('');
  const [license, setLicense] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [deposit, setDeposit] = useState('');
  const [taxRate, setTaxRate] = useState('');
  const [margin, setMargin] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoBusy, setLogoBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const p = profile as any;
    if (p) {
      setName(p.company_name || '');
      setLicense(p.company_license || '');
      setPhone(p.company_phone || '');
      setEmail(p.company_email || '');
      setAddress(p.company_address || '');
      setDeposit(p.default_deposit_percent != null ? String(p.default_deposit_percent) : '');
      setTaxRate(p.default_tax_percent != null ? String(p.default_tax_percent) : '');
      setMargin(p.default_margin_percent != null ? String(p.default_margin_percent) : '');
      setLogoUrl(p.logo_url || '');
    }
  }, [profile]);

  const pickLogo = async () => {
    if (!user) return;
    const res = await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: false, quality: 0.9 });
    if (res.canceled || !res.assets?.length) return;
    setLogoBusy(true);
    try {
      const url = await uploadCompanyLogo(user.id, res.assets[0].uri);
      setLogoUrl(url);
    } catch (e: any) {
      Alert.alert(t('misc.couldNotUploadLogo'), e?.message || t('misc.tryAgain'));
    } finally {
      setLogoBusy(false);
    }
  };
  const save = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const depNum = deposit.trim() === '' ? null : Math.max(0, Math.min(100, parseInt(deposit, 10) || 0));
      const taxNum = taxRate.trim() === '' ? null : Math.max(0, parseFloat(taxRate) || 0);
      const marginNum = margin.trim() === '' ? null : Math.max(0, parseFloat(margin) || 0);
      await updateCompanyProfile(user.id, { company_name: name, company_license: license, company_phone: phone, company_email: email, company_address: address, default_deposit_percent: depNum, default_tax_percent: taxNum, default_margin_percent: marginNum, logo_url: logoUrl || null });
      qc.invalidateQueries({ queryKey: ['company'] });
      back();
    } catch (e: any) {
      Alert.alert(t('misc.error'), e.message || t('misc.couldNotSave'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Nav title={t('misc.businessDetails')} center onBack={back} />
      <ScrollView contentContainerStyle={scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', marginBottom: 18 }}>
          <Pressable onPress={pickLogo} style={{ width: 96, height: 96, borderRadius: 24, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
            {logoUrl ? <Image source={{ uri: logoUrl }} style={{ width: 96, height: 96 }} resizeMode="cover" /> : <Icon name="image" size={30} color={colors.primary} />}
          </Pressable>
          <Pressable onPress={pickLogo} disabled={logoBusy} hitSlop={8}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.primary, marginTop: 10 }}>{logoBusy ? t('misc.uploading') : logoUrl ? t('misc.changeLogo') : t('misc.addLogo')}</Text>
          </Pressable>
        </View>
        <Field label={t('misc.companyName')}><Input value={name} onChangeText={setName} placeholder={t('misc.companyNamePlaceholder')} /></Field>
        <Field label={t('misc.licenseNum')} opt><Input value={license} onChangeText={setLicense} placeholder="GC-000000" /></Field>
        <Field label={t('misc.phone')}><Input value={phone} onChangeText={setPhone} keyboardType="phone-pad" /></Field>
        <Field label={t('misc.email')}><Input value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" /></Field>
        <Field label={t('misc.address')}><Input value={address} onChangeText={setAddress} placeholder={t('misc.addressPlaceholder')} /></Field>
        <Row style={{ gap: 10 }}>
          <View style={{ flex: 1 }}><Field label={t('misc.defaultTax')} opt><Input value={taxRate} onChangeText={setTaxRate} keyboardType="decimal-pad" placeholder={t('misc.defaultTaxPlaceholder')} /></Field></View>
          <View style={{ flex: 1 }}><Field label={t('misc.defaultDeposit')} opt><Input value={deposit} onChangeText={setDeposit} keyboardType="number-pad" placeholder={t('misc.defaultDepositPlaceholder')} maxLength={3} /></Field></View>
        </Row>
        <Field label={t('misc.defaultMargin')} opt><Input value={margin} onChangeText={setMargin} keyboardType="decimal-pad" placeholder={t('misc.defaultMarginPlaceholder')} /></Field>
      </ScrollView>
      <View style={actionbar}>
        <Btn title={busy ? t('misc.saving') : t('misc.save')} onPress={save} disabled={busy} />
      </View>
    </>
  );
}

export function ChangePasswordScreen({ back }: NavProp) {
  const t = useT();
  const { updatePassword } = useAuth();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (pw.length < 6) { Alert.alert(t('misc.tooShort'), t('misc.useAtLeast6')); return; }
    if (pw !== pw2) { Alert.alert(t('misc.doesntMatch'), t('misc.passwordsDifferent')); return; }
    setBusy(true);
    const { error } = await updatePassword(pw);
    setBusy(false);
    if (error) { Alert.alert(t('misc.error'), error.message || t('misc.couldNotUpdatePassword')); return; }
    Alert.alert(t('misc.passwordUpdated'), t('misc.passwordChanged'));
    back();
  };
  return (
    <>
      <Nav title={t('misc.changePassword')} center onBack={back} />
      <ScrollView contentContainerStyle={scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Field label={t('misc.newPassword')}><Input value={pw} onChangeText={setPw} secureTextEntry placeholder={t('misc.atLeast6')} autoFocus /></Field>
        <Field label={t('misc.confirmNewPassword')}><Input value={pw2} onChangeText={setPw2} secureTextEntry placeholder={t('misc.repeatPassword')} /></Field>
      </ScrollView>
      <View style={actionbar}>
        <Btn title={busy ? t('misc.saving') : t('misc.updatePassword')} onPress={save} disabled={busy} />
      </View>
    </>
  );
}

export function LanguageScreen({ back }: NavProp) {
  const t = useT();
  const [locale, setLoc] = useLocale();
  return (
    <>
      <Nav title={t('misc.language')} center onBack={back} />
      <ScrollView contentContainerStyle={scroll} showsVerticalScrollIndicator={false}>
        <Card style={{ overflow: 'hidden', marginTop: 8 }}>
          {LOCALES.map((l, i) => (
            <Pressable
              key={l.code}
              onPress={() => setLoc(l.code)}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, paddingHorizontal: 16, borderBottomWidth: i === LOCALES.length - 1 ? 0 : 1, borderBottomColor: colors.border }}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.ink }}>{l.label}</Text>
              {locale === l.code ? <Icon name="check" size={18} color={colors.primary} /> : null}
            </Pressable>
          ))}
        </Card>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted, marginTop: 14, textAlign: 'center', lineHeight: 18 }}>{t('misc.languageHint')}</Text>
      </ScrollView>
    </>
  );
}

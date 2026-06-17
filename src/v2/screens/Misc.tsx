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

type NavProp = { go: (n: string, p?: any, mode?: string) => void; back: () => void; params?: any };
const scroll = { paddingHorizontal: 20, paddingBottom: 120 };
const actionbar = { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 };

export function ClientScreen({ go, back, params }: NavProp) {
  const c: Client | undefined = params?.client;
  const { user } = useAuth();
  const { data: allJobs = [] } = useQuery({ queryKey: ['jobs', user?.id], queryFn: () => fetchJobs(user!.id), enabled: !!user?.id });
  const jobs = c?.id ? allJobs.filter((j) => j.clientId === c.id) : [];
  const acts: [string, string, string][] = [
    ['phone', 'Call', colors.primary],
    ['msg', 'Text', colors.info],
    ['mail', 'Email', colors.accentInk],
  ];
  if (!c) {
    return (
      <>
        <Nav title="Client" center onBack={back} />
        <Empty icon="users" title="Client not found" body="Open a client from the list to see their details." />
      </>
    );
  }
  return (
    <>
      <Nav title="Client" center onBack={back} right={<NavBtn icon="edit" size={17} onPress={() => go('clientEdit', { client: c })} />} />
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
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted }}>Phone</Text>
            <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.ink }}>{c.phone || '—'}</Text>
          </Between>
          <Divider />
          <Between>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted }}>Email</Text>
            <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.ink }}>{c.email || '—'}</Text>
          </Between>
        </Card>
        <SectionTitle title="Job history" link={`${jobs.length} total`} />
        <View style={{ gap: 10 }}>
          {jobs.length ? (
            jobs.map((j, i) => <JobCard key={j.id} j={j} i={i} onPress={() => go('job', { job: j })} />)
          ) : (
            <Card pad style={{ alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted }}>No jobs yet for this client.</Text>
            </Card>
          )}
        </View>
      </ScrollView>
      <View style={actionbar}>
        <Btn title={`New quote for ${c.name.split(' ')[0]}`} icon="camera" onPress={() => go('camera')} />
      </View>
    </>
  );
}

export function ClientEditScreen({ back, params }: NavProp) {
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
    if (!name.trim()) { Alert.alert('Required', 'Client name is required.'); return; }
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
      Alert.alert('Error', e.message || 'Could not save client.');
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
        Alert.alert('Error', e.message || 'Could not delete.');
      }
    };
    // jobs are kept (FK is ON DELETE SET NULL) — warn that they'll just be unlinked
    const n = await countClientProjects(existing.id).catch(() => 0);
    const msg = n > 0
      ? `${existing.name} has ${n} job${n > 1 ? 's' : ''}. Deleting keeps ${n > 1 ? 'them' : 'it'} but unlinks ${n > 1 ? 'them' : 'it'} from this client. This can't be undone.`
      : `Remove ${existing.name}? This can't be undone.`;
    Alert.alert('Delete client?', msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doDelete },
    ]);
  };

  return (
    <>
      <Nav title={editing ? 'Edit client' : 'New client'} center onBack={back} />
      <ScrollView contentContainerStyle={scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Field label="Name"><Input value={name} onChangeText={setName} placeholder="Client or company name" autoFocus={!editing} /></Field>
        <Field label="Phone" opt><Input value={phone} onChangeText={setPhone} placeholder="(555) 000-0000" keyboardType="phone-pad" /></Field>
        <Field label="Email" opt><Input value={email} onChangeText={setEmail} placeholder="name@email.com" keyboardType="email-address" autoCapitalize="none" /></Field>
        <Row style={{ gap: 10, alignItems: 'flex-start' }}>
          <View style={{ flex: 0.4 }}>
            <Field label="ZIP"><Input value={zip} onChangeText={onZip} placeholder="ZIP" keyboardType="number-pad" maxLength={5} /></Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="City / State"><Input value={city} onChangeText={setCity} placeholder={zipBusy ? 'Looking up…' : 'auto-fills from ZIP'} /></Field>
          </View>
        </Row>
        <Field label="Street address" opt><Input value={address} onChangeText={setAddress} placeholder="123 Main St" /></Field>
        <Field label="Notes" opt><Input value={notes} onChangeText={setNotes} multiline placeholder="Gate code, preferred times, etc." style={{ height: 80, paddingTop: 13 }} /></Field>
        {editing ? <Btn variant="danger" icon="trash" title="Delete client" onPress={remove} style={{ marginTop: 8 }} /> : null}
      </ScrollView>
      <View style={actionbar}>
        <Btn title={busy ? 'Saving…' : editing ? 'Save changes' : 'Create client'} onPress={save} disabled={busy} />
      </View>
    </>
  );
}

export function CompanyScreen({ back }: NavProp) {
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
      Alert.alert('Could not upload logo', e?.message || 'Try again.');
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
      Alert.alert('Error', e.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Nav title="Business details" center onBack={back} />
      <ScrollView contentContainerStyle={scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', marginBottom: 18 }}>
          <Pressable onPress={pickLogo} style={{ width: 96, height: 96, borderRadius: 24, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
            {logoUrl ? <Image source={{ uri: logoUrl }} style={{ width: 96, height: 96 }} resizeMode="cover" /> : <Icon name="image" size={30} color={colors.primary} />}
          </Pressable>
          <Pressable onPress={pickLogo} disabled={logoBusy} hitSlop={8}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.primary, marginTop: 10 }}>{logoBusy ? 'Uploading…' : logoUrl ? 'Change logo' : 'Add logo'}</Text>
          </Pressable>
        </View>
        <Field label="Company name"><Input value={name} onChangeText={setName} placeholder="Your company" /></Field>
        <Field label="License #" opt><Input value={license} onChangeText={setLicense} placeholder="GC-000000" /></Field>
        <Field label="Phone"><Input value={phone} onChangeText={setPhone} keyboardType="phone-pad" /></Field>
        <Field label="Email"><Input value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" /></Field>
        <Field label="Address"><Input value={address} onChangeText={setAddress} placeholder="Street, city, state" /></Field>
        <Row style={{ gap: 10 }}>
          <View style={{ flex: 1 }}><Field label="Default tax %" opt><Input value={taxRate} onChangeText={setTaxRate} keyboardType="decimal-pad" placeholder="e.g. 8.25" /></Field></View>
          <View style={{ flex: 1 }}><Field label="Default deposit %" opt><Input value={deposit} onChangeText={setDeposit} keyboardType="number-pad" placeholder="e.g. 25" maxLength={3} /></Field></View>
        </Row>
        <Field label="Default margin % (internal markup)" opt><Input value={margin} onChangeText={setMargin} keyboardType="decimal-pad" placeholder="e.g. 15" /></Field>
      </ScrollView>
      <View style={actionbar}>
        <Btn title={busy ? 'Saving…' : 'Save'} onPress={save} disabled={busy} />
      </View>
    </>
  );
}

export function ChangePasswordScreen({ back }: NavProp) {
  const { updatePassword } = useAuth();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (pw.length < 6) { Alert.alert('Too short', 'Use at least 6 characters.'); return; }
    if (pw !== pw2) { Alert.alert("Doesn't match", 'The two passwords are different.'); return; }
    setBusy(true);
    const { error } = await updatePassword(pw);
    setBusy(false);
    if (error) { Alert.alert('Error', error.message || 'Could not update password.'); return; }
    Alert.alert('Password updated', 'Your password has been changed.');
    back();
  };
  return (
    <>
      <Nav title="Change password" center onBack={back} />
      <ScrollView contentContainerStyle={scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Field label="New password"><Input value={pw} onChangeText={setPw} secureTextEntry placeholder="At least 6 characters" autoFocus /></Field>
        <Field label="Confirm new password"><Input value={pw2} onChangeText={setPw2} secureTextEntry placeholder="Repeat the password" /></Field>
      </ScrollView>
      <View style={actionbar}>
        <Btn title={busy ? 'Saving…' : 'Update password'} onPress={save} disabled={busy} />
      </View>
    </>
  );
}

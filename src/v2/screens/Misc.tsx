// PhotoQuote v2 — Client detail, Client edit, Company edit
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '../Icon';
import { colors, fonts } from '../theme';
import { Client, CLIENTS, initials, JOBS } from '../data';
import { Avatar, Between, Btn, Card, Divider, Field, Input, Nav, NavBtn, Row, SectionTitle, useStore } from '../ui';
import { JobCard } from './Tabs';
import { useAuth } from '../lib/auth';
import { createClient, deleteClient, fetchCompanyProfile, updateClient, updateCompanyProfile } from '../lib/api';

type NavProp = { go: (n: string, p?: any, mode?: string) => void; back: () => void; params?: any };
const scroll = { paddingHorizontal: 20, paddingBottom: 120 };
const actionbar = { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 };

export function ClientScreen({ go, back, params }: NavProp) {
  const c: Client = params?.client || CLIENTS[0];
  const jobs = JOBS.filter((j) => j.client === c.name); // job history wired in Fase 2
  const acts: [string, string, string][] = [
    ['phone', 'Call', colors.primary],
    ['msg', 'Text', colors.info],
    ['mail', 'Email', colors.accentInk],
  ];
  return (
    <>
      <Nav title="Client" center onBack={back} right={<NavBtn icon="edit" size={17} onPress={() => go('clientEdit', { client: c })} />} />
      <ScrollView contentContainerStyle={scroll} showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', paddingVertical: 8 }}>
          <Avatar text={initials(c.name)} size={72} radius={22} fontSize={26} />
          <Text style={{ fontFamily: fonts.extrabold, fontSize: 22, color: colors.ink, letterSpacing: -0.4, marginTop: 14 }}>{c.name}</Text>
          <Row style={{ gap: 6, marginTop: 8 }}>
            <Icon name="mapPin" size={13} color={colors.muted} />
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted }}>{c.addr}, {c.city}</Text>
          </Row>
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
            <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.ink }}>{c.phone}</Text>
          </Between>
          <Divider />
          <Between>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted }}>Email</Text>
            <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.ink }}>{c.email}</Text>
          </Between>
        </Card>
        <SectionTitle title="Job history" link={`${jobs.length || 0} total`} />
        <View style={{ gap: 10 }}>
          {jobs.length ? (
            jobs.map((j, i) => <JobCard key={j.id} j={j} i={i} onPress={() => go('job', { id: j.id })} />)
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
  const [zip, setZip] = useState('');
  const [city, setCity] = useState(existing?.city || '');
  const [address, setAddress] = useState(existing?.addr || '');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) { Alert.alert('Required', 'Client name is required.'); return; }
    if (!user) return;
    setBusy(true);
    try {
      const payload = { name, phone, email, address: address || city, notes };
      if (editing && existing) {
        await updateClient(existing.id, payload);
      } else {
        const created = await createClient(user.id, payload);
        // coming from the estimate flow → pre-select the new client back on the Attach screen
        if (params?.from === 'attach' && created?.id) {
          up({ aSel: { id: created.id, name: name.trim(), phone, email, addr: address || city, city } });
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

  const remove = () => {
    if (!existing) return;
    Alert.alert('Delete client?', `Remove ${existing.name}? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteClient(existing.id);
            qc.invalidateQueries({ queryKey: ['clients'] });
            back();
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Could not delete.');
          }
        },
      },
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
            <Field label="ZIP"><Input value={zip} onChangeText={(v) => { setZip(v); if (v.length >= 5 && !city) setCity('Austin, TX'); }} placeholder="ZIP" keyboardType="number-pad" /></Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="City / State"><Input value={city} onChangeText={setCity} placeholder="auto-fills from ZIP" /></Field>
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
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const p = profile as any;
    if (p) {
      setName(p.company_name || '');
      setLicense(p.company_license || '');
      setPhone(p.company_phone || '');
      setEmail(p.company_email || '');
      setAddress(p.company_address || '');
    }
  }, [profile]);
  const save = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await updateCompanyProfile(user.id, { company_name: name, company_license: license, company_phone: phone, company_email: email, company_address: address });
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
        <Field label="Company name"><Input value={name} onChangeText={setName} placeholder="Your company" /></Field>
        <Field label="License #" opt><Input value={license} onChangeText={setLicense} placeholder="GC-000000" /></Field>
        <Field label="Phone"><Input value={phone} onChangeText={setPhone} keyboardType="phone-pad" /></Field>
        <Field label="Email"><Input value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" /></Field>
        <Field label="Address"><Input value={address} onChangeText={setAddress} placeholder="Street, city, state" /></Field>
      </ScrollView>
      <View style={actionbar}>
        <Btn title={busy ? 'Saving…' : 'Save'} onPress={save} disabled={busy} />
      </View>
    </>
  );
}

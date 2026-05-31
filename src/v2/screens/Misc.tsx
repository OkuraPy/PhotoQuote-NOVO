// PhotoQuote v2 — Client detail, Client edit, Company edit
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Icon } from '../Icon';
import { colors, fonts } from '../theme';
import { CLIENTS, COMPANY, initials, JOBS } from '../data';
import { Avatar, Between, Btn, Card, Divider, Field, Input, Nav, NavBtn, Row, SectionTitle } from '../ui';
import { JobCard } from './Tabs';

type NavProp = { go: (n: string, p?: any, mode?: string) => void; back: () => void; params?: any };
const scroll = { paddingHorizontal: 20, paddingBottom: 120 };
const actionbar = { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 };

export function ClientScreen({ go, back, params }: NavProp) {
  const c = CLIENTS.find((x) => x.id === params?.id) || CLIENTS[0];
  const jobs = JOBS.filter((j) => j.client === c.name);
  const acts: [string, string, string][] = [
    ['phone', 'Call', colors.primary],
    ['msg', 'Text', colors.info],
    ['mail', 'Email', colors.accentInk],
  ];
  return (
    <>
      <Nav title="Client" center onBack={back} right={<NavBtn icon="edit" size={17} onPress={() => go('clientEdit', { id: c.id })} />} />
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
  const editing = params?.id;
  const c = editing ? CLIENTS.find((x) => x.id === params.id) : null;
  const [zip, setZip] = useState(c ? '78704' : '');
  const [city, setCity] = useState(c ? c.city : '');
  return (
    <>
      <Nav title={editing ? 'Edit client' : 'New client'} center onBack={back} />
      <ScrollView contentContainerStyle={scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Field label="Name"><Input defaultValue={c?.name} placeholder="Client or company name" autoFocus={!editing} /></Field>
        <Field label="Phone" opt><Input defaultValue={c?.phone} placeholder="(555) 000-0000" keyboardType="phone-pad" /></Field>
        <Field label="Email" opt><Input defaultValue={c?.email} placeholder="name@email.com" keyboardType="email-address" autoCapitalize="none" /></Field>
        <Row style={{ gap: 10, alignItems: 'flex-start' }}>
          <View style={{ flex: 0.4 }}>
            <Field label="ZIP"><Input value={zip} onChangeText={(v) => { setZip(v); if (v.length >= 5) setCity('Austin, TX'); }} placeholder="ZIP" keyboardType="number-pad" /></Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="City / State"><Input value={city} onChangeText={setCity} placeholder="auto-fills from ZIP" /></Field>
          </View>
        </Row>
        <Field label="Street address" opt><Input defaultValue={c?.addr} placeholder="123 Main St" /></Field>
        <Field label="Notes" opt><Input multiline placeholder="Gate code, preferred times, etc." style={{ height: 80, paddingTop: 13 }} /></Field>
        {editing ? <Btn variant="danger" icon="trash" title="Delete client" style={{ marginTop: 8 }} /> : null}
      </ScrollView>
      <View style={actionbar}>
        <Btn title={editing ? 'Save changes' : 'Create client'} onPress={back} />
      </View>
    </>
  );
}

export function CompanyScreen({ back }: NavProp) {
  return (
    <>
      <Nav title="Business details" center onBack={back} />
      <ScrollView contentContainerStyle={scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Field label="Company name"><Input defaultValue={COMPANY.name} /></Field>
        <Field label="License #" opt><Input defaultValue="GC-204881" /></Field>
        <Field label="Phone"><Input defaultValue={COMPANY.phone} keyboardType="phone-pad" /></Field>
        <Field label="Email"><Input defaultValue={COMPANY.email} keyboardType="email-address" autoCapitalize="none" /></Field>
        <Field label="Address"><Input defaultValue={COMPANY.addr} /></Field>
        <Field label="City / State / ZIP"><Input defaultValue={COMPANY.city} /></Field>
      </ScrollView>
      <View style={actionbar}>
        <Btn title="Save" onPress={back} />
      </View>
    </>
  );
}

// PhotoQuote v2 — tab roots: Home, Jobs, Clients, Profile
import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '../Icon';
import { colors, fonts, radii, shadow } from '../theme';
import { COMPANY, fmt0, initials, Job, split, STAGES } from '../data';
import { Avatar, Between, Btn, Card, Empty, NavBtn, Row, SearchBar, SectionTitle, StageChip, Switch, useStore } from '../ui';
import { useAuth } from '../lib/auth';
import { fetchClients, fetchCompanyProfile, fetchJobs } from '../lib/api';

type NavProp = { go: (n: string, p?: any, mode?: string) => void; back: () => void; params?: any };
const scroll = { paddingHorizontal: 20, paddingBottom: 120 };

/* ---------------- JOB CARD ---------------- */
export function JobCard({ j, i, onPress }: { j: Job; i: number; onPress: () => void }) {
  const [d, c] = split(j.value);
  return (
    <Pressable onPress={onPress}>
      <Card style={{ flexDirection: 'row', gap: 13, padding: 13, alignItems: 'center' }}>
        <View>
          <View style={{ width: 58, height: 58, borderRadius: 13, overflow: 'hidden' }}>
            {/* photo placeholder */}
            <LinearGradient colors={['#DCE2E0', '#EEF1F0']} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="image" size={20} color="#A6AEB8" />
            </LinearGradient>
          </View>
          <View style={{ position: 'absolute', right: 4, bottom: 4, backgroundColor: 'rgba(12,17,22,0.62)', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 7 }}>
            <Text style={{ fontFamily: fonts.extrabold, fontSize: 10, color: '#fff' }}>{j.photos}</Text>
          </View>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontFamily: fonts.extrabold, fontSize: 15, color: j.client ? colors.ink : colors.faint, letterSpacing: -0.2 }}>
            {j.client || 'No client yet'}
          </Text>
          <Row style={{ gap: 5, marginTop: 2 }}>
            <Icon name="mapPin" size={13} color={colors.faint} />
            <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted, flex: 1 }}>{j.addr}</Text>
          </Row>
          <Between style={{ marginTop: 9 }}>
            <Text style={{ fontFamily: fonts.extrabold, fontSize: 15, color: colors.ink }}>
              {d}<Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted }}>{c}</Text>
            </Text>
            <StageChip stage={j.stage} />
          </Between>
        </View>
      </Card>
    </Pressable>
  );
}

/* ---------------- HOME ---------------- */
export function HomeScreen({ go }: NavProp) {
  const { user } = useAuth();
  const { data: jobs = [], isLoading } = useQuery({ queryKey: ['jobs', user?.id], queryFn: () => fetchJobs(user!.id), enabled: !!user?.id });
  const { data: profile } = useQuery({ queryKey: ['company', user?.id], queryFn: () => fetchCompanyProfile(user!.id), enabled: !!user?.id });
  const pipeline = jobs.filter((j) => ['Draft', 'Quoted', 'Sent', 'Approved'].includes(j.stage)).reduce((s, j) => s + j.value, 0);
  const invoiced = jobs.filter((j) => j.stage === 'Invoiced').reduce((s, j) => s + j.value, 0);
  const collected = jobs.filter((j) => j.stage === 'Paid').reduce((s, j) => s + j.value, 0);
  const active = jobs.filter((j) => j.stage !== 'Paid').length;
  const openQuotes = jobs.filter((j) => ['Quoted', 'Sent'].includes(j.stage)).length;
  const [pd, pc] = split(pipeline);
  const recent = jobs.slice(0, 4);
  const companyName = (profile as any)?.company_name || 'Your company';
  return (
    <>
      <Between style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4, alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.5, color: colors.muted }}>WELCOME BACK</Text>
          <Text numberOfLines={1} style={{ fontFamily: fonts.extrabold, fontSize: 28, color: colors.ink, letterSpacing: -0.7, marginTop: 4 }}>{companyName}</Text>
        </View>
        <Row style={{ gap: 8 }}>
          <NavBtn icon="bell" />
          <Avatar text={initials(companyName)} size={40} radius={13} />
        </Row>
      </Between>
      <ScrollView contentContainerStyle={scroll} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 12, marginTop: 16 }}>
          <LinearGradient colors={[colors.primary, colors.primary700]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={{ borderRadius: radii.lg, padding: 16, ...shadow.btn }}>
            <Row style={{ gap: 6 }}>
              <Icon name="trend" size={14} color="rgba(255,255,255,0.8)" />
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: 'rgba(255,255,255,0.78)', letterSpacing: 0.5 }}>Pipeline</Text>
            </Row>
            <Text style={{ fontFamily: fonts.num, fontSize: 40, color: '#fff', marginTop: 8, letterSpacing: -0.8 }}>
              {pd}<Text style={{ fontSize: 24, color: 'rgba(255,255,255,0.7)' }}>{pc}</Text>
            </Text>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 5 }}>{active} active jobs · {openQuotes} open quotes</Text>
          </LinearGradient>
          <Row style={{ gap: 12, alignItems: 'stretch' }}>
            <Metric icon="receipt" label="Invoiced" value={fmt0(invoiced)} meta="awaiting payment" />
            <Metric icon="wallet" label="Collected" value={fmt0(collected)} meta="received" valueColor={colors.success} />
          </Row>
        </View>

        <Btn title="New Quote" icon="camera" onPress={() => go('camera')} style={{ marginTop: 20, height: 60 }} />
        <Row style={{ gap: 10, marginTop: 12 }}>
          <Btn title="New client" icon="user" variant="ghost" sm onPress={() => go('clientEdit', {})} style={{ flex: 1 }} />
          <Btn title="All jobs" icon="layers" variant="ghost" sm onPress={() => go('jobs', {}, 'tab')} style={{ flex: 1 }} />
        </Row>

        <SectionTitle title="Recent jobs" link="See all" onLink={() => go('jobs', {}, 'tab')} />
        {isLoading ? (
          <View style={{ paddingVertical: 30, alignItems: 'center' }}><ActivityIndicator color={colors.primary} /></View>
        ) : recent.length === 0 ? (
          <Card pad style={{ alignItems: 'center', paddingVertical: 28 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.muted, textAlign: 'center' }}>No jobs yet. Tap "New Quote" to create your first.</Text>
          </Card>
        ) : (
          <View style={{ gap: 10 }}>
            {recent.map((j, i) => (
              <JobCard key={j.id} j={j} i={i} onPress={() => go('job', { job: j })} />
            ))}
          </View>
        )}
      </ScrollView>
    </>
  );
}

function Metric({ icon, label, value, meta, valueColor }: { icon: string; label: string; value: string; meta: string; valueColor?: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, padding: 15, ...shadow.sm }}>
      <Row style={{ gap: 6 }}>
        <Icon name={icon} size={13} color={colors.muted} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.muted, letterSpacing: 0.4 }}>{label}</Text>
      </Row>
      <Text style={{ fontFamily: fonts.num, fontSize: 26, color: valueColor || colors.ink, marginTop: 8, letterSpacing: -0.5 }}>{value}</Text>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, marginTop: 5 }}>{meta}</Text>
    </View>
  );
}

/* ---------------- JOBS LIST ---------------- */
export function JobsScreen({ go }: NavProp) {
  const { store, up } = useStore();
  const { user } = useAuth();
  const { data: jobs = [], isLoading } = useQuery({ queryKey: ['jobs', user?.id], queryFn: () => fetchJobs(user!.id), enabled: !!user?.id });
  const filter = store.jobFilter || 'All';
  const q = store.jobQ || '';
  const filters = ['All', ...STAGES];
  let list = jobs.filter((j) => filter === 'All' || j.stage === filter);
  if (q) list = list.filter((j) => (j.client || 'no client').toLowerCase().includes(q.toLowerCase()) || j.addr.toLowerCase().includes(q.toLowerCase()) || j.title.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <Between style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 }}>
        <Text style={{ fontFamily: fonts.extrabold, fontSize: 30, color: colors.ink, letterSpacing: -0.7 }}>Jobs</Text>
        <NavBtn icon="filter" size={18} />
      </Between>
      <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
        <SearchBar placeholder="Search client or address" value={q} onChangeText={(t) => up({ jobQ: t })} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }} style={{ marginTop: 12 }}>
          {filters.map((f) => (
            <Pressable
              key={f}
              onPress={() => up({ jobFilter: f })}
              style={{ paddingVertical: 5, paddingHorizontal: 13, borderRadius: radii.pill, backgroundColor: filter === f ? colors.primary : colors.card, borderWidth: 1, borderColor: filter === f ? colors.primary : colors.border }}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: filter === f ? '#fff' : colors.ink2 }}>{f}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <ScrollView contentContainerStyle={[scroll, { paddingTop: 14 }]} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={{ paddingTop: 40, alignItems: 'center' }}><ActivityIndicator color={colors.primary} /></View>
        ) : list.length === 0 ? (
          <Empty icon="layers" title={jobs.length === 0 ? 'No jobs yet' : 'No matches'} body={jobs.length === 0 ? 'Tap "New Quote" to create your first job.' : 'Try a different filter or search.'} />
        ) : (
          <View style={{ gap: 10 }}>
            {list.map((j, i) => (
              <JobCard key={j.id} j={j} i={i} onPress={() => go('job', { job: j })} />
            ))}
          </View>
        )}
      </ScrollView>
      <Fab onPress={() => go('camera')} />
    </>
  );
}

export function Fab({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ position: 'absolute', right: 18, bottom: 24, height: 56, paddingHorizontal: 22, borderRadius: 18, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', gap: 9, ...shadow.btn }}>
      <Icon name="plus" size={20} color="#fff" />
      <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, color: '#fff' }}>New Quote</Text>
    </Pressable>
  );
}

/* ---------------- CLIENTS ---------------- */
export function ClientsScreen({ go }: NavProp) {
  const { store, up } = useStore();
  const { user } = useAuth();
  const q = store.clientQ || '';
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients', user?.id],
    queryFn: () => fetchClients(user!.id),
    enabled: !!user?.id,
  });
  const list = clients.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 }}>
        <Text style={{ fontFamily: fonts.extrabold, fontSize: 30, color: colors.ink, letterSpacing: -0.7 }}>Clients</Text>
      </View>
      <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
        <SearchBar placeholder="Search clients" value={q} onChangeText={(t) => up({ clientQ: t })} />
      </View>
      <ScrollView contentContainerStyle={[scroll, { paddingTop: 8 }]} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={{ paddingTop: 60, alignItems: 'center' }}><ActivityIndicator color={colors.primary} /></View>
        ) : list.length === 0 ? (
          <Empty icon="users" title={q ? 'No matches' : 'No clients yet'} body={q ? 'Try another search.' : 'Add your first client with the button below.'} />
        ) : (
          <Card style={{ paddingHorizontal: 16, marginTop: 8 }}>
            {list.map((c, idx) => (
              <Pressable
                key={c.id}
                onPress={() => go('client', { client: c })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 14, borderBottomWidth: idx === list.length - 1 ? 0 : 1, borderBottomColor: colors.border }}
              >
                <Avatar text={initials(c.name)} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontFamily: fonts.extrabold, fontSize: 15, color: colors.ink }}>{c.name}</Text>
                  <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted, marginTop: 2 }}>{c.city || c.phone || c.email}</Text>
                </View>
                <Icon name="chevR" size={15} color="#C2C9D2" />
              </Pressable>
            ))}
          </Card>
        )}
      </ScrollView>
      <Fab onPress={() => go('clientEdit', {})} />
    </>
  );
}

/* ---------------- PROFILE ---------------- */
export function ProfileScreen({ go }: NavProp) {
  const { signOut } = useAuth();
  return (
    <>
      <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 }}>
        <Text style={{ fontFamily: fonts.extrabold, fontSize: 30, color: colors.ink, letterSpacing: -0.7 }}>Profile</Text>
      </View>
      <ScrollView contentContainerStyle={[scroll, { paddingTop: 8 }]} showsVerticalScrollIndicator={false}>
        <Card pad style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 54, height: 54, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.extrabold, fontSize: 22, color: '#fff' }}>A</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.extrabold, fontSize: 17, color: colors.ink }}>{COMPANY.name}</Text>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted }}>{COMPANY.license} · {COMPANY.city}</Text>
          </View>
          <NavBtn icon="edit" size={17} onPress={() => go('profileCompany')} />
        </Card>

        <SectionTitle title="Company" />
        <SetGroup rows={[
          { ico: 'building', name: 'Business details', val: 'Name, address, license', onPress: () => go('profileCompany') },
          { ico: 'image', name: 'Logo', val: 'Shown on PDFs' },
          { ico: 'users', name: 'Team', val: '1 owner · invite members' },
        ]} />

        <SectionTitle title="Defaults" />
        <SetGroup rows={[
          { ico: 'globe', name: 'Currency & locale', val: 'USD ($) · English' },
          { ico: 'percent', name: 'Default tax rate', val: '8.25%' },
          { ico: 'card', name: 'Payment terms', val: 'Net 15' },
          { ico: 'wallet', name: 'Default deposit', val: '25%' },
        ]} />

        <SectionTitle title="Account" />
        <SetGroup rows={[
          { ico: 'bell', name: 'Notifications', toggle: true },
          { ico: 'lock', name: 'Change password' },
          { ico: 'logout', name: 'Log out', danger: true, onPress: () => signOut() },
        ]} />
        <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted, textAlign: 'center', marginTop: 20 }}>PhotoQuote v2.0 · Made for the trades</Text>
      </ScrollView>
    </>
  );
}

type SetRowDef = { ico: string; name: string; val?: string; onPress?: () => void; toggle?: boolean; danger?: boolean };
function SetGroup({ rows }: { rows: SetRowDef[] }) {
  return (
    <Card style={{ overflow: 'hidden' }}>
      {rows.map((r, i) => (
        <SetRow key={r.name} {...r} last={i === rows.length - 1} />
      ))}
    </Card>
  );
}
function SetRow({ ico, name, val, onPress, toggle, danger, last }: SetRowDef & { last?: boolean }) {
  const [on, setOn] = React.useState(true);
  return (
    <Pressable
      onPress={toggle ? () => setOn(!on) : onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 15, paddingHorizontal: 16, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border }}
    >
      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: danger ? colors.errorTint : colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={ico} size={18} color={danger ? colors.error : colors.ink2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: danger ? colors.error : colors.ink }}>{name}</Text>
        {val ? <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.muted }}>{val}</Text> : null}
      </View>
      {toggle ? <Switch on={on} onPress={() => setOn(!on)} /> : !danger ? <Icon name="chevR" size={17} color="#C2C9D2" /> : null}
    </Pressable>
  );
}

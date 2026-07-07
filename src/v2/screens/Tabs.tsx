// PhotoQuote v2 — tab roots: Home, Jobs, Clients, Profile
import React from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '../Icon';
import { colors, fonts, radii, shadow } from '../theme';
import { ClosedKind, fmt0, homeMetrics, initials, Job, split, STAGES } from '../data';
import { Avatar, Between, Btn, Card, Empty, NavBtn, Row, SearchBar, SectionTitle, StageChip, Switch, useStore } from '../ui';
import { useAuth } from '../lib/auth';
import { fetchClients, fetchCompanyProfile, fetchJobs } from '../lib/api';
import { LOCALES, registerStrings, useLocale, useT } from '../lib/i18n';

registerStrings({
  // Job card
  'tabs.noClientYet': { en: 'No client yet', es: 'Sin cliente todavía', pt: 'Sem cliente ainda' },
  // closed-state chip (ClosedChip lives here; the Job screen header reuses these keys)
  'job.closed.lost': { en: 'LOST', es: 'PERDIDA', pt: 'PERDIDO' },
  'job.closed.archived': { en: 'ARCHIVED', es: 'ARCHIVADA', pt: 'ARQUIVADO' },

  // Home
  'tabs.welcomeBack': { en: 'WELCOME BACK', es: 'BIENVENIDO DE NUEVO', pt: 'BEM-VINDO DE VOLTA' },
  'tabs.yourCompany': { en: 'Your company', es: 'Tu empresa', pt: 'Sua empresa' },
  'tabs.pipeline': { en: 'Pipeline', es: 'En proceso', pt: 'Em andamento' },
  'tabs.pipelineMeta': {
    en: '{active} active jobs · {openQuotes} open quotes',
    es: '{active} trabajos activos · {openQuotes} cotizaciones abiertas',
    pt: '{active} trabalhos ativos · {openQuotes} orçamentos abertos',
  },
  'tabs.invoiced': { en: 'Invoiced', es: 'Facturado', pt: 'Faturado' },
  'tabs.awaitingPayment': { en: 'awaiting payment', es: 'pago pendiente', pt: 'aguardando pagamento' },
  'tabs.collected': { en: 'Collected', es: 'Cobrado', pt: 'Recebido' },
  'tabs.received': { en: 'received', es: 'recibido', pt: 'recebido' },
  'tabs.newQuote': { en: 'New Quote', es: 'Nueva cotización', pt: 'Novo orçamento' },
  'tabs.newClient': { en: 'New client', es: 'Nuevo cliente', pt: 'Novo cliente' },
  'tabs.allJobs': { en: 'All jobs', es: 'Todos los trabajos', pt: 'Todos os trabalhos' },
  'tabs.recentJobs': { en: 'Recent jobs', es: 'Trabajos recientes', pt: 'Trabalhos recentes' },
  'tabs.seeAll': { en: 'See all', es: 'Ver todos', pt: 'Ver todos' },
  'tabs.noJobsHome': {
    en: 'No jobs yet. Tap "New Quote" to create your first.',
    es: 'Aún no hay trabajos. Toca "Nueva cotización" para crear el primero.',
    pt: 'Nenhum trabalho ainda. Toque em "Novo orçamento" para criar o primeiro.',
  },

  // Jobs list
  'tabs.jobs': { en: 'Jobs', es: 'Trabajos', pt: 'Trabalhos' },
  'tabs.searchClientOrAddress': {
    en: 'Search client or address',
    es: 'Buscar cliente o dirección',
    pt: 'Buscar cliente ou endereço',
  },
  'tabs.filterAll': { en: 'All', es: 'Todos', pt: 'Todos' },
  // closed filters — labels match the ClosedChip the cards show (values stay English in the store)
  'tabs.filterLost': { en: 'Lost', es: 'Perdida', pt: 'Perdido' },
  'tabs.filterArchived': { en: 'Archived', es: 'Archivada', pt: 'Arquivado' },
  'tabs.noJobsYet': { en: 'No jobs yet', es: 'Aún no hay trabajos', pt: 'Nenhum trabalho ainda' },
  'tabs.noMatches': { en: 'No matches', es: 'Sin resultados', pt: 'Nenhum resultado' },
  'tabs.noJobsBody': {
    en: 'Tap "New Quote" to create your first job.',
    es: 'Toca "Nueva cotización" para crear tu primer trabajo.',
    pt: 'Toque em "Novo orçamento" para criar seu primeiro trabalho.',
  },
  'tabs.noMatchesJobsBody': {
    en: 'Try a different filter or search.',
    es: 'Prueba con otro filtro o búsqueda.',
    pt: 'Tente outro filtro ou busca.',
  },

  // Clients
  'tabs.clients': { en: 'Clients', es: 'Clientes', pt: 'Clientes' },
  'tabs.searchClients': { en: 'Search clients', es: 'Buscar clientes', pt: 'Buscar clientes' },
  'tabs.noClientsYet': { en: 'No clients yet', es: 'Aún no hay clientes', pt: 'Nenhum cliente ainda' },
  'tabs.tryAnotherSearch': { en: 'Try another search.', es: 'Prueba con otra búsqueda.', pt: 'Tente outra busca.' },
  'tabs.addFirstClient': {
    en: 'Add your first client with the button below.',
    es: 'Agrega tu primer cliente con el botón de abajo.',
    pt: 'Adicione seu primeiro cliente com o botão abaixo.',
  },

  // Profile
  'tabs.profile': { en: 'Profile', es: 'Perfil', pt: 'Perfil' },
  'tabs.tapToAddDetails': { en: 'Tap to add details', es: 'Toca para agregar detalles', pt: 'Toque para adicionar detalhes' },
  'tabs.company': { en: 'Company', es: 'Empresa', pt: 'Empresa' },
  'tabs.businessDetails': { en: 'Business details', es: 'Datos de la empresa', pt: 'Dados da empresa' },
  'tabs.businessDetailsVal': {
    en: 'Name, address, license',
    es: 'Nombre, dirección, licencia',
    pt: 'Nome, endereço, licença',
  },
  'tabs.logo': { en: 'Logo', es: 'Logotipo', pt: 'Logotipo' },
  'tabs.logoAdded': { en: 'Added · shown on PDFs', es: 'Agregado · se muestra en los PDF', pt: 'Adicionado · aparece nos PDFs' },
  'tabs.logoAdd': { en: 'Add a logo', es: 'Agrega un logotipo', pt: 'Adicione um logotipo' },
  'tabs.team': { en: 'Team', es: 'Equipo', pt: 'Equipe' },
  'tabs.teamVal': { en: '1 owner · invite members', es: '1 propietario · invita miembros', pt: '1 proprietário · convide membros' },
  'tabs.defaults': { en: 'Defaults', es: 'Valores predeterminados', pt: 'Padrões' },
  'tabs.language': { en: 'Language', es: 'Idioma', pt: 'Idioma' },
  'tabs.defaultTaxRate': { en: 'Default tax rate', es: 'Tasa de impuesto predeterminada', pt: 'Taxa de imposto padrão' },
  'tabs.defaultDeposit': { en: 'Default deposit', es: 'Anticipo predeterminado', pt: 'Entrada padrão' },
  'tabs.defaultMargin': { en: 'Default margin', es: 'Margen predeterminado', pt: 'Margem padrão' },
  'tabs.notSet': { en: 'Not set', es: 'Sin definir', pt: 'Não definido' },
  'tabs.account': { en: 'Account', es: 'Cuenta', pt: 'Conta' },
  'tabs.notifications': { en: 'Notifications', es: 'Notificaciones', pt: 'Notificações' },
  'tabs.changePassword': { en: 'Change password', es: 'Cambiar contraseña', pt: 'Alterar senha' },
  'tabs.logOut': { en: 'Log out', es: 'Cerrar sesión', pt: 'Sair' },
  'tabs.footer': {
    en: 'PhotoQuote v2.0 · Made for the trades',
    es: 'PhotoQuote v2.0 · Hecho para los oficios',
    pt: 'PhotoQuote v2.0 · Feito para profissionais',
  },
});

type NavProp = { go: (n: string, p?: any, mode?: string) => void; back: () => void; params?: any };
const scroll = { paddingHorizontal: 20, paddingBottom: 120 };

/* ---------------- CLOSED CHIP ---------------- */
// Same silhouette as StageChip, but for the ORTHOGONAL closed axis (projects.status) — it
// REPLACES the stage chip wherever a job is lost/archived. Shared: cards here, Job header there.
const CLOSED_CHIP: Record<ClosedKind, { c: string; t: string; key: string }> = {
  lost: { c: colors.error, t: colors.errorTint, key: 'job.closed.lost' },
  archived: { c: '#8A93A3', t: '#EEF0F3', key: 'job.closed.archived' }, // Draft's neutral gray
};
export function ClosedChip({ kind, lg }: { kind: ClosedKind; lg?: boolean }) {
  const t = useT();
  const s = CLOSED_CHIP[kind];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: lg ? 6 : 5, paddingHorizontal: lg ? 12 : 10, borderRadius: radii.pill, backgroundColor: s.t }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: s.c }} />
      <Text style={{ fontFamily: fonts.extrabold, fontSize: lg ? 12.5 : 11.5, color: s.c }}>{t(s.key)}</Text>
    </View>
  );
}

/* ---------------- JOB CARD ---------------- */
export function JobCard({ j, i, onPress }: { j: Job; i: number; onPress: () => void }) {
  const t = useT();
  const [d, c] = split(j.value);
  return (
    <Pressable onPress={onPress}>
      <Card style={{ flexDirection: 'row', gap: 13, padding: 13, alignItems: 'center' }}>
        <View>
          <View style={{ width: 58, height: 58, borderRadius: 13, overflow: 'hidden', backgroundColor: colors.chipBg }}>
            {j.thumb ? (
              <Image source={{ uri: j.thumb }} style={{ flex: 1 }} resizeMode="cover" />
            ) : (
              <LinearGradient colors={['#DCE2E0', '#EEF1F0']} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="image" size={20} color="#A6AEB8" />
              </LinearGradient>
            )}
          </View>
          <View style={{ position: 'absolute', right: 4, bottom: 4, backgroundColor: 'rgba(12,17,22,0.62)', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 7 }}>
            <Text style={{ fontFamily: fonts.extrabold, fontSize: 10, color: '#fff' }}>{j.photos}</Text>
          </View>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontFamily: fonts.extrabold, fontSize: 15, color: j.client ? colors.ink : colors.faint, letterSpacing: -0.2 }}>
            {j.client || t('tabs.noClientYet')}
          </Text>
          <Row style={{ gap: 5, marginTop: 2 }}>
            <Icon name="mapPin" size={13} color={colors.faint} />
            <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted, flex: 1 }}>{j.addr}</Text>
          </Row>
          <Between style={{ marginTop: 9 }}>
            <Text style={{ fontFamily: fonts.extrabold, fontSize: 15, color: colors.ink }}>
              {d}<Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted }}>{c}</Text>
            </Text>
            {j.closed ? <ClosedChip kind={j.closed} /> : <StageChip stage={j.stage} />}
          </Between>
        </View>
      </Card>
    </Pressable>
  );
}

/* ---------------- HOME ---------------- */
export function HomeScreen({ go }: NavProp) {
  const t = useT();
  const { user } = useAuth();
  const { data: jobs = [], isLoading } = useQuery({ queryKey: ['jobs', user?.id], queryFn: () => fetchJobs(user!.id), enabled: !!user?.id });
  const { data: profile } = useQuery({ queryKey: ['company', user?.id], queryFn: () => fetchCompanyProfile(user!.id), enabled: !!user?.id });
  // closed (lost/archived) jobs are out of every number except collected — see homeMetrics
  const { pipeline, invoiced, collected, active, openQuotes } = homeMetrics(jobs);
  const [pd, pc] = split(pipeline);
  const recent = jobs.filter((j) => !j.closed).slice(0, 4);
  const companyName = (profile as any)?.company_name || t('tabs.yourCompany');
  return (
    <>
      <Between style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4, alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.5, color: colors.muted }}>{t('tabs.welcomeBack')}</Text>
          <Text numberOfLines={1} style={{ fontFamily: fonts.extrabold, fontSize: 28, color: colors.ink, letterSpacing: -0.7, marginTop: 4 }}>{companyName}</Text>
        </View>
        <Avatar text={initials(companyName)} size={40} radius={13} />
      </Between>
      <ScrollView contentContainerStyle={scroll} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 12, marginTop: 16 }}>
          <LinearGradient colors={[colors.primary, colors.primary700]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={{ borderRadius: radii.lg, padding: 16, ...shadow.btn }}>
            <Row style={{ gap: 6 }}>
              <Icon name="trend" size={14} color="rgba(255,255,255,0.8)" />
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: 'rgba(255,255,255,0.78)', letterSpacing: 0.5 }}>{t('tabs.pipeline')}</Text>
            </Row>
            <Text style={{ fontFamily: fonts.num, fontSize: 40, color: '#fff', marginTop: 8, letterSpacing: -0.8 }}>
              {pd}<Text style={{ fontSize: 24, color: 'rgba(255,255,255,0.7)' }}>{pc}</Text>
            </Text>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 5 }}>{t('tabs.pipelineMeta', { active, openQuotes })}</Text>
          </LinearGradient>
          <Row style={{ gap: 12, alignItems: 'stretch' }}>
            <Metric icon="receipt" label={t('tabs.invoiced')} value={fmt0(invoiced)} meta={t('tabs.awaitingPayment')} />
            <Metric icon="wallet" label={t('tabs.collected')} value={fmt0(collected)} meta={t('tabs.received')} valueColor={colors.success} />
          </Row>
        </View>

        <Btn title={t('tabs.newQuote')} icon="camera" onPress={() => go('camera')} style={{ marginTop: 20, height: 60 }} />
        <Row style={{ gap: 10, marginTop: 12 }}>
          <Btn title={t('tabs.newClient')} icon="user" variant="ghost" sm onPress={() => go('clientEdit', {})} style={{ flex: 1 }} />
          <Btn title={t('tabs.allJobs')} icon="layers" variant="ghost" sm onPress={() => go('jobs', {}, 'tab')} style={{ flex: 1 }} />
        </Row>

        <SectionTitle title={t('tabs.recentJobs')} link={t('tabs.seeAll')} onLink={() => go('jobs', {}, 'tab')} />
        {isLoading ? (
          <View style={{ paddingVertical: 30, alignItems: 'center' }}><ActivityIndicator color={colors.primary} /></View>
        ) : recent.length === 0 ? (
          <Card pad style={{ alignItems: 'center', paddingVertical: 28 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.muted, textAlign: 'center' }}>{t('tabs.noJobsHome')}</Text>
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
  const t = useT();
  const { store, up } = useStore();
  const { user } = useAuth();
  const { data: jobs = [], isLoading } = useQuery({ queryKey: ['jobs', user?.id], queryFn: () => fetchJobs(user!.id), enabled: !!user?.id });
  const filter = store.jobFilter || 'All';
  const q = store.jobQ || '';
  // 'All' and the stage filters show OPEN jobs only; Lost/Archived list just their own closed kind
  const filters = ['All', ...STAGES, 'Lost', 'Archived'];
  let list = jobs.filter((j) =>
    filter === 'Lost' ? j.closed === 'lost'
    : filter === 'Archived' ? j.closed === 'archived'
    : !j.closed && (filter === 'All' || j.stage === filter)
  );
  if (q) list = list.filter((j) => (j.client || 'no client').toLowerCase().includes(q.toLowerCase()) || j.addr.toLowerCase().includes(q.toLowerCase()) || j.title.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 }}>
        <Text style={{ fontFamily: fonts.extrabold, fontSize: 30, color: colors.ink, letterSpacing: -0.7 }}>{t('tabs.jobs')}</Text>
      </View>
      <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
        <SearchBar placeholder={t('tabs.searchClientOrAddress')} value={q} onChangeText={(v) => up({ jobQ: v })} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }} style={{ marginTop: 12 }}>
          {filters.map((f) => (
            <Pressable
              key={f}
              onPress={() => up({ jobFilter: f })}
              style={{ paddingVertical: 5, paddingHorizontal: 13, borderRadius: radii.pill, backgroundColor: filter === f ? colors.primary : colors.card, borderWidth: 1, borderColor: filter === f ? colors.primary : colors.border }}
            >
              {/* the store keeps the LOGICAL value (English); only the label is translated */}
              <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: filter === f ? '#fff' : colors.ink2 }}>
                {f === 'All' ? t('tabs.filterAll') : f === 'Lost' ? t('tabs.filterLost') : f === 'Archived' ? t('tabs.filterArchived') : t('stage.' + f)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <FlatList
        data={isLoading ? [] : list}
        keyExtractor={(j) => j.id}
        renderItem={({ item: j, index: i }) => <JobCard j={j} i={i} onPress={() => go('job', { job: j })} />}
        contentContainerStyle={[scroll, { paddingTop: 14, gap: 10 }]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        windowSize={7}
        ListEmptyComponent={
          isLoading ? (
            <View style={{ paddingTop: 40, alignItems: 'center' }}><ActivityIndicator color={colors.primary} /></View>
          ) : (
            <Empty icon="layers" title={jobs.length === 0 ? t('tabs.noJobsYet') : t('tabs.noMatches')} body={jobs.length === 0 ? t('tabs.noJobsBody') : t('tabs.noMatchesJobsBody')} />
          )
        }
      />
      <Fab onPress={() => go('camera')} />
    </>
  );
}

export function Fab({ onPress }: { onPress: () => void }) {
  const t = useT();
  return (
    <Pressable onPress={onPress} style={{ position: 'absolute', right: 18, bottom: 24, height: 56, paddingHorizontal: 22, borderRadius: 18, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', gap: 9, ...shadow.btn }}>
      <Icon name="plus" size={20} color="#fff" />
      <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, color: '#fff' }}>{t('tabs.newQuote')}</Text>
    </Pressable>
  );
}

/* ---------------- CLIENTS ---------------- */
export function ClientsScreen({ go }: NavProp) {
  const t = useT();
  const { store, up } = useStore();
  const { user } = useAuth();
  const q = store.clientQ || '';
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients', user?.id],
    queryFn: () => fetchClients(user!.id),
    enabled: !!user?.id,
  });
  const ql = q.toLowerCase();
  const list = clients.filter((c) => c.name.toLowerCase().includes(ql) || c.phone.toLowerCase().includes(ql) || c.email.toLowerCase().includes(ql) || c.city.toLowerCase().includes(ql));
  return (
    <>
      <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 }}>
        <Text style={{ fontFamily: fonts.extrabold, fontSize: 30, color: colors.ink, letterSpacing: -0.7 }}>{t('tabs.clients')}</Text>
      </View>
      <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
        <SearchBar placeholder={t('tabs.searchClients')} value={q} onChangeText={(v) => up({ clientQ: v })} />
      </View>
      <ScrollView contentContainerStyle={[scroll, { paddingTop: 8 }]} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={{ paddingTop: 60, alignItems: 'center' }}><ActivityIndicator color={colors.primary} /></View>
        ) : list.length === 0 ? (
          <Empty icon="users" title={q ? t('tabs.noMatches') : t('tabs.noClientsYet')} body={q ? t('tabs.tryAnotherSearch') : t('tabs.addFirstClient')} />
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
  const t = useT();
  const { user, signOut } = useAuth();
  const { data: profile } = useQuery({ queryKey: ['company', user?.id], queryFn: () => fetchCompanyProfile(user!.id), enabled: !!user?.id });
  const company = (profile as any) || {};
  const companyName = company.company_name || t('tabs.yourCompany');
  const [locale] = useLocale();
  const localeLabel = LOCALES.find((l) => l.code === locale)?.label || 'English';
  return (
    <>
      <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 }}>
        <Text style={{ fontFamily: fonts.extrabold, fontSize: 30, color: colors.ink, letterSpacing: -0.7 }}>{t('tabs.profile')}</Text>
      </View>
      <ScrollView contentContainerStyle={[scroll, { paddingTop: 8 }]} showsVerticalScrollIndicator={false}>
        <Card pad style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 54, height: 54, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {company.logo_url ? <Image source={{ uri: company.logo_url }} style={{ width: 54, height: 54 }} resizeMode="cover" /> : <Text style={{ fontFamily: fonts.extrabold, fontSize: 22, color: '#fff' }}>{(companyName[0] || 'P').toUpperCase()}</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontFamily: fonts.extrabold, fontSize: 17, color: colors.ink }}>{companyName}</Text>
            <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted }}>{[company.company_license, company.default_city].filter(Boolean).join(' · ') || company.company_email || t('tabs.tapToAddDetails')}</Text>
          </View>
          <NavBtn icon="edit" size={17} onPress={() => go('profileCompany')} />
        </Card>

        <SectionTitle title={t('tabs.company')} />
        <SetGroup rows={[
          { ico: 'building', name: t('tabs.businessDetails'), val: t('tabs.businessDetailsVal'), onPress: () => go('profileCompany') },
          { ico: 'image', name: t('tabs.logo'), val: company.logo_url ? t('tabs.logoAdded') : t('tabs.logoAdd'), onPress: () => go('profileCompany') },
        ]} />

        <SectionTitle title={t('tabs.defaults')} />
        <SetGroup rows={[
          { ico: 'globe', name: t('tabs.language'), val: localeLabel, onPress: () => go('language') },
          { ico: 'percent', name: t('tabs.defaultTaxRate'), val: company.default_tax_percent != null ? `${company.default_tax_percent}%` : t('tabs.notSet'), onPress: () => go('profileCompany') },
          { ico: 'wallet', name: t('tabs.defaultDeposit'), val: company.default_deposit_percent != null ? `${company.default_deposit_percent}%` : t('tabs.notSet'), onPress: () => go('profileCompany') },
          { ico: 'trend', name: t('tabs.defaultMargin'), val: company.default_margin_percent != null ? `${company.default_margin_percent}%` : t('tabs.notSet'), onPress: () => go('profileCompany') },
        ]} />

        <SectionTitle title={t('tabs.account')} />
        <SetGroup rows={[
          { ico: 'lock', name: t('tabs.changePassword'), onPress: () => go('changePassword') },
          { ico: 'logout', name: t('tabs.logOut'), danger: true, onPress: () => signOut() },
        ]} />
        <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted, textAlign: 'center', marginTop: 20 }}>{t('tabs.footer')}</Text>
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

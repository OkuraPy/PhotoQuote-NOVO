# Plano de Integração Supabase - PhotoQuote AI

## Contexto

O PhotoQuote AI é um aplicativo React Native para orçamentos de construção que atualmente usa autenticação mock e armazenamento em memória. Este plano detalha a migração completa para Supabase com autenticação real, banco de dados PostgreSQL, e storage em nuvem.

**Estado Atual:**
- Autenticação mock (qualquer usuário pode entrar)
- Todos os dados em memória (perdidos ao fechar o app)
- `@supabase/supabase-js` v2.95.3 instalado mas não configurado
- Modelos TypeScript bem definidos em `AppContext.tsx`
- Projeto Supabase criado: `wjraififmbuspjzpqkcr`

**Objetivo:**
- Autenticação real com email/senha
- Persistência de dados em PostgreSQL
- Upload de fotos e logos para Supabase Storage
- Arquitetura preparada para planos de assinatura

---

## FASE 1: Autenticação Supabase

### 1.1 Configuração de Ambiente

**Arquivos a modificar:**
- `app/.env` - Adicionar credenciais Supabase
- `app/app.config.js` - Expor variáveis via expo-constants

**Ações:**
```env
# .env
OPENAI_API_KEY=sk-proj-... (já existe)
SUPABASE_URL=https://wjraififmbuspjzpqkcr.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqcmFpZmlmbWJ1c3BqenBxa2NyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNTAxMjgsImV4cCI6MjA4NjgyNjEyOH0.CmMqKf1nvKwzfNrpP3V4BwyOl_jqJbkNy0oXHzl17o8
```

```javascript
// app.config.js - modificar para incluir Supabase
export default ({ config }) => ({
  ...config,
  extra: {
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  },
});
```

### 1.2 Cliente Supabase

**Arquivo a criar:** `app/src/services/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || '';
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

### 1.3 AuthContext

**Arquivo a criar:** `app/src/context/AuthContext.tsx`

Estrutura:
- `user: User | null` - Usuário atual
- `session: Session | null` - Sessão ativa
- `loading: boolean` - Estado de carregamento
- `signIn(email, password)` - Login
- `signUp(email, password, companyData)` - Cadastro
- `signOut()` - Logout
- Listener `onAuthStateChange` para sincronizar estado

### 1.4 Navegação Protegida

**Arquivo a modificar:** `app/src/navigation/AppNavigator.tsx`

Adicionar lógica condicional:
```typescript
const { user, loading } = useAuth();

if (loading) return <LoadingScreen />;

return (
  <NavigationContainer>
    <Stack.Navigator>
      {!user ? (
        // Stack de autenticação
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
      ) : (
        // Stack autenticado
        <Stack.Screen name="Main" component={MainTabs} />
        // ... outras telas
      )}
    </Stack.Navigator>
  </NavigationContainer>
);
```

**Arquivo a modificar:** `app/App.tsx`
```typescript
<AuthProvider>
  <AppProvider>
    <SafeAreaProvider>
      <AppNavigator />
    </SafeAreaProvider>
  </AppProvider>
</AuthProvider>
```

### 1.5 Telas de Login/Signup

**Modificar:** `app/src/screens/LoginScreen.tsx`
- Substituir `handleLogin` mock por `authContext.signIn(email, password)`
- Adicionar tratamento de erros
- Adicionar loading state

**Criar:** `app/src/screens/SignUpScreen.tsx`
- Formulário de cadastro com email/senha
- Captura de dados da empresa (CompanyProfile)
- Integração com `authContext.signUp()`

### 1.6 Logout

**Modificar:** `app/src/screens/CompanyProfileScreen.tsx`
- Adicionar botão de logout
- Chamar `authContext.signOut()`

**Verificação Fase 1:**
- [ ] Cadastrar novo usuário
- [ ] Verificar usuário criado no Supabase Dashboard
- [ ] Fechar e reabrir app (deve manter sessão)
- [ ] Fazer logout e login novamente
- [ ] Limpar dados do app (deve exigir login)

---

## FASE 2: Schema de Banco de Dados

### 2.1 Criar Tabelas Core

**Usar:** Supabase MCP tool `apply_migration`

**Migration:** `create_core_schema`

Tabelas (conforme DATABASE_SCHEMA.md):
1. **users** - Perfil da empresa vinculado a auth.users
2. **clients** - Clientes do usuário
3. **projects** - Projetos vinculados a clientes
4. **media** - Fotos/vídeos dos projetos
5. **price_tables** - Tabelas de preço regionais
6. **estimates** - Orçamentos
7. **line_items** - Itens de linha dos orçamentos

### 2.2 Adicionar Tabela de Assinaturas

**Tabela adicional:** `subscription_plans`

```sql
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  price_monthly DECIMAL(10,2) NOT NULL,
  price_yearly DECIMAL(10,2),
  features JSONB NOT NULL DEFAULT '{}',
  max_projects INTEGER,
  max_estimates_per_month INTEGER,
  max_storage_gb INTEGER,
  ai_credits_per_month INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN subscription_plan_id UUID REFERENCES subscription_plans(id);
ALTER TABLE users ADD COLUMN subscription_status VARCHAR(20) DEFAULT 'active';
ALTER TABLE users ADD COLUMN subscription_expires_at TIMESTAMPTZ;

-- Seed data
INSERT INTO subscription_plans (name, price_monthly, features, max_projects, max_estimates_per_month, max_storage_gb, ai_credits_per_month)
VALUES
  ('Free', 0, '{"basic_estimates": true}', 5, 10, 1, 10),
  ('Pro', 29, '{"advanced_ai": true, "priority_support": true}', 50, 100, 10, 100),
  ('Enterprise', 99, '{"custom_branding": true, "api_access": true}', 999, 999, 100, 999);
```

### 2.3 Row-Level Security (RLS)

Habilitar RLS em todas as tabelas:
```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
-- ... outras tabelas

-- Policies
CREATE POLICY users_policy ON users FOR ALL USING (id = auth.uid());
CREATE POLICY clients_policy ON clients FOR ALL USING (user_id = auth.uid());
CREATE POLICY projects_policy ON projects FOR ALL USING (user_id = auth.uid());
-- ... outras policies conforme DATABASE_SCHEMA.md
```

### 2.4 Triggers e Functions

```sql
-- Auto-gerar números de orçamento
CREATE OR REPLACE FUNCTION generate_estimate_number(user_uuid UUID)
RETURNS VARCHAR(50) AS $$
  -- implementação conforme DATABASE_SCHEMA.md
$$ LANGUAGE plpgsql;

-- Auto-atualizar totais de orçamentos
CREATE OR REPLACE FUNCTION update_estimate_totals()
RETURNS TRIGGER AS $$
  -- implementação conforme DATABASE_SCHEMA.md
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER trigger_update_estimate_totals
AFTER INSERT OR UPDATE OR DELETE ON line_items
FOR EACH ROW EXECUTE FUNCTION update_estimate_totals();
```

### 2.5 Índices de Performance

```sql
-- Conforme DATABASE_SCHEMA.md
CREATE INDEX idx_clients_user_id ON clients(user_id);
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_estimates_project_id ON estimates(project_id);
-- ... todos os índices do schema
```

**Verificação Fase 2:**
- [ ] Todas as tabelas criadas no Supabase Dashboard
- [ ] RLS habilitado em todas as tabelas
- [ ] Triggers funcionando (testar inserção de line_item)
- [ ] Índices criados
- [ ] Seed data de subscription_plans inserido

---

## FASE 3: Integração da Camada de Dados

### 3.1 Service Layer de Database

**Criar:** `app/src/services/database.ts`

Estrutura de serviços:
```typescript
export const clientService = {
  async getAll(): Promise<Client[]>,
  async create(data): Promise<Client>,
  async update(id, data): Promise<void>,
  async delete(id): Promise<void>,
};

export const projectService = { ... };
export const estimateService = { ... };
export const invoiceService = { ... };
```

**Funções de mapeamento:**
- `mapClientFromDB()` - DB → App types (full_name → name)
- `mapClientToDB()` - App → DB types (name → full_name)
- Similar para outras entidades

### 3.2 Cache Layer

**Criar:** `app/src/services/cache.ts`

```typescript
export const cacheService = {
  async saveClients(clients: Client[]): Promise<void>,
  async loadClients(): Promise<Client[]>,
  // Similar para projects, estimates
};
```

### 3.3 Migrar AppContext

**Modificar:** `app/src/context/AppContext.tsx`

Estratégia:
1. Converter métodos CRUD para `async`
2. Integrar `database.ts` services
3. Manter estado em memória para performance
4. Carregar do cache primeiro, depois do DB

Exemplo:
```typescript
const addClient = useCallback(async (data: Omit<Client, 'id' | 'createdAt'>) => {
  const client = await clientService.create(data);
  setClients(prev => [client, ...prev]);
  await cacheService.saveClients([client, ...clients]);
  return client;
}, [clients]);

useEffect(() => {
  const loadClients = async () => {
    // 1. Cache rápido
    const cached = await cacheService.loadClients();
    setClients(cached);

    // 2. DB preciso
    const fresh = await clientService.getAll();
    setClients(fresh);
    await cacheService.saveClients(fresh);
  };
  loadClients();
}, []);
```

### 3.4 Atualizar Telas (Breaking Change)

**Arquivos a modificar:**
- `app/src/screens/AddClientScreen.tsx`
- `app/src/screens/ClientsScreen.tsx`
- `app/src/screens/NewProjectScreen.tsx`
- `app/src/screens/EstimatePreviewScreen.tsx`
- `app/src/screens/InvoicesListScreen.tsx`
- `app/src/screens/CompanyProfileScreen.tsx`

Mudanças:
```typescript
// Adicionar async/await
const handleSave = async () => {
  try {
    setLoading(true);
    await addClient(formData);
    navigation.goBack();
  } catch (error) {
    Alert.alert('Erro', 'Falha ao salvar cliente');
  } finally {
    setLoading(false);
  }
};
```

### 3.5 CompanyProfile → users table

**Estratégia:**
- Após login, carregar perfil da tabela `users`
- Se não existir, criar registro
- Operações de update salvam na tabela `users`
- Mapeamento entre campos:
  - `CompanyProfile.name` → `users.company_name`
  - `CompanyProfile.phone` → `users.company_phone`
  - `CompanyProfile.city` → `users.default_city`

**Verificação Fase 3:**
- [ ] Criar cliente via tela
- [ ] Verificar no Supabase Dashboard
- [ ] Fechar e reabrir app (dados persistem)
- [ ] Atualizar cliente (mudanças salvas)
- [ ] Deletar cliente (removido do DB)
- [ ] Criar projeto → estimate → invoice (fluxo completo)
- [ ] Teste offline (mostrar dados em cache)

---

## FASE 4: Supabase Storage

### 4.1 Configurar Buckets

**Criar via Supabase Dashboard:**
1. **company-logos** (privado)
   - Path: `{user_id}/logo.jpg`
   - Max: 5MB
   - Tipos: image/jpeg, image/png, image/webp

2. **project-photos** (privado)
   - Path: `{user_id}/{project_id}/{photo_id}.jpg`
   - Max: 10MB
   - Tipos: image/jpeg, image/png, image/webp

3. **estimate-pdfs** (privado)
   - Path: `{user_id}/{estimate_id}.pdf`
   - Max: 20MB
   - Tipos: application/pdf

**Policies de Storage:**
```sql
CREATE POLICY "Users can upload their own logo" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'company-logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
-- Similar para project-photos e estimate-pdfs
```

### 4.2 Storage Service

**Criar:** `app/src/services/storage.ts`

```typescript
export const storageService = {
  async uploadLogo(userId: string, localUri: string): Promise<string>,
  async uploadProjectPhoto(userId, projectId, localUri, photoId): Promise<string>,
  async uploadPDF(userId, estimateId, localUri): Promise<string>,
  async deleteProjectPhoto(userId, projectId, photoId): Promise<void>,
};
```

### 4.3 Integrar Upload de Logo

**Modificar:** `app/src/screens/CompanyProfileScreen.tsx`

```typescript
const handleLogoUpload = async () => {
  const result = await ImagePicker.launchImageLibraryAsync({...});
  if (!result.canceled) {
    const { user } = await supabase.auth.getUser();
    const logoUrl = await storageService.uploadLogo(user.id, result.assets[0].uri);
    await updateCompanyProfile({ logoUri: logoUrl });
  }
};
```

### 4.4 Integrar Upload de Fotos

**Modificar:** `app/src/screens/PhotoUploadScreen.tsx`

```typescript
const handlePhotoCapture = async () => {
  const result = await ImagePicker.launchCameraAsync({...});
  if (!result.canceled) {
    const { user } = await supabase.auth.getUser();
    const photoId = generateId();

    // Upload
    const photoUrl = await storageService.uploadProjectPhoto(
      user.id, projectId, result.assets[0].uri, photoId
    );

    // Salvar na tabela media
    await supabase.from('media').insert({
      id: photoId,
      project_id: projectId,
      media_type: 'photo',
      file_url: photoUrl,
      display_order: photos.length,
    });
  }
};
```

**Verificação Fase 4:**
- [ ] Upload de logo funciona
- [ ] Logo aparece no Storage Dashboard
- [ ] Logo carrega ao reabrir app
- [ ] Upload de foto de projeto
- [ ] Foto aparece no Storage
- [ ] Registro criado na tabela `media`
- [ ] PDF de orçamento exportado e salvo

---

## FASE 5: Testes e Otimização

### 5.1 Checklist de Testes

**Autenticação:**
- [ ] Cadastro de novo usuário
- [ ] Login com credenciais corretas
- [ ] Login com senha errada (deve falhar)
- [ ] Persistência de sessão (fechar/abrir app)
- [ ] Logout

**CRUD Completo:**
- [ ] Criar cliente
- [ ] Listar clientes
- [ ] Editar cliente
- [ ] Deletar cliente
- [ ] Criar projeto vinculado a cliente
- [ ] Criar estimate com line items
- [ ] Verificar totais calculados automaticamente
- [ ] Criar invoice

**RLS/Segurança:**
- [ ] Criar 2 usuários diferentes
- [ ] Usuário A não pode ver dados de usuário B
- [ ] Tentar acessar storage de outro usuário (deve falhar)

**Performance:**
- [ ] Listar 50+ clientes (deve ser rápido)
- [ ] Cache funciona offline
- [ ] Loading states aparecem durante operações
- [ ] Sem crashes ou erros no console

### 5.2 Error Handling

**Criar:** `app/src/utils/errorHandler.ts`

```typescript
export const handleError = (error: any): string => {
  if (error.code === '23505') return 'Registro já existe';
  if (error.message?.includes('Invalid login')) return 'Email ou senha incorretos';
  if (error.message?.includes('network')) return 'Sem conexão com internet';
  return 'Erro inesperado';
};
```

### 5.3 Otimizações

- Implementar paginação em listas grandes
- Usar `React.memo` em componentes de lista
- Debounce em buscas
- Eager loading com joins no Supabase
- Comprimir imagens antes de upload

**Verificação Fase 5:**
- [ ] Todos os testes passam
- [ ] Sem erros no console
- [ ] App funciona offline (dados em cache)
- [ ] Performance aceitável
- [ ] Mensagens de erro amigáveis

---

## Arquivos Críticos

### A Criar (8 arquivos):
1. `app/src/services/supabase.ts` - Cliente Supabase
2. `app/src/context/AuthContext.tsx` - Contexto de autenticação
3. `app/src/screens/SignUpScreen.tsx` - Tela de cadastro
4. `app/src/services/database.ts` - Service layer do DB
5. `app/src/services/cache.ts` - Cache AsyncStorage
6. `app/src/services/storage.ts` - Storage uploads
7. `app/src/utils/errorHandler.ts` - Tratamento de erros
8. `app/src/components/LoadingScreen.tsx` - Tela de loading

### A Modificar (10+ arquivos):
1. `app/.env` - Credenciais Supabase
2. `app/app.config.js` - Expo config
3. `app/App.tsx` - Wrap com AuthProvider
4. `app/src/navigation/AppNavigator.tsx` - Navegação protegida
5. `app/src/context/AppContext.tsx` - CRUD async + DB integration
6. `app/src/screens/LoginScreen.tsx` - Auth real
7. `app/src/screens/CompanyProfileScreen.tsx` - Logout + logo upload
8. `app/src/screens/AddClientScreen.tsx` - Async operations
9. `app/src/screens/PhotoUploadScreen.tsx` - Storage upload
10. Todas as outras telas que usam AppContext

### Migrações Supabase (2):
1. `create_core_schema` - Todas as tabelas + RLS + triggers + indexes
2. `seed_subscription_plans` - Dados iniciais de planos

---

## Cronograma Estimado

| Fase | Duração | Descrição |
|------|---------|-----------|
| Fase 1 | 2-3 dias | Autenticação completa |
| Fase 2 | 1 dia | Schema de banco de dados |
| Fase 3 | 4-5 dias | Integração de dados (maior complexidade) |
| Fase 4 | 2-3 dias | Storage de arquivos |
| Fase 5 | 3-4 dias | Testes e otimização |
| **Total** | **12-16 dias** | |

---

## Riscos e Mitigações

**Alto Risco:**
1. **Breaking changes em CRUD** → Testar todas as telas após mudanças
2. **RLS mal configurado** → Testar com múltiplos usuários

**Médio Risco:**
3. **Performance** → Implementar cache e otimizar queries
4. **Offline** → Strategy simples de cache (não implementar sync bidirecional no MVP)

**Baixo Risco:**
5. **Auth edge cases** → Supabase gerencia automaticamente
6. **Type mismatches** → Camada de mapeamento resolve

---

## Status da Implementação

✅ **COMPLETO** - Todas as 5 fases foram implementadas com sucesso!

Veja `IMPLEMENTATION_COMPLETE.md` na raiz do projeto para detalhes completos da implementação.

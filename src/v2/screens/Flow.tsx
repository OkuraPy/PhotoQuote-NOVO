// PhotoQuote v2 — priority flow: Camera (photo-first + voice), Estimate (AI + editing), Attach client
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, Image, KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { Icon } from '../Icon';
import { colors, fonts, radii, shadow } from '../theme';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { applyMarkup, buildStarterEstimate, calcTotals, deriveBase, fmt, LineItem, SERVICE_TYPES, split } from '../data';
import { MAX_AI_PHOTOS, requestEstimate, transcribeAudio, translateNote } from '../lib/ai';
import { createClient, createJob, fetchClients, fetchCompanyProfile, getMyLocation, lookupZip, Region, updateEstimateItems } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Avatar, Between, Btn, Card, Chip, CatChip, DecimalInput, Divider, Field, FLOW_RESET, Input, Kav, LinkBtn, Nav, NavBtn, Row, SearchBar, SectionTitle, Sheet, Stepper, Switch, useStore } from '../ui';
import { getLocale, registerStrings, useT } from '../lib/i18n';

registerStrings({
  // Camera screen
  'flow.locationUnavailableTitle': { en: 'Location unavailable', es: 'Ubicación no disponible', pt: 'Localização indisponível' },
  'flow.locationUnavailableBody': { en: 'Allow location access, or enter the ZIP manually.', es: 'Permite el acceso a la ubicación o introduce el código postal manualmente.', pt: 'Permita o acesso à localização ou digite o CEP manualmente.' },
  'flow.couldNotTakePhotoTitle': { en: 'Could not take the photo', es: 'No se pudo tomar la foto', pt: 'Não foi possível tirar a foto' },
  'flow.tryAgainPeriod': { en: 'Try again.', es: 'Inténtalo de nuevo.', pt: 'Tente novamente.' },
  'flow.cameraAccessNeeded': { en: 'Camera access needed', es: 'Se necesita acceso a la cámara', pt: 'Acesso à câmera necessário' },
  'flow.startingCamera': { en: 'Starting camera…', es: 'Iniciando la cámara…', pt: 'Iniciando a câmera…' },
  'flow.allowCamera': { en: 'Allow camera', es: 'Permitir cámara', pt: 'Permitir câmera' },
  'flow.enableInSettings': { en: 'Enable it in Settings, or pick from your library below.', es: 'Actívalo en Ajustes o elige de tu galería abajo.', pt: 'Ative nas Configurações ou escolha da sua galeria abaixo.' },
  'flow.serviceTypes': { en: 'SERVICE TYPES', es: 'TIPOS DE SERVICIO', pt: 'TIPOS DE SERVIÇO' },
  'flow.helpsTheAi': { en: '· helps the AI', es: '· ayuda a la IA', pt: '· ajuda a IA' },
  'flow.zipPlaceholder': { en: 'ZIP — sets regional pricing', es: 'Código postal — define el precio regional', pt: 'CEP — define o preço regional' },
  'flow.lookingUpZip': { en: 'Looking up ZIP…', es: 'Buscando el código postal…', pt: 'Buscando o CEP…' },
  'flow.standardPricing': { en: 'Standard pricing', es: 'Precio estándar', pt: 'Preço padrão' },
  'flow.generateEstimate': { en: 'Generate quote', es: 'Generar cotización', pt: 'Gerar orçamento' },

  // Description input (voice)
  'flow.micAccessNeededTitle': { en: 'Microphone access needed', es: 'Se necesita acceso al micrófono', pt: 'Acesso ao microfone necessário' },
  'flow.micAccessNeededBody': { en: 'Allow microphone access to dictate a voice note.', es: 'Permite el acceso al micrófono para dictar una nota de voz.', pt: 'Permita o acesso ao microfone para ditar uma nota de voz.' },
  'flow.couldNotStartRecording': { en: 'Could not start recording', es: 'No se pudo iniciar la grabación', pt: 'Não foi possível iniciar a gravação' },
  'flow.couldNotTranscribe': { en: 'Could not transcribe the recording.', es: 'No se pudo transcribir la grabación.', pt: 'Não foi possível transcrever a gravação.' },
  'flow.recordingTapToStop': { en: 'Recording… tap ◼ to stop & transcribe', es: 'Grabando… toca ◼ para detener y transcribir', pt: 'Gravando… toque ◼ para parar e transcrever' },
  'flow.transcribingNote': { en: 'Transcribing your note…', es: 'Transcribiendo tu nota…', pt: 'Transcrevendo sua nota…' },
  'flow.describeJobPlaceholder': { en: 'Describe the job (optional)', es: 'Describe el trabajo (opcional)', pt: 'Descreva o trabalho (opcional)' },
  'flow.tapMicToDictate': { en: 'Or tap the mic to dictate — we’ll transcribe it into the description.', es: 'O toca el micrófono para dictar — lo transcribiremos en la descripción.', pt: 'Ou toque no microfone para ditar — vamos transcrever na descrição.' },

  // Estimate screen
  'flow.estimate': { en: 'Quote', es: 'Cotización', pt: 'Orçamento' },
  'flow.analyzingOnePhoto': { en: 'Analyzing 1 photo…', es: 'Analizando 1 foto…', pt: 'Analisando 1 foto…' },
  'flow.analyzingNPhotos': { en: 'Analyzing {n} photos…', es: 'Analizando {n} fotos…', pt: 'Analisando {n} fotos…' },
  'flow.readingSurfaces': { en: 'Reading surfaces, materials & scope', es: 'Leyendo superficies, materiales y alcance', pt: 'Lendo superfícies, materiais e escopo' },
  'flow.notJobPhotos': { en: 'These don’t look like job photos', es: 'Estas no parecen fotos del trabajo', pt: 'Estas não parecem fotos do trabalho' },
  'flow.retakePhotos': { en: 'Retake photos', es: 'Volver a tomar fotos', pt: 'Tirar fotos novamente' },
  'flow.couldNotGenerate': { en: 'Couldn’t generate the quote', es: 'No se pudo generar la cotización', pt: 'Não foi possível gerar o orçamento' },
  'flow.tryAgain': { en: 'Try again', es: 'Intentar de nuevo', pt: 'Tentar novamente' },
  'flow.starterEstimate': { en: 'Starter quote', es: 'Cotización inicial', pt: 'Orçamento inicial' },
  'flow.starterEstimateNote': { en: 'Starter quote (AI unavailable) — review and edit the items below.', es: 'Cotización inicial (IA no disponible) — revisa y edita los elementos abajo.', pt: 'Orçamento inicial (IA indisponível) — revise e edite os itens abaixo.' },
  'flow.aiAnalyzedOnePhoto': { en: 'AI analyzed 1 photo', es: 'La IA analizó 1 foto', pt: 'A IA analisou 1 foto' },
  'flow.aiAnalyzedNPhotos': { en: 'AI analyzed {n} photos', es: 'La IA analizó {n} fotos', pt: 'A IA analisou {n} fotos' },
  'flow.reviewItemsBelow': { en: 'Review the items below and adjust as needed.', es: 'Revisa los elementos abajo y ajústalos según sea necesario.', pt: 'Revise os itens abaixo e ajuste conforme necessário.' },
  'flow.confidencePct': { en: '{pct}% confident', es: '{pct}% de confianza', pt: '{pct}% de confiança' },
  'flow.estimatedTotal': { en: 'ESTIMATED TOTAL', es: 'TOTAL ESTIMADO', pt: 'TOTAL ESTIMADO' },
  'flow.subtotal': { en: 'Subtotal', es: 'Subtotal', pt: 'Subtotal' },
  'flow.taxLabel': { en: 'Tax', es: 'Impuesto', pt: 'Imposto' },
  'flow.regionalPricingApplied': { en: '{city} · regional pricing {sign}{pct}% applied', es: '{city} · precio regional {sign}{pct}% aplicado', pt: '{city} · preço regional {sign}{pct}% aplicado' },
  'flow.lineItems': { en: 'Line items', es: 'Elementos', pt: 'Itens' },
  'flow.add': { en: 'Add', es: 'Añadir', pt: 'Adicionar' },
  'flow.taxable': { en: 'Taxable', es: 'Con impuesto', pt: 'Tributável' },
  'flow.noTax': { en: 'No tax', es: 'Sin impuesto', pt: 'Sem imposto' },
  'flow.taxRate': { en: 'Tax rate', es: 'Tasa de impuesto', pt: 'Taxa de imposto' },
  'flow.internalMarkup': { en: 'Internal markup', es: 'Margen interno', pt: 'Margem interna' },
  'flow.hiddenFromClient': { en: 'Hidden from client', es: 'Oculto para el cliente', pt: 'Oculto do cliente' },
  'flow.markupIncluded': { en: 'Markup included in item prices', es: 'Margen incluido en los precios de los elementos', pt: 'Margem incluída nos preços dos itens' },
  'flow.continue': { en: 'Continue', es: 'Continuar', pt: 'Continuar' },
  'flow.saveChanges': { en: 'Save changes', es: 'Guardar cambios', pt: 'Salvar alterações' },

  // Item editor
  'flow.editItem': { en: 'Edit item', es: 'Editar elemento', pt: 'Editar item' },
  'flow.description': { en: 'Description', es: 'Descripción', pt: 'Descrição' },
  'flow.category': { en: 'Category', es: 'Categoría', pt: 'Categoria' },
  'flow.qty': { en: 'Qty', es: 'Cant.', pt: 'Qtd' },
  'flow.unit': { en: 'Unit', es: 'Unidad', pt: 'Unidade' },
  'flow.unitPrice': { en: 'Unit price', es: 'Precio unitario', pt: 'Preço unitário' },
  'flow.applySalesTax': { en: 'Apply sales tax to this item', es: 'Aplicar impuesto sobre las ventas a este elemento', pt: 'Aplicar imposto sobre vendas a este item' },
  'flow.doneAmount': { en: 'Done · {amount}', es: 'Listo · {amount}', pt: 'Concluir · {amount}' },

  // Attach client screen
  'flow.addClient': { en: 'Add client', es: 'Añadir cliente', pt: 'Adicionar cliente' },
  'flow.optionalDoLater': { en: 'Optional — you can do this later', es: 'Opcional — puedes hacerlo más tarde', pt: 'Opcional — você pode fazer isso depois' },
  'flow.client': { en: 'Client', es: 'Cliente', pt: 'Cliente' },
  'flow.searchClient': { en: 'Search name, phone or email', es: 'Busca nombre, teléfono o correo', pt: 'Busque nome, telefone ou e-mail' },
  'flow.nJobs': { en: '{phone} · {jobs} jobs', es: '{phone} · {jobs} trabajos', pt: '{phone} · {jobs} trabalhos' },
  'flow.noClientNamed': { en: 'No client named "{q}"', es: 'Ningún cliente llamado "{q}"', pt: 'Nenhum cliente chamado "{q}"' },
  'flow.addQuick': { en: 'Add quick', es: 'Añadir rápido', pt: 'Adicionar rápido' },
  'flow.fullForm': { en: 'Full form', es: 'Formulario completo', pt: 'Formulário completo' },
  'flow.quickAddNameOnly': { en: 'Quick add — name only', es: 'Añadir rápido — solo nombre', pt: 'Adição rápida — só o nome' },
  'flow.pulledAutomatically': { en: '{addr}, {city} · pulled automatically', es: '{addr}, {city} · obtenido automáticamente', pt: '{addr}, {city} · obtido automaticamente' },
  'flow.jobSiteAddress': { en: 'Job site address', es: 'Dirección de la obra', pt: 'Endereço da obra' },
  'flow.jobSitePlaceholder': { en: 'Street address where the work happens', es: 'Dirección donde se hará el trabajo', pt: 'Endereço onde o trabalho será feito' },
  'flow.printsOnDocs': { en: 'Prints on the quote, invoice and contract.', es: 'Aparece en la cotización, la factura y el contrato.', pt: 'Sai no orçamento, na fatura e no contrato.' },
  'flow.sameAsClientAddress': { en: 'Same as client address', es: 'Igual que la dirección del cliente', pt: 'Mesmo endereço do cliente' },

  // Client note (G1) — prints on the documents (the DOCUMENT text itself is always English)
  'flow.notesForClient': { en: 'Notes for the client', es: 'Notas para el cliente', pt: 'Observações para o cliente' },
  'flow.notesPlaceholder': { en: 'e.g. Price includes two coats. Color to be confirmed with the owner.', es: 'p. ej. El precio incluye dos manos. Color por confirmar con el propietario.', pt: 'ex.: O preço inclui duas demãos. Cor a confirmar com o proprietário.' },
  // Note translation (G1b) — documents are always English; the AI helps a pt/es contractor get there
  'flow.translateToEnglish': { en: 'Translate to English', es: 'Traducir al inglés', pt: 'Traduzir para o inglês' },
  'flow.translating': { en: 'Translating…', es: 'Traduciendo…', pt: 'Traduzindo…' },
  'flow.originalLabel': { en: 'Original', es: 'Original', pt: 'Original' },
  'flow.englishEditable': { en: 'English — edit if needed', es: 'Inglés — edítalo si hace falta', pt: 'Inglês — edite se precisar' },
  'flow.useThis': { en: 'Use this', es: 'Usar esto', pt: 'Usar este' },
  'flow.keepMyText': { en: 'Keep my text', es: 'Mantener mi texto', pt: 'Manter meu texto' },
  'flow.translateFailed': { en: 'Couldn’t translate — the note will print exactly as written.', es: 'No se pudo traducir; la nota se imprimirá tal como está escrita.', pt: 'Não foi possível traduzir — a observação sairá exatamente como está escrita.' },
  'flow.translatedFrom': { en: 'Translated from: {orig}', es: 'Traducido de: {orig}', pt: 'Traduzido de: {orig}' },
  'flow.nothingToSaveTitle': { en: 'Nothing to save', es: 'Nada que guardar', pt: 'Nada para salvar' },
  'flow.nothingToSaveBody': { en: 'Generate a quote first.', es: 'Genera una cotización primero.', pt: 'Gere um orçamento primeiro.' },
  'flow.notSignedInTitle': { en: 'Not signed in', es: 'No has iniciado sesión', pt: 'Não conectado' },
  'flow.notSignedInBody': { en: 'Please sign in again.', es: 'Inicia sesión de nuevo.', pt: 'Faça login novamente.' },
  'flow.newClient': { en: 'New client', es: 'Nuevo cliente', pt: 'Novo cliente' },
  'flow.couldNotSave': { en: 'Could not save', es: 'No se pudo guardar', pt: 'Não foi possível salvar' },
  'flow.skip': { en: 'Save without client', es: 'Guardar sin cliente', pt: 'Salvar sem cliente' },
  'flow.saving': { en: 'Saving…', es: 'Guardando…', pt: 'Salvando…' },
  'flow.saveJob': { en: 'Save job', es: 'Guardar trabajo', pt: 'Salvar trabalho' },
});

type NavProp = { go: (n: string, p?: any, mode?: string) => void; back: () => void; params?: any };
const scroll = { paddingHorizontal: 20, paddingBottom: 120 };
const actionbar = { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 };

// Downscale a capture/pick once at the source (~1280px, same size the upload uses): the photo
// strip stops decoding full-res 12MP shots, and the AI/upload resizes downstream get cheap.
const shrink = async (uri: string) => {
  try {
    const m = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1280 } }], { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG });
    return m.uri;
  } catch {
    return uri; // keep the original rather than losing the shot
  }
};

/* ---------------- CAMERA (photo-first, dark) ---------------- */
export function CameraScreen({ go, back, params }: NavProp) {
  const t = useT();
  const { store, up } = useStore();
  const photos = store.photos || [];
  const svcs = store.svcs || [];
  const toggle = (s: string) => up((st) => ({ svcs: st.svcs.includes(s) ? st.svcs.filter((x) => x !== s) : [...st.svcs, s] }));

  // live camera (expo-camera) — request camera + mic permission as soon as the screen opens
  const camRef = useRef<CameraView>(null);
  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [, requestMicPerm] = useMicrophonePermissions();
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [capturing, setCapturing] = useState(false);
  useEffect(() => {
    (async () => { await requestCamPerm(); await requestMicPerm(); })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // arriving from a client card ("New quote for X") — pre-select that client for the Attach step.
  // Only at the true start of the flow (no photos, no selection yet): the Navigator REMOUNTS this
  // screen on back-nav with the same params, and re-applying would silently undo a client swap
  // the user made on the Attach step.
  useEffect(() => {
    if (params?.client && !store.aSel && (store.photos || []).length === 0) up({ aSel: params.client });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // job location → regional cost multiplier (applied to the estimate prices when generating)
  const zip = store.aZip || '';
  const loc = store.aLoc;
  const [zipBusy, setZipBusy] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const setRegion = (r: Region | null) =>
    r
      ? up({
          aZip: r.zip,
          aLoc: { city: [r.city, r.state].filter(Boolean).join(', '), region: r.label },
          regionMult: r.multiplier,
          regionState: r.state,
          // GPS knows the street (ZIP lookup doesn't) — pre-fill the job-site address (G5).
          // Tapping GPS is an explicit "use my location", so it may overwrite a typed street.
          ...(r.street ? { jobStreet: r.street } : {}),
        })
      : up({ aLoc: null, regionMult: 1, regionState: '' });
  const onZip = async (z: string) => {
    const clean = z.replace(/\D/g, '').slice(0, 5);
    up({ aZip: clean });
    if (clean.length < 5) { setRegion(null); return; }
    setZipBusy(true);
    const r = await lookupZip(clean);
    setZipBusy(false);
    setRegion(r);
  };
  const onGps = async () => {
    setGpsBusy(true);
    const r = await getMyLocation();
    setGpsBusy(false);
    if (!r) { Alert.alert(t('flow.locationUnavailableTitle'), t('flow.locationUnavailableBody')); return; }
    setRegion(r);
  };

  const addAssets = (assets: { uri: string }[]) =>
    up((st) => ({ photos: [...st.photos, ...assets.map((a) => ({ uri: a.uri }))].slice(0, 30) }));

  // capture straight from the live preview
  const takePhoto = async () => {
    if (!camRef.current || capturing) return;
    try {
      setCapturing(true);
      const p = await camRef.current.takePictureAsync({ quality: 0.8 });
      if (p?.uri) addAssets([{ uri: await shrink(p.uri) }]);
    } catch (e: any) {
      Alert.alert(t('flow.couldNotTakePhotoTitle'), e?.message || t('flow.tryAgainPeriod'));
    } finally {
      setCapturing(false);
    }
  };

  const pickLibrary = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 30, quality: 0.8 });
    if (res.canceled || !res.assets?.length) return;
    setCapturing(true); // reuse the shutter spinner while the picked photos are downscaled
    try {
      const room = Math.max(0, 30 - photos.length); // don't shrink photos the 30-cap would discard
      const out: { uri: string }[] = [];
      // serial on purpose: each shrink decodes a full-res bitmap — 30 in flight at once can OOM the phone
      for (const a of res.assets.slice(0, room)) out.push({ uri: await shrink(a.uri) });
      if (out.length) addAssets(out);
    } finally {
      setCapturing(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0C1116' }}>
      {/* CÂMERA fullbleed — preenche a tela inteira (atrás dos controles) */}
      {camPerm?.granted ? (
        <CameraView ref={camRef} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} facing={facing} />
      ) : (
        <LinearGradient colors={['#2A3340', '#0C1116']} start={{ x: 0.5, y: 0.1 }} end={{ x: 0.5, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
            <View style={{ width: 66, height: 66, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="camera" size={28} color="rgba(255,255,255,0.55)" />
            </View>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 14, textAlign: 'center' }}>
              {camPerm && !camPerm.granted ? t('flow.cameraAccessNeeded') : t('flow.startingCamera')}
            </Text>
            {camPerm && !camPerm.granted ? (
              camPerm.canAskAgain ? (
                <Btn variant="soft" sm icon="camera" title={t('flow.allowCamera')} onPress={() => requestCamPerm()} style={{ marginTop: 14, paddingHorizontal: 18 }} />
              ) : (
                <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: 'rgba(255,255,255,0.4)', marginTop: 8, textAlign: 'center' }}>{t('flow.enableInSettings')}</Text>
              )
            ) : null}
        </LinearGradient>
      )}
      {/* close button overlay */}
      <View style={{ position: 'absolute', top: 50, left: 0, right: 0, paddingHorizontal: 18, flexDirection: 'row', justifyContent: 'space-between' }}>
        <CamSide icon="x" onPress={back} />
      </View>

      {/* controles + ficha sobrepostos na base — sobem junto com o teclado */}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
      {/* photo strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingVertical: 14, alignItems: 'center' }}>
        {photos.map((p, i) => (
          <View key={`${p.uri}-${i}`}>
            <Image source={{ uri: p.uri }} style={{ width: 56, height: 56, borderRadius: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.18)' }} />
            <Pressable
              onPress={() => up((st) => ({ photos: st.photos.filter((_, x) => x !== i) }))}
              style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: '#0C1116', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)' }}
            >
              <Icon name="x" size={12} sw={3} color="#fff" />
            </Pressable>
          </View>
        ))}
        <Pressable onPress={takePhoto} style={{ width: 56, height: 56, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{photos.length}/30</Text>
        </Pressable>
      </ScrollView>

      {/* controls */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 28, paddingBottom: 14, paddingTop: 4 }}>
        <CamSide icon="image" big onPress={pickLibrary} />
        <Pressable
          onPress={takePhoto}
          disabled={capturing || !camPerm?.granted}
          style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#fff', borderWidth: 5, borderColor: 'rgba(255,255,255,0.35)', opacity: capturing || !camPerm?.granted ? 0.5 : 1, alignItems: 'center', justifyContent: 'center' }}
        >
          {capturing ? <ActivityIndicator color="#0C1116" /> : null}
        </Pressable>
        <CamSide icon="flip" big onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))} />
      </View>

      {/* bottom sheet card */}
      <ScrollView style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: 300 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 26 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <Row style={{ gap: 6 }}>
          <Text style={{ fontFamily: fonts.extrabold, fontSize: 13, color: colors.ink, letterSpacing: 0.5 }}>{t('flow.serviceTypes')}</Text>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.muted }}>{t('flow.helpsTheAi')}</Text>
        </Row>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2, marginTop: 12 }}>
          {SERVICE_TYPES.map((s) => (
            <Chip key={s} label={s} selected={svcs.includes(s)} onPress={() => toggle(s)} />
          ))}
        </ScrollView>
        <DescriptionInput />

        {/* job location → regional pricing */}
        <Row style={{ gap: 8, marginTop: 16, alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Input placeholder={t('flow.zipPlaceholder')} keyboardType="number-pad" value={zip} onChangeText={onZip} maxLength={5} />
          </View>
          <Pressable onPress={onGps} disabled={gpsBusy} style={{ width: 50, height: 50, borderRadius: 13, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' }}>
            {gpsBusy ? <ActivityIndicator size="small" color={colors.primary} /> : <Icon name="gps" size={20} color={colors.primary} />}
          </Pressable>
        </Row>
        {zipBusy ? (
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, marginTop: 7 }}>{t('flow.lookingUpZip')}</Text>
        ) : loc ? (
          <Row style={{ gap: 6, marginTop: 8 }}>
            <Icon name="mapPin" size={13} color={colors.primary} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.ink }}>{loc.city}</Text>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted }}>
              · {store.regionMult === 1 ? t('flow.standardPricing') : `${loc.region} ${store.regionMult > 1 ? '+' : ''}${Math.round((store.regionMult - 1) * 100)}%`}
            </Text>
          </Row>
        ) : null}

        <Btn
          title={t('flow.generateEstimate')}
          icon="sparkles"
          disabled={!photos.length}
          onPress={() => {
            // photos changed since the last AI run → drop the old estimate so the AI re-runs
            const sig = photos.map((p) => p.uri).join('|');
            if (sig !== store.aiSig) up({ items: [], confidence: 0, aiNotes: '' });
            go('estimate', { fresh: true });
          }}
          style={{ marginTop: 16 }}
        />
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
function CamSide({ icon, onPress, big }: { icon: string; onPress?: () => void; big?: boolean }) {
  const s = big ? 52 : 40;
  return (
    <Pressable onPress={onPress} style={{ width: s, height: s, borderRadius: big ? 15 : 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={big ? 22 : 20} color="#fff" />
    </Pressable>
  );
}

/* ---------------- DESCRIPTION (type OR record voice) ---------------- */
export function DescriptionInput() {
  const t = useT();
  const { store, up } = useStore();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [mode, setMode] = useState<'idle' | 'recording' | 'transcribing'>('idle');
  const [secs, setSecs] = useState(0);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (mode === 'recording') {
      const id = setInterval(() => setSecs((s) => s + 1), 1000);
      return () => clearInterval(id);
    }
  }, [mode]);
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const startRec = async () => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) { Alert.alert(t('flow.micAccessNeededTitle'), t('flow.micAccessNeededBody')); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setErr(''); setSecs(0); setMode('recording');
    } catch (e: any) {
      Alert.alert(t('flow.couldNotStartRecording'), e?.message || t('flow.tryAgainPeriod'));
    }
  };

  // stop → transcribe (OpenAI via Edge Function) → append the text into the description
  const stopRec = async () => {
    setMode('transcribing');
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error('No recording captured.');
      const r = await transcribeAudio(uri);
      if (r.ok) {
        const prev = (store.descText || '').trim();
        up({ descText: prev ? `${prev} ${r.text}` : r.text });
      } else {
        setErr(r.error);
      }
    } catch (e: any) {
      setErr(e?.message || t('flow.couldNotTranscribe'));
    } finally {
      setMode('idle');
    }
  };

  if (mode === 'recording') {
    return (
      <View style={{ marginTop: 16 }}>
        <View style={[voicebar, { backgroundColor: colors.errorTint, borderColor: 'transparent', gap: 11 }]}>
          <RecDot />
          <Wave color={colors.error} />
          <Text style={{ fontFamily: fonts.num, fontSize: 13, color: colors.error, minWidth: 40, textAlign: 'right' }}>{mmss(secs)}</Text>
          <Pressable onPress={stopRec} style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 15, height: 15, borderRadius: 4, backgroundColor: '#fff' }} />
          </Pressable>
        </View>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, marginTop: 9, textAlign: 'center' }}>{t('flow.recordingTapToStop')}</Text>
      </View>
    );
  }

  if (mode === 'transcribing') {
    return (
      <View style={{ marginTop: 16 }}>
        <View style={voicebar}>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 13, color: colors.ink }}>{t('flow.transcribingNote')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ marginTop: 16 }}>
      <Row style={{ gap: 10, alignItems: 'flex-end' }}>
        <TextInput
          multiline
          placeholder={t('flow.describeJobPlaceholder')}
          placeholderTextColor={colors.faint}
          value={store.descText || ''}
          onChangeText={(v) => up({ descText: v })}
          style={{ flex: 1, minHeight: 50, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 13, fontSize: 15, fontFamily: fonts.semibold, color: colors.ink, ...shadow.sm }}
        />
        <Pressable onPress={startRec} style={mic}><Icon name="mic" size={22} color={colors.primary} /></Pressable>
      </Row>
      <Row style={{ gap: 6, marginTop: 9 }}>
        <Icon name={err ? 'flag' : 'mic'} size={13} color={err ? colors.error : colors.muted} />
        <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 12, color: err ? colors.error : colors.muted }}>
          {err || t('flow.tapMicToDictate')}
        </Text>
      </Row>
    </View>
  );
}
const voicebar = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingVertical: 11, paddingHorizontal: 13, ...shadow.sm };
const mic = { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.primaryTint, alignItems: 'center' as const, justifyContent: 'center' as const };
// Gravando — bolinha com pulso suave.
function RecDot() {
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const l = Animated.loop(
      Animated.sequence([
        Animated.timing(p, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(p, { toValue: 0, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    l.start();
    return () => l.stop();
  }, [p]);
  return (
    <Animated.View
      style={{
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: colors.error,
        opacity: p.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }),
        transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] }) }],
      }}
    />
  );
}

// Waveform animada — as barras pulsam continuamente; usa flex pra preencher a largura (qualquer tela).
function Wave({ color }: { color: string }) {
  const N = 28;
  const anims = useRef([...Array(N)].map((_, i) => new Animated.Value(((i * 37) % 100) / 100))).current;
  useEffect(() => {
    const loops = anims.map((a, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(a, { toValue: 1, duration: 360 + (i % 7) * 85, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(a, { toValue: 0.1, duration: 360 + (i % 7) * 85, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [anims]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, height: 36, flex: 1 }}>
      {anims.map((a, i) => (
        <Animated.View
          key={i}
          style={{
            flex: 1,
            height: 32,
            borderRadius: 99,
            backgroundColor: color,
            opacity: a.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
            transform: [{ scaleY: a.interpolate({ inputRange: [0, 1], outputRange: [0.16, 1] }) }],
          }}
        />
      ))}
    </View>
  );
}

/* ---------------- ESTIMATE (AI + editing) ---------------- */
type EstPhase = 'analyzing' | 'done' | 'rejected' | 'error';

export function EstimateScreen({ go, back, params }: NavProp) {
  const tr = useT();
  const { store, up } = useStore();
  // edit mode: opened from an existing job ("Edit" on the QuoteTab hydrates the store first);
  // saving updates THAT estimate instead of continuing the capture flow (which would duplicate the job)
  const editJob = (params && params.editJob) as { projectId: string; estimateId: string } | undefined;
  const items = store.items || [];
  const taxRate = store.taxRate ?? 8.25;
  const marginRate = store.marginRate ?? 0;
  const editing = store.editing;
  const count = (store.photos || []).length;
  const analyzed = Math.min(count, MAX_AI_PHOTOS); // how many actually went to the AI

  // Real AI flow: call the ai-estimate Edge Function once when arriving fresh from the camera.
  // Guard on items.length so navigating back INTO this screen doesn't re-run the AI or wipe edits
  // (the lightweight Navigator remounts a screen each time it becomes the stack top).
  const needsAI = !!(params && params.fresh) && (store.items?.length || 0) === 0;
  const [phase, setPhase] = useState<EstPhase>(needsAI ? 'analyzing' : 'done');
  const [reason, setReason] = useState(''); // rejection reason or error message
  const ranRef = useRef(false);

  // pre-fill tax/margin from the company defaults on a fresh estimate (once the profile loads)
  const { ownerId } = useAuth();
  const { data: companyProfile } = useQuery({ queryKey: ['company', ownerId], queryFn: () => fetchCompanyProfile(ownerId!), enabled: !!ownerId });
  const defaultsRef = useRef(false);
  useEffect(() => {
    const p = companyProfile as any;
    if (needsAI && p && !defaultsRef.current) {
      defaultsRef.current = true;
      up((st) => {
        const patch: Partial<{ taxRate: number; marginRate: number; items: LineItem[] }> = {};
        // only seed while still at the initial defaults — never clobber a manual edit made before the profile loaded
        if (st.taxRate === 8.25 && p.default_tax_percent != null) patch.taxRate = Number(p.default_tax_percent);
        if (st.marginRate === 0 && p.default_margin_percent != null) {
          patch.marginRate = Number(p.default_margin_percent);
          // AI may have landed before the profile — fold the default markup into the existing prices
          if (st.items.length) patch.items = applyMarkup(st.items, patch.marginRate);
        }
        return patch;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyProfile, needsAI]);

  const runAI = async () => {
    setPhase('analyzing');
    setReason('');
    const r = await requestEstimate({ photos: store.photos, services: store.svcs, description: store.descText, regionMult: store.regionMult });
    if (r.ok) {
      // markup goes INTO the unit prices (region is already applied by requestEstimate)
      up((st) => ({ items: applyMarkup(r.items, st.marginRate ?? 0), confidence: r.confidence, aiNotes: r.notes, aiSig: (st.photos || []).map((p) => p.uri).join('|') }));
      setPhase('done');
    } else if ('error' in r) {
      setReason(r.error);
      setPhase('error');
    } else {
      setReason(r.reason);
      setPhase('rejected');
    }
  };

  useEffect(() => {
    if (needsAI && !ranRef.current) {
      ranRef.current = true;
      runAI();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const analyzing = phase === 'analyzing';
  const conf = Math.round(store.confidence || 0);
  const showEstimate = phase === 'done' || analyzing;
  const t = calcTotals(items, taxRate, 0); // markup is already embedded in the unit prices
  const [d, c] = split(t.total);
  // edit mode: persist the edited items back into the SAME estimate (trigger recomputes totals)
  const queryClient = useQueryClient();
  const [savingEdit, setSavingEdit] = useState(false);
  const saveEdit = async () => {
    if (!editJob) return;
    setSavingEdit(true);
    try {
      const note = (store.custNote || '').trim();
      await updateEstimateItems(editJob.estimateId, store.items, taxRate, marginRate, {
        customerNote: note || null,
        customerNoteSrc: (note && (store.custNoteSrc || '').trim()) || null, // no note → no original either
      });
      await queryClient.invalidateQueries({ queryKey: ['jobDetail', editJob.projectId] });
      await queryClient.invalidateQueries({ queryKey: ['jobs'] });
      back();
    } catch (e: any) {
      Alert.alert(tr('flow.couldNotSave'), e?.message || tr('flow.tryAgainPeriod'));
    } finally {
      setSavingEdit(false);
    }
  };

  // manual edit types the FINAL price — derive the pre-markup base so the stepper stays exact
  const priced = (patch: Partial<LineItem>): Partial<LineItem> =>
    patch.price !== undefined ? { ...patch, basePrice: deriveBase(patch.price, marginRate) } : patch;
  const updateItem = (id: number, patch: Partial<LineItem>) => up((st) => ({ items: st.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }));
  const removeItem = (id: number) => up((st) => ({ items: st.items.filter((it) => it.id !== id), editing: null }));
  const addItem = () => {
    // English literal, NOT tr(): this is persisted to line_items.description and prints on the
    // client's PDF/contract — the locked "client output is always English" rule. The editor opens
    // on it for the user to rename anyway (final-review L1).
    const it: LineItem = { id: Date.now(), cat: 'Labor', desc: 'New line item', qty: 1, unit: 'ea', price: 0, basePrice: 0, taxable: false };
    up((st) => ({ items: [...st.items, it], editing: it }));
  };

  return (
    <>
      <Nav title={tr('flow.estimate')} center onBack={back} />
      <ScrollView contentContainerStyle={scroll} showsVerticalScrollIndicator={false}>
        {/* AI status banner (hidden while editing an existing job — no AI run there) */}
        {editJob ? null : analyzing ? (
          <LinearGradient colors={[colors.primaryTint, colors.card]} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, borderRadius: radii.lg, padding: 16, borderWidth: 1, borderColor: colors.primaryTint2 }}>
            <ActivityIndicator color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.extrabold, fontSize: 14.5, color: colors.ink }}>{analyzed === 1 ? tr('flow.analyzingOnePhoto') : tr('flow.analyzingNPhotos', { n: analyzed })}</Text>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted, marginTop: 2 }}>{tr('flow.readingSurfaces')}</Text>
            </View>
          </LinearGradient>
        ) : phase === 'rejected' ? (
          <Card style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 13, padding: 16 }}>
            <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: colors.errorTint, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="flag" size={20} color={colors.error} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.extrabold, fontSize: 14.5, color: colors.ink }}>{tr('flow.notJobPhotos')}</Text>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted, marginTop: 3, lineHeight: 18 }}>{reason}</Text>
              <Btn variant="soft" sm icon="camera" title={tr('flow.retakePhotos')} onPress={back} style={{ marginTop: 12, alignSelf: 'flex-start', paddingHorizontal: 16 }} />
            </View>
          </Card>
        ) : phase === 'error' ? (
          <Card style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 13, padding: 16 }}>
            <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: colors.errorTint, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="flag" size={20} color={colors.error} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.extrabold, fontSize: 14.5, color: colors.ink }}>{tr('flow.couldNotGenerate')}</Text>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted, marginTop: 3, lineHeight: 18 }}>{reason}</Text>
              <Row style={{ gap: 10, marginTop: 12 }}>
                <Btn variant="soft" sm icon="sparkles" title={tr('flow.tryAgain')} onPress={runAI} style={{ paddingHorizontal: 16 }} />
                <Btn variant="ghost" sm title={tr('flow.starterEstimate')} onPress={() => { up((st) => ({ items: applyMarkup(buildStarterEstimate(st.svcs, st.regionMult), st.marginRate ?? 0), confidence: 0, aiNotes: tr('flow.starterEstimateNote'), aiSig: (st.photos || []).map((p) => p.uri).join('|') })); setPhase('done'); }} style={{ paddingHorizontal: 16 }} />
              </Row>
            </View>
          </Card>
        ) : (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 13, padding: 14 }}>
            <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="sparkles" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.extrabold, fontSize: 14.5, color: colors.ink }}>{analyzed === 1 ? tr('flow.aiAnalyzedOnePhoto') : tr('flow.aiAnalyzedNPhotos', { n: analyzed })}</Text>
              <Text numberOfLines={2} style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted, marginTop: 2, lineHeight: 17 }}>{store.aiNotes || tr('flow.reviewItemsBelow')}</Text>
            </View>
            {conf > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: 9, borderRadius: radii.pill, backgroundColor: colors.accentTint, borderWidth: 1, borderColor: colors.accentBorder }}>
                <Icon name="check" size={12} sw={2.6} color={colors.accentInk} />
                <Text style={{ fontFamily: fonts.extrabold, fontSize: 11, color: colors.accentInk }}>{tr('flow.confidencePct', { pct: conf })}</Text>
              </View>
            ) : null}
          </Card>
        )}

        {showEstimate ? (
        <>
        {/* hero total */}
        <View style={{ paddingHorizontal: 4, paddingTop: 22 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.4, color: colors.muted }}>{tr('flow.estimatedTotal')}</Text>
          {analyzing ? (
            <View style={{ height: 48, width: 220, marginTop: 10, borderRadius: 8, backgroundColor: '#EEF1F4' }} />
          ) : (
            <Text style={{ fontFamily: fonts.num, fontSize: 52, color: colors.ink, marginTop: 10, letterSpacing: -1.2 }}>
              {d}<Text style={{ color: colors.muted }}>{c}</Text>
            </Text>
          )}
          {!analyzing ? (
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, marginTop: 12 }}>
              {tr('flow.subtotal')} <Text style={{ fontFamily: fonts.bold, color: colors.ink }}>{fmt(t.subtotal)}</Text> · {tr('flow.taxLabel')} ({taxRate}%) <Text style={{ fontFamily: fonts.bold, color: colors.ink }}>{fmt(t.tax)}</Text>
            </Text>
          ) : null}
          {!analyzing && !editJob && store.regionMult !== 1 && store.aLoc ? (
            <Row style={{ gap: 6, marginTop: 8 }}>
              <Icon name="mapPin" size={13} color={colors.accentInk} />
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted }}>
                {tr('flow.regionalPricingApplied', { city: store.aLoc.city, sign: store.regionMult > 1 ? '+' : '', pct: Math.round((store.regionMult - 1) * 100) })}
              </Text>
            </Row>
          ) : null}
        </View>

        <SectionTitle title={tr('flow.lineItems')} link={tr('flow.add')} onLink={addItem} />
        {analyzing ? (
          <View style={{ gap: 10 }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={{ height: 84, borderRadius: radii.r, backgroundColor: '#EEF1F4' }} />
            ))}
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {items.map((it) => (
              <Pressable key={it.id} onPress={() => up({ editing: it })}>
                <Card style={{ padding: 14 }}>
                  <Between>
                    <CatChip label={it.cat} />
                    <Text style={{ fontFamily: fonts.extrabold, fontSize: 16, color: colors.ink }}>{fmt(it.qty * it.price)}</Text>
                  </Between>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink, marginTop: 9 }}>{it.desc}</Text>
                  <Between style={{ marginTop: 7 }}>
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted }}>{it.qty} {it.unit} × {fmt(it.price)}</Text>
                    <View style={{ paddingVertical: 4, paddingHorizontal: 9, borderRadius: radii.pill, backgroundColor: it.taxable ? colors.primaryTint : '#EEF1F4' }}>
                      <Text style={{ fontFamily: fonts.extrabold, fontSize: 11, color: it.taxable ? colors.primary : colors.faint }}>{it.taxable ? tr('flow.taxable') : tr('flow.noTax')}</Text>
                    </View>
                  </Between>
                </Card>
              </Pressable>
            ))}
          </View>
        )}

        {!analyzing ? (
          <Card pad style={{ marginTop: 16 }}>
            <Between>
              <Row style={{ gap: 9 }}>
                <Icon name="percent" size={17} color={colors.muted} />
                <Text style={{ fontFamily: fonts.extrabold, fontSize: 14, color: colors.ink }}>{tr('flow.taxRate')}</Text>
              </Row>
              <Stepper value={`${taxRate}%`} onMinus={() => up({ taxRate: Math.max(0, +(taxRate - 0.25).toFixed(2)) })} onPlus={() => up({ taxRate: +(taxRate + 0.25).toFixed(2) })} />
            </Between>
            <Divider />
            <Between>
              <Row style={{ gap: 9 }}>
                <Icon name="lock" size={16} color={colors.accentInk} />
                <View>
                  <Text style={{ fontFamily: fonts.extrabold, fontSize: 14, color: colors.ink }}>{tr('flow.internalMarkup')}</Text>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted }}>{tr('flow.hiddenFromClient')}</Text>
                </View>
              </Row>
              <Stepper
                value={`${marginRate}%`}
                onMinus={() => up((st) => { const next = Math.max(0, st.marginRate - 5); return { marginRate: next, items: applyMarkup(st.items, next) }; })}
                onPlus={() => up((st) => { const next = st.marginRate + 5; return { marginRate: next, items: applyMarkup(st.items, next) }; })}
              />
            </Between>
          </Card>
        ) : null}
        {!analyzing && marginRate > 0 ? (
          <Row style={{ gap: 6, marginTop: 10, paddingHorizontal: 6 }}>
            <Icon name="lock" size={12} color={colors.faint} />
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted }}>{tr('flow.markupIncluded')}</Text>
          </Row>
        ) : null}
        {!analyzing ? <ClientNoteCard /> : null}
        </>
        ) : null}
      </ScrollView>
      <View style={actionbar}>
        {editJob ? (
          <Btn title={savingEdit ? tr('flow.saving') : tr('flow.saveChanges')} icon={savingEdit ? undefined : 'check'} disabled={savingEdit} onPress={saveEdit} />
        ) : (
          <Btn title={tr('flow.continue')} icon="arrowRight" disabled={phase !== 'done'} onPress={() => go('attach', {})} />
        )}
      </View>

      <Sheet open={!!editing} onClose={() => up({ editing: null })} title={tr('flow.editItem')}>
        {editing ? (
          <ItemEditor
            it={editing}
            onChange={(p) => { const q = priced(p); updateItem(editing.id, q); up({ editing: { ...editing, ...q } }); }}
            onRemove={() => removeItem(editing.id)}
            onDone={() => up({ editing: null })}
          />
        ) : null}
      </Sheet>
    </>
  );
}

// Stepper moved to ../ui (shared with the Job screen's payment-plan sheet).

function ItemEditor({ it, onChange, onRemove, onDone }: { it: LineItem; onChange: (p: Partial<LineItem>) => void; onRemove: () => void; onDone: () => void }) {
  const t = useT();
  const cats = ['Labor', 'Materials', 'Service', 'Equipment'];
  return (
    <View>
      <Field label={t('flow.description')}><Input value={it.desc} onChangeText={(v) => onChange({ desc: v })} /></Field>
      <Field label={t('flow.category')}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {cats.map((cc) => <Chip key={cc} label={cc} selected={it.cat === cc} onPress={() => onChange({ cat: cc })} />)}
        </ScrollView>
      </Field>
      <Row style={{ gap: 10, alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}><Field label={t('flow.qty')}><DecimalInput value={it.qty} onChangeValue={(v) => onChange({ qty: v })} /></Field></View>
        <View style={{ flex: 1 }}><Field label={t('flow.unit')}><Input value={it.unit} onChangeText={(v) => onChange({ unit: v })} /></Field></View>
        <View style={{ flex: 1 }}><Field label={t('flow.unitPrice')}><DecimalInput value={it.price} onChangeValue={(v) => onChange({ price: v })} /></Field></View>
      </Row>
      <Between style={{ backgroundColor: colors.bg, borderRadius: radii.lg, padding: 16 }}>
        <View>
          <Text style={{ fontFamily: fonts.extrabold, fontSize: 14, color: colors.ink }}>{t('flow.taxable')}</Text>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted }}>{t('flow.applySalesTax')}</Text>
        </View>
        <Switch on={it.taxable} onPress={() => onChange({ taxable: !it.taxable })} />
      </Between>
      <Row style={{ gap: 10, marginTop: 16 }}>
        <Btn variant="danger" sm icon="trash" onPress={onRemove} style={{ width: 54 }} />
        <Btn title={t('flow.doneAmount', { amount: fmt(it.qty * it.price) })} onPress={onDone} style={{ flex: 1 }} />
      </Row>
    </View>
  );
}

/* ---------------- CLIENT NOTE (G1): prints on the quote / invoice / contract ---------------- */
// store.custNote is what gets SAVED as estimates.customer_note; store.custNoteSrc keeps the
// original wording when the note was translated (G1b). Clearing the note clears the original too.
function ClientNoteCard() {
  const t = useT();
  const { store, up } = useStore();
  return (
    <Card pad style={{ marginTop: 16 }}>
      <Row style={{ gap: 9, alignItems: 'flex-start' }}>
        <Icon name="msg" size={16} color={colors.muted} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.extrabold, fontSize: 14, color: colors.ink }}>{t('flow.notesForClient')}</Text>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, marginTop: 1 }}>{t('flow.printsOnDocs')}</Text>
        </View>
      </Row>
      <TextInput
        multiline
        maxLength={2000}
        placeholder={t('flow.notesPlaceholder')}
        placeholderTextColor={colors.faint}
        value={store.custNote || ''}
        onChangeText={(v) => up(v.trim() ? { custNote: v } : { custNote: v, custNoteSrc: '' })}
        style={{ minHeight: 72, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 13, fontSize: 14.5, fontFamily: fonts.semibold, color: colors.ink, marginTop: 12, textAlignVertical: 'top' }}
      />
      <NoteTranslator />
    </Card>
  );
}

// G1b: pt/es locale only — documents are always English, so offer an AI translation of the note.
// The result is shown for review (original read-only + editable English); one tap applies it.
// Any failure quietly keeps the text as written: translation is a helper, never a gate.
function NoteTranslator() {
  const t = useT();
  const { store, up } = useStore();
  const [mode, setMode] = useState<'idle' | 'busy' | 'review' | 'failed'>('idle');
  const [original, setOriginal] = useState('');
  const [english, setEnglish] = useState('');

  const note = (store.custNote || '').trim();
  const applied = !!(store.custNoteSrc || '').trim(); // a translation was already applied
  if (getLocale() === 'en') return null; // typing in English already — nothing to translate

  const run = async () => {
    const src = note;
    setMode('busy');
    const r = await translateNote(src);
    if (r.ok) {
      setOriginal(src);
      setEnglish(r.translated);
      setMode('review');
    } else {
      setMode('failed'); // discreet warning below; the note prints as written
    }
  };

  if (mode === 'review') {
    return (
      <View style={{ marginTop: 12 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.muted }}>{t('flow.originalLabel')}</Text>
        <View style={{ backgroundColor: colors.bg, borderRadius: 12, padding: 12, marginTop: 6 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.ink2, lineHeight: 19 }}>{original}</Text>
        </View>
        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.primary, marginTop: 12 }}>{t('flow.englishEditable')}</Text>
        <TextInput
          multiline
          value={english}
          onChangeText={setEnglish}
          style={{ minHeight: 72, borderRadius: 13, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.card, padding: 13, fontSize: 14.5, fontFamily: fonts.semibold, color: colors.ink, marginTop: 6, textAlignVertical: 'top' }}
        />
        <Row style={{ gap: 10, marginTop: 12 }}>
          <Btn variant="ghost" sm title={t('flow.keepMyText')} onPress={() => setMode('idle')} style={{ flex: 0.8 }} />
          <Btn sm icon="check" title={t('flow.useThis')} disabled={!english.trim()} onPress={() => { up({ custNote: english.trim(), custNoteSrc: original }); setMode('idle'); }} style={{ flex: 1 }} />
        </Row>
      </View>
    );
  }

  return (
    <View style={{ marginTop: 12 }}>
      {mode === 'failed' ? (
        <Row style={{ gap: 6, marginBottom: 8 }}>
          <Icon name="flag" size={12} color={colors.warning} />
          <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 12, color: colors.muted }}>{t('flow.translateFailed')}</Text>
        </Row>
      ) : null}
      {applied ? (
        <Text numberOfLines={2} style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, marginBottom: note ? 8 : 0 }}>
          {t('flow.translatedFrom', { orig: store.custNoteSrc })}
        </Text>
      ) : null}
      {note ? (
        mode === 'busy' ? (
          <Row style={{ gap: 8 }}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted }}>{t('flow.translating')}</Text>
          </Row>
        ) : (
          <LinkBtn icon="sparkles" title={t('flow.translateToEnglish')} onPress={run} />
        )
      ) : null}
    </View>
  );
}

/* ---------------- ATTACH CLIENT ---------------- */
export function AttachScreen({ go, back }: NavProp) {
  const t = useT();
  const { store, up } = useStore();
  // the job/clients belong to the OWNER account (Onda B) — same id as the user for a solo account
  const { ownerId } = useAuth();
  const queryClient = useQueryClient();
  const q = store.aQ || '';
  const sel = store.aSel;
  const loc = store.aLoc; // captured on the setup screen (for the project's city fallback)
  const [saving, setSaving] = useState(false);

  // search the user's REAL clients (was a mock list before)
  const { data: clients = [] } = useQuery({ queryKey: ['clients', ownerId], queryFn: () => fetchClients(ownerId!), enabled: !!ownerId });
  const ql = q.toLowerCase();
  const results = q
    ? clients.filter((c) => c.name.toLowerCase().includes(ql) || (c.phone || '').includes(q) || (c.email || '').toLowerCase().includes(ql))
    : [];
  // existing client → its real id; quick-add (name only) → create it first
  async function resolveClientId(): Promise<string | null> {
    if (!sel || !ownerId) return null;
    if (sel.id) return sel.id;
    const created = await createClient(ownerId, { name: sel.name || t('flow.newClient') });
    return created.id;
  }

  async function onSave(skipClient = false) {
    if (!store.items.length) { Alert.alert(t('flow.nothingToSaveTitle'), t('flow.nothingToSaveBody')); return; }
    if (!ownerId) { Alert.alert(t('flow.notSignedInTitle'), t('flow.notSignedInBody')); return; }
    setSaving(true);
    try {
      const clientId = skipClient ? null : await resolveClientId(); // client is optional
      const client = skipClient ? null : sel; // city fallback only — the address is the JOB SITE's
      // PERSISTED title is client-facing (contract "Project:", portal header) — locked rule:
      // everything the client sees is English. Screens translate for display on their own.
      const jobTitle = store.svcs[0] ? `${store.svcs[0]} job` : 'New quote';
      const { projectId } = await createJob({
        userId: ownerId,
        clientId,
        name: jobTitle,
        // G5: projects.address is the WORK address (typed/GPS). Fallback to the client's street
        // when the field is left empty — a legal document must never lose the address it used
        // to carry (reviewer finding: gallery flow without GPS would print a street-less contract).
        address: (store.jobStreet || '').trim() || client?.addr || undefined,
        city: loc?.city || client?.city || undefined,
        taxRate: store.taxRate ?? 8.25,
        marginRate: store.marginRate ?? 0,
        confidence: store.confidence,
        notes: store.aiNotes,
        customerNote: (store.custNote || '').trim() || undefined,
        customerNoteSrc: ((store.custNote || '').trim() && (store.custNoteSrc || '').trim()) || undefined,
        services: store.svcs,
        items: store.items,
        photos: store.photos,
        zip: store.aZip || undefined,
        state: store.regionState || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ['jobs'] });
      await queryClient.invalidateQueries({ queryKey: ['clients'] });
      up(FLOW_RESET); // the flow is over — clear it so nothing leaks into the next quote
      // pass the saved title along: the store is already reset, so the job header can't derive it
      go('job', { id: projectId, title: jobTitle }, 'reset'); // stack → [home, job]: back never re-enters the dead flow
    } catch (e: any) {
      Alert.alert(t('flow.couldNotSave'), e?.message || t('flow.tryAgainPeriod'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Kav>
      <Nav title={t('flow.addClient')} sub={t('flow.optionalDoLater')} center onBack={back} />
      <ScrollView contentContainerStyle={scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <SectionTitle title={t('flow.client')} />
        {!sel ? (
          <>
            <SearchBar placeholder={t('flow.searchClient')} value={q} onChangeText={(v) => up({ aQ: v })} />
            {results.length > 0 ? (
              <Card style={{ paddingHorizontal: 16, marginTop: 12 }}>
                {results.map((c, idx) => (
                  <Pressable key={c.id} onPress={() => up({ aSel: c })} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 14, borderBottomWidth: idx === results.length - 1 ? 0 : 1, borderBottomColor: colors.border }}>
                    <Avatar text={c.name.split(' ').map((w) => w[0]).slice(0, 2).join('')} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: fonts.extrabold, fontSize: 15, color: colors.ink }}>{c.name}</Text>
                      <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted, marginTop: 2 }}>{t('flow.nJobs', { phone: c.phone, jobs: c.jobs })}</Text>
                    </View>
                    <Icon name="plus" size={18} color={colors.primary} />
                  </Pressable>
                ))}
              </Card>
            ) : q ? (
              <Card pad style={{ marginTop: 12, alignItems: 'center' }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted }}>{t('flow.noClientNamed', { q })}</Text>
                <Row style={{ gap: 10, marginTop: 12 }}>
                  <Btn variant="soft" sm icon="zap" title={t('flow.addQuick')} onPress={() => up({ aSel: { name: q || t('flow.newClient'), quick: true } })} style={{ flex: 1 }} />
                  <Btn variant="ghost" sm title={t('flow.fullForm')} onPress={() => go('clientEdit', { from: 'attach' })} style={{ flex: 1 }} />
                </Row>
              </Card>
            ) : (
              <Row style={{ gap: 10, marginTop: 12 }}>
                <Btn variant="soft" sm icon="zap" title={t('flow.addQuick')} onPress={() => up({ aSel: { name: t('flow.newClient'), quick: true } })} style={{ flex: 1 }} />
                <Btn variant="ghost" sm icon="user" title={t('flow.fullForm')} onPress={() => go('clientEdit', { from: 'attach' })} style={{ flex: 1 }} />
              </Row>
            )}
          </>
        ) : (
          <Card pad>
            <Between>
              <Row style={{ gap: 12 }}>
                <Avatar text={sel.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('')} />
                <View>
                  <Text style={{ fontFamily: fonts.extrabold, fontSize: 16, color: colors.ink }}>{sel.name}</Text>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted }}>{sel.quick ? t('flow.quickAddNameOnly') : `${sel.phone} · ${sel.email}`}</Text>
                </View>
              </Row>
              <NavBtn icon="x" size={17} onPress={() => up({ aSel: null })} />
            </Between>
            {!sel.quick ? (
              <>
                <Divider />
                <Row style={{ gap: 6 }}>
                  <Icon name="mapPin" size={13} color={colors.muted} />
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted }}>{t('flow.pulledAutomatically', { addr: sel.addr, city: sel.city })}</Text>
                </Row>
              </>
            ) : null}
          </Card>
        )}

        {/* job-site address (G5): what prints on the documents — GPS pre-fills, always editable */}
        <SectionTitle title={t('flow.jobSiteAddress')} />
        <Input placeholder={t('flow.jobSitePlaceholder')} value={store.jobStreet || ''} onChangeText={(v) => up({ jobStreet: v })} />
        <Row style={{ marginTop: 9, justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 12, color: colors.muted }}>{t('flow.printsOnDocs')}</Text>
          {sel && !sel.quick && sel.addr ? <LinkBtn icon="user" title={t('flow.sameAsClientAddress')} onPress={() => up({ jobStreet: sel.addr })} /> : null}
        </Row>
        {loc ? (
          <Card pad style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.primaryTint, borderWidth: 0, marginTop: 12 }}>
            <Icon name="mapPin" size={17} color={colors.primary} />
            <Text style={{ flex: 1, fontFamily: fonts.extrabold, fontSize: 14, color: colors.ink }}>{loc.city}</Text>
            {store.regionMult !== 1 ? (
              <View style={{ paddingVertical: 5, paddingHorizontal: 9, borderRadius: radii.pill, backgroundColor: colors.accentTint, borderWidth: 1, borderColor: colors.accentBorder }}>
                <Text style={{ fontFamily: fonts.extrabold, fontSize: 11, color: colors.accentInk }}>{loc.region} {store.regionMult > 1 ? '+' : ''}{Math.round((store.regionMult - 1) * 100)}%</Text>
              </View>
            ) : null}
          </Card>
        ) : null}
      </ScrollView>
      <View style={actionbar}>
        <Row style={{ gap: 10 }}>
          <Btn variant="ghost" title={t('flow.skip')} disabled={saving} onPress={() => onSave(true)} style={{ flex: 0.55 }} />
          <Btn title={saving ? t('flow.saving') : t('flow.saveJob')} icon={saving ? undefined : 'arrowRight'} disabled={saving} onPress={() => onSave(false)} style={{ flex: 1 }} />
        </Row>
      </View>
    </Kav>
  );
}

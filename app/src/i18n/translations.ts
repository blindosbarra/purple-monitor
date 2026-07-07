export type Lang = 'en' | 'it'

export type RegionKey =
  | 'leftLegFront'
  | 'leftLegBack'
  | 'leftLegSide'
  | 'rightLegFront'
  | 'rightLegBack'
  | 'rightLegSide'
  | 'buttocks'
  | 'feet'
  | 'belly'
  | 'leftArmFront'
  | 'leftArmBack'
  | 'rightArmFront'
  | 'rightArmBack'
  | 'mouth'
  | 'arms' // legacy generic entry, kept so old photos still display
  | 'other'

// 'arms' is intentionally absent: it was replaced by the four specific
// arm regions. Old photos keep their label and can be re-filed.
export const REGION_KEYS: RegionKey[] = [
  'leftLegFront',
  'leftLegBack',
  'leftLegSide',
  'rightLegFront',
  'rightLegBack',
  'rightLegSide',
  'buttocks',
  'feet',
  'belly',
  'leftArmFront',
  'leftArmBack',
  'rightArmFront',
  'rightArmBack',
  'mouth',
  'other'
]

const en = {
  appName: 'Purple Monitor',
  disclaimer:
    'This app supports, but never replaces, medical care. Always follow your pediatrician’s advice.',

  navPhotos: 'Photos',
  navCompare: 'Compare',
  navDiary: 'Diary',
  navSettings: 'Settings',

  lockCreateTitle: 'Create a passphrase',
  lockCreateDesc:
    'All data (photos and diary) is encrypted on this phone with this passphrase and never leaves the device. If you forget it, the data cannot be recovered — write it down somewhere safe.',
  lockPassphrase: 'Passphrase',
  lockConfirm: 'Repeat passphrase',
  lockCreate: 'Create and start',
  lockUnlockTitle: 'Unlock',
  lockUnlock: 'Unlock',
  lockWrong: 'Wrong passphrase',
  lockMismatch: 'The passphrases do not match',
  lockTooShort: 'Use at least 6 characters',
  lockNow: 'Lock',

  photosTitle: 'Photo timeline',
  newPhoto: 'New photo',
  allRegions: 'All regions',
  moveRegion: 'Move to another region',
  photosEmpty: 'No photos yet. Take the first one with “New photo”.',
  deletePhotoConfirm: 'Delete this photo?',
  delete: 'Delete',
  close: 'Close',

  captureTitle: 'New photo',
  captureRegion: 'Body region',
  ghostHint: 'Align the leg with the faded previous photo',
  ghostToggle: 'Overlay',
  takePhoto: 'Take photo',
  retake: 'Retake',
  savePhoto: 'Save',
  cameraError: 'Camera not available here. You can import a photo instead.',
  importPhoto: 'Import photo',

  compareTitle: 'Compare days',
  compareNeedTwo: 'Take at least two photos of this region to compare them.',
  compareOlder: 'Older',
  compareNewer: 'Newer',
  compareSide: 'Side by side',
  compareSlider: 'Slider',

  regions: {
    leftLegFront: 'Left leg — front',
    leftLegBack: 'Left leg — back',
    leftLegSide: 'Left leg — side',
    rightLegFront: 'Right leg — front',
    rightLegBack: 'Right leg — back',
    rightLegSide: 'Right leg — side',
    buttocks: 'Buttocks',
    feet: 'Feet',
    belly: 'Belly',
    leftArmFront: 'Left arm — front',
    leftArmBack: 'Left arm — back',
    rightArmFront: 'Right arm — front',
    rightArmBack: 'Right arm — back',
    mouth: 'Mouth',
    arms: 'Arms',
    other: 'Other'
  } as Record<RegionKey, string>,

  analyze: 'Analyze spots',
  analyzing: 'Analyzing…',
  spots: 'Spots',
  affectedArea: 'Affected area',
  sizeSmall: 'Small',
  sizeMedium: 'Medium',
  sizeLarge: 'Large',
  newSpots: 'New',
  persistingSpots: 'Persisting',
  resolvedSpots: 'Resolved',
  compareStats: 'Change between the two dates',
  analysisDisclaimer:
    'Automatic estimate to help you follow changes — not a medical evaluation. Always check visually and correct with your own eyes.',

  diaryTitle: 'Urine & symptom diary',
  newEntry: 'New entry',
  date: 'Date',
  blood: 'Blood (hemoglobin)',
  protein: 'Protein',
  leukocytes: 'Leukocytes (optional)',
  nitrites: 'Nitrites (optional)',
  notMeasured: 'Not measured',
  levelNeg: 'Negative',
  levelTrace: 'Trace',
  levelP1: '+',
  levelP2: '++',
  levelP3: '+++',
  positive: 'Positive',
  symptomsLabel: 'Symptoms today',
  symptomAbdominal: 'Abdominal pain',
  symptomJoint: 'Joint pain / swelling',
  symptomRash: 'New spots / rash worse',
  symptomFever: 'Fever',
  meds: 'Medications given',
  notes: 'Notes',
  save: 'Save',
  cancel: 'Cancel',
  diaryEmpty: 'No entries yet.',
  deleteEntryConfirm: 'Delete this entry?',
  attention: 'Blood or protein in urine — share this result with your pediatrician.',
  testDue: 'A urine test is due — remember to test and record it.',

  settingsTitle: 'Settings',
  language: 'Language',
  reminderTitle: 'Urine test reminder',
  reminderDesc:
    'Choose how often the diary should remind you, following the schedule your pediatrician prescribed.',
  reminderLabels: {
    '0': 'Off',
    '1': 'Every day',
    '3': 'Every 3 days',
    '7': 'Every week',
    '14': 'Every 2 weeks',
    '30': 'Every month'
  } as Record<string, string>,
  securityTitle: 'Security',
  changePassTitle: 'Change passphrase',
  currentPass: 'Current passphrase',
  newPass: 'New passphrase',
  change: 'Change',
  passChanged: 'Passphrase changed.',
  passWrong: 'Current passphrase is wrong',
  backupTitle: 'Backup',
  backupDesc:
    'The backup file stays encrypted with your passphrase. Keep a copy off the phone so months of history are never lost.',
  exportBackup: 'Export backup',
  importBackup: 'Import backup',
  importConfirm: 'Importing replaces ALL current data with the backup. Continue?',
  importDone:
    'Backup imported. The app will now lock — unlock with the passphrase in use when the backup was made.',
  importError: 'This file is not a valid backup.',
  dangerTitle: 'Delete everything',
  wipe: 'Delete all data',
  wipeConfirm1: 'Delete ALL photos and diary entries from this phone?',
  wipeConfirm2: 'Are you sure? This cannot be undone.',
  aboutTitle: 'About & privacy',
  aboutText:
    'Purple Monitor works entirely on this device: no account, no cloud, no network. Photos and diary are encrypted with your passphrase. It is a tracking aid for IgA vasculitis follow-up, not a diagnostic tool.'
}

export type Dict = typeof en

const it: Dict = {
  appName: 'Purple Monitor',
  disclaimer:
    'Questa app supporta, ma non sostituisce mai, le cure mediche. Segui sempre le indicazioni del pediatra.',

  navPhotos: 'Foto',
  navCompare: 'Confronta',
  navDiary: 'Diario',
  navSettings: 'Impostazioni',

  lockCreateTitle: 'Crea una passphrase',
  lockCreateDesc:
    'Tutti i dati (foto e diario) sono cifrati su questo telefono con questa passphrase e non lasciano mai il dispositivo. Se la dimentichi, i dati non potranno essere recuperati: scrivila in un posto sicuro.',
  lockPassphrase: 'Passphrase',
  lockConfirm: 'Ripeti la passphrase',
  lockCreate: 'Crea e inizia',
  lockUnlockTitle: 'Sblocca',
  lockUnlock: 'Sblocca',
  lockWrong: 'Passphrase errata',
  lockMismatch: 'Le passphrase non coincidono',
  lockTooShort: 'Usa almeno 6 caratteri',
  lockNow: 'Blocca',

  photosTitle: 'Cronologia foto',
  newPhoto: 'Nuova foto',
  allRegions: 'Tutte le zone',
  moveRegion: "Sposta in un'altra zona",
  photosEmpty: 'Ancora nessuna foto. Scatta la prima con “Nuova foto”.',
  deletePhotoConfirm: 'Eliminare questa foto?',
  delete: 'Elimina',
  close: 'Chiudi',

  captureTitle: 'Nuova foto',
  captureRegion: 'Zona del corpo',
  ghostHint: 'Allinea la gamba con la foto precedente in trasparenza',
  ghostToggle: 'Sovrapposizione',
  takePhoto: 'Scatta',
  retake: 'Ripeti',
  savePhoto: 'Salva',
  cameraError: 'Fotocamera non disponibile qui. Puoi importare una foto.',
  importPhoto: 'Importa foto',

  compareTitle: 'Confronta i giorni',
  compareNeedTwo: 'Scatta almeno due foto di questa zona per confrontarle.',
  compareOlder: 'Più vecchia',
  compareNewer: 'Più recente',
  compareSide: 'Affiancate',
  compareSlider: 'Cursore',

  regions: {
    leftLegFront: 'Gamba sinistra — davanti',
    leftLegBack: 'Gamba sinistra — dietro',
    leftLegSide: 'Gamba sinistra — lato',
    rightLegFront: 'Gamba destra — davanti',
    rightLegBack: 'Gamba destra — dietro',
    rightLegSide: 'Gamba destra — lato',
    buttocks: 'Glutei',
    feet: 'Piedi',
    belly: 'Pancia',
    leftArmFront: 'Braccio sinistro — davanti',
    leftArmBack: 'Braccio sinistro — dietro',
    rightArmFront: 'Braccio destro — davanti',
    rightArmBack: 'Braccio destro — dietro',
    mouth: 'Bocca',
    arms: 'Braccia',
    other: 'Altro'
  },

  analyze: 'Analizza le macchie',
  analyzing: 'Analisi in corso…',
  spots: 'Macchie',
  affectedArea: 'Area interessata',
  sizeSmall: 'Piccole',
  sizeMedium: 'Medie',
  sizeLarge: 'Grandi',
  newSpots: 'Nuove',
  persistingSpots: 'Persistenti',
  resolvedSpots: 'Risolte',
  compareStats: 'Variazione tra le due date',
  analysisDisclaimer:
    'Stima automatica per aiutarti a seguire i cambiamenti — non è una valutazione medica. Controlla sempre anche a occhio.',

  diaryTitle: 'Diario urine e sintomi',
  newEntry: 'Nuova voce',
  date: 'Data',
  blood: 'Sangue (emoglobina)',
  protein: 'Proteine',
  leukocytes: 'Leucociti (facoltativo)',
  nitrites: 'Nitriti (facoltativo)',
  notMeasured: 'Non misurato',
  levelNeg: 'Negativo',
  levelTrace: 'Tracce',
  levelP1: '+',
  levelP2: '++',
  levelP3: '+++',
  positive: 'Positivo',
  symptomsLabel: 'Sintomi di oggi',
  symptomAbdominal: 'Dolore addominale',
  symptomJoint: 'Dolore/gonfiore articolare',
  symptomRash: 'Nuove macchie / eruzione peggiorata',
  symptomFever: 'Febbre',
  meds: 'Farmaci somministrati',
  notes: 'Note',
  save: 'Salva',
  cancel: 'Annulla',
  diaryEmpty: 'Ancora nessuna voce.',
  deleteEntryConfirm: 'Eliminare questa voce?',
  attention: 'Sangue o proteine nelle urine — condividi questo risultato con il pediatra.',
  testDue: 'È ora del test delle urine — ricordati di farlo e registrarlo.',

  settingsTitle: 'Impostazioni',
  language: 'Lingua',
  reminderTitle: 'Promemoria test urine',
  reminderDesc:
    'Scegli ogni quanto il diario deve ricordartelo, seguendo lo schema prescritto dal pediatra.',
  reminderLabels: {
    '0': 'Disattivato',
    '1': 'Ogni giorno',
    '3': 'Ogni 3 giorni',
    '7': 'Ogni settimana',
    '14': 'Ogni 2 settimane',
    '30': 'Ogni mese'
  },
  securityTitle: 'Sicurezza',
  changePassTitle: 'Cambia passphrase',
  currentPass: 'Passphrase attuale',
  newPass: 'Nuova passphrase',
  change: 'Cambia',
  passChanged: 'Passphrase cambiata.',
  passWrong: 'La passphrase attuale è errata',
  backupTitle: 'Backup',
  backupDesc:
    'Il file di backup resta cifrato con la tua passphrase. Conservane una copia fuori dal telefono per non perdere mesi di storico.',
  exportBackup: 'Esporta backup',
  importBackup: 'Importa backup',
  importConfirm: "L'importazione sostituisce TUTTI i dati attuali con il backup. Continuare?",
  importDone:
    "Backup importato. L'app ora si bloccherà: sbloccala con la passphrase in uso quando è stato creato il backup.",
  importError: 'Questo file non è un backup valido.',
  dangerTitle: 'Elimina tutto',
  wipe: 'Elimina tutti i dati',
  wipeConfirm1: 'Eliminare TUTTE le foto e le voci del diario da questo telefono?',
  wipeConfirm2: 'Sei sicuro? Non si può annullare.',
  aboutTitle: 'Informazioni e privacy',
  aboutText:
    'Purple Monitor funziona interamente su questo dispositivo: nessun account, nessun cloud, nessuna rete. Foto e diario sono cifrati con la tua passphrase. È un aiuto per il monitoraggio della vasculite da IgA, non uno strumento diagnostico.'
}

export const translations: Record<Lang, Dict> = { en, it }
